import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { findCover } from "./covers";
import {
  downloadSnapshot,
  insertBook,
  insertBooks,
  loadLibrary,
  markLegacyAnnounced,
  rememberActiveBook,
  removeBook,
  removeWord,
  replaceFromSnapshot,
  saveWord,
} from "./db";
import type { Book, FilterId, Snapshot, WordEntry } from "./model";
import { rowsFromGoodreads, sameBook, uuid, withCounts } from "./model";

export interface ImportSummary {
  added: number;
  skipped: number;
  withoutCover: number;
  skippedWant: number;
  failed: number;
}

interface LibraryValue {
  ready: boolean;
  books: Book[];
  words: WordEntry[];
  activeBookId: string | null;
  filter: FilterId;
  sheet: "add" | "import" | null;
  listId: string | null;
  notice: string | null;
  setFilter: (filter: FilterId) => void;
  setSheet: (sheet: "add" | "import" | null) => void;
  selectBook: (id: string | null) => void;
  openList: (id: string) => void;
  closeList: () => void;
  dismissNotice: () => void;
  keepWord: (entry: Omit<WordEntry, "id" | "dateAdded" | "lastReviewed" | "isFavorite" | "searchCount">) => Promise<string>;
  addBook: (input: Omit<Book, "id" | "dateAdded" | "wordCount" | "source"> & { source?: string }) => Promise<void>;
  importGoodreads: (
    text: string,
    includeWant: boolean,
    onProgress: (done: number, total: number) => void,
  ) => Promise<ImportSummary>;
  exportJson: () => void;
  importJson: (text: string) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  deleteWord: (id: string) => Promise<void>;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function useLibrary(): LibraryValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("Library missing");
  return value;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [sheet, setSheet] = useState<"add" | "import" | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    loadLibrary()
      .then((library) => {
        if (cancel) return;
        setBooks(library.books);
        setWords(library.words);
        setActiveBookId(library.activeBookId);
        if (library.copied > 0) {
          void markLegacyAnnounced();
          setNotice(
            library.copied === 1
              ? "Brought 1 record over from this browser’s Bookvocab library."
              : `Brought ${library.copied} records over from this browser’s Bookvocab library.`,
          );
        }
        setReady(true);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancel) {
          setNotice("Couldn’t open the library in this browser.");
          setReady(true);
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  const selectBook = useCallback((id: string | null) => {
    setActiveBookId(id);
    void rememberActiveBook(id);
  }, []);

  const keepWord = useCallback(
    async (entry: Omit<WordEntry, "id" | "dateAdded" | "lastReviewed" | "isFavorite" | "searchCount">) => {
      const saved = await saveWord({
        ...entry,
        id: uuid(),
        dateAdded: Date.now(),
        lastReviewed: null,
        isFavorite: false,
        searchCount: 1,
        word: entry.word.toLowerCase(),
      });
      setWords((current) => {
        const next = [saved, ...current.filter((word) => word.id !== saved.id && word.word !== saved.word)];
        setBooks((booksNow) => withCounts(booksNow, next));
        return next;
      });
      const title = saved.bookId ? books.find((book) => book.id === saved.bookId)?.title || "that book" : "Misc";
      return title;
    },
    [books],
  );

  const addBookAction = useCallback(
    async (input: Omit<Book, "id" | "dateAdded" | "wordCount" | "source"> & { source?: string }) => {
      const book: Book = {
        ...input,
        id: uuid(),
        dateAdded: Date.now(),
        wordCount: 0,
        source: input.source || "manual",
      };
      await insertBook(book);
      setBooks((current) => [book, ...current]);
      setActiveBookId(book.id);
      await rememberActiveBook(book.id);
    },
    [],
  );

  const importGoodreads = useCallback(
    async (text: string, includeWant: boolean, onProgress: (done: number, total: number) => void) => {
      const { rows, skippedWant } = rowsFromGoodreads(text, includeWant);
      const accepted: typeof rows = [];
      let skipped = 0;
      for (const row of rows) {
        const dup =
          books.some((book) => sameBook(book, row)) || accepted.some((book) => sameBook(book, row));
        if (dup) skipped++;
        else accepted.push(row);
      }
      onProgress(0, accepted.length);
      const created: Book[] = [];
      let withoutCover = 0;
      let failed = 0;
      let cursor = 0;
      let done = 0;
      async function worker() {
        while (cursor < accepted.length) {
          const row = accepted[cursor++];
          try {
            const coverUrl = await findCover(row.isbn, row.title, row.author);
            if (!coverUrl) withoutCover++;
            created.push({
              id: uuid(),
              title: row.title,
              author: row.author,
              isbn: row.isbn,
              coverUrl,
              publishYear: row.publishYear,
              pages: row.pages,
              rating: row.rating,
              shelf: row.shelf,
              dateAdded: Date.now(),
              wordCount: 0,
              source: "goodreads",
              goodreadsId: row.goodreadsId,
            });
          } catch {
            failed++;
          }
          done++;
          onProgress(done, accepted.length);
        }
      }
      const workers = Math.min(3, accepted.length);
      if (workers > 0) await Promise.all(Array.from({ length: workers }, () => worker()));
      if (created.length) {
        await insertBooks(created);
        setBooks((current) => withCounts([...created, ...current], words));
      }
      return { added: created.length, skipped, withoutCover, skippedWant, failed };
    },
    [books, words],
  );

  const exportJson = useCallback(() => {
    downloadSnapshot(books, words, activeBookId);
  }, [books, words, activeBookId]);

  const importJson = useCallback(async (text: string) => {
    const snapshot = JSON.parse(text) as Snapshot;
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.books) || !Array.isArray(snapshot.words)) {
      throw new Error("That file isn’t a Bookvocab backup.");
    }
    await replaceFromSnapshot(snapshot);
    const library = await loadLibrary();
    setBooks(library.books);
    setWords(library.words);
    setActiveBookId(library.activeBookId);
  }, []);

  const deleteBookAction = useCallback(async (id: string) => {
    await removeBook(id);
    setWords((current) => {
      const next = current.filter((word) => word.bookId !== id);
      setBooks((booksNow) => withCounts(booksNow.filter((book) => book.id !== id), next));
      return next;
    });
    setActiveBookId((current) => (current === id ? null : current));
    if (activeBookId === id) void rememberActiveBook(null);
    setListId(null);
  }, [activeBookId]);

  const deleteWordAction = useCallback(async (id: string) => {
    await removeWord(id);
    setWords((current) => {
      const next = current.filter((word) => word.id !== id);
      setBooks((booksNow) => withCounts(booksNow, next));
      return next;
    });
  }, []);

  const value = useMemo<LibraryValue>(
    () => ({
      ready,
      books,
      words,
      activeBookId,
      filter,
      sheet,
      listId,
      notice,
      setFilter,
      setSheet,
      selectBook,
      openList: setListId,
      closeList: () => setListId(null),
      dismissNotice: () => setNotice(null),
      keepWord,
      addBook: addBookAction,
      importGoodreads,
      exportJson,
      importJson,
      deleteBook: deleteBookAction,
      deleteWord: deleteWordAction,
    }),
    [
      ready,
      books,
      words,
      activeBookId,
      filter,
      sheet,
      listId,
      notice,
      selectBook,
      keepWord,
      addBookAction,
      importGoodreads,
      exportJson,
      importJson,
      deleteBookAction,
      deleteWordAction,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
