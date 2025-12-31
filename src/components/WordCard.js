import { fadeInUp } from '../utils/animations.js';
import { createElement, formatDate, hapticFeedback } from '../utils/helpers.js';
import { deleteWord } from '../services/db.js';
import { appState } from '../js/state.js';

/**
 * Create a word card component
 * @param {Object} wordData - Word data object
 * @param {Object} options - Options (onDelete callback, etc.)
 * @returns {HTMLElement}
 */
export function createWordCard(wordData, options = {}) {
  const { onDelete, book } = options;

  const card = createElement('div', {
    className: 'card word-card',
    dataset: { wordId: wordData.id },
  });

  // Header with word and actions
  const header = createElement('div', {
    className: 'flex justify-between items-start mb-3',
  });

  const wordInfo = createElement('div', { className: 'flex-1' });

  const wordTitle = createElement('h3', {
    className: 'text-xl font-semibold text-gray-900 mb-1',
  }, wordData.word);

  wordInfo.appendChild(wordTitle);

  if (wordData.phonetic) {
    const phoneticEl = createElement('p', {
      className: 'text-sm text-gray-500 italic',
    }, wordData.phonetic);
    wordInfo.appendChild(phoneticEl);
  }

  header.appendChild(wordInfo);

  // Actions (audio + delete)
  const actions = createElement('div', {
    className: 'flex gap-2',
  });

  if (wordData.audioUrl) {
    const playBtn = createElement('button', {
      className: 'p-2 text-gray-600 hover:text-primary transition-colors',
      'aria-label': 'Play pronunciation',
      onClick: () => {
        hapticFeedback('light');
        const audio = new Audio(wordData.audioUrl);
        audio.play().catch(err => console.error('Audio playback failed:', err));
      },
    });
    playBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    `;
    actions.appendChild(playBtn);
  }

  const deleteBtn = createElement('button', {
    className: 'p-2 text-gray-400 hover:text-error transition-colors',
    'aria-label': 'Delete word',
    onClick: async () => {
      if (confirm(`Delete "${wordData.word}"?`)) {
        hapticFeedback('medium');
        try {
          await deleteWord(wordData.id);
          card.style.animation = 'slideUp 0.3s ease-out reverse';
          setTimeout(() => {
            card.remove();
            if (onDelete) onDelete(wordData.id);
          }, 300);
        } catch (error) {
          console.error('Failed to delete word:', error);
          alert('Failed to delete word. Please try again.');
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

  header.appendChild(actions);
  card.appendChild(header);

  // Definitions
  const defsContainer = createElement('div', {
    className: 'space-y-2 mb-3',
  });

  wordData.definitions.forEach((def, index) => {
    const defEl = createElement('div', { className: 'definition' });

    const defText = createElement('p', {
      className: 'text-sm text-gray-700',
    });

    if (def.partOfSpeech) {
      const pos = createElement('span', {
        className: 'font-medium text-primary',
      }, `${def.partOfSpeech}. `);
      defText.appendChild(pos);
    }

    const defContent = createElement('span', {}, def.definition);
    defText.appendChild(defContent);

    defEl.appendChild(defText);

    // Examples
    if (def.examples && def.examples.length > 0) {
      const examplesList = createElement('ul', {
        className: 'mt-1 ml-4 text-xs text-gray-600 italic',
      });

      def.examples.forEach(example => {
        const exampleItem = createElement('li', {
          className: 'list-disc',
        }, `"${example}"`);
        examplesList.appendChild(exampleItem);
      });

      defEl.appendChild(examplesList);
    }

    defsContainer.appendChild(defEl);
  });

  card.appendChild(defsContainer);

  // Footer (book info + date)
  const footer = createElement('div', {
    className: 'pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500',
  });

  if (book) {
    const bookInfo = createElement('span', {
      className: 'flex items-center gap-1',
    });
    bookInfo.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <span>${book.title}</span>
    `;
    footer.appendChild(bookInfo);
  } else {
    footer.appendChild(createElement('span', {}, ''));
  }

  const dateEl = createElement('span', {}, formatDate(wordData.dateAdded));
  footer.appendChild(dateEl);

  card.appendChild(footer);

  // Animate in
  fadeInUp(card);

  return card;
}
