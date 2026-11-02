import { useState } from "react";
import { CAMPAIGNS, MISSIONS, type MissionEntry } from "../data/campaign";
import { FACTIONS } from "../data/roles";
import { CodexLink } from "./codexLinks";
import { Briefing } from "./Mission";
import { PlayView } from "./PlayView";

// The campaigns, in the order they're meant to be played (docs/CAMPAIGN.md), and the playable missions:
// `#story/<mission id>` opens one. `won` is what was won during this visit; nothing is stored.
export function StoryView({ topic, won, onWon, onOpen }: { topic?: string; won: Set<string>; onWon: (id: string) => void; onOpen: (id: string | null) => void }) {
  const entry = MISSIONS.find((m) => m.def.id === topic);
  if (entry) return <MissionView key={entry.def.id} entry={entry} onWon={() => onWon(entry.def.id)} onLeave={() => onOpen(null)} />;
  return (
    <div className="page story">
      <h2>Story</h2>
      <p className="lede">
        Generations ago, the three peoples fought a war that nearly wrecked the world: walls against swarms against storms. It ended in a
        treaty, the Compact. Now every dispute over land, insults and old grudges is settled on the Field. Each commander chooses
        champions and places them, and once the horn sounds, no one may touch the fight. The rules are the same for everyone.
      </p>
      <p className="muted">
        Start with the Wardens. Their first mission is ready; the rest of the three campaigns are on the way. Until then, <a href="#play">Play</a> is
        the whole game, with every unit, and the <CodexLink topic="compact">Codex</CodexLink> explains the rules.
      </p>
      <div className="campaigns">
        {CAMPAIGNS.map((c, i) => {
          const playable = c.missions.filter((m) => m.play).length;
          return (
            <section key={c.id} className={`campaign campaign-${c.faction}`}>
              <div className="campaign-head">
                <span className="campaign-num">{i + 1}</span>
                <div>
                  <h3>{c.title}</h3>
                  <span className="muted small">
                    {FACTIONS.find((f) => f.id === c.faction)?.name} · {playable ? `${playable} of ${c.missions.length} missions ready` : "coming soon"}
                  </span>
                </div>
              </div>
              <p className="campaign-tagline">{c.tagline}</p>
              {c.missions.length > 0 && (
                <ol className="missions">
                  {c.missions.map((m) => (
                    <li key={m.title} className={m.play ? "playable" : ""}>
                      {m.play ? (
                        <button className="mission-link" onClick={() => onOpen(m.play!.id)}>
                          <b>{m.title}</b>
                          {won.has(m.play.id) ? <span className="mission-won"> ✓ won</span> : <span className="mission-play"> ▶ Play</span>}
                          <span className="muted">{m.teaser}</span>
                        </button>
                      ) : (
                        <>
                          <b>{m.title}</b> <span className="muted">{m.teaser}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// A mission: its briefing, then the Field. Leaving goes back to the list; Try again restarts the match.
function MissionView({ entry, onWon, onLeave }: { entry: MissionEntry; onWon: () => void; onLeave: () => void }) {
  const [briefed, setBriefed] = useState(false);
  if (!briefed) return <Briefing entry={entry} onStart={() => setBriefed(true)} onBack={onLeave} />;
  return <PlayView mission={{ def: entry.def, title: entry.title, onLeave, onWon }} />;
}
