import { useEffect, useState } from "react";
import { searchBooks, type FoundBook } from "./covers";
import { setApiKey, getApiKey } from "./dictionary";
import { useLibrary, type ImportSummary } from "./library";
import type { Shelf } from "./model";

export function Sheets() {
  const { sheet, setSheet } = useLibrary();
  if (!sheet) return null;
  return (
    <div className="sheet-overlay is-open" onClick={(event) => {
      if (event.target === event.currentTarget) setSheet(null);
    }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-handle" />
        {sheet === "add" ? <AddSheet /> : <ImportSheet />}
      </div>
    </div>
  );
}

function AddSheet() {
  const { addBook, setSheet, selectBook } = useLibrary();
  const [title, setTitle] = useState("");
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<FoundBook[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const shelf: Shelf = finished ? "read" : "reading";

  useEffect(() => {
    const query = title.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchBooks(query)
        .then(setResults)
        .catch(() => setResults([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [title]);

  async function commit(found?: FoundBook) {
    const name = (found?.title || title).trim();
    if (!name || busy) return;
    setBusy(true);
    setStatus("");
    try {
      await addBook({
        title: name,
        author: found?.author || "Unknown",
        isbn: found?.isbn || null,
        coverUrl: found?.coverUrl || null,
        publishYear: found?.publishYear || null,
        pages: found?.pages || null,
        rating: null,
        shelf,
        goodreadsId: null,
      });
      setSheet(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn’t add that book.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 id="sheet-title">Add a book</h2>
      <p className="sheet-sub">New words file under whichever cover you tap.</p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void commit(results[0]);
        }}
      >
        <input
          className="field"
          value={title}
          placeholder="Title"
          aria-label="Book title"
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
        />
        <label className="check">
          <input type="checkbox" checked={finished} onChange={(event) => setFinished(event.target.checked)} />
          I’ve finished it
        </label>
        <button className="keep wide" type="submit" disabled={busy || title.trim().length < 2}>
          {busy ? "Adding…" : finished ? "Add to finished" : "Add and select"}
        </button>
      </form>
      {results.length > 0 && (
        <ul className="pick-list">
          {results.map((book) => (
            <li key={`${book.title}-${book.isbn}`}>
              <button type="button" onClick={() => void commit(book)}>
                <span className="pick-title">{book.title}</span>
                <span className="pick-sub">
                  {book.author}
                  {book.publishYear ? ` · ${book.publishYear}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="sheet-status">{status}</p>}
      <button type="button" className="text-btn" onClick={() => { selectBook(null); setSheet(null); }}>
        Use Misc instead
      </button>
    </>
  );
}

function ImportSheet() {
  const { importGoodreads, exportJson, importJson, setSheet } = useLibrary();
  const [includeWant, setIncludeWant] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [status, setStatus] = useState("");
  const [key, setKey] = useState("");
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    setKey(getApiKey());
  }, []);

  async function readCsv(file: File) {
    setStatus("");
    setSummary(null);
    const text = await file.text();
    try {
      const result = await importGoodreads(text, includeWant, (done, total) => setProgress({ done, total }));
      setSummary(result);
      setProgress(null);
    } catch (error) {
      setProgress(null);
      setStatus(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return (
    <>
      <h2 id="sheet-title">Import</h2>
      <p className="sheet-sub">
        From Goodreads: My Books, Import and export, Export Library. Currently reading becomes Reading. Read stays Read. Want to read stays out unless you tick the box. Books already on the wall are skipped.
      </p>
      <label
        className={`drop${drag ? " is-hot" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void readCsv(file);
        }}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readCsv(file);
          }}
        />
        Drop a Goodreads CSV, or tap to choose
      </label>
      <label className="check">
        <input type="checkbox" checked={includeWant} onChange={(event) => setIncludeWant(event.target.checked)} />
        Include want-to-read
      </label>
      {progress && (
        <p className="sheet-status">
          Looking up covers {progress.done} / {progress.total}
        </p>
      )}
      {summary && (
        <p className="sheet-status">
          Added {summary.added}. Skipped {summary.skipped} already here
          {summary.skippedWant ? ` and ${summary.skippedWant} want-to-read` : ""}. {summary.withoutCover} without a cover
          {summary.failed ? `. ${summary.failed} failed` : ""}.
        </p>
      )}
      {status && <p className="sheet-status">{status}</p>}

      <div className="sheet-split">
        <h3>Backup</h3>
        <div className="pair">
          <button type="button" className="chip action" onClick={exportJson}>
            Download JSON
          </button>
          <label className="chip action file-chip">
            Re-import
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await importJson(await file.text());
                  setStatus("Backup merged. Existing books and words were left in place.");
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : "Couldn’t read that backup.");
                }
              }}
            />
          </label>
        </div>
      </div>

      <form
        className="sheet-split"
        onSubmit={(event) => {
          event.preventDefault();
          setApiKey(key);
          setStatus(key.trim() ? "Dictionary key saved in this browser." : "Dictionary key cleared. Definitions use the free dictionary.");
        }}
      >
        <h3>Dictionary</h3>
        <p className="sheet-sub">
          A Merriam-Webster key uses the same slot as the current site. Leave it blank and lookups use the free dictionary.
        </p>
        <input
          className="field"
          value={key}
          placeholder="Merriam-Webster key"
          aria-label="Merriam-Webster API key"
          autoComplete="off"
          onChange={(event) => setKey(event.target.value)}
        />
        <button className="chip action" type="submit">
          Save key
        </button>
      </form>
      <button type="button" className="text-btn" onClick={() => setSheet(null)}>
        Done
      </button>
    </>
  );
}
