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
        <div className="logo">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 3 L14.5 13.5 M3 4 L13.5 14.5 M20 3 L9.5 13.5 M21 4 L10.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M11 14 L15 18 M13 12 L17 16 M13 14 L9 18 M11 12 L7 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M16.5 17.5 L19.5 20.5 M7.5 17.5 L4.5 20.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Muster
        </div>
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
