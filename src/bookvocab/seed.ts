import type { Book, WordEntry } from "./model";

function book(
  id: string,
  title: string,
  author: string,
  cover: number,
  year: number,
  shelf: Book["shelf"],
  isbn: string,
): Book {
  return {
    id,
    title,
    author,
    isbn,
    coverUrl: `https://covers.openlibrary.org/b/id/${cover}-L.jpg`,
    publishYear: year,
    pages: null,
    rating: null,
    shelf,
    dateAdded: Date.UTC(year, 0, 1),
    wordCount: 0,
    source: "seed",
    goodreadsId: null,
  };
}

/** Shown only when this browser has neither a wall library nor the original database. */
export const SEED_BOOKS: Book[] = [
  book("seed-circe", "Circe", "Madeline Miller", 8739376, 2018, "reading", "9780316556347"),
  book("seed-piranesi", "Piranesi", "Susanna Clarke", 10226290, 2020, "reading", "9781635575637"),
  book("seed-klara", "Klara and the Sun", "Kazuo Ishiguro", 10648686, 2021, "reading", "9780593318171"),
  book("seed-never", "Never Let Me Go", "Kazuo Ishiguro", 1047334, 2005, "read", "9781400078776"),
  book("seed-remains", "The Remains of the Day", "Kazuo Ishiguro", 95742, 1989, "read", "9780679731726"),
  book("seed-beloved", "Beloved", "Toni Morrison", 8261367, 1987, "read", "9781400033416"),
  book("seed-left", "The Left Hand of Darkness", "Ursula K. Le Guin", 10618463, 1969, "read", "9780441478125"),
  book("seed-station", "Station Eleven", "Emily St. John Mandel", 7369961, 2014, "read", "9780385353304"),
  book("seed-normal", "Normal People", "Sally Rooney", 8794265, 2018, "read", "9781984822178"),
  book("seed-secret", "The Secret History", "Donna Tartt", 744854, 1992, "read", "9780140167771"),
  book("seed-moscow", "A Gentleman in Moscow", "Amor Towles", 11326818, 2016, "read", "9780670026197"),
  book("seed-vanish", "The Vanishing Half", "Brit Bennett", 10095692, 2020, "read", "9780525536291"),
  {
    id: "seed-hours",
    title: "The Hours",
    author: "Michael Cunningham",
    isbn: "9780312243029",
    coverUrl: null,
    publishYear: 1998,
    pages: null,
    rating: null,
    shelf: "read",
    dateAdded: Date.UTC(1998, 0, 1),
    wordCount: 0,
    source: "seed",
    goodreadsId: null,
  },
];

export const SEED_WORDS: WordEntry[] = [
  {
    id: "seed-word-luminous",
    word: "luminous",
    definitions: [
      { partOfSpeech: "adjective", definition: "full of or shedding light; bright or shining.", examples: [] },
      { partOfSpeech: "adjective", definition: "intellectually brilliant.", examples: [] },
    ],
    phonetic: "ˈluːmɪnəs",
    audioUrl: null,
    bookId: "seed-circe",
    dateAdded: Date.UTC(2018, 5, 2),
    lastReviewed: null,
    isFavorite: false,
    searchCount: 1,
  },
  {
    id: "seed-word-ephemeral",
    word: "ephemeral",
    definitions: [{ partOfSpeech: "adjective", definition: "lasting for a very short time.", examples: [] }],
    phonetic: "ɪˈfɛmərəl",
    audioUrl: null,
    bookId: null,
    dateAdded: Date.UTC(2024, 3, 12),
    lastReviewed: null,
    isFavorite: false,
    searchCount: 1,
  },
];
