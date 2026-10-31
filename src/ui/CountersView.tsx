import { useEffect, useState } from "react";
import { FACTIONS, factionOf } from "../data/roles";
import { DEFAULT_UNITS } from "../data/units";
import { COUNTER_BUDGET, COUNTER_SEEDS, strengths, weaknesses, type Reason } from "../game/counters";
import { runMatchup, type MatchupResult } from "../game/lab";
import type { LabMessage, LabRequest } from "../game/lab.worker";
import type { UnitDef } from "../sim/types";
import { CodexLink, Linked } from "./codexLinks";
import { RoleChips, Swatch } from "./UnitInfo";

// "I'm getting wrecked by X, what do I build?" Pick X; every other unit fights it with the same supply
// (one-unit armies, level 1, no upgrades, no Keeps), simulated in a worker. Results are cached for the
// session, since the roster can't change while the page is open.
const cache = new Map<string, Map<string, MatchupResult>>();

const STRONG = 0.65;
const WEAK = 0.35;
const valid = (id?: string) => (id && DEFAULT_UNITS.some((u) => u.id === id) ? id : null);

export function CountersView({ topic }: { topic?: string }) {
  const units = DEFAULT_UNITS;
  const [enemyId, setEnemyId] = useState<string | null>(() => valid(topic));
  const [results, setResults] = useState<Map<string, MatchupResult>>(new Map());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const id = valid(topic);
    if (id) setEnemyId(id);
  }, [topic]);

  useEffect(() => {
    if (!enemyId) return;
    const cached = cache.get(enemyId);
    if (cached) {
      setResults(cached);
      setProgress(null);
      return;
    }
    const pairs = units.filter((u) => u.id !== enemyId).map((u): [string, string] => [u.id, enemyId]);
    const map = new Map<string, MatchupResult>();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let worker: Worker | null = null;
    setResults(new Map());
    setProgress({ done: 0, total: pairs.length });
    const onResult = (r: MatchupResult, done: number) => {
      map.set(r.a, r);
      setResults(new Map(map));
      setProgress({ done, total: pairs.length });
    };
    const finish = () => {
      cache.set(enemyId, map);
      setProgress(null);
    };
    // Fallback when workers are unavailable: one matchup per frame.
    const onMainThread = () => {
      let k = 0;
      const step = () => {
        if (stopped) return;
        if (k >= pairs.length) return finish();
        const [a, b] = pairs[k++];
        onResult(runMatchup(units, a, b, COUNTER_BUDGET, COUNTER_SEEDS), k);
        timer = setTimeout(step, 0);
      };
      step();
    };
    try {
      worker = new Worker(new URL("../game/lab.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<LabMessage>) => {
        if (e.data.type === "result") onResult(e.data.result, e.data.done);
        else {
          finish();
          worker?.terminate();
        }
      };
      worker.onerror = () => {
        worker?.terminate();
        onMainThread();
      };
      worker.postMessage({ units, pairs, budget: COUNTER_BUDGET, seeds: COUNTER_SEEDS } satisfies LabRequest);
    } catch {
      onMainThread();
    }
    return () => {
      stopped = true;
      worker?.terminate();
      clearTimeout(timer);
    };
  }, [enemyId, units]);

  const pick = (id: string) => {
    setEnemyId(id);
    try {
      history.replaceState(null, "", `#counters/${id}`);
    } catch {
      // some embedded hosts disallow history changes
    }
  };

  const enemy = enemyId ? units.find((u) => u.id === enemyId) : undefined;
  const rows = enemy
    ? units
        .filter((u) => u.id !== enemy.id && results.has(u.id))
        .map((u) => ({ unit: u, r: results.get(u.id)! }))
        .sort((x, y) => y.r.winRate - x.r.winRate || y.r.avgRemainA - y.r.avgRemainB - (x.r.avgRemainA - x.r.avgRemainB))
    : [];
  const strong = rows.filter((x) => x.r.winRate >= STRONG);
  const even = rows.filter((x) => x.r.winRate > WEAK && x.r.winRate < STRONG);
  const weak = rows.filter((x) => x.r.winRate <= WEAK);

  return (
    <div className="page counters">
      <h2>Counters</h2>
      <p className="lede">Getting wrecked by something? Pick it, and see what to build against it.</p>

      <div className="enemy-picker">
        {FACTIONS.map((f) => {
          const list = units.filter((u) => factionOf(u.tags) === f.id);
          if (!list.length) return null;
          return (
            <div key={f.id} className="picker-group">
              <span className="picker-faction">{f.name}</span>
              <div className="picker-items">
                {list.map((u) => (
                  <button key={u.id} className={`picker-item ${u.id === enemyId ? "active" : ""}`} onClick={() => pick(u.id)}>
                    <Swatch def={u} size={18} /> {u.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!enemy ? (
        <p className="muted">Pick the enemy unit that&apos;s beating you.</p>
      ) : (
        <>
          <div className="counter-enemy">
            <Swatch def={enemy} size={40} />
            <div>
              <h3>Against {enemy.name}</h3>
              {enemy.description && (
                <p className="muted">
                  <Linked text={enemy.description} />
                </p>
              )}
              <RoleChips tags={enemy.tags} />
            </div>
          </div>
          {progress && (
            <p className="muted small">
              Testing every unit against {enemy.name}: {progress.done} of {progress.total}…
            </p>
          )}
          <CounterGroup title="Build these" hint="They win this fight at the same supply." rows={strong} enemy={enemy} kind="strong" />
          <CounterGroup title="Even fights" hint="Close either way. Placement and the rest of your army decide it." rows={even} enemy={enemy} kind="even" />
          <CounterGroup title="Don't send these" hint={`${enemy.name} beats them.`} rows={weak} enemy={enemy} kind="weak" />
          <p className="muted small method">
            How this is tested: {COUNTER_BUDGET} supply of each unit against {COUNTER_BUDGET} supply of {enemy.name}, as many squads as
            that buys, at level 1 with no upgrades and no <CodexLink topic="keeps">Keeps</CodexLink>. Real armies mix units, so add a
            counter to your army rather than building nothing else. Fliers look stronger here than in real matches, where most armies
            bring some <CodexLink topic="role-antiair">anti-air</CodexLink>.
          </p>
        </>
      )}
    </div>
  );
}

function CounterGroup({
  title,
  hint,
  rows,
  enemy,
  kind,
}: {
  title: string;
  hint: string;
  rows: { unit: UnitDef; r: MatchupResult }[];
  enemy: UnitDef;
  kind: "strong" | "even" | "weak";
}) {
  if (!rows.length) return null;
  return (
    <section className={`counter-group ${kind}`}>
      <h4>
        {title} <span className="muted small">{hint}</span>
      </h4>
      {rows.map(({ unit, r }) => {
        const pros = kind === "weak" ? [] : strengths(unit, enemy);
        const cons = kind === "strong" ? [] : weaknesses(unit, enemy);
        return (
          <div key={unit.id} className="counter-row">
            <Swatch def={unit} size={26} />
            <div className="counter-main">
              <div>
                <b>{unit.name}</b>{" "}
                <span className="muted small">
                  {unit.cost} supply{unit.unlockCost ? ` · unlock ${unit.unlockCost}` : ""}
                </span>
              </div>
              <div className="reasons">
                {pros.map((p, i) => (
                  <ReasonChip key={`p${i}`} reason={p} pro />
                ))}
                {cons.map((c, i) => (
                  <ReasonChip key={`c${i}`} reason={c} />
                ))}
                {!pros.length && !cons.length && <span className="muted small">{kind === "weak" ? "Loses the trade" : "Wins the trade"}</span>}
              </div>
            </div>
            <WinBar win={r.winRate} />
          </div>
        );
      })}
    </section>
  );
}

function ReasonChip({ reason, pro }: { reason: Reason; pro?: boolean }) {
  const cls = `reason ${pro ? "pro" : "con"}`;
  return reason.topic ? (
    <CodexLink topic={reason.topic} className={cls}>
      {reason.text}
    </CodexLink>
  ) : (
    <span className={cls}>{reason.text}</span>
  );
}

function WinBar({ win }: { win: number }) {
  const pct = Math.round(win * 100);
  return (
    <div className="winbar" title={`Wins ${pct}% of test fights`}>
      <div className="winbar-fill" style={{ width: `${pct}%` }} />
      <span>wins {pct}%</span>
    </div>
  );
}
