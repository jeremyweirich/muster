import { useState } from "react";

// The game is landscape-only. A touch phone held upright gets this full-page prompt on any tab (styles.css shows it
// only then); "portrait anyway" dismisses it for the rest of the visit.
export function RotateHint() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="rotate-hint">
      <div className="rotate-icon">📱↻</div>
      <p>Turn your phone sideways to play.</p>
      {canLockLandscape && <button className="primary" onClick={goLandscape}>Full screen, landscape</button>}
      <button onClick={() => setDismissed(true)}>Play in portrait anyway</button>
    </div>
  );
}

// Fullscreen plus an orientation lock works on Android browsers; iOS has neither, so the button is hidden there.
const canLockLandscape = typeof document !== "undefined" && !!document.fullscreenEnabled && typeof screen !== "undefined" && "orientation" in screen;

async function goLandscape() {
  try {
    await document.documentElement.requestFullscreen();
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    // not supported here; the player can still rotate by hand
  }
}
