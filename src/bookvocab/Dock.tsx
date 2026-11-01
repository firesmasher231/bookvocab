import { useEffect, useRef, useState } from "react";
import { CoverFace } from "./CoverFace";
import { lookupWord } from "./dictionary";
import { useLibrary } from "./library";
import { MISC_ID, type Lookup } from "./model";

export function Dock() {
  const { books, words, activeBookId, keepWord, openList } = useLibrary();
  const book = books.find((item) => item.id === activeBookId) || null;
  const [text, setText] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2) {
      setLookup(null);
      return;
    }
    const token = ++request.current;
    const timer = window.setTimeout(() => {
      lookupWord(query)
        .then((result) => {
          if (token !== request.current) return;
          setLookup(result);
          if (!result.found) {
            setStatus(result.suggestions.length ? `Did you mean ${result.suggestions.slice(0, 3).join(", ")}?` : "Word not found");
          } else setStatus("");
        })
        .catch((error: unknown) => {
          if (token !== request.current) return;
          setLookup(null);
          setStatus(error instanceof Error ? error.message : "Couldn’t look that up.");
        });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [text]);

  async function file(forced?: Lookup) {
    const query = text.trim();
    if (!query || busy) return;
    setBusy(true);
    try {
      let result = forced && forced.found ? forced : lookup;
      if (!result || !result.found || result.word !== query.toLowerCase()) {
        result = await lookupWord(query);
        setLookup(result);
      }
      if (!result.found) {
        setStatus(result.suggestions.length ? `Did you mean ${result.suggestions.slice(0, 3).join(", ")}?` : "Word not found");
        return;
      }
      const already = words.some((word) => word.word === result.word);
      const title = await keepWord({
        word: result.word,
        definitions: result.definitions,
        phonetic: result.phonetic,
        audioUrl: result.audioUrl,
        bookId: activeBookId,
      });
      setStatus(already ? `Already kept — filed under ${title}` : `Kept in ${title}`);
      setText("");
      setLookup(null);
      request.current++;
      if (navigator.vibrate) navigator.vibrate(12);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn’t save that word.");
    } finally {
      setBusy(false);
    }
  }

  const hit = lookup && lookup.found ? lookup : null;
  const title = book?.title || "Misc";

  return (
    <div className={`dock${hit ? " has-def" : ""}`}>
      {hit && (
        <div className="def" aria-live="polite">
          <div className="def-head">
            <h2>{hit.word}</h2>
            {hit.phonetic && <p className="phonetic">{hit.phonetic}</p>}
          </div>
          <ol>
            {hit.definitions.slice(0, 3).map((def, index) => (
              <li key={`${def.partOfSpeech}-${index}`}>
                {def.partOfSpeech ? <em>{def.partOfSpeech}. </em> : null}
                {def.definition}
              </li>
            ))}
          </ol>
        </div>
      )}
      <form
        className="dock-row"
        onSubmit={(event) => {
          event.preventDefault();
          void file();
        }}
      >
        <button
          type="button"
          className="thumb-btn"
          aria-label={`Words in ${title}`}
          onClick={() => openList(book ? book.id : MISC_ID)}
        >
          <CoverFace title={book?.title || "Misc"} coverUrl={book?.coverUrl || null} misc={!book} />
        </button>
        <label className="word-field">
          <span className="sr">Word to file under {title}</span>
          <input
            ref={inputRef}
            value={text}
            placeholder="Type a word…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label={`Type a word. It will be filed under ${title}.`}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button type="submit" className="keep" disabled={busy || text.trim().length < 2}>
          Keep
        </button>
      </form>
      <p className="dock-status" aria-live="polite">
        {status || `Filing under ${title}`}
        {lookup && !lookup.found
          ? lookup.suggestions.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="suggestion"
                onClick={() => {
                  setText(suggestion);
                  inputRef.current?.focus();
                }}
              >
                {suggestion}
              </button>
            ))
          : null}
      </p>
    </div>
  );
}
