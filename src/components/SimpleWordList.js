import { createElement, formatDate, showToast } from '../utils/helpers.js';
import { getAllWords, getBook, deleteWord } from '../services/db.js';
import { staggerChildren } from '../utils/animations.js';

/**
 * Create simple elegant word listing
 * @param {HTMLElement} container - Container element
 * @param {number} limit - Maximum number of words to show
 * @returns {Object} - Component interface
 */
export function createSimpleWordList(container, limit = 10) {
  const component = createElement('div', {
    className: 'simple-word-list space-y-relaxed',
    id: 'simple-word-list',
  });

  container.appendChild(component);

  /**
   * Render word list
   */
  async function render() {
    component.innerHTML = '';

    try {
      const words = await getAllWords();
      const recentWords = words.slice(0, limit);

      if (recentWords.length === 0) {
        displayEmptyState();
        return;
      }

      // Render simple word items
      for (const word of recentWords) {
        let book = null;
        if (word.bookId) {
          book = await getBook(word.bookId);
        }
        const item = createWordItem(word, book);
        component.appendChild(item);
      }

      // Animate in
      setTimeout(() => {
        staggerChildren('#simple-word-list', '.word-item');
      }, 10);

    } catch (error) {
      console.error('Failed to load words:', error);
      component.innerHTML = `
        <div class="text-center text-caption py-8">
          <p>Failed to load words</p>
        </div>
      `;
    }
  }

  /**
   * Create simple word item
   */
  function createWordItem(wordData, book) {
    const item = createElement('div', {
      className: 'word-item py-4',
      style: `
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        opacity: 0;
        border-radius: 8px;
        margin: 0 -0.5rem;
        padding-left: 0.5rem;
        padding-right: 0.5rem;
        position: relative;
      `,
    });

    // Word and date row with delete button
    const wordRow = createElement('div', {
      className: 'flex items-baseline justify-between gap-4 mb-1',
    });

    const wordText = createElement('h3', {
      className: 'text-subhead',
      style: 'font-size: 1.25rem; font-weight: 400; letter-spacing: -0.015em; color: #171717;',
    });
    wordText.textContent = wordData.word;

    const rightSide = createElement('div', {
      style: 'display: flex; align-items: center; gap: 0.75rem;',
    });

    const dateText = createElement('span', {
      className: 'text-caption',
      style: 'font-size: 0.75rem; color: #a3a3a3; white-space: nowrap;',
    });
    dateText.textContent = formatDate(wordData.dateAdded);

    // Delete button
    const deleteBtn = createElement('button', {
      style: `
        background: transparent;
        border: none;
        cursor: pointer;
        color: #a3a3a3;
        font-size: 1rem;
        padding: 0.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        opacity: 0.6;
      `,
      'aria-label': 'Delete word',
    });
    deleteBtn.textContent = '×';

    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.opacity = '1';
      deleteBtn.style.color = '#525252';
    });

    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.opacity = '0.6';
      deleteBtn.style.color = '#a3a3a3';
    });

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteWord(wordData.id);
      showToast(`Deleted "${wordData.word}"`);
      render();
    });

    rightSide.appendChild(dateText);
    rightSide.appendChild(deleteBtn);

    wordRow.appendChild(wordText);
    wordRow.appendChild(rightSide);
    item.appendChild(wordRow);

    // Phonetic if available
    if (wordData.phonetic) {
      const phoneticEl = createElement('p', {
        className: 'text-caption mb-2',
        style: 'font-size: 0.8125rem; color: #a3a3a3; font-style: italic;',
      });
      phoneticEl.textContent = wordData.phonetic;
      item.appendChild(phoneticEl);
    }

    // First definition (truncated)
    if (wordData.definitions && wordData.definitions.length > 0) {
      const firstDef = wordData.definitions[0];
      const defText = createElement('p', {
        className: 'text-body',
        style: `
          font-size: 0.875rem;
          color: #525252;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        `,
      });

      let text = '';
      if (firstDef.partOfSpeech) {
        text += `${firstDef.partOfSpeech}. `;
      }
      text += firstDef.definition || firstDef;

      defText.textContent = text;
      item.appendChild(defText);
    }

    // Book tag if available
    if (book) {
      const bookTag = createElement('div', {
        className: 'mt-2',
      });

      const tag = createElement('span', {
        style: `
          display: inline-block;
          padding: 0.25rem 0.625rem;
          background: rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          font-size: 0.6875rem;
          color: #525252;
          letter-spacing: 0.01em;
        `,
      });
      tag.textContent = book.title;

      bookTag.appendChild(tag);
      item.appendChild(bookTag);
    }

    return item;
  }

  /**
   * Display empty state
   */
  function displayEmptyState() {
    const emptyState = createElement('div', {
      className: 'text-center py-16',
    });

    const message = createElement('p', {
      className: 'text-body',
      style: 'color: #a3a3a3; font-size: 0.9375rem;',
    }, 'Your vocabulary library is empty');

    emptyState.appendChild(message);
    component.appendChild(emptyState);
  }

  // Initial render
  render();

  return {
    render,
  };
}
