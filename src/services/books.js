/**
 * Fetch book metadata by ISBN from Open Library API
 * @param {string} isbn - ISBN-10 or ISBN-13
 * @returns {Promise<Object|null>}
 */
export async function fetchBookByISBN(isbn) {
  if (!isbn || typeof isbn !== 'string') {
    throw new Error('Invalid ISBN parameter');
  }

  // Clean ISBN (remove hyphens and spaces)
  const cleanIsbn = isbn.replace(/[-\s]/g, '');

  try {
    const response = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const bookData = data[`ISBN:${cleanIsbn}`];

    if (!bookData) {
      return null; // Book not found
    }

    // Check if cover exists
    const hasCover = await coverExists(cleanIsbn);

    // Extract book information
    const book = {
      isbn: cleanIsbn,
      title: bookData.title || 'Unknown Title',
      author: bookData.authors?.[0]?.name || 'Unknown Author',
      publishYear: extractPublishYear(bookData.publish_date),
      coverUrl: hasCover ? buildCoverUrl(cleanIsbn) : null,
      publishers: bookData.publishers?.map(p => p.name) || [],
      numberOfPages: bookData.number_of_pages || null,
      subjects: bookData.subjects?.slice(0, 5).map(s => s.name) || [],
    };

    return book;

  } catch (error) {
    console.error('Book fetch failed:', error);

    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to fetch book data. Please try again.');
    }
  }
}

/**
 * Extract publish year from date string
 * @param {string} publishDate - Publish date from API
 * @returns {number|null}
 */
function extractPublishYear(publishDate) {
  if (!publishDate) return null;

  // Try to extract year (4 digits)
  const match = publishDate.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Build cover image URL for an ISBN
 * @param {string} isbn - ISBN number
 * @param {string} size - Size: S (small), M (medium), L (large)
 * @returns {string}
 */
export function buildCoverUrl(isbn, size = 'M') {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
}

/**
 * Check if a cover image exists for an ISBN
 * Open Library returns a 1x1 white pixel GIF when no cover exists
 * @param {string} isbn - ISBN number
 * @returns {Promise<boolean>}
 */
export async function coverExists(isbn) {
  try {
    const url = buildCoverUrl(isbn, 'S');
    const response = await fetch(url);
    
    if (!response.ok) {
      return false;
    }
    
    // Check Content-Length - a 1x1 white pixel GIF is typically ~35-50 bytes
    // Real book covers are much larger (usually several KB)
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      // If smaller than 100 bytes, it's likely the placeholder
      if (size < 100) {
        return false;
      }
    }
    
    // If no content-length header, we'll let the image load and check dimensions in the component
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Search for books by title
 * @param {string} title - Book title
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>}
 */
export async function searchBooksByTitle(title, limit = 5) {
  if (!title || typeof title !== 'string') {
    throw new Error('Invalid title parameter');
  }

  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.docs || data.docs.length === 0) {
      return [];
    }

    // Format results
    return data.docs.map(doc => ({
      title: doc.title,
      author: doc.author_name?.[0] || 'Unknown Author',
      publishYear: doc.first_publish_year || null,
      isbn: doc.isbn?.[0] || null,
      coverUrl: doc.isbn?.[0] ? buildCoverUrl(doc.isbn[0]) : null,
    }));

  } catch (error) {
    console.error('Book search failed:', error);
    throw new Error('Failed to search books. Please try again.');
  }
}

/**
 * Validate ISBN format (basic check)
 * @param {string} isbn - ISBN to validate
 * @returns {boolean}
 */
export function isValidISBN(isbn) {
  if (!isbn) return false;

  const cleaned = isbn.replace(/[-\s]/g, '');

  // Check if it's 10 or 13 digits
  if (!/^\d{10}$/.test(cleaned) && !/^\d{13}$/.test(cleaned)) {
    return false;
  }

  return true;
}

/**
 * Format ISBN with hyphens for display
 * @param {string} isbn - ISBN to format
 * @returns {string}
 */
export function formatISBN(isbn) {
  if (!isbn) return '';

  const cleaned = isbn.replace(/[-\s]/g, '');

  if (cleaned.length === 10) {
    // ISBN-10: X-XXX-XXXXX-X
    return cleaned.replace(/(\d{1})(\d{3})(\d{5})(\d{1})/, '$1-$2-$3-$4');
  } else if (cleaned.length === 13) {
    // ISBN-13: XXX-X-XXX-XXXXX-X
    return cleaned.replace(/(\d{3})(\d{1})(\d{3})(\d{5})(\d{1})/, '$1-$2-$3-$4-$5');
  }

  return isbn;
}
