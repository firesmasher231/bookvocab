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
import { fadeInUp } from "../utils/animations.js";

/**
 * Create simplified word input with auto-save
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Component interface
 */
export function createWordInputSimple(container) {
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
      font-size: 1.125rem;
      padding: 1rem;
      text-align: center;
      background: transparent;
      border: none;
      outline: none;
      color: #171717;
      font-weight: 400;
      letter-spacing: -0.015em;
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

	// Book cover image (hidden initially)
	const bookCover = createElement("img", {
		style: `
      width: 24px;
      height: 32px;
      object-fit: cover;
      border-radius: 2px;
      display: none;
    `,
		alt: "Book cover",
	});
	bookSelectorContainer.appendChild(bookCover);

	// Native select styled to match design
	const bookSelect = createElement("select", {
		style: `
      background: transparent;
      border: none;
      cursor: pointer;
      color: #a3a3a3;
      font-size: 0.75rem;
      font-weight: 400;
      letter-spacing: 0.01em;
      padding: 0;
      padding-right: 1rem;
      outline: none;
      transition: all 0.2s ease;
      flex: 1;
      max-width: 120px;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    `,
	});

	const defaultOption = createElement("option", { value: "" }, "Misc");
	bookSelect.appendChild(defaultOption);

	const addBookOption = createElement(
		"option",
		{ value: "__add_new__" },
		"+ Add new book"
	);
	bookSelect.appendChild(addBookOption);

	// Custom wrapper for select with arrow
	const selectWrapper = createElement("div", {
		style: `
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex: 1;
      position: relative;
    `,
	});

	selectWrapper.appendChild(bookSelect);

	const dropdownArrow = createElement(
		"span",
		{
			style: "font-size: 0.625rem; flex-shrink: 0; pointer-events: none;",
		},
		"▼"
	);
	selectWrapper.appendChild(dropdownArrow);

	bookSelect.addEventListener("focus", () => {
		inputWrapper.style.borderColor = "rgba(0, 0, 0, 0.15)";
		inputWrapper.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.06)";
	});

	bookSelect.addEventListener("blur", () => {
		inputWrapper.style.borderColor = "rgba(0, 0, 0, 0.08)";
		inputWrapper.style.boxShadow = "0 2px 12px rgba(0, 0, 0, 0.04)";
	});

	bookSelectorContainer.appendChild(selectWrapper);

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

	// Store books data for lookup
	let booksData = [];

	// Load books into dropdown
	async function loadBooks() {
		const books = await getAllBooks();
		booksData = books;

		// Clear existing options except first two
		while (bookSelect.options.length > 2) {
			bookSelect.remove(2);
		}

		books.forEach((book) => {
			// Truncate long titles for dropdown display
			const displayTitle = book.title.length > 20
				? book.title.substring(0, 20) + '...'
				: book.title;
			const option = createElement("option", { value: book.id }, displayTitle);
			bookSelect.appendChild(option);
		});
	}

	// Update dropdown UI based on selection
	function updateDropdownUI(bookId) {
		if (!bookId) {
			// Misc if no book selected
			bookCover.style.display = "none";
			bookSelect.value = "";
			return;
		}

		const book = booksData.find((b) => b.id === parseInt(bookId));
		if (book) {
			bookSelect.value = bookId;
			if (book.coverUrl) {
				bookCover.src = book.coverUrl;
				bookCover.style.display = "block";
			} else {
				bookCover.style.display = "none";
			}
		}
	}

	// Handle book selection
	bookSelect.addEventListener("change", async (e) => {
		if (e.target.value === "__add_new__") {
			// Prompt for manual book entry
			const title = prompt("Enter book title:");
			if (!title) {
				bookSelect.value = "";
				selectedBookId = null;
				updateDropdownUI(null);
				return;
			}

			const author = prompt("Enter author (optional):") || "Unknown";

			const newBook = {
				title,
				author,
				isbn: null,
				coverUrl: null,
				publishYear: null,
			};

			const bookId = await addBook(newBook);
			selectedBookId = bookId;

			await loadBooks();
			bookSelect.value = bookId;
			updateDropdownUI(bookId);

			hapticFeedback("light");
			status.textContent = `Associated with "${title}"`;
			setTimeout(() => {
				status.textContent = "";
			}, 2000);
		} else {
			selectedBookId = e.target.value || null;
			updateDropdownUI(selectedBookId);
		}
	});

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
