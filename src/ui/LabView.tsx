import { useEffect, useRef, useState } from "react";
import { runMatchup, type MatchupResult } from "../game/lab";
import type { LabMessage, LabRequest } from "../game/lab.worker";
import { useRoster } from "../store/roster";
import { Num } from "./fields";
import { Swatch } from "./UnitInfo";

// Every unit vs every unit at equal supply, simulated headless in a worker.
export function LabView() {
  const units = useRoster();
  const [budget, setBudget] = useState(1000);
  const [seeds, setSeeds] = useState(4);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Map<string, MatchupResult>>(new Map());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [hover, setHover] = useState<{ a: string; b: string } | null>(null);
  const worker = useRef<Worker | null>(null);
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      worker.current?.terminate();
      cancelled.current = true;
    },
    [],
  );

  const ids = units.filter((u) => !excluded.has(u.id)).map((u) => u.id);

  const run = () => {
    worker.current?.terminate();
    cancelled.current = true;
    const map = new Map<string, MatchupResult>();
    setResults(new Map());
    setProgress({ done: 0, total: (ids.length * (ids.length - 1)) / 2 });
    const onMessage = (msg: LabMessage) => {
      if (msg.type === "result") {
        const r = msg.result;
        map.set(`${r.a}|${r.b}`, r);
        setResults(new Map(map));
        setProgress({ done: msg.done, total: msg.total });
      } else {
        setProgress(null);
        worker.current?.terminate();
      }
    };
    try {
      const w = new Worker(new URL("../game/lab.worker.ts", import.meta.url), { type: "module" });
      worker.current = w;
      w.onmessage = (e: MessageEvent<LabMessage>) => onMessage(e.data);
      w.onerror = () => {
        w.terminate();
        runOnMainThread(onMessage);
      };
      w.postMessage({ units, ids, budget, seeds } satisfies LabRequest);
    } catch {
      runOnMainThread(onMessage);
    }
  };

  // Fallback when workers are unavailable: run one matchup per frame.
  const runOnMainThread = (onMessage: (m: LabMessage) => void) => {
    cancelled.current = false;
    const pairs: [string, string][] = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
    let k = 0;
    const step = () => {
      if (cancelled.current) return;
      if (k >= pairs.length) return onMessage({ type: "done" });
      const [a, b] = pairs[k++];
      onMessage({ type: "result", result: runMatchup(units, a, b, budget, seeds), done: k, total: pairs.length });
      setTimeout(step, 0);
    };
    step();
  };

  const get = (a: string, b: string): { win: number; r: MatchupResult } | null => {
    const r = results.get(`${a}|${b}`);
    if (r) return { win: r.winRate, r };
    const s = results.get(`${b}|${a}`);
    if (s) return { win: 1 - s.winRate, r: s };
    return null;
  };

  const score = (a: string) => {
    let total = 0;
    let n = 0;
    for (const b of ids) {
      if (a === b) continue;
      const g = get(a, b);
      if (g) {
        total += g.win;
        n++;
      }
    }
    return n ? total / n : null;
  };

  const hovered = hover ? get(hover.a, hover.b) : null;
  const name = (id: string) => units.find((u) => u.id === id)?.name ?? id;

  return (
    <div className="lab">
      <div className="lab-controls">
        <h2>Balance Lab</h2>
        <label>
          Supply per side <Num value={budget} step={100} onChange={setBudget} />
        </label>
        <label>
          Seeds <Num value={seeds} min={1} onChange={(v) => setSeeds(Math.max(1, Math.round(v)))} />
        </label>
        <button className="primary" onClick={run} disabled={ids.length < 2}>
          Run matrix
        </button>
        {progress && (
          <span className="muted">
            {progress.done}/{progress.total}
          </span>
        )}
      </div>
      <p className="muted small">
        Each cell is the row unit's win rate against the column unit, each side spending the same supply on as many squads of one unit as
        it can afford. Mass single-unit fights undervalue support and combo units — use the sandbox for those. Click a unit to toggle it.
      </p>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th />
              {units.map((u) => (
                <th key={u.id} className={excluded.has(u.id) ? "off" : ""} title={u.name}>
                  <Swatch def={u} size={20} />
                </th>
              ))}
              <th>avg</th>
            </tr>
          </thead>
          <tbody>
            {units.map((a) => {
              const s = excluded.has(a.id) ? null : score(a.id);
              return (
                <tr key={a.id} className={excluded.has(a.id) ? "off" : ""}>
                  <th
                    className="row-head"
                    onClick={() => {
                      const next = new Set(excluded);
                      next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                      setExcluded(next);
                    }}
                  >
                    <Swatch def={a} size={16} /> {a.name} <span className="muted">{a.cost}</span>
                  </th>
                  {units.map((b) => {
                    if (a.id === b.id) return <td key={b.id} className="diag" />;
                    const g = excluded.has(a.id) || excluded.has(b.id) ? null : get(a.id, b.id);
                    return (
                      <td
                        key={b.id}
                        style={g ? { background: heat(g.win) } : undefined}
                        onMouseEnter={() => setHover({ a: a.id, b: b.id })}
                        onMouseLeave={() => setHover(null)}
                      >
                        {g ? Math.round(g.win * 100) : ""}
                      </td>
                    );
                  })}
                  <td className="avg">{s === null ? "" : `${Math.round(s * 100)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="lab-detail">
        {hover && hovered ? (
          <span>
            <b>{name(hover.a)}</b> vs <b>{name(hover.b)}</b>: {Math.round(hovered.win * 100)}% win. Survivors keep{" "}
            {Math.round((hovered.r.a === hover.a ? hovered.r.avgRemainA : hovered.r.avgRemainB) * 100)}% vs{" "}
            {Math.round((hovered.r.a === hover.a ? hovered.r.avgRemainB : hovered.r.avgRemainA) * 100)}% of their value · ~
            {hovered.r.avgTime.toFixed(0)}s
          </span>
        ) : (
          <span className="muted">Hover a cell for details.</span>
        )}
      </div>
    </div>
  );
}

// red (0%) → neutral (50%) → green (100%)
function heat(w: number): string {
  const t = Math.abs(w - 0.5) * 2;
  const hue = w >= 0.5 ? 130 : 0;
  return `hsla(${hue}, 60%, 40%, ${0.15 + t * 0.7})`;
}
