import Quagga from "@ericblade/quagga2";

/*
 * Barcode scanning for book ISBNs.
 *
 * Two engines are supported:
 *  - The browser's native BarcodeDetector (Chrome/Edge on Android, ChromeOS,
 *    macOS). It is fast and accurate, so it is preferred when it can read EAN-13.
 *  - Quagga2 as a fallback everywhere else (iOS Safari, Firefox, desktop).
 *
 * Every read is validated as a real ISBN (978/979 prefix + checksum), and the
 * Quagga path additionally requires the same code on consecutive reads, which
 * filters out the occasional misread digit.
 */

let isInitialized = false;
let detectionCallback = null;
let engine = null; // "native" | "quagga"
let nativeStream = null;
let nativeVideo = null;
let nativeLoopHandle = null;
let quaggaHits = new Map();

/* ------------------------------------------------------------------ */
/* ISBN helpers                                                        */
/* ------------------------------------------------------------------ */

function isValidIsbn13(code) {
	if (!/^97[89]\d{10}$/.test(code)) return false;
	let sum = 0;
	for (let i = 0; i < 12; i++) {
		sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
	}
	return (10 - (sum % 10)) % 10 === Number(code[12]);
}

function isValidIsbn10(code) {
	if (!/^\d{9}[\dX]$/i.test(code)) return false;
	let sum = 0;
	for (let i = 0; i < 10; i++) {
		const c = code[i].toUpperCase();
		sum += (c === "X" ? 10 : Number(c)) * (10 - i);
	}
	return sum % 11 === 0;
}

/**
 * Turn a raw barcode value into a valid ISBN, or null if it is not one.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeIsbn(raw) {
	if (!raw) return null;
	const code = String(raw).replace(/[^0-9X]/gi, "").toUpperCase();
	if (code.length === 13 && isValidIsbn13(code)) return code;
	if (code.length === 10 && isValidIsbn10(code)) return code;
	return null;
}

/* ------------------------------------------------------------------ */
/* Native BarcodeDetector                                              */
/* ------------------------------------------------------------------ */

let nativeDetectorPromise = null;

/**
 * Returns a BarcodeDetector that can read EAN-13, or null if unsupported.
 */
function getNativeDetector() {
	if (nativeDetectorPromise) return nativeDetectorPromise;
	nativeDetectorPromise = (async () => {
		try {
			if (!("BarcodeDetector" in window)) return null;
			const formats = await window.BarcodeDetector.getSupportedFormats();
			if (!formats.includes("ean_13")) return null;
			const wanted = ["ean_13", "upc_a", "code_128"].filter((f) =>
				formats.includes(f)
			);
			return new window.BarcodeDetector({ formats: wanted });
		} catch (err) {
			console.warn("[Scanner] BarcodeDetector unavailable:", err);
			return null;
		}
	})();
	return nativeDetectorPromise;
}

async function startNative(target, detector) {
	nativeStream = await navigator.mediaDevices.getUserMedia({
		video: {
			facingMode: { ideal: "environment" },
			width: { ideal: 1280 },
			height: { ideal: 720 },
		},
		audio: false,
	});

	nativeVideo = document.createElement("video");
	nativeVideo.setAttribute("playsinline", "");
	nativeVideo.setAttribute("autoplay", "");
	nativeVideo.muted = true;
	nativeVideo.srcObject = nativeStream;
	target.appendChild(nativeVideo);
	await nativeVideo.play();

	let busy = false;
	const tick = async () => {
		if (!isInitialized || engine !== "native") return;
		if (!busy && nativeVideo.readyState >= 2) {
			busy = true;
			try {
				const codes = await detector.detect(nativeVideo);
				for (const c of codes) {
					const isbn = normalizeIsbn(c.rawValue);
					if (isbn) {
						emit(isbn);
						break;
					}
				}
			} catch (err) {
				// Transient decode errors are fine; keep looping.
			}
			busy = false;
		}
		nativeLoopHandle = setTimeout(tick, 150);
	};
	tick();
}

function stopNative() {
	if (nativeLoopHandle) clearTimeout(nativeLoopHandle);
	nativeLoopHandle = null;
	if (nativeStream) nativeStream.getTracks().forEach((t) => t.stop());
	nativeStream = null;
	if (nativeVideo) {
		nativeVideo.srcObject = null;
		nativeVideo.remove();
	}
	nativeVideo = null;
}

/* ------------------------------------------------------------------ */
/* Quagga fallback                                                     */
/* ------------------------------------------------------------------ */

function startQuagga(target) {
	const config = {
		inputStream: {
			name: "Live",
			type: "LiveStream",
			target,
			constraints: {
				// Keep these loose: strict min/aspectRatio constraints fail with
				// OverconstrainedError on many phones held in portrait.
				facingMode: "environment",
				width: { ideal: 1280 },
				height: { ideal: 720 },
			},
		},
		decoder: {
			// Book barcodes are EAN-13. Extra readers only add false positives.
			readers: ["ean_reader"],
			multiple: false,
		},
		locator: {
			patchSize: "medium",
			halfSample: true,
		},
		numOfWorkers: 0,
		frequency: 10,
		locate: true,
	};

	return new Promise((resolve, reject) => {
		Quagga.init(config, (err) => {
			if (err) {
				reject(err);
				return;
			}
			quaggaHits = new Map();
			Quagga.onDetected(handleQuaggaDetection);
			Quagga.start();
			resolve();
		});
	});
}

function handleQuaggaDetection(result) {
	const isbn = normalizeIsbn(result?.codeResult?.code);
	if (!isbn) return;

	// Require two matching reads to rule out a single misread frame.
	const count = (quaggaHits.get(isbn) || 0) + 1;
	quaggaHits.set(isbn, count);
	if (count >= 2) {
		quaggaHits.clear();
		emit(isbn);
	}
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function emit(isbn) {
	console.log("[Scanner] ISBN detected:", isbn);
	if (detectionCallback) {
		detectionCallback({
			isbn,
			format: isbn.length === 13 ? "ISBN-13" : "ISBN-10",
		});
	}
}

/**
 * Initialize and start the live barcode scanner.
 * @param {HTMLElement} target - Container the camera feed is rendered into
 * @param {Function} onDetected - Called with { isbn, format }
 * @param {Function} onError - Called with an Error
 */
export async function initScanner(target, onDetected, onError) {
	if (isInitialized) {
		console.warn("Scanner already initialized");
		return;
	}

	detectionCallback = onDetected;
	isInitialized = true;

	try {
		const detector = await getNativeDetector();
		if (detector) {
			engine = "native";
			await startNative(target, detector);
			console.log("[Scanner] Using native BarcodeDetector");
		} else {
			engine = "quagga";
			await startQuagga(target);
			console.log("[Scanner] Using Quagga2");
		}
	} catch (error) {
		console.error("[Scanner] Failed to start:", error);
		stopScanner();
		const denied =
			error?.name === "NotAllowedError" ||
			error?.name === "PermissionDeniedError";
		const err = new Error(
			denied
				? "Camera permission denied. Please allow camera access to scan barcodes."
				: "Could not start the camera. Try uploading a photo instead."
		);
		onError(err);
		throw err;
	}
}

/**
 * Stop the live scanner and release the camera.
 */
export function stopScanner() {
	if (!isInitialized) return;
	console.log("[Scanner] Stopping scanner");

	if (engine === "native") {
		stopNative();
	} else if (engine === "quagga") {
		try {
			Quagga.offDetected(handleQuaggaDetection);
			Quagga.stop();
		} catch (err) {
			console.warn("[Scanner] Quagga stop error:", err);
		}
	}

	engine = null;
	isInitialized = false;
	detectionCallback = null;
}

/**
 * Decode an ISBN barcode from an image file.
 * @param {File|Blob} file
 * @returns {Promise<string|null>} The ISBN, or null if none was found
 */
export async function decodeImageFile(file) {
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();

		// 1. Native detector, if available.
		const detector = await getNativeDetector();
		if (detector) {
			try {
				const codes = await detector.detect(img);
				for (const c of codes) {
					const isbn = normalizeIsbn(c.rawValue);
					if (isbn) return isbn;
				}
			} catch (err) {
				console.warn("[Scanner] Native image decode failed:", err);
			}
		}

		// 2. Quagga at a few sizes. Phone photos are huge, and Quagga's locator
		// works best around 800-1600px, so try several before giving up.
		const longest = Math.max(img.naturalWidth, img.naturalHeight);
		const sizes = [800, 1280, 1600, 640].filter((s) => s <= longest);
		if (sizes.length === 0) sizes.push(longest);

		for (const size of sizes) {
			for (const patchSize of ["medium", "large"]) {
				const isbn = await quaggaDecodeSingle(url, size, patchSize);
				if (isbn) return isbn;
			}
		}
		return null;
	} finally {
		URL.revokeObjectURL(url);
	}
}

function quaggaDecodeSingle(src, size, patchSize) {
	return new Promise((resolve) => {
		try {
			Quagga.decodeSingle(
				{
					src,
					numOfWorkers: 0,
					inputStream: { size },
					decoder: { readers: ["ean_reader"], multiple: false },
					locate: true,
					locator: { patchSize, halfSample: false },
				},
				(result) => resolve(normalizeIsbn(result?.codeResult?.code))
			);
		} catch (err) {
			console.warn("[Scanner] Quagga decodeSingle error:", err);
			resolve(null);
		}
	});
}

/**
 * Check if a camera is available.
 * @returns {Promise<boolean>}
 */
export async function isCameraAvailable() {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.some((device) => device.kind === "videoinput");
	} catch (error) {
		return false;
	}
}

/**
 * @returns {boolean} Whether the live scanner is running
 */
export function isScannerActive() {
	return isInitialized;
}

/**
 * Ask for camera permission, then release the camera immediately.
 * @returns {Promise<boolean>}
 */
export async function requestCameraPermission() {
	if (!navigator.mediaDevices?.getUserMedia) return false;
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: "environment" },
		});
		stream.getTracks().forEach((track) => track.stop());
		return true;
	} catch (error) {
		console.error("Camera permission error:", error.name, error);
		return false;
	}
}
