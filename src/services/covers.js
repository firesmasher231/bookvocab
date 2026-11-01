import { getAllBooks, updateBook } from './db.js';
import { findCoverUrl } from './books.js';

/*
 * Backfill covers for books saved before cover lookup was fixed: books with no
 * cover, or with only an ISBN-based link (which is often a blank image).
 * Each book is checked once; books still without a cover are retried weekly.
 */

const RETRY_MS = 7 * 24 * 60 * 60 * 1000;

function needsCover(book) {
  if (book.coverUrl && !book.coverUrl.includes('/b/isbn/')) return false;
  if (!book.coverCheckedAt) return true;
  return !book.coverUrl && Date.now() - book.coverCheckedAt > RETRY_MS;
}

let running = false;

export async function backfillCovers() {
  if (running || !navigator.onLine) return;
  running = true;
  let changed = false;
  try {
    const books = (await getAllBooks()).filter(needsCover);
    for (const book of books) {
      try {
        const found = await findCoverUrl(book);
        const coverUrl = found || book.coverUrl || null;
        await updateBook(book.id, { coverUrl, coverCheckedAt: Date.now() });
        if (coverUrl !== book.coverUrl) changed = true;
      } catch (err) {
        console.warn('[Covers] Backfill failed for', book.title, err);
      }
    }
  } finally {
    running = false;
    if (changed) {
      window.dispatchEvent(new Event('books-changed'));
      if (window.refreshBooksList) window.refreshBooksList();
    }
  }
}
