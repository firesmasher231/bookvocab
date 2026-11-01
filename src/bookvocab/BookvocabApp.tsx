import { useCallback, useState } from "react";
import { Dock } from "./Dock";
import { LibraryProvider } from "./library";
import { Sheets } from "./Sheets";
import { TopBar } from "./TopBar";
import { Wall } from "./Wall";
import { WordScreen } from "./WordScreen";

function Shell() {
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const onFind = useCallback((id: string) => {
    setFocus((current) => ({ id, n: (current?.n || 0) + 1 }));
  }, []);
  return (
    <div className="bv">
      <Wall focusId={focus?.id ?? null} focusNonce={focus?.n ?? 0} />
      <TopBar onFind={onFind} />
      <Dock />
      <Sheets />
      <WordScreen />
    </div>
  );
}

export function BookvocabApp() {
  return (
    <LibraryProvider>
      <Shell />
    </LibraryProvider>
  );
}
