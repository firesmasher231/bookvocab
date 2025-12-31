import { createElement, formatDate, hapticFeedback } from '../utils/helpers.js';
import { fadeInUp } from '../utils/animations.js';
import { deleteBook } from '../services/db.js';
import { appState } from '../js/state.js';

/**
 * Create a book card component
 * @param {Object} bookData - Book data object
 * @param {Object} options - Options (onDelete callback, etc.)
 * @returns {HTMLElement}
 */
export function createBookCard(bookData, options = {}) {
  const { onDelete, onClick } = options;

  const card = createElement('div', {
    className: 'card book-card cursor-pointer hover:shadow-lg transition-shadow',
    dataset: { bookId: bookData.id },
    onClick: () => {
      if (onClick) {
        hapticFeedback('light');
        onClick(bookData);
      }
    },
  });

  const content = createElement('div', {
    className: 'flex gap-4',
  });

  // Book cover
  if (bookData.coverUrl) {
    const coverContainer = createElement('div', {
      className: 'flex-shrink-0',
    });

    const cover = createElement('img', {
      src: bookData.coverUrl,
      alt: `${bookData.title} cover`,
      className: 'w-20 h-28 object-cover rounded shadow-sm',
      onerror: (e) => {
        // Fallback if cover fails to load
        e.target.style.display = 'none';
      },
    });

    coverContainer.appendChild(cover);
    content.appendChild(coverContainer);
  }

  // Book info
  const info = createElement('div', {
    className: 'flex-1 min-w-0',
  });

  const title = createElement('h3', {
    className: 'text-lg font-semibold text-gray-900 mb-1 truncate',
  }, bookData.title);
  info.appendChild(title);

  const author = createElement('p', {
    className: 'text-sm text-gray-600 mb-2',
  }, bookData.author);
  info.appendChild(author);

  // Metadata
  const metadata = createElement('div', {
    className: 'flex flex-wrap gap-2 text-xs text-gray-500',
  });

  if (bookData.publishYear) {
    const year = createElement('span', {
      className: 'bg-gray-100 px-2 py-1 rounded',
    }, bookData.publishYear.toString());
    metadata.appendChild(year);
  }

  if (bookData.isbn) {
    const isbn = createElement('span', {
      className: 'bg-gray-100 px-2 py-1 rounded',
    }, `ISBN: ${bookData.isbn.substring(0, 10)}...`);
    metadata.appendChild(isbn);
  }

  const wordCount = createElement('span', {
    className: 'bg-primary/10 text-primary px-2 py-1 rounded font-medium',
  }, `${bookData.wordCount || 0} words`);
  metadata.appendChild(wordCount);

  info.appendChild(metadata);
  content.appendChild(info);

  // Actions
  const actions = createElement('div', {
    className: 'flex-shrink-0 flex flex-col justify-between',
  });

  const deleteBtn = createElement('button', {
    className: 'p-2 text-gray-400 hover:text-error transition-colors',
    'aria-label': 'Delete book',
    onClick: async (e) => {
      e.stopPropagation(); // Prevent card click

      const confirmMsg = bookData.wordCount > 0
        ? `Delete "${bookData.title}"? This will unlink ${bookData.wordCount} word(s).`
        : `Delete "${bookData.title}"?`;

      if (confirm(confirmMsg)) {
        hapticFeedback('medium');
        try {
          await deleteBook(bookData.id, false); // Don't delete words, just unlink
          card.style.animation = 'slideUp 0.3s ease-out reverse';
          setTimeout(() => {
            card.remove();
            if (onDelete) onDelete(bookData.id);
          }, 300);
        } catch (error) {
          console.error('Failed to delete book:', error);
          alert('Failed to delete book. Please try again.');
        }
      }
    },
  });
  deleteBtn.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  `;
  actions.appendChild(deleteBtn);

  const date = createElement('span', {
    className: 'text-xs text-gray-400',
  }, formatDate(bookData.dateAdded));
  actions.appendChild(date);

  content.appendChild(actions);

  card.appendChild(content);

  // Animate in
  fadeInUp(card);

  return card;
}
