export type Shelf = "reading" | "read" | "to-read";

export interface Definition {
  partOfSpeech: string;
  definition: string;
  examples: string[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  coverUrl: string | null;
  publishYear: number | null;
  pages: number | null;
  rating: number | null;
  shelf: Shelf;
  dateAdded: number;
  wordCount: number;
  source: string;
  goodreadsId: string | null;
}

export interface WordEntry {
  id: string;
  word: string;
  definitions: Definition[];
  phonetic: string;
  audioUrl: string | null;
  bookId: string | null;
  dateAdded: number;
  lastReviewed: number | null;
  isFavorite: boolean;
  searchCount: number;
}

export interface LookupHit {
  found: true;
  word: string;
  phonetic: string;
  audioUrl: string | null;
  definitions: Definition[];
}

export interface LookupMiss {
  found: false;
  suggestions: string[];
}

export type Lookup = LookupHit | LookupMiss;

export interface Snapshot {
  version: 1;
  exportedAt: string;
  books: Book[];
  words: WordEntry[];
  activeBookId: string | null;
}

export type FilterId = "all" | "reading" | "read" | "words";

export const MISC_ID = "misc";

export function uuid(): string {
  return crypto.randomUUID();
}

export function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cleanIsbn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.trim().replace(/^="?|"$/g, "");
  const digits = stripped.replace(/[^0-9Xx]/g, "");
  if (digits.length === 10 || digits.length === 13) return digits.toUpperCase();
  return null;
}

export function isbnKey(isbn: string | null): string | null {
  if (!isbn) return null;
  return isbn.length === 13 ? isbn.slice(3) : isbn;
}

export function sameBook(
  a: { isbn: string | null; title: string; author: string; goodreadsId?: string | null },
  b: { isbn: string | null; title: string; author: string; goodreadsId?: string | null },
): boolean {
  if (a.goodreadsId && b.goodreadsId && a.goodreadsId === b.goodreadsId) return true;
  if (a.isbn && b.isbn && (a.isbn === b.isbn || isbnKey(a.isbn) === isbnKey(b.isbn))) return true;
  return norm(a.title) === norm(b.title) && norm(a.author) === norm(b.author);
}

export function withCounts(books: Book[], words: WordEntry[]): Book[] {
  const counts = new Map<string, number>();
  for (const word of words) {
    if (!word.bookId) continue;
    counts.set(word.bookId, (counts.get(word.bookId) || 0) + 1);
  }
  return books.map((book) => ({ ...book, wordCount: counts.get(book.id) || 0 }));
}

export function wordsFor(words: WordEntry[], bookId: string | null): WordEntry[] {
  return words
    .filter((word) => (bookId ? word.bookId === bookId : !word.bookId))
    .sort((a, b) => b.dateAdded - a.dateAdded);
}

export function clothIndex(title: string): number {
  let hash = 0;
  for (const ch of title) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return Math.abs(hash) % 8;
}

const SHELF_RANK: Record<Shelf, number> = { reading: 0, read: 1, "to-read": 2 };

export function wallBooks(books: Book[], filter: FilterId): Book[] {
  return books
    .filter((book) => {
      if (filter === "reading") return book.shelf === "reading";
      if (filter === "read") return book.shelf === "read";
      if (filter === "words") return book.wordCount > 0;
      return true;
    })
    .sort((a, b) => SHELF_RANK[a.shelf] - SHELF_RANK[b.shelf] || b.dateAdded - a.dateAdded);
}

export function showMisc(filter: FilterId, looseCount: number): boolean {
  if (filter === "all") return true;
  if (filter === "words") return looseCount > 0;
  return false;
}

export function parseExclusiveShelf(raw: string): Shelf | "skip" {
  const shelf = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (shelf === "currently-reading" || shelf === "reading") return "reading";
  if (shelf === "read") return "read";
  if (shelf === "to-read" || shelf === "want-to-read" || shelf === "to-read") return "to-read";
  if (!shelf) return "skip";
  return "skip";
}

function parseIntish(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/\d{1,4}/);
  if (!match) return null;
  const n = Number.parseInt(match[0], 10);
  return Number.isFinite(n) ? n : null;
}

export interface GoodreadsRow {
  title: string;
  author: string;
  isbn: string | null;
  publishYear: number | null;
  pages: number | null;
  rating: number | null;
  shelf: Shelf;
  goodreadsId: string | null;
}

/** RFC-style CSV that understands quotes, commas, and Goodreads `="isbn"` cells. */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const header = (rows[0] || []).map((h) => h.trim());
  if (!header.length) return [];
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((key, index) => {
      obj[key] = (r[index] ?? "").trim();
    });
    return obj;
  });
}

export function rowsFromGoodreads(text: string, includeWant: boolean): { rows: GoodreadsRow[]; skippedWant: number } {
  const records = parseCsv(text);
  const rows: GoodreadsRow[] = [];
  let skippedWant = 0;
  for (const record of records) {
    const title = record.Title || record.title || "";
    if (!title.trim()) continue;
    const shelf = parseExclusiveShelf(record["Exclusive Shelf"] || record["exclusive shelf"] || "");
    if (shelf === "to-read" && !includeWant) {
      skippedWant++;
      continue;
    }
    if (shelf === "skip") continue;
    const isbn13 = cleanIsbn(record.ISBN13 || record.isbn13);
    const isbn10 = cleanIsbn(record.ISBN || record.isbn);
    const rating = parseIntish(record["My Rating"]);
    rows.push({
      title: title.trim(),
      author: (record.Author || record.author || "Unknown").trim() || "Unknown",
      isbn: isbn13 || isbn10,
      publishYear: parseIntish(record["Original Publication Year"]) || parseIntish(record["Year Published"]),
      pages: parseIntish(record["Number of Pages"]),
      rating: rating && rating > 0 ? rating : null,
      shelf,
      goodreadsId: (record["Book Id"] || "").trim() || null,
    });
  }
  return { rows, skippedWant };
}
