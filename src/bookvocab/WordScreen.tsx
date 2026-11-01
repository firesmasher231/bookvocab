import { useState } from "react";
import { CoverFace } from "./CoverFace";
import { useLibrary } from "./library";
import { MISC_ID, wordsFor } from "./model";

function formatDate(value: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(value);
  } catch {
    return "";
  }
}

export function WordScreen() {
  const { books, words, listId, closeList, deleteWord, deleteBook } = useLibrary();
  const [confirm, setConfirm] = useState(false);
  if (!listId) return null;
  const misc = listId === MISC_ID;
  const book = misc ? null : books.find((item) => item.id === listId) || null;
  const list = wordsFor(words, misc ? null : listId);
  const title = misc ? "Misc" : book?.title || "Book";

  return (
    <div className="word-screen" role="dialog" aria-modal="true" aria-labelledby="word-screen-title">
      <header className="word-head">
        <button type="button" className="chip action" onClick={closeList}>
          Back
        </button>
        <CoverFace title={title} coverUrl={book?.coverUrl || null} misc={misc} />
        <div className="word-head-text">
          <h2 id="word-screen-title">{title}</h2>
          <p>
            {misc ? "Words not tied to a book" : book?.author || "Unknown"}
            {book?.publishYear ? ` · ${book.publishYear}` : ""}
            {list.length ? ` · ${list.length}` : ""}
          </p>
        </div>
      </header>
      {list.length === 0 ? (
        <p className="empty-words">No words yet. Type one in the field and press Keep.</p>
      ) : (
        <ul className="word-list">
          {list.map((word) => (
            <li key={word.id}>
              <div className="word-line">
                <h3>{word.word}</h3>
                <span>{formatDate(word.dateAdded)}</span>
                <button type="button" aria-label={`Delete ${word.word}`} onClick={() => void deleteWord(word.id)}>
                  Delete
                </button>
              </div>
              {word.phonetic && <p className="phonetic">{word.phonetic}</p>}
              {word.definitions.slice(0, 3).map((def, index) => (
                <p key={index} className="word-def">
                  {def.partOfSpeech ? <em>{def.partOfSpeech}. </em> : null}
                  {def.definition}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
      {!misc && book && (
        <div className="danger-zone">
          {confirm ? (
            <div className="pair">
              <button type="button" className="chip" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="chip danger" onClick={() => void deleteBook(book.id)}>
                Delete book and words
              </button>
            </div>
          ) : (
            <button type="button" className="text-btn" onClick={() => setConfirm(true)}>
              Delete this book
            </button>
          )}
        </div>
      )}
    </div>
  );
}
