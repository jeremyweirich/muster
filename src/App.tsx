import { useEffect, useState } from "react";
import { randomId } from "./game/pvp";
import { relayUrl } from "./net/config";
import { CodexView } from "./ui/CodexView";
import { CountersView } from "./ui/CountersView";
import { DebugView } from "./ui/DebugView";
import { Intro } from "./ui/Intro";
import { PlayView } from "./ui/PlayView";
import { PvpView, type PlayStatus } from "./ui/PvpView";
import { RotateHint } from "./ui/RotateHint";
import { SpectateView } from "./ui/SpectateView";
import { StoryView } from "./ui/StoryView";
import { UnitsView } from "./ui/UnitsView";
import { loadProgress, recordWin, resetProgress } from "./ui/progress";
import { parsePvpLink, setPageQuery, type PvpLink } from "./ui/usePvp";

const TABS = [
  { id: "story", label: "Story" },
  { id: "play", label: "Play" },
  { id: "pvp", label: "PvP" },
  { id: "units", label: "Units" },
  { id: "codex", label: "Codex" },
  { id: "counters", label: "Counters" },
  { id: "spectate", label: "Spectate" },
] as const;

// "debug" is a hidden tab for development, opened by clicking the version in the corner.
type Tab = (typeof TABS)[number]["id"] | "debug";

// The hash is #tab or #tab/topic: keyword links elsewhere in the game open #codex/<topic>,
// #units/<unit> opens a unit's page, #counters/<unit> opens the counter guide for that unit, and #story/<mission>
// opens a story mission. With no tab, the site opens on Story, except a PvP link (?join=…), which opens on Play.
function parseHash(): { tab: Tab; topic?: string } {
  const [tab, topic] = location.hash.slice(1).split("/");
  if (tab === "debug") return { tab };
  if (TABS.some((t) => t.id === tab)) return { tab: tab as Tab, topic };
  return { tab: /[?&](join|match)=/.test(location.search) ? "play" : "story" };
}

const relayAvailable = !!relayUrl();

export function App() {
  const [route, setRoute] = useState(parseHash);
  const tab = route.tab;
  const spectating = tab === "spectate";
  // once opened, Spectate (the AI playing itself) stays mounted like Play, so following a Codex link doesn't lose the match
  const [spectateOpened, setSpectateOpened] = useState(spectating);
  useEffect(() => {
    if (spectating) setSpectateOpened(true);
  }, [spectating]);
  // Story stays mounted too, and remembers its open mission, so the Story tab (or Back from a Codex link) returns to it
  const storying = tab === "story";
  const [storyOpened, setStoryOpened] = useState(storying);
  const [storyTopic, setStoryTopic] = useState<string | undefined>(storying ? route.topic : undefined);
  useEffect(() => {
    if (!storying) return;
    setStoryOpened(true);
    setStoryTopic(route.topic);
  }, [storying, route.topic]);
  // missions won and commendations earned, kept in this browser (progress.ts); `allMissions` is the debug panel's
  // switch that opens every mission for this visit
  const [progress, setProgress] = useState(loadProgress);
  const [allMissions, setAllMissions] = useState(false);
  // players who land on Play (a shared #play link) get the walkthrough; Story's "Play the full game" shows it too
  // (the finale's "Play the full game" opens the version for players who've finished the campaign)
  const [intro, setIntro] = useState<"new" | "graduate" | null>(() => (parseHash().tab === "play" && !parsePvpLink(location.search, () => "") ? "new" : null));
  // a PvP match, when the address has one (?join=… or ?match=…); see docs/MULTIPLAYER.md
  const [pvp, setPvp] = useState<PvpLink | null>(() => parsePvpLink(location.search, () => randomId(16)));
  // what Play reports about its match, for the PvP tab
  const [playStatus, setPlayStatus] = useState<PlayStatus | null>(null);
  // `topic` null opens the tab bare; left out, Story goes back to its open mission
  const go = (t: Tab, topic: string | null = (t === "story" && storyTopic) || null) => {
    setRoute({ tab: t, topic: topic ?? undefined });
    try {
      history.replaceState(null, "", `${location.pathname}${location.search}#${t}${topic ? `/${topic}` : ""}`);
    } catch {
      // some embedded hosts disallow history changes
    }
  };
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

  // the host waits on the PvP tab and goes to the board as soon as the friend opens the link
  const friendJoined = !!playStatus?.pvp?.friendJoined;
  useEffect(() => {
    if (friendJoined && tab === "pvp") go("play");
  }, [friendJoined]);
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
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <button className="help-btn" onClick={() => setIntro("new")}>
          How to play
        </button>
        <button className="version muted" title={`Debug tools and Report a bug · built ${new Date(__BUILD_TIME__).toLocaleString()}`} onClick={() => go("debug")}>
          <span className="build">{__APP_VERSION__}</span>
        </button>
      </header>
      {/* Play stays mounted so following a Codex link mid-game doesn't lose the match */}
      <div style={{ display: tab === "play" ? "contents" : "none" }}>
        <PlayView key={pvp?.room ?? "ai"} pvp={pvp ? { link: pvp, onLeave: leavePvp } : undefined} onStatus={setPlayStatus} />
      </div>
      {tab === "pvp" && (
        <PvpView available={relayAvailable} room={pvp?.room ?? null} play={playStatus} onCreate={startPvp} onLeave={leavePvp} onPlay={() => go("play")} />
      )}
      {tab === "units" && <UnitsView topic={route.topic} />}
      {tab === "codex" && <CodexView topic={route.topic} />}
      {tab === "counters" && <CountersView topic={route.topic} />}
      {tab === "debug" && <DebugView allMissions={allMissions} onAllMissions={setAllMissions} />}
      {storyOpened && (
        <div style={{ display: storying ? "contents" : "none" }}>
          <StoryView
            topic={storyTopic}
            progress={progress}
            allOpen={allMissions}
            onWon={(id, commended) => setProgress((p) => recordWin(p, id, commended))}
            onReset={() => setProgress(resetProgress())}
            onOpen={(id) => go("story", id)}
            onPlayFull={() => {
              go("play");
              setIntro("new");
            }}
            onGraduate={() => {
              go("play");
              setIntro("graduate");
            }}
          />
        </div>
      )}
      {spectateOpened && (
        <div style={{ display: spectating ? "contents" : "none" }}>
          <SpectateView />
        </div>
      )}
      {intro && <Intro graduate={intro === "graduate"} onClose={() => setIntro(null)} />}
      <RotateHint />
    </div>
  );
}
