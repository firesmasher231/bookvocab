import {
	createElement,
	debounce,
	hapticFeedback,
	showToast,
} from "../utils/helpers.js";
import { lookupWord } from "../services/dictionary.js";
import {
	addWord,
	getWordByText,
	getAllBooks,
	addBook,
} from "../services/db.js";
import { searchBooksByTitle } from "../services/books.js";
import { fadeInUp } from "../utils/animations.js";

/**
 * Create simplified word input with auto-save
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Component interface
 */
export function createWordInputSimple(container) {
	console.log("[Placeholder Check] createWordInputSimple called");
	const component = createElement("div", {
		className: "word-input-simple mb-8",
	});

	// Unified wrapper containing input and book selector
	const inputWrapper = createElement("div", {
		style: `
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1.5px solid rgba(0, 0, 0, 0.08);
      border-radius: 1rem;
      padding: 0.5rem;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    `,
	});

	// Input container (left side - takes most space)
	const inputContainer = createElement("div", {
		style: `
      flex: 1;
    `,
	});

	const input = createElement("input", {
		type: "text",
		placeholder: "Type a word...",
		"aria-label": "Search for a word",
		autocomplete: "off",
		style: `
      width: 100%;
      font-size: 0.9375rem;
      padding: 0.875rem 1rem;
      text-align: center;
      background: transparent;
      border: none;
      outline: none;
      color: #171717;
      font-weight: 400;
      letter-spacing: -0.011em;
	  transition: all 0.2s ease;
    `,
	});

	input.addEventListener("focus", () => {
		inputWrapper.style.borderColor = "rgba(0, 0, 0, 0.15)";
		inputWrapper.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.06)";
		input.placeholder = "";
	});

	input.addEventListener("focusout", () => {
		input.placeholder = "Type a word...";
	});

	input.addEventListener("blur", () => {
		inputWrapper.style.borderColor = "rgba(0, 0, 0, 0.08)";
		inputWrapper.style.boxShadow = "0 2px 12px rgba(0, 0, 0, 0.04)";
	});

	inputContainer.appendChild(input);

	// Vertical divider
	const divider = createElement("div", {
		style: `
      width: 1px;
      height: 32px;
      background: rgba(0, 0, 0, 0.08);
    `,
	});

	// Book selector container (right side - compact)
	const bookSelectorContainer = createElement("div", {
		style: `
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 100px;
    `,
	});

	// Function to check if a cover URL is a placeholder by file size
	async function checkIfPlaceholderBySize(url) {
		try {
			console.log("[Placeholder Check] Checking file size for:", url);
			const response = await fetch(url, { method: "HEAD" });

			if (!response.ok) {
				console.log(
					"[Placeholder Check] Response not OK, treating as placeholder"
				);
				return true;
			}

			const contentLength = response.headers.get("content-length");
			if (contentLength) {
				const size = parseInt(contentLength, 10);
				console.log("[Placeholder Check] File size:", size, "bytes");
				// 1x1 pixel GIFs are typically 35-50 bytes, real covers are much larger
				if (size < 100) {
					console.log("[Placeholder Check] File too small, is placeholder");
					return true;
				}
				console.log("[Placeholder Check] File size OK, not a placeholder");
				return false;
			}

			// If no content-length, fall back to dimension check
			console.log(
				"[Placeholder Check] No content-length header, will check dimensions"
			);
			return null;
		} catch (error) {
			console.error("[Placeholder Check] Error checking file size:", error);
			return null; // Fall back to dimension check
		}
	}

	// Function to check if image is a placeholder by dimensions (fallback)
	function checkIfPlaceholderByDimensions(img) {
		console.log("[Placeholder Check] Checking image dimensions:", {
			naturalWidth: img.naturalWidth,
			naturalHeight: img.naturalHeight,
			width: img.width,
			height: img.height,
			complete: img.complete,
			src: img.src,
		});

		// Check natural dimensions - these are the actual image dimensions
		// A 1x1 pixel image will have naturalWidth and naturalHeight of 1
		// Also check if dimensions are suspiciously small (2x2 or less)
		const isPlaceholder =
			(img.naturalWidth <= 1 && img.naturalHeight <= 1) ||
			(img.naturalWidth <= 2 && img.naturalHeight <= 2);

		console.log("[Placeholder Check] Dimension check result:", {
			isPlaceholder,
			reason: isPlaceholder
				? `Dimensions are ${img.naturalWidth}x${img.naturalHeight} (too small)`
				: `Dimensions are ${img.naturalWidth}x${img.naturalHeight} (valid)`,
		});

		return isPlaceholder;
	}

	// Function to handle placeholder detection with retry logic
	function handlePlaceholderCheck(retryCount = 0) {
		const maxRetries = 5;

		console.log(
			`[Placeholder Check] Attempt ${retryCount + 1}/${maxRetries + 1}`,
			{
				complete: bookCover.complete,
				naturalWidth: bookCover.naturalWidth,
				naturalHeight: bookCover.naturalHeight,
				src: bookCover.src,
			}
		);

		// Check if image has loaded and has dimensions
		if (
			bookCover.complete &&
			bookCover.naturalWidth > 0 &&
			bookCover.naturalHeight > 0
		) {
			if (checkIfPlaceholderByDimensions(bookCover)) {
				console.log(
					"[Placeholder Check] Showing placeholder instead of image (dimension check)"
				);
				bookCover.style.display = "none";
				if (currentBookTitle) {
					bookCoverPlaceholder.textContent = getBookInitials(currentBookTitle);
					bookCoverPlaceholder.style.background =
						getBookPlaceholderGradient(currentBookTitle);
				}
				bookCoverPlaceholder.style.display = "flex";
			} else {
				console.log("[Placeholder Check] Image is valid, keeping it visible");
			}
		} else if (bookCover.complete && retryCount < maxRetries) {
			// Image is complete but dimensions not available yet, retry
			console.log(
				`[Placeholder Check] Retrying in 50ms (dimensions not ready)`
			);
			setTimeout(() => {
				handlePlaceholderCheck(retryCount + 1);
			}, 50);
		} else if (bookCover.complete && retryCount >= maxRetries) {
			// If complete but still no dimensions after retries, might be an error - show placeholder
			console.log(
				"[Placeholder Check] Max retries reached, showing placeholder as fallback"
			);
			bookCover.style.display = "none";
			if (currentBookTitle) {
				bookCoverPlaceholder.textContent = getBookInitials(currentBookTitle);
				bookCoverPlaceholder.style.background =
					getBookPlaceholderGradient(currentBookTitle);
			}
			bookCoverPlaceholder.style.display = "flex";
		} else {
			console.log(
				"[Placeholder Check] Image not complete yet, waiting for load"
			);
		}
	}
	// Book cover image (hidden initially)
	console.log("[Placeholder Check] Creating bookCover image element");
	const bookCover = createElement("img", {
		style: `
      width: 24px;
      height: 32px;
      object-fit: cover;
      border-radius: 2px;
      display: none;
    `,
		alt: "Book cover",
		onerror: () => {
			console.log(
				"[Placeholder Check] Image onerror fired - showing placeholder"
			);
			// If image fails to load, show placeholder instead
			bookCover.style.display = "none";
			if (currentBookTitle) {
				bookCoverPlaceholder.textContent = getBookInitials(currentBookTitle);
				bookCoverPlaceholder.style.background =
					getBookPlaceholderGradient(currentBookTitle);
			}
			bookCoverPlaceholder.style.display = "flex";
		},
		onload: () => {
			console.log("[Placeholder Check] Image onload fired", {
				src: bookCover.src,
				naturalWidth: bookCover.naturalWidth,
				naturalHeight: bookCover.naturalHeight,
			});
			// Check immediately and also after a short delay to catch edge cases
			handlePlaceholderCheck();
			setTimeout(() => {
				console.log("[Placeholder Check] Delayed check after onload");
				handlePlaceholderCheck();
			}, 50);
		},
	});
	console.log("[Placeholder Check] bookCover element created:", bookCover);

	// Book cover placeholder (for books without images)
	const bookCoverPlaceholder = createElement("div", {
		style: `
      width: 24px;
      height: 32px;
      border-radius: 2px;
      display: none;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      font-size: 10px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `,
	});

	bookSelectorContainer.appendChild(bookCover);
	bookSelectorContainer.appendChild(bookCoverPlaceholder);

	// Custom dropdown button
	const dropdownButton = createElement("button", {
		type: "button",
		style: `
      background: transparent;
      border: none;
      cursor: pointer;
      color: #737373;
      font-size: 0.6875rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      padding: 0;
      outline: none;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      max-width: 110px;
      text-transform: uppercase;
    `,
	});

	const dropdownText = createElement("span", {
		style: `
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      text-align: right;
    `,
	});
	dropdownText.textContent = "Misc";

	const dropdownArrow = createElement("span", {
		style: "font-size: 0.5rem; flex-shrink: 0; margin-left: 0.125rem;",
	});
	dropdownArrow.textContent = "▼";

	dropdownButton.appendChild(dropdownText);
	dropdownButton.appendChild(dropdownArrow);

	// Custom dropdown menu
	const dropdownMenu = createElement("div", {
		style: `
      position: absolute;
      top: calc(100% + 0.75rem);
      right: -0.5rem;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 14px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
      min-width: 220px;
      max-width: 280px;
      max-height: 320px;
      overflow-y: auto;
      display: none;
      z-index: 1000;
      padding: 0.625rem;
    `,
	});

	let isDropdownOpen = false;

	dropdownButton.addEventListener("click", (e) => {
		e.stopPropagation();
		isDropdownOpen = !isDropdownOpen;
		dropdownMenu.style.display = isDropdownOpen ? "block" : "none";
		dropdownArrow.textContent = isDropdownOpen ? "▲" : "▼";
	});

	// Close dropdown when clicking outside
	document.addEventListener("click", (e) => {
		if (isDropdownOpen && !bookSelectorContainer.contains(e.target)) {
			isDropdownOpen = false;
			dropdownMenu.style.display = "none";
			dropdownArrow.textContent = "▼";
		}
	});

	bookSelectorContainer.appendChild(dropdownButton);
	bookSelectorContainer.appendChild(dropdownMenu);
	bookSelectorContainer.style.position = "relative";

	// Assemble the unified wrapper
	inputWrapper.appendChild(inputContainer);
	inputWrapper.appendChild(divider);
	inputWrapper.appendChild(bookSelectorContainer);
	component.appendChild(inputWrapper);

	// Status indicator (subtle)
	const status = createElement("div", {
		className: "text-caption text-center mt-3",
		style: "min-height: 1.5rem; color: #a3a3a3; font-size: 0.8125rem;",
	});
	component.appendChild(status);

	// Result display area (initially hidden)
	const resultArea = createElement("div", {
		style: `
      display: none;
      margin-top: 2rem;
      padding: 0;
      transition: all 0.2s ease;
    `,
	});
	component.appendChild(resultArea);

	container.appendChild(component);

	let lastSearchedWord = "";
	let searchTimeout = null;
	let selectedBookId = null;
	let currentResult = null;
	let currentBookTitle = null; // Store current book title for placeholder

	// Store books data for lookup
	let booksData = [];

	// Helper to generate initials from book title
	function getBookInitials(title) {
		if (!title) return "?";
		const words = title.trim().split(/\s+/);
		if (words.length === 1) {
			return words[0].substring(0, 2).toUpperCase();
		}
		return (words[0][0] + words[words.length - 1][0]).toUpperCase();
	}

	// Helper to generate a color gradient based on book title
	function getBookPlaceholderGradient(title) {
		if (!title) {
			return "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
		}

		// Generate a hash from the title to get consistent colors
		let hash = 0;
		for (let i = 0; i < title.length; i++) {
			hash = title.charCodeAt(i) + ((hash << 5) - hash);
		}

		// Predefined beautiful gradient combinations
		const gradients = [
			"linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
			"linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
			"linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
			"linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
			"linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
			"linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
			"linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
			"linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
			"linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
			"linear-gradient(135deg, #ff8a80 0%, #ea4c89 100%)",
		];

		return gradients[Math.abs(hash) % gradients.length];
	}

	// Helper to create dropdown item
	function createDropdownItem(text, value, isAddNew = false, fullTitle = null) {
		const item = createElement("div", {
			style: `
        padding: 0.75rem 1rem;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 0.8125rem;
        font-weight: ${isAddNew ? "500" : "400"};
        letter-spacing: -0.008em;
        color: ${isAddNew ? "#737373" : "#171717"};
        line-height: 1.4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `,
		});
		item.textContent = text;
		// Store the full title for UI updates
		if (fullTitle) {
			item.dataset.fullTitle = fullTitle;
		}

		item.addEventListener("mouseenter", () => {
			item.style.background = "rgba(0, 0, 0, 0.04)";
		});

		item.addEventListener("mouseleave", () => {
			item.style.background = "transparent";
		});

		item.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			isDropdownOpen = false;
			dropdownMenu.style.display = "none";
			dropdownArrow.textContent = "▼";
			handleDropdownSelect(value, fullTitle || text);
		});

		return item;
	}

	// Load books into dropdown
	async function loadBooks() {
		const books = await getAllBooks();
		booksData = books;

		// Clear dropdown menu
		dropdownMenu.innerHTML = "";

		// Add "Misc" option
		dropdownMenu.appendChild(createDropdownItem("Misc", null));

		// Add separator
		const separator1 = createElement("div", {
			style: "height: 1px; background: rgba(0, 0, 0, 0.06); margin: 0.5rem 0;",
		});
		dropdownMenu.appendChild(separator1);

		// Add books
		books.forEach((book) => {
			const displayTitle =
				book.title.length > 25
					? book.title.substring(0, 25) + "..."
					: book.title;
			dropdownMenu.appendChild(
				createDropdownItem(displayTitle, book.id, false, book.title)
			);
		});

		// Add separator
		const separator2 = createElement("div", {
			style: "height: 1px; background: rgba(0, 0, 0, 0.06); margin: 0.5rem 0;",
		});
		dropdownMenu.appendChild(separator2);

		// Add "Add new book" option
		dropdownMenu.appendChild(
			createDropdownItem("+ Add new book", "__add_new__", true)
		);
	}

	// Update dropdown UI based on selection
	async function updateDropdownUI(bookId, title = null) {
		console.log("[Placeholder Check] updateDropdownUI called", {
			bookId,
			title,
			hasBooksData: booksData.length > 0,
		});

		// Check for null or undefined explicitly
		if (bookId === null || bookId === undefined) {
			console.log("[Placeholder Check] BookId is null/undefined, showing Misc");
			// Misc if no book selected
			dropdownText.textContent = "Misc";
			bookCover.style.display = "none";
			bookCoverPlaceholder.style.display = "none";
			selectedBookId = null;
			return;
		}

		// Book IDs are UUIDs (strings), so compare as strings
		const book = booksData.find((b) => String(b.id) === String(bookId));
		console.log("[Placeholder Check] Found book:", {
			found: !!book,
			bookTitle: book?.title,
			bookCoverUrl: book?.coverUrl,
		});

		// Use provided title or book title
		const displayTitle = title
			? title.length > 12
				? title.substring(0, 12) + "..."
				: title
			: book
			? book.title.length > 12
				? book.title.substring(0, 12) + "..."
				: book.title
			: "Book";

		dropdownText.textContent = displayTitle;
		// Store the bookId as-is (string UUID)
		selectedBookId = bookId;

		// Store current book title for placeholder use (needed for onload handler)
		const bookTitle = book ? book.title : title || "Book";
		currentBookTitle = bookTitle;

		if (book && book.coverUrl) {
			console.log("[Placeholder Check] Setting cover URL:", book.coverUrl);

			// Load the image and check dimensions when loaded
			bookCover.src = book.coverUrl;
			bookCover.style.display = "block";
			bookCoverPlaceholder.style.display = "none";

			// Force check after a short delay to ensure dimensions are available
			setTimeout(() => {
				console.log("[Placeholder Check] Forced check after setting src");
				handlePlaceholderCheck();
			}, 200);
		} else {
			console.log(
				"[Placeholder Check] No coverUrl, showing placeholder immediately",
				{
					hasBook: !!book,
					coverUrl: book?.coverUrl,
				}
			);
			bookCover.style.display = "none";
			// Show placeholder with book initials
			bookCoverPlaceholder.textContent = getBookInitials(bookTitle);
			bookCoverPlaceholder.style.background =
				getBookPlaceholderGradient(bookTitle);
			bookCoverPlaceholder.style.display = "flex";
		}
	}

	// Handle dropdown selection
	async function handleDropdownSelect(value, title = null) {
		if (value === "__add_new__") {
			// Prompt for manual book entry
			const title = prompt("Enter book title:");
			if (!title) {
				selectedBookId = null;
				await updateDropdownUI(null);
				return;
			}

			const author = prompt("Enter author (optional):") || "Unknown";

			// Try to find book in Open Library to get ISBN and cover
			status.textContent = "Searching for book...";
			let newBook = {
				title,
				author,
				isbn: null,
				coverUrl: null,
				publishYear: null,
			};

			try {
				const searchResults = await searchBooksByTitle(title, 1);
				if (searchResults && searchResults.length > 0) {
					const foundBook = searchResults[0];
					// Use found book data if it matches
					newBook = {
						title: foundBook.title || title,
						author: foundBook.author || author,
						isbn: foundBook.isbn || null,
						coverUrl: foundBook.coverUrl || null,
						publishYear: foundBook.publishYear || null,
					};
				}
			} catch (error) {
				console.error("Failed to search for book:", error);
				// Continue with manual entry if search fails
			}

			const bookId = await addBook(newBook);

			await loadBooks();
			await updateDropdownUI(bookId);

			hapticFeedback("light");
			status.textContent = `Associated with "${newBook.title}"`;
			setTimeout(() => {
				status.textContent = "";
			}, 2000);
		} else {
			// Update the UI first, which will set selectedBookId
			await updateDropdownUI(value, title);
			hapticFeedback("light");
		}
	}

	// Initial load
	loadBooks();

	// Display search result
	function displayResult(result) {
		currentResult = result;
		resultArea.innerHTML = "";
		resultArea.style.display = "block";

		// Container with border like recent searches
		const resultCard = createElement("div", {
			style: `
				border-bottom: 1px solid rgba(0, 0, 0, 0.05);
				padding-bottom: 1.5rem;
				margin-bottom: 1.5rem;
			`,
		});

		// Word title row
		const wordRow = createElement("div", {
			style: "margin-bottom: 0.5rem;",
		});

		const wordTitle = createElement("h3", {
			style:
				"font-size: 1.5rem; font-weight: 500; letter-spacing: -0.02em; color: #171717;",
		});
		wordTitle.textContent = result.word;
		wordRow.appendChild(wordTitle);
		resultCard.appendChild(wordRow);

		// Phonetic
		if (result.phonetic) {
			const phoneticEl = createElement("p", {
				style:
					"font-size: 0.875rem; color: #a3a3a3; font-style: italic; margin-bottom: 1rem;",
			});
			phoneticEl.textContent = result.phonetic;
			resultCard.appendChild(phoneticEl);
		}

		// Definitions - clean format matching recent searches
		if (result.definitions && result.definitions.length > 0) {
			result.definitions.slice(0, 3).forEach((def, index) => {
				const defWrapper = createElement("div", {
					style: `margin-bottom: ${
						index === result.definitions.slice(0, 3).length - 1
							? "0"
							: "0.75rem"
					};`,
				});

				const defText = createElement("p", {
					style: `
						font-size: 0.9375rem;
						color: #525252;
						line-height: 1.6;
						letter-spacing: -0.01em;
					`,
				});

				// Inline part of speech if available
				let text = "";
				if (def.partOfSpeech) {
					text += `${def.partOfSpeech}. `;
				}
				text += def.definition || def;

				defText.textContent = text;
				defWrapper.appendChild(defText);
				resultCard.appendChild(defWrapper);
			});
		}

		resultArea.appendChild(resultCard);
	}

	/**
	 * Search for word, display result, and auto-save
	 */
	const handleSearch = debounce(async (query) => {
		if (!query || query.length < 2) {
			status.textContent = "";
			resultArea.style.display = "none";
			return;
		}

		// Clean up the query
		const cleanQuery = query.trim().toLowerCase();

		// Avoid duplicate searches
		if (cleanQuery === lastSearchedWord) {
			return;
		}

		// Clear previous result when starting new search
		if (resultArea.style.display === "block") {
			resultArea.style.display = "none";
			resultArea.innerHTML = "";
			if (window.refreshWordList) window.refreshWordList();
		}

		status.textContent = "Searching...";

		try {
			const result = await lookupWord(cleanQuery);

			if (!result.found) {
				status.textContent = "Word not found";
				if (result.suggestions && result.suggestions.length > 0) {
					status.textContent = `Did you mean: ${result.suggestions
						.slice(0, 3)
						.join(", ")}?`;
				}
				return;
			}

			// Check if word already exists
			const existing = await getWordByText(result.word);

			if (existing) {
				status.textContent = "Already in your library";
				lastSearchedWord = cleanQuery;

				// Clear input after a moment
				setTimeout(() => {
					input.value = "";
					status.textContent = "";
					lastSearchedWord = "";
				}, 2000);
				return;
			}

			// Display the result first
			status.textContent = "";
			lastSearchedWord = cleanQuery;
			displayResult(result);

			// Auto-save the word with book association
			const wordToSave = {
				word: result.word,
				definitions: result.definitions,
				phonetic: result.phonetic,
				audioUrl: result.audioUrl,
				bookId: selectedBookId,
			};

			await addWord(wordToSave);
			hapticFeedback("medium");

			// Show saved status
			status.textContent = `✓ Saved "${result.word}"`;

			// Clear the input to allow new search
			setTimeout(() => {
				input.value = "";
				status.textContent = "";
				lastSearchedWord = "";
			}, 1500);
		} catch (error) {
			console.error("Word lookup error:", error);
			status.textContent = error.message || "Error looking up word";
		}
	}, 800);

	// Event listeners
	input.addEventListener("input", (e) => {
		handleSearch(e.target.value);
	});

	input.addEventListener("keypress", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSearch(input.value);
		}
	});

	return {
		focus: () => input.focus(),
		clear: () => {
			input.value = "";
			status.textContent = "";
			lastSearchedWord = "";
		},
		refreshBooks: loadBooks,
	};
}
