import { createElement, hapticFeedback, showToast } from "../utils/helpers.js";
import {
	initScanner,
	stopScanner,
	decodeImageFile,
	normalizeIsbn,
} from "../services/scanner.js";
import { fetchBookByISBN, formatISBN } from "../services/books.js";
import { addBook, getBookByISBN } from "../services/db.js";
import { setActiveBook } from "../js/activeBook.js";

/*
 * Full-screen barcode scanner.
 *
 *   scan    -> live camera fills the screen, glass controls float on top
 *   lookup  -> barcode found, fetching the book
 *   confirm -> cover art fills the screen, details overlaid on a gradient,
 *              "Add this book" / "Scan again"
 *   missing -> ISBN read but no book found
 */

let current = null; // the open scanner, if any

const ICON = {
	close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
	photo: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>`,
	keyboard: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg>`,
	back: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>`,
};

/**
 * Open the full-screen scanner.
 * @param {Object} [options]
 * @param {Function} [options.onAdded] - Called with the saved book
 */
export function openScanner(options = {}) {
	if (current) return current;

	const root = createElement("div", {
		className: "scanner-modal",
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "Scan a book barcode",
	});
	const prevOverflow = document.body.style.overflow;
	document.body.style.overflow = "hidden";

	let liveRunning = false;
	let busy = false;
	let closed = false;

	/* ---------- Scan screen ---------- */

	const scanScreen = createElement("div", { className: "scan-screen" });

	const feed = createElement("div", {
		className: "scan-feed",
		id: "scanner-video-container",
	});
	scanScreen.appendChild(feed);

	const shade = createElement("div", { className: "scan-shade", "aria-hidden": "true" });
	const frame = createElement("div", { className: "scan-frame" });
	frame.appendChild(createElement("div", { className: "scan-line" }));
	shade.appendChild(frame);
	scanScreen.appendChild(shade);

	const top = createElement("div", { className: "scan-top" });
	const closeBtn = createElement("button", {
		type: "button",
		className: "glass-btn glass-icon",
		"aria-label": "Close scanner",
		onClick: () => close(),
	});
	closeBtn.innerHTML = ICON.close;
	top.appendChild(closeBtn);
	top.appendChild(createElement("div", { className: "glass-chip scan-title" }, "Scan a book"));
	top.appendChild(createElement("div", { style: "width: 44px;" }));
	scanScreen.appendChild(top);

	const hint = createElement(
		"div",
		{ className: "glass-chip scan-hint", role: "status", "aria-live": "polite" },
		"Starting camera…"
	);
	scanScreen.appendChild(hint);

	const bottom = createElement("div", { className: "scan-bottom" });

	const isbnForm = createElement("form", { className: "glass-panel isbn-form" });
	const isbnInput = createElement("input", {
		type: "text",
		inputmode: "numeric",
		autocomplete: "off",
		placeholder: "ISBN (10 or 13 digits)",
		"aria-label": "ISBN",
	});
	const isbnGo = createElement("button", { type: "submit", className: "glass-btn glass-btn-solid" }, "Find");
	isbnForm.appendChild(isbnInput);
	isbnForm.appendChild(isbnGo);
	isbnForm.addEventListener("submit", (e) => {
		e.preventDefault();
		const isbn = normalizeIsbn(isbnInput.value);
		if (!isbn) {
			hapticFeedback("light");
			setHint("That doesn't look like a valid ISBN", true);
			return;
		}
		isbnInput.blur();
		lookup(isbn);
	});

	const fileInput = createElement("input", {
		type: "file",
		accept: "image/*",
		style: "display: none;",
		onChange: async (e) => {
			const file = e.target.files[0];
			e.target.value = "";
			if (!file) return;
			setHint("Reading barcode from photo…");
			try {
				const isbn = await decodeImageFile(file);
				if (isbn) lookup(isbn);
				else setHint("No barcode found in that photo. Try closer, with more light.", true);
			} catch (err) {
				console.error("[Scanner] Photo decode failed:", err);
				setHint("Couldn't read that photo", true);
			}
		},
	});

	const actions = createElement("div", { className: "scan-actions" });
	const photoBtn = createElement("button", {
		type: "button",
		className: "glass-btn",
		onClick: () => fileInput.click(),
	});
	photoBtn.innerHTML = `${ICON.photo}<span>Photo</span>`;
	const typeBtn = createElement("button", {
		type: "button",
		className: "glass-btn",
		onClick: () => {
			const open = isbnForm.classList.toggle("is-open");
			if (open) isbnInput.focus();
		},
	});
	typeBtn.innerHTML = `${ICON.keyboard}<span>Type ISBN</span>`;
	actions.appendChild(photoBtn);
	actions.appendChild(typeBtn);

	bottom.appendChild(isbnForm);
	bottom.appendChild(actions);
	bottom.appendChild(fileInput);
	scanScreen.appendChild(bottom);

	root.appendChild(scanScreen);

	/* ---------- Result layer (lookup / confirm / missing) ---------- */

	const result = createElement("div", { className: "scan-result", "aria-live": "polite" });
	root.appendChild(result);

	document.body.appendChild(root);
	requestAnimationFrame(() => root.classList.add("is-open"));

	const onKey = (e) => {
		if (e.key === "Escape") close();
	};
	document.addEventListener("keydown", onKey);

	/* ---------- Behaviour ---------- */

	function setHint(text, isError = false) {
		hint.textContent = text;
		hint.classList.toggle("is-error", isError);
	}

	async function startLive() {
		if (liveRunning || closed) return;
		if (!navigator.mediaDevices?.getUserMedia) {
			cameraUnavailable("This browser can't open the camera.");
			return;
		}
		try {
			await initScanner(feed, (r) => lookup(r.isbn), () => {});
			if (closed) {
				stopScanner();
				return;
			}
			liveRunning = true;
			root.classList.add("is-live");
			setHint("Point at the barcode on the back cover");
		} catch (err) {
			cameraUnavailable(
				/permission/i.test(err.message)
					? "Camera access is off. Allow it in your browser settings, or use a photo."
					: "Couldn't start the camera. Use a photo or type the ISBN."
			);
		}
	}

	function stopLive() {
		if (liveRunning) stopScanner();
		liveRunning = false;
		root.classList.remove("is-live");
	}

	function cameraUnavailable(message) {
		root.classList.add("no-camera");
		setHint(message, true);
	}

	async function lookup(isbn) {
		if (busy) return;
		busy = true;
		stopLive();
		hapticFeedback("heavy");
		showLoading(isbn);

		try {
			const existing = await getBookByISBN(isbn);
			const book = existing || (await fetchBookByISBN(isbn));
			if (closed) return;
			if (book) showConfirm(book, Boolean(existing));
			else showMissing(isbn);
		} catch (err) {
			if (closed) return;
			showMissing(isbn, err.message);
		}
	}

	function showResult(node) {
		result.innerHTML = "";
		result.appendChild(node);
		root.classList.add("show-result");
	}

	function rescan() {
		busy = false;
		root.classList.remove("show-result");
		setTimeout(() => {
			if (!root.classList.contains("show-result")) result.innerHTML = "";
		}, 300);
		setHint("Point at the barcode on the back cover");
		if (!root.classList.contains("no-camera")) startLive();
	}

	function showLoading(isbn) {
		const box = createElement("div", { className: "result-loading" });
		box.appendChild(createElement("div", { className: "glass-spinner", "aria-hidden": "true" }));
		box.appendChild(createElement("p", { className: "result-loading-title" }, "Found a barcode"));
		box.appendChild(createElement("p", { className: "result-loading-sub" }, `Looking up ${formatISBN(isbn)}…`));
		showResult(box);
	}

	function showConfirm(book, alreadyAdded) {
		const card = createElement("div", { className: "confirm" });

		// Full-bleed cover art, with a blurred copy behind it so low-resolution
		// covers still fill the screen gracefully.
		const art = createElement("div", { className: "confirm-art" });
		const blur = createElement("div", { className: "confirm-art-blur" });
		const img = createElement("img", { className: "confirm-art-img", alt: "" });
		const applyFallback = () => {
			card.classList.add("no-cover");
			img.remove();
		};
		if (book.coverUrl) {
			img.addEventListener("load", () => {
				if (img.naturalWidth <= 2) applyFallback();
				else {
					blur.style.backgroundImage = `url("${img.src}")`;
					card.classList.add("cover-loaded");
				}
			});
			img.addEventListener("error", applyFallback);
			img.src = book.coverUrl;
			art.appendChild(blur);
			art.appendChild(img);
		} else {
			card.classList.add("no-cover");
		}
		art.appendChild(createElement("div", { className: "confirm-gradient" }));
		card.appendChild(art);

		const topBar = createElement("div", { className: "scan-top" });
		const back = createElement("button", {
			type: "button",
			className: "glass-btn glass-icon",
			"aria-label": "Scan again",
			onClick: rescan,
		});
		back.innerHTML = ICON.back;
		const x = createElement("button", {
			type: "button",
			className: "glass-btn glass-icon",
			"aria-label": "Close scanner",
			onClick: () => close(),
		});
		x.innerHTML = ICON.close;
		topBar.appendChild(back);
		topBar.appendChild(x);
		card.appendChild(topBar);

		const info = createElement("div", { className: "confirm-info" });
		info.appendChild(
			createElement(
				"p",
				{ className: "confirm-eyebrow" },
				alreadyAdded ? "Already in your books" : "Is this your book?"
			)
		);
		info.appendChild(createElement("h2", { className: "confirm-title" }, book.title || "Untitled"));
		if (book.subtitle) {
			info.appendChild(createElement("p", { className: "confirm-subtitle" }, book.subtitle));
		}
		info.appendChild(
			createElement("p", { className: "confirm-author" }, book.author && book.author !== "Unknown Author" ? book.author : "Unknown author")
		);

		const meta = createElement("div", { className: "confirm-meta" });
		const chips = [
			book.publishYear,
			book.publishers?.[0],
			book.numberOfPages ? `${book.numberOfPages} pages` : null,
			book.isbn ? `ISBN ${formatISBN(book.isbn)}` : null,
		].filter(Boolean);
		chips.forEach((c) => meta.appendChild(createElement("span", { className: "glass-chip" }, String(c))));
		if (chips.length) info.appendChild(meta);

		const buttons = createElement("div", { className: "confirm-actions" });
		const again = createElement(
			"button",
			{ type: "button", className: "glass-btn", onClick: rescan },
			"Scan again"
		);
		const yes = createElement(
			"button",
			{
				type: "button",
				className: "glass-btn glass-btn-solid",
				onClick: async () => {
					yes.disabled = true;
					try {
						const saved = alreadyAdded ? book : await addBook(book);
						await setActiveBook(saved.id);
						hapticFeedback("medium");
						showToast(`Now reading: ${saved.title}`, "success");
						if (window.refreshBooksList) window.refreshBooksList();
						if (options.onAdded) options.onAdded(saved);
						close();
					} catch (err) {
						console.error("Failed to save book:", err);
						showToast("Could not save the book", "error");
						yes.disabled = false;
					}
				},
			},
			alreadyAdded ? "Switch to this book" : "Add this book"
		);
		buttons.appendChild(again);
		buttons.appendChild(yes);
		info.appendChild(buttons);
		card.appendChild(info);

		showResult(card);
		setTimeout(() => yes.focus({ preventScroll: true }), 350);
	}

	function showMissing(isbn, errorMessage) {
		const box = createElement("div", { className: "result-loading" });
		box.appendChild(createElement("p", { className: "result-loading-title" }, errorMessage ? "Lookup failed" : "Book not found"));
		box.appendChild(
			createElement(
				"p",
				{ className: "result-loading-sub" },
				errorMessage || `Nothing matched ISBN ${formatISBN(isbn)}. You can add it by title from the book switcher.`
			)
		);
		const row = createElement("div", { className: "confirm-actions" });
		row.appendChild(createElement("button", { type: "button", className: "glass-btn", onClick: () => close() }, "Close"));
		row.appendChild(createElement("button", { type: "button", className: "glass-btn glass-btn-solid", onClick: rescan }, "Scan again"));
		box.appendChild(row);
		showResult(box);
	}

	function close() {
		if (closed) return;
		closed = true;
		stopLive();
		document.removeEventListener("keydown", onKey);
		document.body.style.overflow = prevOverflow;
		root.classList.remove("is-open");
		setTimeout(() => root.remove(), 250);
		current = null;
	}

	startLive();

	current = { close };
	return current;
}

/**
 * Backwards-compatible wrapper used by the views.
 */
export function createBarcodeScanner() {
	return {
		show: (options) => openScanner(options),
		hide: () => current?.close(),
		isActive: () => Boolean(current),
	};
}
