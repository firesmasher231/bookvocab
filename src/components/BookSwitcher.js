import { createElement, hapticFeedback, showToast } from '../utils/helpers.js';
import { appState } from '../js/state.js';
import { getActiveBookId, setActiveBook } from '../js/activeBook.js';
import { addBook } from '../services/db.js';
import { searchBooksByTitle } from '../services/books.js';

/* ------------------------------------------------------------------ */
/* Cover helpers                                                       */
/* ------------------------------------------------------------------ */

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
];

function initials(title) {
  const words = (title || '?').trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function gradientFor(title) {
  let hash = 0;
  for (const ch of title || '') hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * A small book cover: the real cover if it loads, otherwise coloured initials.
 * Misc (no book) gets a neutral stack icon.
 * @param {Object|null} book
 * @param {number} width
 * @param {number} height
 */
export function createCoverThumb(book, width = 26, height = 36) {
  const box = createElement('div', {
    className: 'book-thumb',
    style: `
      width: ${width}px; height: ${height}px; flex-shrink: 0;
      border-radius: 4px; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    `,
  });

  const showInitials = () => {
    box.innerHTML = '';
    box.style.background = gradientFor(book.title);
    box.style.color = 'white';
    box.style.fontSize = `${Math.round(width * 0.36)}px`;
    box.style.fontWeight = '600';
    box.style.letterSpacing = '0.02em';
    box.textContent = initials(book.title);
  };

  if (!book) {
    box.style.background = '#e5e5e5';
    box.style.color = '#737373';
    box.style.boxShadow = 'none';
    box.style.fontSize = `${Math.round(width * 0.55)}px`;
    box.textContent = '✱';
    box.setAttribute('aria-hidden', 'true');
    return box;
  }

  if (book.coverUrl) {
    const img = createElement('img', {
      alt: '',
      style: 'width: 100%; height: 100%; object-fit: cover; display: block;',
    });
    // Open Library returns a 1x1 image when it has no cover.
    img.addEventListener('load', () => {
      if (img.naturalWidth <= 2) showInitials();
    });
    img.addEventListener('error', showInitials);
    img.src = book.coverUrl;
    box.style.background = '#e5e5e5';
    box.appendChild(img);
  } else {
    showInitials();
  }
  return box;
}

/* ------------------------------------------------------------------ */
/* Bottom-left chip                                                    */
/* ------------------------------------------------------------------ */

/**
 * Create the always-visible book switcher chip.
 * @returns {HTMLElement}
 */
export function createBookSwitcher() {
  const chip = createElement('button', {
    type: 'button',
    className: 'book-switcher glass-pill',
    'aria-haspopup': 'dialog',
    onClick: () => {
      hapticFeedback('light');
      openBookSheet();
    },
  });

  function render() {
    const books = appState.get('books') || [];
    const book = books.find((b) => b.id === getActiveBookId()) || null;
    chip.innerHTML = '';
    chip.setAttribute(
      'aria-label',
      `Current book: ${book ? book.title : 'Misc'}. Tap to switch.`
    );

    chip.appendChild(createCoverThumb(book));

    const text = createElement('span', { className: 'book-switcher-text' });
    text.appendChild(createElement('span', { className: 'book-switcher-label' }, 'Reading'));
    text.appendChild(
      createElement('span', { className: 'book-switcher-title' }, book ? book.title : 'Misc')
    );
    chip.appendChild(text);

    const caret = createElement('span', { className: 'book-switcher-caret', 'aria-hidden': 'true' });
    caret.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 6.5 5 3.5 8 6.5"/></svg>`;
    chip.appendChild(caret);
  }

  appState.subscribe('activeBookId', render);
  appState.subscribe('books', render);
  render();
  return chip;
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

let sheetOpen = false;

export function openBookSheet() {
  if (sheetOpen) return;
  sheetOpen = true;

  const overlay = createElement('div', {
    className: 'sheet-overlay',
    onClick: (e) => {
      if (e.target === overlay) close();
    },
  });

  const sheet = createElement('div', {
    className: 'sheet',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'book-sheet-title',
  });

  sheet.appendChild(createElement('div', { className: 'sheet-handle', 'aria-hidden': 'true' }));
  sheet.appendChild(
    createElement('h3', { id: 'book-sheet-title', className: 'sheet-title' }, 'What are you reading?')
  );
  sheet.appendChild(
    createElement('p', { className: 'sheet-subtitle' }, 'New words are saved to this book.')
  );

  const list = createElement('div', { className: 'sheet-list' });
  sheet.appendChild(list);

  function renderList() {
    list.innerHTML = '';
    const books = [...(appState.get('books') || [])].sort(
      (a, b) => (b.dateAdded || 0) - (a.dateAdded || 0)
    );
    const active = getActiveBookId();

    const row = (book) => {
      const selected = book ? book.id === active : active === null;
      const item = createElement('button', {
        type: 'button',
        className: `sheet-row${selected ? ' is-selected' : ''}`,
        'aria-pressed': String(selected),
        onClick: async () => {
          hapticFeedback('light');
          await setActiveBook(book ? book.id : null);
          close();
        },
      });
      item.appendChild(createCoverThumb(book, 32, 44));
      const text = createElement('span', { className: 'sheet-row-text' });
      text.appendChild(createElement('span', { className: 'sheet-row-title' }, book ? book.title : 'Misc'));
      text.appendChild(
        createElement(
          'span',
          { className: 'sheet-row-sub' },
          book ? book.author || 'Unknown author' : 'Words not tied to a book'
        )
      );
      item.appendChild(text);
      const check = createElement('span', { className: 'sheet-row-check', 'aria-hidden': 'true' });
      check.textContent = selected ? '✓' : '';
      item.appendChild(check);
      return item;
    };

    books.forEach((b) => list.appendChild(row(b)));
    list.appendChild(row(null));
  }
  renderList();
  const unsub = appState.subscribe('books', renderList);

  // Actions
  const actions = createElement('div', { className: 'sheet-actions' });

  const addForm = createElement('form', { className: 'sheet-add', style: 'display: none;' });
  const addInput = createElement('input', {
    type: 'text',
    className: 'input-field',
    placeholder: 'Book title',
    'aria-label': 'Book title',
    autocomplete: 'off',
  });
  const addSubmit = createElement('button', { type: 'submit', className: 'btn-primary' }, 'Add');
  addForm.appendChild(addInput);
  addForm.appendChild(addSubmit);
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = addInput.value.trim();
    if (!title) return;
    addSubmit.disabled = true;
    addSubmit.textContent = '…';
    let data = { title, author: 'Unknown', isbn: null, coverUrl: null, publishYear: null };
    try {
      const found = (await searchBooksByTitle(title, 1))?.[0];
      if (found) {
        data = {
          title: found.title || title,
          author: found.author || 'Unknown',
          isbn: found.isbn || null,
          coverUrl: found.coverUrl || null,
          publishYear: found.publishYear || null,
        };
      }
    } catch (err) {
      console.warn('Book search failed, adding by title only:', err);
    }
    try {
      const book = await addBook(data);
      await setActiveBook(book.id);
      hapticFeedback('medium');
      showToast(`Now reading: ${book.title}`, 'success');
      close();
    } catch (err) {
      console.error('Failed to add book:', err);
      showToast('Could not add book', 'error');
      addSubmit.disabled = false;
      addSubmit.textContent = 'Add';
    }
  });

  const addBtn = createElement(
    'button',
    {
      type: 'button',
      className: 'sheet-action',
      onClick: () => {
        addForm.style.display = 'flex';
        addBtn.style.display = 'none';
        addInput.focus();
      },
    },
    '＋ Add by title'
  );
  const scanBtn = createElement(
    'button',
    {
      type: 'button',
      className: 'sheet-action',
      onClick: () => {
        close();
        appState.set('currentView', 'scanner');
      },
    },
    '▥ Scan barcode'
  );

  actions.appendChild(addBtn);
  actions.appendChild(scanBtn);
  sheet.appendChild(actions);
  sheet.appendChild(addForm);

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  function close() {
    if (!sheetOpen) return;
    sheetOpen = false;
    unsub();
    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 220);
  }
}
