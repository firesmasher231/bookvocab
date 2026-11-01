import { createElement, debounce, hapticFeedback, showToast } from '../utils/helpers.js';
import { lookupWord } from '../services/dictionary.js';
import { addWord, getWordByText, getAllBooks } from '../services/db.js';
import { appState } from '../js/state.js';
import { fadeInUp, shake } from '../utils/animations.js';
import { createWordCard } from './WordCard.js';

/**
 * Create word input component
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Component interface
 */
export function createWordInput(container) {
  const component = createElement('div', {
    className: 'word-input-container mb-6',
  });

  // Input wrapper
  const inputWrapper = createElement('div', {
    className: 'relative',
  });

  const input = createElement('input', {
    type: 'text',
    className: 'input-field',
    placeholder: 'Search for a word...',
    'aria-label': 'Search for a word',
    autocomplete: 'off',
  });

  const searchIcon = createElement('div', {
    className: 'absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400',
  });
  searchIcon.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  `;

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(searchIcon);
  component.appendChild(inputWrapper);

  // Results container (for definitions or suggestions)
  const resultsContainer = createElement('div', {
    id: 'word-results',
    className: 'mt-4',
  });
  component.appendChild(resultsContainer);

  container.appendChild(component);

  // State
  let currentWord = null;
  let currentDefinition = null;
  let selectedBookId = null;

  /**
   * Handle word search
   */
  const handleSearch = debounce(async (query) => {
    if (!query || query.length < 2) {
      resultsContainer.innerHTML = '';
      return;
    }

    // Show loading
    resultsContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner"></div></div>';

    try {
      const result = await lookupWord(query);

      if (!result.found) {
        // Show suggestions
        displaySuggestions(result.suggestions, query);
      } else {
        // Show definition
        currentWord = result.word;
        currentDefinition = result;
        await displayDefinition(result);
      }

    } catch (error) {
      console.error('Word lookup error:', error);
      resultsContainer.innerHTML = `
        <div class="text-center text-error py-4">
          <p>${error.message}</p>
        </div>
      `;
      shake(resultsContainer);
    }
  }, 500);

  /**
   * Display word definition with save option
   */
  async function displayDefinition(wordData) {
    resultsContainer.innerHTML = '';

    // Check if word already exists
    const existing = await getWordByText(wordData.word);

    const card = createElement('div', {
      className: 'card',
    });

    // Word header
    const header = createElement('div', {
      className: 'mb-4',
    });

    const title = createElement('h3', {
      className: 'text-2xl font-bold text-gray-900 mb-1',
    }, wordData.word);
    header.appendChild(title);

    if (wordData.phonetic) {
      const phonetic = createElement('p', {
        className: 'text-gray-600 italic',
      }, wordData.phonetic);
      header.appendChild(phonetic);
    }

    if (wordData.audioUrl) {
      const playBtn = createElement('button', {
        className: 'mt-2 text-primary hover:text-primary-light transition-colors flex items-center gap-2',
        onClick: () => {
          hapticFeedback('light');
          const audio = new Audio(wordData.audioUrl);
          audio.play();
        },
      });
      playBtn.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
        <span class="text-sm font-medium">Play pronunciation</span>
      `;
      header.appendChild(playBtn);
    }

    card.appendChild(header);

    // Definitions
    const defsContainer = createElement('div', {
      className: 'space-y-3 mb-4',
    });

    wordData.definitions.forEach((def, index) => {
      const defEl = createElement('div', { className: 'pb-3 border-b border-gray-100 last:border-0' });

      const defText = createElement('p', {
        className: 'text-gray-800',
      });

      if (def.partOfSpeech) {
        const pos = createElement('span', {
          className: 'inline-block bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium mr-2',
        }, def.partOfSpeech);
        defText.appendChild(pos);
      }

      defText.appendChild(createElement('span', {}, def.definition));
      defEl.appendChild(defText);

      // Examples
      if (def.examples && def.examples.length > 0) {
        const examplesList = createElement('ul', {
          className: 'mt-2 ml-4 space-y-1 text-sm text-gray-600 italic',
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

    // Save button (if not already saved)
    if (!existing) {
      await displaySaveSection(card, wordData);
    } else {
      const existingNote = createElement('p', {
        className: 'text-center text-gray-500 text-sm py-2',
      }, 'Already in your library');
      card.appendChild(existingNote);
    }

    resultsContainer.appendChild(card);
    fadeInUp(card);
  }

  /**
   * Display save section with book selection
   */
  async function displaySaveSection(card, wordData) {
    const saveSection = createElement('div', {
      className: 'pt-4 border-t border-gray-200',
    });

    // Book selection
    const books = await getAllBooks();

    if (books.length > 0) {
      const label = createElement('label', {
        className: 'block text-sm font-medium text-gray-700 mb-2',
      }, 'Associate with book (optional):');
      saveSection.appendChild(label);

      const select = createElement('select', {
        className: 'input-field mb-3',
      });

      const defaultOption = createElement('option', { value: '' }, 'None');
      select.appendChild(defaultOption);

      books.forEach(book => {
        const option = createElement('option', { value: book.id }, `${book.title} - ${book.author}`);
        select.appendChild(option);
      });

      select.addEventListener('change', (e) => {
        selectedBookId = e.target.value || null;
      });

      saveSection.appendChild(select);
    }

    // Save button
    const saveBtn = createElement('button', {
      className: 'btn-primary w-full',
      onClick: async () => {
        hapticFeedback('medium');
        try {
          const wordToSave = {
            word: wordData.word,
            definitions: wordData.definitions,
            phonetic: wordData.phonetic,
            audioUrl: wordData.audioUrl,
            bookId: selectedBookId,
          };

          await addWord(wordToSave);
          showToast(`"${wordData.word}" added to library`, 'success');

          // Clear input and results
          input.value = '';
          resultsContainer.innerHTML = '';

          // Refresh word list
          appState.set('searchQuery', ''); // Trigger reload
          if (window.refreshWordList) window.refreshWordList();

        } catch (error) {
          console.error('Failed to save word:', error);
          showToast('Failed to save word', 'error');
        }
      },
    }, 'Save to Library');

    saveSection.appendChild(saveBtn);
    card.appendChild(saveSection);
  }

  /**
   * Display suggestions when word not found
   */
  function displaySuggestions(suggestions, originalQuery) {
    resultsContainer.innerHTML = '';

    const card = createElement('div', {
      className: 'card text-center',
    });

    const title = createElement('p', {
      className: 'text-gray-600 mb-3',
    }, `No results found for "${originalQuery}"`);
    card.appendChild(title);

    if (suggestions && suggestions.length > 0) {
      const suggestionsTitle = createElement('p', {
        className: 'text-sm font-medium text-gray-700 mb-2',
      }, 'Did you mean:');
      card.appendChild(suggestionsTitle);

      const suggestionsList = createElement('div', {
        className: 'flex flex-wrap gap-2 justify-center',
      });

      suggestions.forEach(suggestion => {
        const btn = createElement('button', {
          className: 'px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors',
          onClick: () => {
            input.value = suggestion;
            handleSearch(suggestion);
          },
        }, suggestion);
        suggestionsList.appendChild(btn);
      });

      card.appendChild(suggestionsList);
    }

    resultsContainer.appendChild(card);
    fadeInUp(card);
  }

  // Event listeners
  input.addEventListener('input', (e) => {
    handleSearch(e.target.value.trim());
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(input.value.trim());
    }
  });

  return {
    focus: () => input.focus(),
    clear: () => {
      input.value = '';
      resultsContainer.innerHTML = '';
    },
  };
}
