import { useEffect, useRef, useState, type ReactNode } from "react";
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

// A conversation, one line at a time: Continue (or a click on the lines, Space or Enter) shows the next, and Skip
// shows them all. `after` appears once every line has been read. With `reveal` off, everything shows at once.
export function Dialogue({ lines, small, after, reveal = true }: { lines: Line[]; small?: boolean; after?: ReactNode; reveal?: boolean }) {
  const [shown, setShown] = useState(reveal ? Math.min(1, lines.length) : lines.length);
  const last = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const done = shown >= lines.length;
  useEffect(() => {
    if (shown > 1) last.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (!done) next.current?.focus({ preventScroll: true });
  }, [shown, done]);
  const advance = () => setShown((n) => Math.min(lines.length, n + 1));
  return (
    <>
      <div className={`dialogue ${done ? "" : "reading"}`} onClick={done ? undefined : advance}>
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} ref={i === shown - 1 ? last : undefined} className={i === shown - 1 && shown > 1 ? "say-new" : undefined}>
            <Say line={l} small={small} />
          </div>
        ))}
      </div>
      {done ? (
        after
      ) : (
        <div className="dialogue-controls">
          <button ref={next} className="primary" onClick={advance}>
            Continue
          </button>
          <button className="link-btn" onClick={() => setShown(lines.length)}>
            Skip
          </button>
        </div>
      )}
    </>
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

export function Briefing({ entry, onStart, onBack, reveal = true }: { entry: MissionEntry; onStart: () => void; onBack: () => void; reveal?: boolean }) {
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
          <Dialogue
            lines={m.briefing}
            reveal={reveal}
            after={
              <>
                <DrillPage page={m.page} />
                <p className="brief-kit">
                  <Linked text={m.objective} />
                </p>
                <button className="primary big" onClick={onStart}>
                  Take the Field
                </button>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

// In the sidebar once the match is over, in place of the skirmish's "You win the war!". After a win the next mission
// comes first (after the last one, the full game), then playing this one again; going back to the list is a quiet link
// (the Story tab does it too).
export function Debrief({
  def,
  outcome,
  army,
  onRetry,
  onLeave,
  onNext,
  onFinale,
  reveal = true,
}: {
  def: MissionDef;
  outcome: MissionOutcome;
  army: PlacedSquad[];
  onRetry: () => void;
  onLeave: () => void;
  onNext?: () => void;
  onFinale?: () => void;
  reveal?: boolean;
}) {
  const c = def.commendation;
  const after = outcome.won && (
    <>
      {def.winNote && <PencilNote text={def.winNote} />}
      {def.lastPage && <DrillPage page={{ ...def.lastPage, diagram: boardDiagram(army) }} />}
    </>
  );
  return (
    <div className="debrief">
      {outcome.won ? <Dialogue lines={def.win} small after={after} reveal={reveal} /> : outcome.hint && <Say line={outcome.hint} small />}
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
        {outcome.won && onNext && (
          <button className="primary big" onClick={onNext}>
            Next mission →
          </button>
        )}
        {outcome.won && !onNext && onFinale && (
          <button className="primary big" onClick={onFinale}>
            Play the full game →
          </button>
        )}
        {outcome.won && !onNext && !onFinale && (
          <button className="primary big" onClick={onLeave}>
            Back to the campaigns
          </button>
        )}
        <button className={outcome.won ? "" : "primary big"} onClick={onRetry}>
          {outcome.won ? "Play again" : "Try again"}
        </button>
        {(!outcome.won || onNext || onFinale) && (
          <button className="link-btn" onClick={onLeave}>
            Back to the campaigns
          </button>
        )}
      </div>
    </div>
  );
}
