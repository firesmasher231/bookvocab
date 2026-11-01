import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CoverFace } from "./CoverFace";
import { useLibrary } from "./library";
import { MISC_ID, showMisc, wallBooks, wordsFor } from "./model";

interface Camera {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.28;
const MAX_SCALE = 2.6;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function Wall({ focusId, focusNonce }: { focusId: string | null; focusNonce: number }) {
  const { ready, books, words, activeBookId, filter, selectBook, openList } = useLibrary();
  const viewRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<Camera>({ x: 40, y: 80, scale: 1 });
  const [cam, setCam] = useState<Camera>(camRef.current);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinched: false, lastX: 0, lastY: 0, vx: 0, vy: 0, t: 0 });
  const pinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const inertia = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const fitted = useRef(false);

  const loose = wordsFor(words, null).length;
  const visible = wallBooks(books, filter);
  const misc = showMisc(filter, loose);
  const count = visible.length + (misc ? 1 : 0);
  const cols = Math.max(4, Math.ceil(Math.sqrt(Math.max(count, 1) * 1.55)));

  function commit(next: Camera) {
    const scale = clampScale(next.scale);
    const camera = { ...next, scale };
    camRef.current = camera;
    setCam(camera);
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const view = viewRef.current;
    if (!view) return;
    const rect = view.getBoundingClientRect();
    const current = camRef.current;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const scale = clampScale(current.scale * factor);
    const worldX = (px - current.x) / current.scale;
    const worldY = (py - current.y) / current.scale;
    commit({ scale, x: px - worldX * scale, y: py - worldY * scale });
  }

  function fit() {
    const view = viewRef.current;
    const grid = gridRef.current;
    if (!view || !grid) return;
    const pad = 64;
    const w = grid.scrollWidth || 1;
    const h = grid.scrollHeight || 1;
    const scale = clampScale(Math.min((view.clientWidth - pad) / w, (view.clientHeight - pad * 1.4) / h, 1.05));
    commit({
      scale,
      x: (view.clientWidth - w * scale) / 2,
      y: Math.max(72, (view.clientHeight - h * scale) / 2 - 12),
    });
  }

  function centerOn(id: string, scale = camRef.current.scale) {
    const view = viewRef.current;
    const grid = gridRef.current;
    if (!view || !grid) return;
    const tile = grid.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    if (!tile) return;
    const x = tile.offsetLeft + tile.offsetWidth / 2;
    const y = tile.offsetTop + tile.offsetHeight / 2;
    commit({
      scale,
      x: view.clientWidth / 2 - x * scale,
      y: view.clientHeight / 2 - y * scale - 20,
    });
  }

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0014));
      zoomAt(event.clientX, event.clientY, factor);
    };
    view.addEventListener("wheel", onWheel, { passive: false });
    return () => view.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!ready || fitted.current) return;
    fitted.current = true;
    const id = requestAnimationFrame(() => {
      if (books.length > 24) {
        centerOn(activeBookId || MISC_ID, 1);
      } else {
        fit();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [ready, books.length]);

  useEffect(() => {
    if (!focusId) return;
    const id = requestAnimationFrame(() => centerOn(focusId, Math.max(camRef.current.scale, 0.9)));
    return () => cancelAnimationFrame(id);
  }, [focusId, focusNonce]);

  function stopInertia() {
    if (inertia.current != null) cancelAnimationFrame(inertia.current);
    inertia.current = null;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button.zoom-btn")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stopInertia();
    gesture.current.moved = pointers.current.size > 1 ? 20 : 0;
    gesture.current.pinched = pointers.current.size > 1;
    gesture.current.lastX = event.clientX;
    gesture.current.lastY = event.clientY;
    gesture.current.vx = 0;
    gesture.current.vy = 0;
    gesture.current.t = event.timeStamp;
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const prev = pointers.current.get(event.pointerId)!;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      gesture.current.pinched = true;
      gesture.current.moved = 30;
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const pinch = pinchRef.current;
      if (!pinch) {
        pinchRef.current = { dist, midX, midY };
        return;
      }
      const factor = dist / pinch.dist;
      zoomAt(midX, midY, factor);
      commit({
        ...camRef.current,
        x: camRef.current.x + (midX - pinch.midX),
        y: camRef.current.y + (midY - pinch.midY),
      });
      pinchRef.current = { dist, midX, midY };
      return;
    }
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    const dt = Math.max(8, event.timeStamp - gesture.current.t);
    gesture.current.vx = dx / dt;
    gesture.current.vy = dy / dt;
    gesture.current.t = event.timeStamp;
    commit({ ...camRef.current, x: camRef.current.x + dx, y: camRef.current.y + dy });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size > 0) return;
    const tile = (event.target as HTMLElement).closest<HTMLElement>(".tile");
    suppressClick.current = Boolean(tile) && (gesture.current.moved > 8 || gesture.current.pinched);
    if (tile && gesture.current.moved < 8 && !gesture.current.pinched) return;
    const { vx, vy } = gesture.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || gesture.current.pinched || Math.hypot(vx, vy) < 0.05) return;
    let x = camRef.current.x;
    let y = camRef.current.y;
    let ivx = vx * 16;
    let ivy = vy * 16;
    const step = () => {
      ivx *= 0.92;
      ivy *= 0.92;
      x += ivx;
      y += ivy;
      commit({ ...camRef.current, x, y });
      if (Math.hypot(ivx, ivy) < 0.4) {
        inertia.current = null;
        return;
      }
      inertia.current = requestAnimationFrame(step);
    };
    inertia.current = requestAnimationFrame(step);
  }

  function activate(id: string) {
    const next = id === MISC_ID ? null : id;
    if ((activeBookId || MISC_ID) === id) openList(id);
    else selectBook(next);
  }

  const selectedKey = activeBookId || MISC_ID;

  return (
    <div
      className="wall"
      ref={viewRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="world"
        style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})` }}
      >
        <div className="shelf" ref={gridRef} style={{ gridTemplateColumns: `repeat(${cols}, var(--cell))` }}>
          {misc && (
            <Tile
              id={MISC_ID}
              title="Misc"
              author="Words with no book"
              count={loose}
              selected={selectedKey === MISC_ID}
              misc
              coverUrl={null}
              dragged={suppressClick}
              onActivate={activate}
            />
          )}
          {visible.map((book) => (
            <Tile
              key={book.id}
              id={book.id}
              title={book.title}
              author={book.author}
              count={book.wordCount}
              selected={selectedKey === book.id}
              coverUrl={book.coverUrl}
              dragged={suppressClick}
              onActivate={activate}
            />
          ))}
        </div>
      </div>

      {!ready && <p className="wall-hint">Opening your shelf…</p>}
      {ready && books.length === 0 && (
        <p className="wall-hint">Add a book, or import a Goodreads CSV. Words with no book land on Misc.</p>
      )}

      <div className="zoom">
        <button type="button" className="zoom-btn" aria-label="Zoom in" onClick={() => {
          const view = viewRef.current;
          if (!view) return;
          zoomAt(view.getBoundingClientRect().left + view.clientWidth / 2, view.getBoundingClientRect().top + view.clientHeight / 2, 1.22);
        }}>
          +
        </button>
        <button type="button" className="zoom-btn" aria-label="Zoom out" onClick={() => {
          const view = viewRef.current;
          if (!view) return;
          zoomAt(view.getBoundingClientRect().left + view.clientWidth / 2, view.getBoundingClientRect().top + view.clientHeight / 2, 1 / 1.22);
        }}>
          −
        </button>
        <button type="button" className="zoom-btn zoom-fit" aria-label="Fit the shelf" onClick={fit}>
          Fit
        </button>
      </div>
    </div>
  );
}

function Tile({
  id,
  title,
  author,
  count,
  selected,
  coverUrl,
  misc = false,
  dragged,
  onActivate,
}: {
  id: string;
  title: string;
  author: string;
  count: number;
  selected: boolean;
  coverUrl: string | null;
  misc?: boolean;
  dragged: { current: boolean };
  onActivate: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`tile${selected ? " is-selected" : ""}`}
      data-id={id}
      aria-pressed={selected}
      aria-label={misc ? "Misc, words not tied to a book" : `${title} by ${author}`}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onActivate(id);
      }}
    >
      <CoverFace title={title} coverUrl={coverUrl} misc={misc} selected={selected} />
      <span className="cap">{title}</span>
      <span className="cap-sub">{count > 0 ? `${count} ${count === 1 ? "word" : "words"}` : author}</span>
    </button>
  );
}
