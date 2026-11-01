import { useEffect, useState } from "react";
import { randomId } from "./game/pvp";
import { relayUrl } from "./net/config";
import { CodexView } from "./ui/CodexView";
import { CountersView } from "./ui/CountersView";
import { Intro } from "./ui/Intro";
import { PlayView } from "./ui/PlayView";
import { StoryView } from "./ui/StoryView";
import { parsePvpLink, setPageQuery, type PvpLink } from "./ui/usePvp";

const TABS = [
  { id: "play", label: "Play" },
  { id: "story", label: "Story" },
  { id: "codex", label: "Codex" },
  { id: "counters", label: "Counters" },
] as const;

type Tab = (typeof TABS)[number]["id"];

// The hash is #tab or #tab/topic: keyword links elsewhere in the game open #codex/<topic>,
// and #counters/<unit> opens the counter guide for that unit.
function parseHash(): { tab: Tab; topic?: string } {
  const [tab, topic] = location.hash.slice(1).split("/");
  return TABS.some((t) => t.id === tab) ? { tab: tab as Tab, topic } : { tab: "play" };
}

const relayAvailable = !!relayUrl();

export function App() {
  const [route, setRoute] = useState(parseHash);
  const tab = route.tab;
  // new players land on Play, so greet them there with the walkthrough
  const [intro, setIntro] = useState(() => parseHash().tab === "play");
  // a PvP match, when the address has one (?join=… or ?match=…); see docs/MULTIPLAYER.md
  const [pvp, setPvp] = useState<PvpLink | null>(() => parsePvpLink(location.search, () => randomId(16)));
  const startPvp = () => {
    const link = { room: randomId(10), token: randomId(16) };
    setPageQuery(`?match=${link.room}.${link.token}`);
    setPvp(link);
  };
  const leavePvp = () => {
    setPageQuery("");
    setPvp(null);
  };

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return (
    <div className="app">
      <header className="top">
        <div className="logo">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 3 L14.5 13.5 M3 4 L13.5 14.5 M20 3 L9.5 13.5 M21 4 L10.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M11 14 L15 18 M13 12 L17 16 M13 14 L9 18 M11 12 L7 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M16.5 17.5 L19.5 20.5 M7.5 17.5 L4.5 20.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Common Ground
        </div>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => {
                setRoute({ tab: t.id });
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
        <button className="help-btn" onClick={() => setIntro(true)}>
          How to play
        </button>
        <div className="version muted" title={`Built ${new Date(__BUILD_TIME__).toLocaleString()}`}>
          prototype <span className="build">{__APP_VERSION__}</span>
        </div>
      </header>
      {/* Play stays mounted so following a Codex link mid-game doesn't lose the match */}
      <div style={{ display: tab === "play" ? "contents" : "none" }}>
        <PlayView key={pvp?.room ?? "ai"} pvp={pvp ? { link: pvp, onLeave: leavePvp } : undefined} onStartPvp={relayAvailable ? startPvp : undefined} />
      </div>
      {tab === "story" && <StoryView />}
      {tab === "codex" && <CodexView topic={route.topic} />}
      {tab === "counters" && <CountersView topic={route.topic} />}
      {intro && <Intro onClose={() => setIntro(false)} />}
    </div>
  );
}
