import { CAST, type Line, type MissionDef, type MissionEntry } from "../data/campaign";
import { DEFAULT_UNITS } from "../data/units";
import type { MissionOutcome } from "../game/mission";
import { footprintOf } from "../sim/battle";
import type { PlacedSquad } from "../sim/types";
import { Linked } from "./codexLinks";
import { Portrait } from "./Portraits";
import { Swatch } from "./UnitInfo";

// The story around a mission: the briefing before it, the Drill Book page, and the debrief after (docs/CAMPAIGN.md).

const UNITS = new Map(DEFAULT_UNITS.map((u) => [u.id, u]));

// A line of dialogue: the speaker's portrait and a parchment speech bubble. Wardens speak from the left, goblins from
// the right, so a conversation reads as one.
export function Say({ line, small }: { line: Line; small?: boolean }) {
  const who = CAST[line.who];
  return (
    <div className={`say say-${who.side}`}>
      <Portrait who={line.who} size={small ? 34 : 48} />
      <p className="bubble">
        <b>{who.name}</b> {line.text}
      </p>
    </div>
  );
}

// A page of the book: a line in the Marshal's hand (page 9), the rule, the formation drawn as ranks of tokens (front
// rank toward the enemy), and the Marshal's pencil note in the margin.
export function DrillPage({ page }: { page: MissionDef["page"] & { handwritten?: string } }) {
  return (
    <div className="drill-page">
      <div className="drill-title">{page.title}</div>
      {page.handwritten && <p className="drill-ink">{page.handwritten}</p>}
      <p className="drill-text">“{page.text}”</p>
      {page.diagram && (
        <div className="drill-diagram" aria-hidden="true">
          <span className="drill-enemy">the enemy</span>
          {page.diagram.map((rank, i) => (
            <div key={i} className="drill-rank">
              {rank.map((id, j) => {
                const def = UNITS.get(id);
                return def ? <Swatch key={j} def={def} size={26} /> : null;
              })}
            </div>
          ))}
        </div>
      )}
      {page.note && <PencilNote text={page.note} />}
    </div>
  );
}

// The Marshal's pencil note: in a page's margin, and after a win.
export function PencilNote({ text }: { text: string }) {
  return <p className="pencil-note">{text}</p>;
}

// The player's board as a page of the book: ranks by depth, front rank (nearest the enemy) first, each rank left to
// right. A rank is the squads whose middles sit in the same two rows.
export function boardDiagram(army: PlacedSquad[]): string[][] {
  const ranks = new Map<number, PlacedSquad[]>();
  for (const sq of army) {
    const def = UNITS.get(sq.defId);
    if (!def) continue;
    const { w, h } = footprintOf(def, sq.rot);
    const band = Math.floor((sq.y + h / 2) / 2);
    ranks.set(band, [...(ranks.get(band) ?? []), { ...sq, x: sq.x + w / 2 }]);
  }
  return [...ranks.entries()].sort(([a], [b]) => a - b).map(([, sqs]) => sqs.sort((a, b) => a.x - b.x).map((sq) => sq.defId));
}

export function Briefing({ entry, onStart, onBack }: { entry: MissionEntry; onStart: () => void; onBack: () => void }) {
  const m = entry.def;
  return (
    <div className="page mission">
      <div className="mission-card">
        <button className="mission-back" onClick={onBack}>
          ← Campaigns
        </button>
        <div className="muted small">
          {entry.campaign.title} · Mission {entry.number}
        </div>
        <h2>{entry.title}</h2>
        <div className="brief-lines">
          {m.briefing.map((l, i) => (
            <Say key={i} line={l} />
          ))}
        </div>
        <DrillPage page={m.page} />
        <p className="brief-kit">
          <Linked text={m.objective} />
        </p>
        <button className="primary big" onClick={onStart}>
          Take the Field
        </button>
      </div>
    </div>
  );
}

// In the sidebar once the match is over, in place of the skirmish's "You win the war!".
export function Debrief({ def, outcome, army, onRetry, onLeave }: { def: MissionDef; outcome: MissionOutcome; army: PlacedSquad[]; onRetry: () => void; onLeave: () => void }) {
  const c = def.commendation;
  return (
    <div className="debrief">
      {outcome.won ? def.win.map((l, i) => <Say key={i} line={l} small />) : outcome.hint && <Say line={outcome.hint} small />}
      {outcome.won && def.winNote && <PencilNote text={def.winNote} />}
      {outcome.won && def.lastPage && <DrillPage page={{ ...def.lastPage, diagram: boardDiagram(army) }} />}
      {c &&
        (outcome.commended ? (
          <p className="commendation earned">
            ★ <b>Commendation: {c.name}.</b> {c.text}
          </p>
        ) : (
          <p className="commendation muted small">
            Commendation, <b>{c.name}</b>: {c.text}
          </p>
        ))}
      <div className="debrief-buttons">
        <button className={outcome.won ? "" : "primary big"} onClick={onRetry}>
          {outcome.won ? "Play again" : "Try again"}
        </button>
        <button className={outcome.won ? "primary big" : ""} onClick={onLeave}>
          Back to the campaigns
        </button>
      </div>
    </div>
  );
}
