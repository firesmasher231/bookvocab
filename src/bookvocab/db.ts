import type { Book, Snapshot, WordEntry } from "./model";
import { uuid, withCounts } from "./model";
import { SEED_BOOKS, SEED_WORDS } from "./seed";

const NEW_DB = "bookvocab-wall";
const LEGACY_DB = "bookvocab";
const VERSION = 1;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openWall(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NEW_DB, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) {
        const books = db.createObjectStore("books", { keyPath: "id" });
        books.createIndex("isbn", "isbn", { unique: false });
        books.createIndex("title", "title", { unique: false });
      }
      if (!db.objectStoreNames.contains("words")) {
        const words = db.createObjectStore("words", { keyPath: "id" });
        words.createIndex("word", "word", { unique: true });
        words.createIndex("bookId", "bookId", { unique: false });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Open the live site's database read-only. Never creates it, never writes,
 * never bumps its version. A missing database stays missing.
 */
async function openLegacy(): Promise<IDBDatabase | null> {
  if (typeof indexedDB.databases === "function") {
    try {
      const list = await indexedDB.databases();
      if (!list.some((entry) => entry.name === LEGACY_DB)) return null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    let created = false;
    const request = indexedDB.open(LEGACY_DB);
    request.onupgradeneeded = () => {
      created = true;
      try {
        request.transaction?.abort();
      } catch {
        /* already closing */
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (created || !db.objectStoreNames.contains("books") || !db.objectStoreNames.contains("words")) {
        db.close();
        resolve(null);
        return;
      }
      resolve(db);
    };
    request.onerror = () => resolve(null);
  });
}

async function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

async function getSetting<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  const tx = db.transaction("settings", "readonly");
  const row = await requestToPromise(tx.objectStore("settings").get(key) as IDBRequest<{ key: string; value: T } | undefined>);
  return row?.value;
}

async function setSetting(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  const tx = db.transaction("settings", "readwrite");
  tx.objectStore("settings").put({ key, value });
  await transactionDone(tx);
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function addRecord(db: IDBDatabase, store: string, value: unknown): Promise<"added" | "duplicate" | "failed"> {
  try {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).add(value);
    await transactionDone(tx);
    return "added";
  } catch (error) {
    if (error instanceof DOMException && error.name === "ConstraintError") return "duplicate";
    return "failed";
  }
}

function asBook(raw: Record<string, unknown>, source: string): Book | null {
  if (!raw || typeof raw.id !== "string" || !raw.title) return null;
  const shelf = raw.shelf === "read" || raw.shelf === "to-read" || raw.shelf === "reading" ? raw.shelf : "reading";
  const pages =
    typeof raw.pages === "number" ? raw.pages : typeof raw.numberOfPages === "number" ? raw.numberOfPages : null;
  return {
    id: raw.id,
    title: String(raw.title),
    author: raw.author ? String(raw.author) : "Unknown",
    isbn: raw.isbn ? String(raw.isbn) : null,
    coverUrl: raw.coverUrl ? String(raw.coverUrl) : null,
    publishYear: typeof raw.publishYear === "number" ? raw.publishYear : null,
    pages,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    shelf,
    dateAdded: typeof raw.dateAdded === "number" ? raw.dateAdded : Date.now(),
    wordCount: typeof raw.wordCount === "number" ? raw.wordCount : 0,
    source: typeof raw.source === "string" ? raw.source : source,
    goodreadsId: raw.goodreadsId ? String(raw.goodreadsId) : null,
  };
}

function asWord(raw: Record<string, unknown>): WordEntry | null {
  if (!raw || typeof raw.id !== "string" || !raw.word) return null;
  const definitions = Array.isArray(raw.definitions) ? raw.definitions : [];
  return {
    id: raw.id,
    word: String(raw.word),
    definitions: definitions.map((item) => {
      const def = item as Record<string, unknown>;
      return {
        partOfSpeech: def.partOfSpeech ? String(def.partOfSpeech) : "",
        definition: def.definition ? String(def.definition) : String(item),
        examples: Array.isArray(def.examples) ? def.examples.map(String) : [],
      };
    }),
    phonetic: raw.phonetic ? String(raw.phonetic) : "",
    audioUrl: raw.audioUrl ? String(raw.audioUrl) : null,
    bookId: raw.bookId ? String(raw.bookId) : null,
    dateAdded: typeof raw.dateAdded === "number" ? raw.dateAdded : Date.now(),
    lastReviewed: typeof raw.lastReviewed === "number" ? raw.lastReviewed : null,
    isFavorite: Boolean(raw.isFavorite),
    searchCount: typeof raw.searchCount === "number" ? raw.searchCount : 1,
  };
}

interface Seen {
  books: string[];
  words: string[];
}

/**
 * Copy books, words, and the last-selected book out of the original
 * `bookvocab` database. The original is only read. Repeat visits skip ids
 * already copied, including ones later deleted here.
 */
async function importLegacy(db: IDBDatabase): Promise<number> {
  const legacy = await openLegacy();
  if (!legacy) return 0;
  let copied = 0;
  try {
    const [books, words, settingsRows] = await Promise.all([
      getAll<Record<string, unknown>>(legacy, "books"),
      getAll<Record<string, unknown>>(legacy, "words"),
      getAll<{ key: string; value: unknown }>(legacy, "settings").catch(() => []),
    ]);
    const seen = (await getSetting<Seen>(db, "legacySeen")) || { books: [], words: [] };
    const bookSeen = new Set(seen.books);
    const wordSeen = new Set(seen.words);

    for (const raw of books) {
      const book = asBook(raw, "legacy");
      if (!book || bookSeen.has(book.id)) continue;
      const result = await addRecord(db, "books", book);
      if (result !== "failed") {
        bookSeen.add(book.id);
        if (result === "added") copied++;
      }
    }
    for (const raw of words) {
      const word = asWord(raw);
      if (!word || wordSeen.has(word.id)) continue;
      const result = await addRecord(db, "words", word);
      if (result !== "failed") {
        wordSeen.add(word.id);
        if (result === "added") copied++;
      }
    }
    await setSetting(db, "legacySeen", { books: [...bookSeen], words: [...wordSeen] });
    await setSetting(db, "sawLegacy", true);

    const selectionCopied = await getSetting<boolean>(db, "selectionCopied");
    if (!selectionCopied) {
      const legacySelection = settingsRows.find((row) => row.key === "lastSelectedBookId")?.value;
      const id = typeof legacySelection === "string" ? legacySelection : null;
      if (id === null || bookSeen.has(id)) {
        await setSetting(db, "lastSelectedBookId", id);
      }
      await setSetting(db, "selectionCopied", true);
    }
  } finally {
    legacy.close();
  }
  return copied;
}

async function seedIfEmpty(db: IDBDatabase): Promise<void> {
  const [books, words, sawLegacy, didSeed] = await Promise.all([
    getAll<Book>(db, "books"),
    getAll<WordEntry>(db, "words"),
    getSetting<boolean>(db, "sawLegacy"),
    getSetting<boolean>(db, "didSeed"),
  ]);
  if (books.length || words.length || sawLegacy || didSeed) return;
  for (const book of SEED_BOOKS) await addRecord(db, "books", book);
  for (const word of SEED_WORDS) await addRecord(db, "words", word);
  await setSetting(db, "didSeed", true);
  await setSetting(db, "lastSelectedBookId", "seed-circe");
}

export interface LibrarySnapshot {
  books: Book[];
  words: WordEntry[];
  activeBookId: string | null;
  copied: number;
}

export async function loadLibrary(): Promise<LibrarySnapshot> {
  const db = await openWall();
  try {
    const copied = await importLegacy(db);
    await seedIfEmpty(db);
    const [books, words, active] = await Promise.all([
      getAll<Book>(db, "books"),
      getAll<WordEntry>(db, "words"),
      getSetting<string | null>(db, "lastSelectedBookId"),
    ]);
    const counted = withCounts(books, words);
    const activeBookId = active && counted.some((book) => book.id === active) ? active : null;
    if (copied > 0) {
      const previous = (await getSetting<number>(db, "legacyImportCount")) || 0;
      await setSetting(db, "legacyImportCount", previous + copied);
    }
    const announced = await getSetting<boolean>(db, "legacyAnnounced");
    const imported = (await getSetting<number>(db, "legacyImportCount")) || 0;
    return { books: counted, words, activeBookId, copied: announced ? 0 : imported };
  } finally {
    db.close();
  }
}

export async function markLegacyAnnounced(): Promise<void> {
  const db = await openWall();
  try {
    await setSetting(db, "legacyAnnounced", true);
  } finally {
    db.close();
  }
}

export async function rememberActiveBook(id: string | null): Promise<void> {
  const db = await openWall();
  try {
    await setSetting(db, "lastSelectedBookId", id);
  } finally {
    db.close();
  }
}

export async function insertBook(book: Book): Promise<void> {
  const db = await openWall();
  try {
    await addRecord(db, "books", book);
  } finally {
    db.close();
  }
}

export async function insertBooks(books: Book[]): Promise<number> {
  const db = await openWall();
  try {
    let added = 0;
    for (const book of books) {
      if ((await addRecord(db, "books", book)) === "added") added++;
    }
    return added;
  } finally {
    db.close();
  }
}

export async function removeBook(id: string): Promise<void> {
  const db = await openWall();
  try {
    const words = await getAll<WordEntry>(db, "words");
    const tx = db.transaction(["books", "words"], "readwrite");
    tx.objectStore("books").delete(id);
    for (const word of words) {
      if (word.bookId === id) tx.objectStore("words").delete(word.id);
    }
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function saveWord(entry: WordEntry): Promise<WordEntry> {
  const db = await openWall();
  try {
    const tx = db.transaction("words", "readwrite");
    const store = tx.objectStore("words");
    const index = store.index("word");
    const existing = await requestToPromise(index.get(entry.word.toLowerCase()) as IDBRequest<WordEntry | undefined>);
    const next: WordEntry = existing
      ? {
          ...existing,
          definitions: entry.definitions.length ? entry.definitions : existing.definitions,
          phonetic: entry.phonetic || existing.phonetic,
          audioUrl: entry.audioUrl || existing.audioUrl,
          bookId: entry.bookId,
          searchCount: (existing.searchCount || 1) + 1,
        }
      : { ...entry, id: entry.id || uuid(), word: entry.word.toLowerCase(), searchCount: 1 };
    store.put(next);
    await transactionDone(tx);
    return next;
  } finally {
    db.close();
  }
}

export async function removeWord(id: string): Promise<void> {
  const db = await openWall();
  try {
    const tx = db.transaction("words", "readwrite");
    tx.objectStore("words").delete(id);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function replaceFromSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await openWall();
  try {
    for (const book of snapshot.books) {
      const normalized = asBook(book as unknown as Record<string, unknown>, book.source || "backup");
      if (normalized) await addRecord(db, "books", normalized);
    }
    for (const word of snapshot.words) {
      const normalized = asWord(word as unknown as Record<string, unknown>);
      if (normalized) await addRecord(db, "words", normalized);
    }
    const current = await getSetting<string | null>(db, "lastSelectedBookId");
    if (current == null && snapshot.activeBookId) {
      await setSetting(db, "lastSelectedBookId", snapshot.activeBookId);
    }
  } finally {
    db.close();
  }
}

export function downloadSnapshot(books: Book[], words: WordEntry[], activeBookId: string | null): void {
  const snapshot: Snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    books,
    words,
    activeBookId,
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bookvocab-backup.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
