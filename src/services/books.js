/*
 * Book metadata and cover lookup.
 *
 * Sources, in order:
 *  1. Open Library "books" API (by ISBN): title, author, publisher, pages and,
 *     when it has one, a ready-made cover URL.
 *  2. Open Library search: its cover_i id finds a cover from any edition of
 *     the same work, which covers far more books than the ISBN alone.
 *  3. Google Books: fallback for metadata and covers Open Library lacks.
 *
 * Cover URLs are never "checked" with fetch(): covers.openlibrary.org does not
 * send CORS headers, so those checks always failed and books were saved with
 * no cover at all. Images detect missing covers themselves when they load.
 */

const OL = 'https://openlibrary.org';
const OL_COVERS = 'https://covers.openlibrary.org';
const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';

const SEARCH_FIELDS =
  'title,author_name,first_publish_year,isbn,cover_i,publisher,number_of_pages_median';

/** Cover URL for an Open Library cover id. */
export function coverUrlFromId(coverId, size = 'L') {
  return `${OL_COVERS}/b/id/${coverId}-${size}.jpg`;
}

/**
 * Cover URL for an ISBN. default=false makes Open Library return 404 rather
 * than a blank 1x1 image when it has no cover, so <img> onerror fires.
 */
export function buildCoverUrl(isbn, size = 'L') {
  return `${OL_COVERS}/b/isbn/${isbn}-${size}.jpg?default=false`;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function extractPublishYear(publishDate) {
  if (!publishDate) return null;
  const match = String(publishDate).match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

/** Google Books image links are small http thumbnails; ask for a bigger https one. */
function googleCover(imageLinks) {
  const url =
    imageLinks?.extraLarge ||
    imageLinks?.large ||
    imageLinks?.medium ||
    imageLinks?.thumbnail ||
    imageLinks?.smallThumbnail;
  if (!url) return null;
  return url
    .replace(/^http:/, 'https:')
    .replace(/&edge=curl/, '')
    .replace(/zoom=\d/, 'zoom=1') + '&fife=w800';
}

async function searchOpenLibrary(params, limit = 1) {
  const qs = new URLSearchParams({ ...params, limit: String(limit), fields: SEARCH_FIELDS });
  const data = await getJson(`${OL}/search.json?${qs}`);
  return data.docs || [];
}

async function searchGoogle(query) {
  const data = await getJson(`${GOOGLE}?q=${encodeURIComponent(query)}&maxResults=1`);
  return data.items?.[0]?.volumeInfo || null;
}

/**
 * Find the best cover URL for a book, trying several sources.
 * @param {{isbn?: string, title?: string, author?: string}} book
 * @returns {Promise<string|null>}
 */
export async function findCoverUrl({ isbn, title, author } = {}) {
  const attempts = [];
  if (isbn) attempts.push(() => searchOpenLibrary({ isbn }));
  if (title) {
    const params = { title };
    if (author && author !== 'Unknown' && author !== 'Unknown Author') params.author = author;
    attempts.push(() => searchOpenLibrary(params));
  }
  for (const attempt of attempts) {
    try {
      const doc = (await attempt()).find((d) => d.cover_i);
      if (doc) return coverUrlFromId(doc.cover_i);
    } catch (err) {
      console.warn('[Covers] Open Library search failed:', err);
    }
  }

  try {
    const q = isbn ? `isbn:${isbn}` : `intitle:${title}${author ? ` inauthor:${author}` : ''}`;
    const info = await searchGoogle(q);
    const url = googleCover(info?.imageLinks);
    if (url) return url;
  } catch (err) {
    console.warn('[Covers] Google Books lookup failed:', err);
  }

  return isbn ? buildCoverUrl(isbn) : null;
}

/**
 * Fetch book metadata by ISBN.
 * @param {string} isbn - ISBN-10 or ISBN-13
 * @returns {Promise<Object|null>} Book data, or null if no source knows it
 */
export async function fetchBookByISBN(isbn) {
  if (!isbn || typeof isbn !== 'string') {
    throw new Error('Invalid ISBN parameter');
  }
  const cleanIsbn = isbn.replace(/[-\s]/g, '');

  let book = null;
  let networkError = null;

  // 1. Open Library
  try {
    const data = await getJson(
      `${OL}/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`
    );
    const ol = data[`ISBN:${cleanIsbn}`];
    if (ol) {
      book = {
        isbn: cleanIsbn,
        title: ol.title || 'Unknown Title',
        subtitle: ol.subtitle || null,
        author: ol.authors?.[0]?.name || 'Unknown Author',
        publishYear: extractPublishYear(ol.publish_date),
        coverUrl: ol.cover?.large || ol.cover?.medium || null,
        publishers: ol.publishers?.map((p) => p.name) || [],
        numberOfPages: ol.number_of_pages || null,
        subjects: ol.subjects?.slice(0, 5).map((s) => s.name) || [],
      };
    }
  } catch (err) {
    console.warn('[Books] Open Library lookup failed:', err);
    networkError = err;
  }

  // 2. Google Books for anything Open Library is missing
  if (!book || !book.coverUrl || book.author === 'Unknown Author') {
    try {
      const g = await searchGoogle(`isbn:${cleanIsbn}`);
      if (g) {
        networkError = null;
        book = {
          isbn: cleanIsbn,
          title: book?.title || g.title || 'Unknown Title',
          subtitle: book?.subtitle || g.subtitle || null,
          author:
            book && book.author !== 'Unknown Author'
              ? book.author
              : g.authors?.[0] || 'Unknown Author',
          publishYear: book?.publishYear || extractPublishYear(g.publishedDate),
          coverUrl: book?.coverUrl || null,
          publishers: book?.publishers?.length ? book.publishers : g.publisher ? [g.publisher] : [],
          numberOfPages: book?.numberOfPages || g.pageCount || null,
          subjects: book?.subjects?.length ? book.subjects : g.categories || [],
          description: g.description || null,
          _googleCover: googleCover(g.imageLinks),
        };
      }
    } catch (err) {
      console.warn('[Books] Google Books lookup failed:', err);
    }
  }

  if (!book) {
    if (networkError) {
      throw new Error(
        /fetch/i.test(networkError.message)
          ? 'Network error. Please check your internet connection.'
          : 'Failed to fetch book data. Please try again.'
      );
    }
    return null;
  }

  // 3. Cover: any edition of the work on Open Library, then Google, then ISBN
  if (!book.coverUrl) {
    try {
      const docs = await searchOpenLibrary({ isbn: cleanIsbn });
      const doc = docs.find((d) => d.cover_i);
      if (doc) book.coverUrl = coverUrlFromId(doc.cover_i);
    } catch (err) {
      /* fall through */
    }
  }
  if (!book.coverUrl && book.title) {
    try {
      const params = { title: book.title };
      if (book.author !== 'Unknown Author') params.author = book.author;
      const doc = (await searchOpenLibrary(params)).find((d) => d.cover_i);
      if (doc) book.coverUrl = coverUrlFromId(doc.cover_i);
    } catch (err) {
      /* fall through */
    }
  }
  book.coverUrl = book.coverUrl || book._googleCover || buildCoverUrl(cleanIsbn);
  delete book._googleCover;

  return book;
}

/**
 * Search for books by title.
 * @param {string} title - Book title
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>}
 */
export async function searchBooksByTitle(title, limit = 5) {
  if (!title || typeof title !== 'string') {
    throw new Error('Invalid title parameter');
  }

  try {
    const docs = await searchOpenLibrary({ title }, limit);
    return docs.map((doc) => {
      const isbn = doc.isbn?.find((i) => i.length === 13) || doc.isbn?.[0] || null;
      return {
        title: doc.title,
        author: doc.author_name?.[0] || 'Unknown Author',
        publishYear: doc.first_publish_year || null,
        isbn,
        coverUrl: doc.cover_i
          ? coverUrlFromId(doc.cover_i)
          : isbn
          ? buildCoverUrl(isbn)
          : null,
        publishers: doc.publisher?.slice(0, 1) || [],
        numberOfPages: doc.number_of_pages_median || null,
      };
    });
  } catch (error) {
    console.error('Book search failed:', error);
    throw new Error('Failed to search books. Please try again.');
  }
}

/**
 * Format ISBN with hyphens for display.
 * @param {string} isbn
 * @returns {string}
 */
export function formatISBN(isbn) {
  if (!isbn) return '';
  const cleaned = isbn.replace(/[-\s]/g, '');
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{1})(\d{3})(\d{5})(\d{1})/, '$1-$2-$3-$4');
  }
  if (cleaned.length === 13) {
    return cleaned.replace(/(\d{3})(\d{1})(\d{3})(\d{5})(\d{1})/, '$1-$2-$3-$4-$5');
  }
  return isbn;
}
