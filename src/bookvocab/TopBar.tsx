import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "./library";
import { norm, wallBooks, type FilterId } from "./model";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "reading", label: "Reading" },
  { id: "read", label: "Read" },
  { id: "words", label: "With words" },
];

export function TopBar({ onFind }: { onFind: (id: string) => void }) {
  const { books, filter, setFilter, setSheet, notice, dismissNotice, selectBook } = useLibrary();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = norm(query);
    if (q.length < 2) return [];
    return wallBooks(books, "all").filter((book) => norm(`${book.title} ${book.author}`).includes(q)).slice(0, 6);
  }, [books, query]);

  useEffect(() => {
    if (!matches[0] || query.trim().length < 2) return;
    setFilter("all");
    selectBook(matches[0].id);
    onFind(matches[0].id);
  }, [matches, onFind, query, selectBook, setFilter]);

  return (
    <header className="topbar">
      <div className="top-row">
        <div className="filters" role="toolbar" aria-label="Shelf filters">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip${filter === item.id ? " is-on" : ""}`}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="top-actions">
          <button type="button" className="chip action" onClick={() => setSheet("add")}>
            Add
          </button>
          <button type="button" className="chip action" onClick={() => setSheet("import")}>
            Import
          </button>
        </div>
      </div>
      <form
        className="find"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (matches[0]) onFind(matches[0].id);
        }}
      >
        <input
          value={query}
          placeholder="Find on the wall"
          aria-label="Find a book on the wall"
          onChange={(event) => setQuery(event.target.value)}
        />
        {matches.length > 0 && (
          <ul className="find-list">
            {matches.map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  onClick={() => {
                    onFind(book.id);
                    setQuery(book.title);
                  }}
                >
                  <strong>{book.title}</strong>
                  <span>{book.author}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      {notice && (
        <p className="notice">
          <span>{notice}</span>
          <button type="button" onClick={dismissNotice} aria-label="Dismiss">
            Close
          </button>
        </p>
      )}
    </header>
  );
}
