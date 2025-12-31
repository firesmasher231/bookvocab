import { createElement } from '../utils/helpers.js';
import { getAllWords, getBook } from '../services/db.js';
import { createWordCard } from './WordCard.js';
import { staggerChildren } from '../utils/animations.js';
import { appState } from '../js/state.js';

/**
 * Create word list component
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Component interface
 */
export function createWordList(container) {
  const component = createElement('div', {
    className: 'word-list-container',
    id: 'word-list',
  });

  container.appendChild(component);

  /**
   * Render word list
   */
  async function render(options = {}) {
    component.innerHTML = '';

    try {
      // Show loading
      const loading = createElement('div', {
        className: 'flex justify-center py-12',
      });
      loading.innerHTML = '<div class="spinner"></div>';
      component.appendChild(loading);

      // Fetch words
      const words = await getAllWords(options);

      // Clear loading
      component.innerHTML = '';

      if (words.length === 0) {
        displayEmptyState(options.bookId);
        return;
      }

      // Display words with their book info
      const wordsWithBooks = await Promise.all(
        words.map(async (word) => {
          if (word.bookId) {
            const book = await getBook(word.bookId);
            return { ...word, book };
          }
          return word;
        })
      );

      // Create word cards
      wordsWithBooks.forEach(word => {
        const card = createWordCard(word, {
          book: word.book,
          onDelete: () => render(options),
        });
        component.appendChild(card);
      });

      // Animate cards in
      setTimeout(() => {
        staggerChildren('#word-list', '.word-card');
      }, 10);

    } catch (error) {
      console.error('Failed to load words:', error);
      component.innerHTML = `
        <div class="text-center text-error py-8">
          <p>Failed to load words. Please try again.</p>
        </div>
      `;
    }
  }

  /**
   * Display empty state
   */
  function displayEmptyState(bookId) {
    const emptyState = createElement('div', {
      className: 'text-center py-12',
    });

    const icon = createElement('div', {
      className: 'text-gray-300 mb-4',
    });
    icon.innerHTML = `
      <svg class="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    `;
    emptyState.appendChild(icon);

    const message = createElement('p', {
      className: 'text-gray-500 text-lg',
    }, bookId ? 'No words from this book yet' : 'No words saved yet');
    emptyState.appendChild(message);

    const hint = createElement('p', {
      className: 'text-gray-400 text-sm mt-2',
    }, 'Search for a word above to get started');
    emptyState.appendChild(hint);

    component.appendChild(emptyState);
  }

  /**
   * Filter words by search query
   */
  async function search(query) {
    if (!query) {
      render();
      return;
    }

    const allWords = await getAllWords();
    const filtered = allWords.filter(word =>
      word.word.toLowerCase().includes(query.toLowerCase())
    );

    component.innerHTML = '';

    if (filtered.length === 0) {
      const noResults = createElement('div', {
        className: 'text-center py-8 text-gray-500',
      }, `No words found matching "${query}"`);
      component.appendChild(noResults);
      return;
    }

    // Display filtered words
    const wordsWithBooks = await Promise.all(
      filtered.map(async (word) => {
        if (word.bookId) {
          const book = await getBook(word.bookId);
          return { ...word, book };
        }
        return word;
      })
    );

    wordsWithBooks.forEach(word => {
      const card = createWordCard(word, {
        book: word.book,
        onDelete: () => search(query),
      });
      component.appendChild(card);
    });

    setTimeout(() => {
      staggerChildren('#word-list', '.word-card');
    }, 10);
  }

  // Initial render
  render();

  // Subscribe to state changes
  appState.subscribe('currentBook', (bookId) => {
    if (appState.get('currentView') === 'library') {
      render({ bookId });
    }
  });

  return {
    render,
    search,
    filterByBook: (bookId) => render({ bookId }),
  };
}
