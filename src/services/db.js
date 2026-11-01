import { openDB } from 'idb';

const DB_NAME = 'bookvocab';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Initialize and open the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export async function initDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create words store
      if (!db.objectStoreNames.contains('words')) {
        const wordsStore = db.createObjectStore('words', { keyPath: 'id' });
        wordsStore.createIndex('word', 'word', { unique: true });
        wordsStore.createIndex('bookId', 'bookId');
        wordsStore.createIndex('dateAdded', 'dateAdded');
        wordsStore.createIndex('isFavorite', 'isFavorite');
      }

      // Create books store
      if (!db.objectStoreNames.contains('books')) {
        const booksStore = db.createObjectStore('books', { keyPath: 'id' });
        booksStore.createIndex('isbn', 'isbn', { unique: true });
        booksStore.createIndex('title', 'title');
        booksStore.createIndex('dateAdded', 'dateAdded');
      }

      // Create settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

/**
 * Generate a simple UUID
 * @returns {string}
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================
// WORDS CRUD Operations
// ============================================

/**
 * Add a new word to the database
 * @param {Object} wordData - Word data object
 * @returns {Promise<Object>} - The created word with ID
 */
export async function addWord(wordData) {
  const db = await initDB();
  const word = {
    id: generateUUID(),
    word: wordData.word,
    definitions: wordData.definitions || [],
    phonetic: wordData.phonetic || '',
    audioUrl: wordData.audioUrl || null,
    bookId: wordData.bookId || null,
    dateAdded: Date.now(),
    lastReviewed: null,
    isFavorite: false,
    ...wordData,
  };

  await db.add('words', word);

  // Update book word count if associated with a book
  if (word.bookId) {
    await updateBookWordCount(word.bookId);
  }

  return word;
}

/**
 * Get a word by its text
 * @param {string} wordText - The word to search for
 * @returns {Promise<Object|null>}
 */
export async function getWordByText(wordText) {
  const db = await initDB();
  const index = db.transaction('words').store.index('word');
  return await index.get(wordText.toLowerCase());
}

/**
 * Get a word by ID
 * @param {string} id - Word ID
 * @returns {Promise<Object|null>}
 */
export async function getWord(id) {
  const db = await initDB();
  return await db.get('words', id);
}

/**
 * Get all words
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
export async function getAllWords(options = {}) {
  const db = await initDB();
  const tx = db.transaction('words', 'readonly');
  const store = tx.objectStore('words');

  let words;

  if (options.bookId) {
    // Filter by book
    const index = store.index('bookId');
    words = await index.getAll(options.bookId);
  } else if (options.favorites) {
    // Get only favorites
    const index = store.index('isFavorite');
    words = await index.getAll(true);
  } else {
    // Get all words
    words = await store.getAll();
  }

  // Sort by date added (newest first) by default
  words.sort((a, b) => b.dateAdded - a.dateAdded);

  return words;
}

/**
 * Update a word
 * @param {string} id - Word ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
export async function updateWord(id, updates) {
  const db = await initDB();
  const word = await db.get('words', id);

  if (!word) {
    throw new Error('Word not found');
  }

  const updated = { ...word, ...updates };
  await db.put('words', updated);

  // Update book word count if bookId changed
  if (updates.bookId && updates.bookId !== word.bookId) {
    if (word.bookId) await updateBookWordCount(word.bookId);
    if (updates.bookId) await updateBookWordCount(updates.bookId);
  }

  return updated;
}

/**
 * Delete a word
 * @param {string} id - Word ID
 * @returns {Promise<void>}
 */
export async function deleteWord(id) {
  const db = await initDB();
  const word = await db.get('words', id);

  if (word) {
    await db.delete('words', id);

    // Update book word count
    if (word.bookId) {
      await updateBookWordCount(word.bookId);
    }
  }
}

/**
 * Search words by query
 * @param {string} query - Search query
 * @returns {Promise<Array>}
 */
export async function searchWords(query) {
  const db = await initDB();
  const allWords = await db.getAll('words');
  const lowercaseQuery = query.toLowerCase();

  return allWords.filter(word =>
    word.word.toLowerCase().includes(lowercaseQuery) ||
    word.definitions.some(def =>
      def.definition && def.definition.toLowerCase().includes(lowercaseQuery)
    )
  );
}

// ============================================
// BOOKS CRUD Operations
// ============================================

/**
 * Add a new book
 * @param {Object} bookData - Book data
 * @returns {Promise<Object>}
 */
/**
 * Tell listeners (the book switcher) that the set of books changed.
 */
function notifyBooksChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('books-changed'));
  }
}

export async function addBook(bookData) {
  const db = await initDB();

  // Check if book with ISBN already exists
  if (bookData.isbn) {
    const existing = await getBookByISBN(bookData.isbn);
    if (existing) {
      return existing;
    }
  }

  const book = {
    id: generateUUID(),
    isbn: bookData.isbn || null,
    title: bookData.title,
    author: bookData.author || 'Unknown',
    coverUrl: bookData.coverUrl || null,
    publishYear: bookData.publishYear || null,
    dateAdded: Date.now(),
    wordCount: 0,
    ...bookData,
  };

  await db.add('books', book);
  notifyBooksChanged();
  return book;
}

/**
 * Get a book by ISBN
 * @param {string} isbn - ISBN number
 * @returns {Promise<Object|null>}
 */
export async function getBookByISBN(isbn) {
  const db = await initDB();
  const index = db.transaction('books').store.index('isbn');
  return await index.get(isbn);
}

/**
 * Get a book by ID
 * @param {string} id - Book ID
 * @returns {Promise<Object|null>}
 */
export async function getBook(id) {
  const db = await initDB();
  return await db.get('books', id);
}

/**
 * Get all books
 * @returns {Promise<Array>}
 */
export async function getAllBooks() {
  const db = await initDB();
  const books = await db.getAll('books');

  // Sort by date added (newest first)
  books.sort((a, b) => b.dateAdded - a.dateAdded);

  return books;
}

/**
 * Update a book
 * @param {string} id - Book ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
export async function updateBook(id, updates) {
  const db = await initDB();
  const book = await db.get('books', id);

  if (!book) {
    throw new Error('Book not found');
  }

  const updated = { ...book, ...updates };
  await db.put('books', updated);
  return updated;
}

/**
 * Delete a book
 * @param {string} id - Book ID
 * @param {boolean} deleteWords - Whether to delete associated words
 * @returns {Promise<void>}
 */
export async function deleteBook(id, deleteWords = false) {
  const db = await initDB();

  if (deleteWords) {
    // Delete all words associated with this book
    const words = await getAllWords({ bookId: id });
    const tx = db.transaction('words', 'readwrite');
    for (const word of words) {
      await tx.store.delete(word.id);
    }
    await tx.done;
  } else {
    // Remove bookId from associated words
    const words = await getAllWords({ bookId: id });
    for (const word of words) {
      await updateWord(word.id, { bookId: null });
    }
  }

  await db.delete('books', id);
  notifyBooksChanged();
}

/**
 * Clear all data from the database
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  const db = await initDB();
  
  // Clear all stores
  const tx = db.transaction(['words', 'books', 'settings'], 'readwrite');
  await tx.objectStore('words').clear();
  await tx.objectStore('books').clear();
  await tx.objectStore('settings').clear();
  await tx.done;
  
  console.log('All data cleared from database');
  notifyBooksChanged();
}

/**
 * Update book word count
 * @param {string} bookId - Book ID
 * @returns {Promise<void>}
 */
async function updateBookWordCount(bookId) {
  const words = await getAllWords({ bookId });
  await updateBook(bookId, { wordCount: words.length });
}

// ============================================
// SETTINGS Operations
// ============================================

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @returns {Promise<any>}
 */
export async function getSetting(key) {
  const db = await initDB();
  const setting = await db.get('settings', key);
  return setting ? setting.value : null;
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  const db = await initDB();
  await db.put('settings', { key, value });
}

/**
 * Get all settings
 * @returns {Promise<Object>}
 */
export async function getAllSettings() {
  const db = await initDB();
  const settings = await db.getAll('settings');
  return settings.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {});
}
