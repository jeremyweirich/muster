import { useState } from "react";
import { CAMPAIGNS, MISSIONS, type MissionEntry } from "../data/campaign";
import { FACTIONS } from "../data/roles";
import { Briefing } from "./Mission";
import { PlayView } from "./PlayView";
import { missionOpen, type Progress } from "./progress";

// The campaigns, in the order they're meant to be played (docs/CAMPAIGN.md), and the playable missions:
// `#story/<mission id>` opens one. Missions open in order, each once the one before is won (progress.ts).
export function StoryView({
  topic,
  progress,
  allOpen,
  onWon,
  onReset,
  onOpen,
  onPlayFull,
  onGraduate,
}: {
  topic?: string;
  progress: Progress;
  allOpen: boolean;
  onWon: (id: string, commended: boolean) => void;
  onReset: () => void;
  onOpen: (id: string | null) => void;
  onPlayFull: () => void;
  onGraduate: () => void; // after the last mission: on to the full game, with what the campaign didn't cover
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const entry = MISSIONS.find((m) => m.def.id === topic && missionOpen(progress, m.def.id, allOpen));
  if (entry) {
    const next = MISSIONS[MISSIONS.indexOf(entry) + 1];
    return <MissionView key={entry.def.id} entry={entry} onWon={(c) => onWon(entry.def.id, c)} onLeave={() => onOpen(null)} onNext={next ? () => onOpen(next.def.id) : undefined} onFinale={next ? undefined : onGraduate} />;
  }
  const started = progress.won.length > 0 || progress.commended.length > 0;
  return (
    <div className="page story">
      <StoryIntro onPlayFull={onPlayFull} />
      <div className="campaigns">
        {CAMPAIGNS.map((c, i) => {
          const playable = c.missions.filter((m) => m.play);
          const won = playable.filter((m) => progress.won.includes(m.play!.id)).length;
          const commendations = playable.filter((m) => m.play!.commendation);
          const commended = commendations.filter((m) => progress.commended.includes(m.play!.id)).length;
          return (
            <section key={c.id} className={`campaign campaign-${c.faction}`}>
              <div className="campaign-head">
                <span className="campaign-num">{i + 1}</span>
                <div>
                  <h3>{c.title}</h3>
                  <span className="muted small">
                    {FACTIONS.find((f) => f.id === c.faction)?.name} ·{" "}
                    {playable.length ? (
                      <>
                        {won} of {c.missions.length} won
                        {commendations.length > 0 && (
                          <>
                            {" "}
                            · {commended} of {commendations.length} <StarIcon on title="commendations" />
                          </>
                        )}
                      </>
                    ) : (
                      "coming soon"
                    )}
                  </span>
                </div>
              </div>
              <p className="campaign-tagline">{c.tagline}</p>
              {c.missions.length > 0 && (
                <ol className="missions">
                  {c.missions.map((m, n) => {
                    const def = m.play;
                    if (!def)
                      return (
                        <li key={m.title} className="mission-soon">
                          <b>{m.title}</b> <span className="muted">{m.teaser}</span>
                        </li>
                      );
                    const open = missionOpen(progress, def.id, allOpen);
                    const isWon = progress.won.includes(def.id);
                    return (
                      <li key={m.title}>
                        <button className={`mission-link ${open ? "" : "locked"}`} disabled={!open} onClick={() => onOpen(def.id)}>
                          <span className="mission-row">
                            <b>{m.title}</b>
                            <span className="mission-marks">
                              <VictoryIcon on={isWon} />
                              {def.commendation && <StarIcon on={progress.commended.includes(def.id)} title={`Commendation: ${def.commendation.name}`} />}
                            </span>
                          </span>
                          <span className="muted">{m.teaser}</span>
                          {open ? (
                            !isWon && <span className="mission-play">▶ Play</span>
                          ) : (
                            <span className="mission-lock">🔒 Win {c.missions[n - 1]?.title ?? "the campaign before"} first</span>
                          )}
                          {isWon && def.commendation && !progress.commended.includes(def.id) && (
                            <span className="mission-todo">
                              <StarIcon on={false} /> {def.commendation.name}: {def.commendation.text}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </div>
      {started && (
        <div className="reset-progress">
          {confirmReset ? (
            <>
              <span>Forget every mission won and every commendation?</span>
              <button
                className="warn-btn"
                onClick={() => {
                  onReset();
                  setConfirmReset(false);
                }}
              >
                Yes, reset
              </button>
              <button onClick={() => setConfirmReset(false)}>Keep it</button>
            </>
          ) : (
            <button className="small-btn" onClick={() => setConfirmReset(true)}>
              Reset all progress
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// The top of the Story tab: the skip for players who know the genre, then the Compact in a paragraph. Exported for
// docs/COPY.md (scripts/copy-doc.ts).
export function StoryIntro({ onPlayFull }: { onPlayFull: () => void }) {
  return (
    <>
      {/* for players who'd rather skip the story: first thing on the page, no scrolling */}
      <div className="skip-story">
        <span>Know strategy games already? Skip the story.</span>
        <button className="primary" onClick={onPlayFull}>
          Play the full game now →
        </button>
      </div>
      <h2>Story</h2>
      <p className="lede">
        Generations ago, the Wardens, Goblins and Elementals fought a war that nearly wrecked the world. It ended when the three
        factions were finally able to find Common Ground. Now every dispute over land, insults and old grudges is settled on the
        Field. Each commander chooses and commits their units carefully - once battle starts, they cannot be moved again.
      </p>
    </>
  );
}

// A mission: its briefing, then the Field. Leaving goes back to the list; Try again restarts the match; Next opens
// the next mission's briefing.
function MissionView({
  entry,
  onWon,
  onLeave,
  onNext,
  onFinale,
}: {
  entry: MissionEntry;
  onWon: (commended: boolean) => void;
  onLeave: () => void;
  onNext?: () => void;
  onFinale?: () => void;
}) {
  const [briefed, setBriefed] = useState(false);
  if (!briefed) return <Briefing entry={entry} onStart={() => setBriefed(true)} onBack={onLeave} />;
  return <PlayView mission={{ def: entry.def, title: entry.title, onLeave, onWon, onNext, onFinale }} />;
}

// A won mission's banner; an empty, dashed slot until then.
function VictoryIcon({ on }: { on: boolean }) {
  return (
    <svg className={`mark victory ${on ? "on" : ""}`} viewBox="0 0 20 20" width="20" height="20" role="img" aria-label={on ? "won" : "not won yet"}>
      <title>{on ? "Won" : "Not won yet"}</title>
      <path d="M5 2.5 V18" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.8 3.2 H16 L13.2 7.2 L16 11.2 H5.8 Z" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function StarIcon({ on, title }: { on: boolean; title?: string }) {
  const label = `${title ?? "Commendation"}${on ? "" : " (not earned yet)"}`;
  return (
    <svg className={`mark star ${on ? "on" : ""}`} viewBox="0 0 20 20" width="18" height="18" role="img" aria-label={label}>
      <title>{label}</title>
      <path d="M10 2 L12.4 7.2 L18 7.8 L13.8 11.6 L15 17.2 L10 14.3 L5 17.2 L6.2 11.6 L2 7.8 L7.6 7.2 Z" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
