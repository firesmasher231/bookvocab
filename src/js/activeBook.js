import { appState } from './state.js';
import { getAllBooks, getSetting, setSetting } from '../services/db.js';

/*
 * The "active book" is the book new words get attached to. It is shown in the
 * book switcher at the bottom-left of every screen. null means Misc (no book).
 * The choice is persisted in the settings store so it survives reloads.
 */

const SETTING_KEY = 'lastSelectedBookId';

/**
 * Load the persisted active book, dropping it if the book no longer exists.
 */
export async function initActiveBook() {
  window.addEventListener('books-changed', () => {
    refreshBooksState();
  });
  const id = await getSetting(SETTING_KEY);
  const books = await getAllBooks();
  appState.set('books', books);
  appState.set('activeBookId', books.some((b) => b.id === id) ? id : null);
}

/**
 * @returns {string|null} The active book id, or null for Misc
 */
export function getActiveBookId() {
  return appState.get('activeBookId') ?? null;
}

/**
 * Make a book active (or pass null for Misc) and remember the choice.
 * @param {string|null} id
 */
export async function setActiveBook(id) {
  appState.set('activeBookId', id ?? null);
  await setSetting(SETTING_KEY, id ?? null);
}

/**
 * Reload the book list after books are added or removed, and fall back to
 * Misc if the active book was deleted.
 */
export async function refreshBooksState() {
  const books = await getAllBooks();
  appState.set('books', books);
  const active = getActiveBookId();
  if (active && !books.some((b) => b.id === active)) {
    await setActiveBook(null);
  }
}
