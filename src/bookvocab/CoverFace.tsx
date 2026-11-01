import { useState } from "react";
import { clothIndex } from "./model";

interface CoverFaceProps {
  title: string;
  coverUrl: string | null;
  misc?: boolean;
  selected?: boolean;
}

export function CoverFace({ title, coverUrl, misc = false, selected = false }: CoverFaceProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(coverUrl) && !failed && !misc;
  const cloth = misc ? "misc" : String(clothIndex(title));

  return (
    <span className={`frame${selected ? " is-selected" : ""}`}>
      {showImage ? (
        <img
          src={coverUrl || undefined}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth > 0 && img.naturalWidth <= 2) setFailed(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={`cloth cloth-${cloth}`}>
          <span className="cloth-title">{misc ? "Misc" : title}</span>
        </span>
      )}
    </span>
  );
}
