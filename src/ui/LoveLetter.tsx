import { useEffect } from "react";

// The easter egg for beating the AI on Hard: this game is a love letter to Mechabellum, so point the winner at it.
// The site stores nothing yet, so "once" means once per visit. When stored progress lands, remember that it was shown
// and never show it again (DESIGN.md §10).

export const MECHABELLUM_URL = "https://store.steampowered.com/app/669330/Mechabellum/";

let shown = false;
export const loveLetterShown = () => shown;

export function LoveLetter({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    shown = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="intro-backdrop" onClick={onClose}>
      <div className="intro love-letter" role="dialog" aria-modal="true" aria-label="A love letter" onClick={(e) => e.stopPropagation()}>
        <h2>You beat Hard!</h2>
        <div className="intro-body">
          <p>
            This game is a love letter to <b>Mechabellum</b>. If you liked this game, you&apos;ll love the real thing.
          </p>
        </div>
        <div className="love-letter-buttons">
          <button onClick={onClose}>Close</button>
          <a className="button primary" href={MECHABELLUM_URL} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            Mechabellum on Steam ↗
          </a>
        </div>
      </div>
    </div>
  );
}
