import { useState } from "react";
import { CodexView } from "./ui/CodexView";
import { EditorView } from "./ui/EditorView";
import { LabView } from "./ui/LabView";
import { PlayView } from "./ui/PlayView";

const TABS = [
  { id: "play", label: "Play" },
  { id: "units", label: "Units" },
  { id: "lab", label: "Balance Lab" },
  { id: "codex", label: "Codex" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function initialTab(): Tab {
  const h = location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? (h as Tab) : "play";
}

export function App() {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div className="app">
      <header className="top">
        <div className="logo">⚔ Muster</div>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => {
                setTab(t.id);
                try {
                  history.replaceState(null, "", `#${t.id}`);
                } catch {
                  // some embedded hosts disallow history changes
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="version muted" title={`Built ${new Date(__BUILD_TIME__).toLocaleString()}`}>
          prototype <span className="build">{__APP_VERSION__}</span>
        </div>
      </header>
      {/* Play stays mounted so switching to the editor mid-game doesn't lose the match */}
      <div style={{ display: tab === "play" ? "contents" : "none" }}>
        <PlayView />
      </div>
      {tab === "units" && <EditorView />}
      {tab === "lab" && <LabView />}
      {tab === "codex" && <CodexView />}
    </div>
  );
}
