const OL = "https://openlibrary.org/search.json";

interface Doc {
  cover_i?: number;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  isbn?: string[];
}

async function search(params: Record<string, string>): Promise<Doc[]> {
  const qs = new URLSearchParams({ ...params, fields: "cover_i,title,author_name,first_publish_year,isbn,number_of_pages_median" });
  const response = await fetch(`${OL}?${qs}`);
  if (!response.ok) throw new Error(`Open Library ${response.status}`);
  const data = (await response.json()) as { docs?: Doc[] };
  return data.docs || [];
}

export function coverFromId(id: number): string {
  return `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
}

export interface FoundBook {
  title: string;
  author: string;
  isbn: string | null;
  coverUrl: string | null;
  publishYear: number | null;
  pages: number | null;
}

function pickIsbn(doc: Doc): string | null {
  const list = doc.isbn || [];
  return list.find((isbn) => isbn.length === 13) || list[0] || null;
}

function toFound(doc: Doc, fallbackTitle: string): FoundBook {
  return {
    title: doc.title || fallbackTitle,
    author: doc.author_name?.[0] || "Unknown",
    isbn: pickIsbn(doc),
    coverUrl: doc.cover_i ? coverFromId(doc.cover_i) : null,
    publishYear: doc.first_publish_year || null,
    pages: doc.number_of_pages_median || null,
  };
}

/** ISBN first, then title. Returns null when Open Library has no cover id. */
export async function findCover(isbn: string | null, title: string, author?: string): Promise<string | null> {
  if (isbn) {
    try {
      const docs = await search({ isbn, limit: "1" });
      const hit = docs.find((doc) => doc.cover_i);
      if (hit?.cover_i) return coverFromId(hit.cover_i);
    } catch {
      /* try title */
    }
  }
  if (!title) return null;
  try {
    const params: Record<string, string> = { title, limit: "5" };
    if (author && author !== "Unknown") params.author = author;
    const docs = await search(params);
    const hit = docs.find((doc) => doc.cover_i);
    return hit?.cover_i ? coverFromId(hit.cover_i) : null;
  } catch {
    return null;
  }
}

export async function searchBooks(title: string): Promise<FoundBook[]> {
  const docs = await search({ title, limit: "5" });
  return docs.map((doc) => toFound(doc, title));
}
