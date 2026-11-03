import { CAST, type Line, type MissionDef, type MissionEntry } from "../data/campaign";
import { DEFAULT_UNITS } from "../data/units";
import type { MissionOutcome } from "../game/mission";
import { Linked, UnitLink } from "./codexLinks";
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

// A page of the book: the rule, then the drill drawn as ranks of tokens, front rank toward the enemy.
export function DrillPage({ page }: { page: MissionDef["page"] }) {
  return (
    <div className="drill-page">
      <div className="drill-title">{page.title}</div>
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
      {page.drill && <p className="drill-line">{page.drill}</p>}
    </div>
  );
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
        <p className="muted small">
          Your champions:{" "}
          {m.units.map((id, i) => (
            <span key={id}>
              {i > 0 && ", "}
              <UnitLink id={id}>{UNITS.get(id)?.name ?? id}</UnitLink>
            </span>
          ))}
          . {m.hp ? `Each side starts with ${m.hp[0]} HP.` : "One battle decides it."}
        </p>
        <button className="primary big" onClick={onStart}>
          Take the Field
        </button>
      </div>
    </div>
  );
}

// In the sidebar once the match is over, in place of the skirmish's "You win the war!".
export function Debrief({ def, outcome, onRetry, onLeave }: { def: MissionDef; outcome: MissionOutcome; onRetry: () => void; onLeave: () => void }) {
  const c = def.commendation;
  return (
    <div className="debrief">
      {outcome.won ? def.win.map((l, i) => <Say key={i} line={l} small />) : outcome.hint && <Say line={outcome.hint} small />}
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
