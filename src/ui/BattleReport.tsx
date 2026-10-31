import { useState } from "react";
import { ELEMENT_COLORS, STATUSES, SURFACES } from "../data/elements";
import type { BattleResult, SquadStats } from "../sim/battle";
import type { Side, UnitDef } from "../sim/types";
import { Swatch } from "./UnitInfo";

// Colors for breakdown keys: elements, statuses, surfaces and reactions by name.
const KEY_COLORS: Record<string, string> = { ...ELEMENT_COLORS };
for (const s of Object.values(STATUSES)) KEY_COLORS[s.name] = s.color;
for (const s of Object.values(SURFACES)) KEY_COLORS[s.name] = s.color;
KEY_COLORS.Attack = "#e2b45a";

function fmt(n: number) {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString();
}

function Bars({ data, unitColors }: { data: Record<string, number>; unitColors?: Record<string, string> }) {
  const rows = Object.entries(data)
    .filter(([, v]) => v >= 0.5)
    .sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  if (!rows.length) return <p className="muted small">None.</p>;
  return (
    <div className="bars">
      {rows.map(([k, v]) => (
        <div key={k} className="bar-row">
          <span className="bar-label">{k}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(v / total) * 100}%`, background: unitColors?.[k] ?? KEY_COLORS[k] ?? "#8d969f" }} />
          </span>
          <span className="bar-num">{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function SquadDetail({ stats, def }: { stats: SquadStats; def?: UnitDef }) {
  return (
    <div className="squad-detail">
      <div className="unit-info-head">
        {def && <Swatch def={def} size={28} />}
        <div>
          <div className="unit-name">{stats.name}</div>
          <div className="muted small">
            {stats.side === 0 ? "Yours" : "Enemy"} · {stats.alive}/{stats.total} survived
          </div>
        </div>
      </div>
      <div className="stat-tiles">
        <div>
          <b>{fmt(stats.dealt)}</b>
          <span>damage dealt</span>
        </div>
        <div>
          <b>{stats.kills}</b>
          <span>kills</span>
        </div>
        <div>
          <b>{fmt(stats.taken)}</b>
          <span>damage taken</span>
        </div>
        <div className={stats.friendly > 0 ? "warn" : ""}>
          <b>{fmt(stats.friendly)}</b>
          <span>friendly fire{stats.teamKills ? ` (${stats.teamKills} killed)` : ""}</span>
        </div>
      </div>
      <h5>Dealt through</h5>
      <Bars data={stats.dealtBy} />
      <h5>Taken from</h5>
      <Bars data={stats.takenBySource} />
      <h5>Taken by element</h5>
      <Bars data={stats.takenByElement} />
      {Object.keys(stats.takenByReaction).length > 0 && (
        <>
          <h5>Extra damage from reactions</h5>
          <Bars data={stats.takenByReaction} />
        </>
      )}
    </div>
  );
}

export const MEDAL_COLORS = ["#f5c542", "#c9d1d9", "#cd7f32"] as const;

// The top squads on one side by damage dealt (towers excluded), best first.
export function topSquads(result: BattleResult, side: Side, n = 3): SquadStats[] {
  return Object.values(result.stats)
    .filter((s) => s.side === side && !s.structure && s.dealt >= 1)
    .sort((a, b) => b.dealt - a.dealt)
    .slice(0, n);
}

// At-a-glance impact: the three biggest damage dealers on each side.
export function MvpBoard({
  result,
  defs,
  selected,
  onSelect,
  onHover,
}: {
  result: BattleResult;
  defs: Map<string, UnitDef>;
  selected: string | null;
  onSelect: (uid: string | null) => void;
  onHover: (uid: string | null) => void;
}) {
  return (
    <div className="mvp-board">
      {([0, 1] as Side[]).map((side) => (
        <div key={side} className={`mvp-col mvp-${side}`}>
          <div className="mvp-head">{side === 0 ? "Your MVPs" : "Enemy MVPs"}</div>
          {topSquads(result, side).map((s, i) => {
            const def = defs.get(s.defId);
            return (
              <button
                key={s.uid}
                className={`mvp-row ${selected === s.uid ? "active" : ""}`}
                onClick={() => onSelect(selected === s.uid ? null : s.uid)}
                onMouseEnter={() => onHover(s.uid)}
                onMouseLeave={() => onHover(null)}
              >
                <span className="medal" style={{ background: MEDAL_COLORS[i] }}>
                  {i + 1}
                </span>
                {def && <Swatch def={def} size={16} />}
                <span className="mvp-name">{s.name}</span>
                <span className="mvp-dmg">{fmt(s.dealt)}</span>
              </button>
            );
          })}
          {topSquads(result, side).length === 0 && <span className="muted small">No damage dealt.</span>}
        </div>
      ))}
    </div>
  );
}

export function SquadList({
  result,
  defs,
  selected,
  onSelect,
  onHover,
}: {
  result: BattleResult;
  defs: Map<string, UnitDef>;
  selected: string | null;
  onSelect: (uid: string | null) => void;
  onHover: (uid: string | null) => void;
}) {
  const [side, setSide] = useState<Side>(0);
  const rows = Object.values(result.stats)
    .filter((s) => s.side === side)
    .sort((a, b) => Number(a.structure) - Number(b.structure) || b.dealt - a.dealt);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.dealt, r.taken)));
  return (
    <div className="squad-list">
      <div className="seg">
        <button className={side === 0 ? "active" : ""} onClick={() => setSide(0)}>
          Your squads
        </button>
        <button className={side === 1 ? "active" : ""} onClick={() => setSide(1)}>
          Enemy squads
        </button>
      </div>
      <div className="squad-rows">
        {rows.map((r) => {
          const def = defs.get(r.defId);
          return (
            <button
              key={r.uid}
              className={`squad-row ${selected === r.uid ? "active" : ""}`}
              onClick={() => onSelect(selected === r.uid ? null : r.uid)}
              onMouseEnter={() => onHover(r.uid)}
              onMouseLeave={() => onHover(null)}
            >
              {def && <Swatch def={def} size={16} />}
              <span className="squad-row-name">
                {r.name} <span className="muted">{r.alive}/{r.total}</span>
              </span>
              <span className="mini-bars">
                <span className="mini-bar dealt" style={{ width: `${(r.dealt / max) * 100}%` }} />
                <span className="mini-bar taken" style={{ width: `${(r.taken / max) * 100}%` }} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="legend small muted">
        <span className="dot dealt" /> dealt <span className="dot taken" /> taken
      </div>
    </div>
  );
}
