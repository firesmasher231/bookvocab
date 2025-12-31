import { createElement, hapticFeedback, showToast } from "../utils/helpers.js";
import {
	initScanner,
	stopScanner,
	isCameraAvailable,
	requestCameraPermission,
} from "../services/scanner.js";
import { fetchBookByISBN } from "../services/books.js";
import { addBook } from "../services/db.js";
import { fadeInUp, fadeOutDown } from "../utils/animations.js";
import { appState } from "../js/state.js";
import Quagga from "@ericblade/quagga2";

/**
 * Create barcode scanner component
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Component interface
 */
export function createBarcodeScanner(container) {
	let scannerActive = false;
	let lastScannedISBN = null;
	let scanTimeout = null;

	const component = createElement("div", {
		className: "barcode-scanner-container",
		id: "barcode-scanner",
	});

	/**
	 * Show scanner
	 */
	async function show() {
		component.innerHTML = "";

		// On iOS Safari, enumerateDevices requires permission first
		// So we skip the availability check and go straight to requesting permission
		// The getUserMedia call will fail if there's no camera

		// Request permission (this also checks availability on iOS)
		const hasPermission = await requestCameraPermission();
		if (!hasPermission) {
			showCameraPermissionError();
			return;
		}

		// Create scanner UI
		const scannerCard = createElement("div", {
			className: "card relative overflow-hidden",
		});

		// Header
		const header = createElement("div", {
			className: "flex justify-between items-center mb-4",
		});

		const title = createElement(
			"h3",
			{
				className: "text-lg font-semibold text-gray-900",
			},
			"Scan Book Barcode"
		);
		header.appendChild(title);

		const closeBtn = createElement("button", {
			className: "p-2 text-gray-600 hover:text-gray-900 transition-colors",
			"aria-label": "Close scanner",
			onClick: () => {
				hapticFeedback("light");
				// Stop camera immediately when dismissed
				if (scannerActive) {
					stopScanner();
					scannerActive = false;
					appState.set("scannerActive", false);
				}
				hide();
			},
		});
		closeBtn.innerHTML = `
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
		header.appendChild(closeBtn);

		scannerCard.appendChild(header);

		// Video container - MUST be a direct container for QuaggaJS (hidden by default)
		const videoContainer = createElement("div", {
			id: "scanner-video-container",
			className: "relative bg-black rounded-lg overflow-hidden mb-4",
			style: "min-height: 300px; width: 100%; display: none;",
		});

		scannerCard.appendChild(videoContainer);

		// Overlay guide (added separately to avoid interfering with Quagga)
		const overlay = createElement("div", {
			className: "absolute pointer-events-none",
			style: `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        height: 60%;
        border: 3px solid rgba(67, 233, 123, 0.8);
        border-radius: 12px;
        z-index: 10;
      `,
		});
		videoContainer.appendChild(overlay);

		// Instructions (hidden by default)
		const instructions = createElement(
			"p",
			{
				className: "text-sm text-gray-600 text-center mb-4",
				style: "display: none;",
			},
			"Position the barcode within the frame"
		);
		scannerCard.appendChild(instructions);

		// Image upload section (Primary option)
		const uploadSection = createElement("div", {
			className: "mb-4",
			style:
				"border-top: 1px solid rgba(0, 0, 0, 0.06); padding-top: 1rem; margin-top: 1rem;",
		});

		const uploadLabel = createElement(
			"p",
			{
				className: "text-sm font-medium text-gray-700 text-center mb-2",
			},
			"📸 Or upload a photo of the barcode:"
		);
		uploadSection.appendChild(uploadLabel);

		const uploadBtn = createElement(
			"button",
			{
				className: "btn-primary",
				style: "width: 100%; padding: 1rem; font-size: 1rem;",
				onClick: () => fileInput.click(),
			},
			"📷 Upload Image"
		);

		const fileInput = createElement("input", {
			type: "file",
			accept: "image/*",
			// Removed capture attribute - let user choose between camera or gallery
			style: "display: none;",
			onChange: async (e) => {
				const file = e.target.files[0];
				if (file) {
					await handleImageUpload(file);
				}
			},
		});

		uploadSection.appendChild(fileInput);
		uploadSection.appendChild(uploadBtn);
		scannerCard.appendChild(uploadSection);

		// Toggle for live scanner
		const toggleLiveScanner = createElement(
			"button",
			{
				className: "text-sm text-primary text-center w-full mt-2 underline",
				style:
					"background: none; border: none; cursor: pointer; padding: 0.5rem;",
				onClick: () => {
					const isHidden = videoContainer.style.display === "none";
					videoContainer.style.display = isHidden ? "block" : "none";
					instructions.style.display = isHidden ? "block" : "none";
					toggleLiveScanner.textContent = isHidden
						? "📸 Use photo upload instead"
						: "📹 Use live scanner instead";

					if (isHidden && !scannerActive) {
						// Initialize scanner when showing
						initializeLiveScanner();
					} else if (!isHidden && scannerActive) {
						// Stop scanner when hiding
						stopScanner();
						scannerActive = false;
					}
				},
			},
			"📹 Use live scanner instead"
		);
		uploadSection.appendChild(toggleLiveScanner);

		// Manual entry section
		const manualEntry = createElement("div", {
			className: "mb-4",
			style:
				"border-top: 1px solid rgba(0, 0, 0, 0.06); padding-top: 1rem; margin-top: 1rem;",
		});

		const manualLabel = createElement(
			"p",
			{
				className: "text-sm text-gray-600 text-center mb-2",
			},
			"Or enter ISBN:"
		);
		manualEntry.appendChild(manualLabel);

		const manualInputWrapper = createElement("div", {
			style: "display: flex; gap: 0.5rem; align-items: center;",
		});

		const isbnInput = createElement("input", {
			type: "text",
			placeholder: "978-0-123456-78-9",
			className: "input-field",
			style: "flex: 1; text-align: center; font-size: 0.9375rem;",
		});

		const submitBtn = createElement(
			"button",
			{
				className: "btn-primary",
				style: "padding: 0.875rem 1.5rem;",
				onClick: async () => {
					const isbn = isbnInput.value.trim().replace(/[-\s]/g, "");
					if (isbn.length >= 10) {
						hapticFeedback("medium");
						await handleManualISBN(isbn);
					} else {
						showToast("Please enter a valid ISBN");
					}
				},
			},
			"Add Book"
		);

		manualInputWrapper.appendChild(isbnInput);
		manualInputWrapper.appendChild(submitBtn);
		manualEntry.appendChild(manualInputWrapper);
		scannerCard.appendChild(manualEntry);

		// Status
		const status = createElement("div", {
			id: "scanner-status",
			className: "text-center text-sm",
			style: "min-height: 1.5rem;",
		});
		status.innerHTML = '<span class="text-gray-500">Ready to scan</span>';
		scannerCard.appendChild(status);

		// Tips
		const tips = createElement("div", {
			className: "text-xs text-gray-500 text-center mt-2",
			style: "line-height: 1.4;",
		});
		tips.innerHTML = `
      <strong>💡 Tip:</strong> For best results, upload a clear photo of the barcode
    `;
		scannerCard.appendChild(tips);

		component.appendChild(scannerCard);
		container.appendChild(component);

		fadeInUp(scannerCard);

		// Function to initialize live scanner
		async function initializeLiveScanner() {
			try {
				console.log("[BarcodeScanner] Initializing scanner...");
				// Get the actual video container element (not the wrapper)
				const videoElement = document.getElementById("scanner-video-container");

				if (!videoElement) {
					console.error("[BarcodeScanner] Video container not found!");
					throw new Error("Video container not found");
				}

				console.log("[BarcodeScanner] Video container found:", videoElement);

				await initScanner(
					videoElement,
					handleBarcodeDetected,
					handleScannerError
				);

				scannerActive = true;
				status.innerHTML = '<span class="text-success">✓ Ready to scan</span>';
				appState.set("scannerActive", true);
				console.log("[BarcodeScanner] Scanner ready!");
			} catch (error) {
				console.error("[BarcodeScanner] Initialization error:", error);
				handleScannerError(error);
			}
		}

		// Don't initialize scanner by default - let user choose upload or live scan
	}

	/**
	 * Hide scanner
	 */
	async function hide() {
		if (scannerActive) {
			stopScanner();
			scannerActive = false;
			appState.set("scannerActive", false);
		}

		if (scanTimeout) {
			clearTimeout(scanTimeout);
			scanTimeout = null;
		}

		const scannerCard = component.querySelector(".card");
		if (scannerCard) {
			await fadeOutDown(scannerCard);
		}

		component.innerHTML = "";
	}

	/**
	 * Handle manual ISBN entry
	 */
	async function handleManualISBN(isbn) {
		const status = document.getElementById("scanner-status");
		if (status) {
			status.innerHTML =
				'<span class="text-primary">Fetching book info...</span>';
		}

		try {
			// Fetch book metadata
			const bookData = await fetchBookByISBN(isbn);

			if (!bookData) {
				status.innerHTML =
					'<span class="text-error">Book not found. Please check the ISBN.</span>';
				showToast("Book not found");
				return;
			}

			// Add book to database
			const savedBook = await addBook(bookData);

			showToast(`Added: ${savedBook.title}`);
			status.innerHTML = `<span class="text-success">Added: ${savedBook.title}</span>`;

			// Stop camera immediately
			if (scannerActive) {
				stopScanner();
				scannerActive = false;
				appState.set("scannerActive", false);
			}

			// Close scanner after 1.5 seconds
			setTimeout(() => {
				hide();
				// Refresh books view if active
				if (appState.get("currentView") === "books") {
					if (window.refreshBooksList) window.refreshBooksList();
				}
			}, 1500);
		} catch (error) {
			console.error("Failed to fetch/save book:", error);
			status.innerHTML =
				'<span class="text-error">Failed to fetch book info. Try again.</span>';
			showToast("Failed to fetch book info");
		}
	}

	/**
	 * Handle image upload and decode barcode from it
	 */
	async function handleImageUpload(file) {
		console.log("[BarcodeScanner] Processing uploaded image...", file);
		hapticFeedback("light");

		// Show loading state
		const statusEl = document.getElementById("scanner-status");
		if (statusEl) {
			statusEl.innerHTML =
				'<span class="text-primary">🔍 Scanning image...</span>';
		}

		try {
			// Create image URL from file
			const imageUrl = URL.createObjectURL(file);
			console.log("[BarcodeScanner] Created image URL:", imageUrl);

			// Create an image element to get dimensions
			const img = new Image();
			img.src = imageUrl;

			await new Promise((resolve, reject) => {
				img.onload = () => {
					console.log(
						"[BarcodeScanner] Image loaded:",
						img.width,
						"x",
						img.height
					);
					resolve();
				};
				img.onerror = reject;
			});

			console.log("[BarcodeScanner] Starting Quagga decode...");

			// Use Quagga to decode the image
			Quagga.decodeSingle(
				{
					src: imageUrl,
					numOfWorkers: 0, // Use main thread for single decode
					decoder: {
						readers: [
							"ean_reader",
							"ean_8_reader",
							"code_128_reader",
							"upc_reader",
							"upc_e_reader",
							"code_39_reader",
							"code_39_vin_reader",
							"codabar_reader",
							"i2of5_reader",
						],
						multiple: false,
					},
					locate: true,
					locator: {
						patchSize: "large", // Use large for better detection on images
						halfSample: false, // Don't reduce quality for static images
					},
					inputStream: {
						size: Math.max(img.width, img.height), // Use full resolution
					},
				},
				(result) => {
					console.log("[BarcodeScanner] Quagga result:", result);

					// Clean up
					URL.revokeObjectURL(imageUrl);

					if (result && result.codeResult) {
						console.log(
							"[BarcodeScanner] Barcode found in image:",
							result.codeResult.code
						);
						console.log("[BarcodeScanner] Format:", result.codeResult.format);

						// Validate and process the ISBN
						const code = result.codeResult.code;
						const cleanCode = code.replace(/[^0-9X]/gi, "");

						console.log("[BarcodeScanner] Cleaned code:", cleanCode);

						if (cleanCode.length >= 10) {
							handleBarcodeDetected({ isbn: cleanCode });
						} else {
							if (statusEl) {
								statusEl.innerHTML =
									'<span class="text-error">❌ Invalid barcode</span>';
							}
							showToast(`Invalid ISBN: ${cleanCode} (too short)`);
						}
					} else {
						console.log("[BarcodeScanner] No barcode found in image");
						if (statusEl) {
							statusEl.innerHTML =
								'<span class="text-error">❌ No barcode detected</span>';
						}
						showToast(
							"No barcode found. Try: 1) Better lighting 2) Crop closer to barcode 3) Manual entry"
						);
					}
				}
			);
		} catch (error) {
			console.error("[BarcodeScanner] Image upload error:", error);
			const statusEl = document.getElementById("scanner-status");
			if (statusEl) {
				statusEl.innerHTML =
					'<span class="text-error">❌ Error processing image</span>';
			}
			showToast("Error processing image. Please try again.");
		}
	}

	/**
	 * Handle barcode detection
	 */
	async function handleBarcodeDetected(result) {
		console.log("[BarcodeScanner] Barcode detected!", result);
		const { isbn } = result;

		// Prevent duplicate scans
		if (isbn === lastScannedISBN) {
			return;
		}

		lastScannedISBN = isbn;
		hapticFeedback("heavy");

		const status = document.getElementById("scanner-status");
		if (status) {
			status.innerHTML =
				'<span class="text-primary">Barcode detected! Fetching book info...</span>';
		}

		try {
			// Fetch book metadata
			const bookData = await fetchBookByISBN(isbn);

			if (!bookData) {
				status.innerHTML =
					'<span class="text-error">Book not found. Try another barcode.</span>';
				resetScanTimeout();
				return;
			}

			// Add book to database
			const savedBook = await addBook(bookData);

			showToast(`Added: ${savedBook.title}`);
			status.innerHTML = `<span class="text-success">Added: ${savedBook.title}</span>`;

			// Stop camera immediately
			if (scannerActive) {
				stopScanner();
				scannerActive = false;
				appState.set("scannerActive", false);
			}

			// Close scanner after 1.5 seconds
			setTimeout(() => {
				hide();
				// Refresh books view if active
				if (appState.get("currentView") === "books") {
					if (window.refreshBooksList) window.refreshBooksList();
				}
			}, 1500);
		} catch (error) {
			console.error("Failed to fetch/save book:", error);
			status.innerHTML =
				'<span class="text-error">Failed to fetch book info. Try again.</span>';
			resetScanTimeout();
		}
	}

	/**
	 * Reset scan timeout to allow rescanning
	 */
	function resetScanTimeout() {
		if (scanTimeout) clearTimeout(scanTimeout);

		scanTimeout = setTimeout(() => {
			lastScannedISBN = null;
			const status = document.getElementById("scanner-status");
			if (status) {
				status.innerHTML = '<span class="text-success">Ready to scan</span>';
			}
		}, 3000);
	}

	/**
	 * Handle scanner errors
	 */
	function handleScannerError(error) {
		console.error("Scanner error:", error);

		const status = document.getElementById("scanner-status");
		if (status) {
			status.innerHTML = `<span class="text-error">${error.message}</span>`;
		}

		showToast(error.message, "error");
	}

	/**
	 * Show camera permission error UI
	 */
	function showCameraPermissionError() {
		component.innerHTML = "";

		const errorCard = createElement("div", {
			className: "card text-center",
		});

		const icon = createElement("div", {
			className: "text-error mb-4",
		});
		icon.innerHTML = `
      <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    `;
		errorCard.appendChild(icon);

		const title = createElement(
			"h3",
			{
				className: "text-lg font-semibold text-gray-900 mb-2",
			},
			"Camera Access Required"
		);
		errorCard.appendChild(title);

		const message = createElement("p", {
			className: "text-gray-600 mb-4",
			style: "line-height: 1.6;",
		});

		// Provide iOS-specific instructions
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
		const isHTTPS =
			window.location.protocol === "https:" ||
			window.location.hostname === "localhost";

		if (!isHTTPS) {
			message.innerHTML = `
        <strong>HTTPS Required:</strong><br>
        Camera access requires a secure connection (HTTPS).<br>
        The app will only work on localhost or HTTPS domains.
      `;
		} else if (isIOS) {
			message.innerHTML = `
        <strong>On iOS Safari:</strong><br>
        1. Tap the camera icon when prompted<br>
        2. Or go to Settings → Safari → Camera<br>
        3. Select "Ask" or "Allow"<br>
        4. Reload this page and try again
      `;
		} else {
			message.textContent =
				"Please allow camera access when prompted, or check your browser settings. You may need to reload the page after granting permission.";
		}
		errorCard.appendChild(message);

		const closeBtn = createElement(
			"button",
			{
				className: "btn-primary",
				onClick: () => {
					component.innerHTML = "";
				},
			},
			"Close"
		);
		errorCard.appendChild(closeBtn);

		component.appendChild(errorCard);
		container.appendChild(component);
		fadeInUp(errorCard);
	}

	return {
		show,
		hide,
		isActive: () => scannerActive,
	};
}
