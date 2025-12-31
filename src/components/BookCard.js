import { createElement, formatDate, hapticFeedback, showToast } from '../utils/helpers.js';
import { fadeInUp } from '../utils/animations.js';
import { deleteBook } from '../services/db.js';
import { appState } from '../js/state.js';
import { createConfirmModal } from './ConfirmModal.js';

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

  // Helper to get book initials for placeholder
  function getBookInitials(title) {
    if (!title) return '?';
    const words = title.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  // Helper to generate gradient based on title
  function getBookPlaceholderGradient(title) {
    if (!title) {
      return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
    
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      'linear-gradient(135deg, #ff8a80 0%, #ea4c89 100%)',
    ];
    
    return gradients[Math.abs(hash) % gradients.length];
  }

  // Book cover (or placeholder if cover is invalid)
  const coverContainer = createElement('div', {
    className: 'flex-shrink-0',
  });

  if (bookData.coverUrl) {
    const cover = createElement('img', {
      src: bookData.coverUrl,
      alt: `${bookData.title} cover`,
      className: 'w-20 h-28 object-cover rounded shadow-sm',
      onerror: (e) => {
        // Fallback if cover fails to load - show placeholder
        e.target.style.display = 'none';
        showPlaceholder();
      },
      onload: (e) => {
        // Check if it's a 1x1 placeholder image
        if (e.target.naturalWidth <= 2 && e.target.naturalHeight <= 2) {
          e.target.style.display = 'none';
          showPlaceholder();
        }
      },
    });

    const placeholder = createElement('div', {
      className: 'rounded shadow-sm',
      style: `
        width: 5rem;
        height: 7rem;
        display: none;
        align-items: center;
        justify-content: center;
        background: ${getBookPlaceholderGradient(bookData.title)};
        color: white;
        font-weight: 600;
        font-size: 1.5rem;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      `,
    });
    placeholder.textContent = getBookInitials(bookData.title);

    function showPlaceholder() {
      placeholder.style.display = 'flex';
    }

    coverContainer.appendChild(cover);
    coverContainer.appendChild(placeholder);
  } else {
    // No coverUrl at all - show placeholder immediately
    const placeholder = createElement('div', {
      className: 'rounded shadow-sm',
      style: `
        width: 5rem;
        height: 7rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${getBookPlaceholderGradient(bookData.title)};
        color: white;
        font-weight: 600;
        font-size: 1.5rem;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      `,
    });
    placeholder.textContent = getBookInitials(bookData.title);
    coverContainer.appendChild(placeholder);
  }

  content.appendChild(coverContainer);

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

      const message = bookData.wordCount > 0
        ? `Are you sure you want to delete "${bookData.title}"?\n\nThis will also delete ${bookData.wordCount} word(s) associated with this book.`
        : `Are you sure you want to delete "${bookData.title}"?`;

      createConfirmModal({
        title: 'Delete Book',
        message,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
        onConfirm: async () => {
          hapticFeedback('medium');
          try {
            // Delete book and associated words
            await deleteBook(bookData.id, true);
            card.style.animation = 'slideUp 0.3s ease-out reverse';
            setTimeout(() => {
              card.remove();
              if (onDelete) onDelete(bookData.id);
            }, 300);
          } catch (error) {
            console.error('Failed to delete book:', error);
            showToast('Failed to delete book. Please try again.', 'error');
          }
        },
      });
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
