import { useEffect, useRef, useState } from "react";
import { SHOWCASES } from "../data/showcases";
import { DEFAULT_UNITS } from "../data/units";
import { ARENA, FEATURED, showcaseBattle } from "../game/showcase";
import { SIDE_COLORS } from "../render/draw";
import type { Battle } from "../sim/battle";
import { applyUpgrades } from "../sim/upgrades";
import type { UnitDef } from "../sim/types";
import { drawBanner, useBattlePlayer } from "./battlePlayer";
import { FieldCanvas } from "./FieldCanvas";
import { UnitInfo, UnitPicker } from "./UnitInfo";

// Browse the roster: pick a unit to see what it does, with a little fight that shows it off (src/data/showcases.ts).
// Upgrades can be tried in the fight. #units/<id> opens a unit's page, so other screens can link here.
const TILE = 28;
const PAUSE = 2.5; // seconds the result stays up before the fight starts over
const valid = (id?: string) => (id && DEFAULT_UNITS.some((u) => u.id === id) ? id : null);

export function UnitsView({ topic }: { topic?: string }) {
  const units = DEFAULT_UNITS;
  const [unitId, setUnitId] = useState(() => valid(topic) ?? units[0].id);
  const [ups, setUps] = useState<string[]>([]);

  useEffect(() => {
    const id = valid(topic);
    if (id) {
      setUnitId(id);
      setUps([]);
    }
  }, [topic]);

  const pick = (id: string) => {
    setUnitId(id);
    setUps([]);
    try {
      history.replaceState(null, "", `#units/${id}`);
    } catch {
      // some embedded hosts disallow history changes
    }
  };

  const base = units.find((u) => u.id === unitId)!;
  // in the unit's own order, so the result doesn't depend on the order they were switched on
  const active = (base.upgrades ?? []).map((u) => u.id).filter((id) => ups.includes(id));
  const toggle = (id: string) => setUps((cur) => (cur.includes(id) ? cur.filter((u) => u !== id) : [...cur, id]));

  return (
    <div className="page units">
      <h2>Units</h2>
      <p className="lede">Every unit on the Field, and what it&apos;s for. Pick one to watch it fight, then try its upgrades.</p>
      <UnitPicker units={units} active={unitId} onPick={pick} />
      <div className="unit-page">
        <ShowcasePanel units={units} def={base} upgrades={active} />
        <UnitInfo
          def={applyUpgrades(base, active)}
          owned={active}
          upgradeAction={(id) => (
            <button className={`small-btn ${active.includes(id) ? "on" : ""}`} onClick={() => toggle(id)}>
              {active.includes(id) ? "Remove" : "Try it"}
            </button>
          )}
        />
      </div>
    </div>
  );
}

function ShowcasePanel({ units, def, upgrades }: { units: UnitDef[]; def: UnitDef; upgrades: string[] }) {
  const sc = SHOWCASES[def.id];
  const key = `${def.id}|${upgrades.join(",")}`;
  const player = useBattlePlayer();
  const fight = useRef<{ key: string; battle: Battle; seed: number; endedAt: number | null } | null>(null);
  const name = (id: string) => units.find((u) => u.id === id)?.name ?? id;

  const start = (seed: number) => {
    fight.current = { key, battle: showcaseBattle(units, def.id, upgrades, seed), seed, endedAt: null };
    player.reset();
  };

  const draw = (ctx: CanvasRenderingContext2D, dt: number, time: number) => {
    if (fight.current?.key !== key) start(1);
    const f = fight.current!;
    // a one-sided fight is still worth watching, so it only speeds up a little
    player.frame(ctx, f.battle, TILE, dt, time, 1, undefined, false, { highlight: (m) => m.squadUid.startsWith(FEATURED), sideways: true }, 2);
    if (!f.battle.over) return;
    f.endedAt ??= time;
    const w = f.battle.winner;
    drawBanner(ctx, (ARENA.fieldW * TILE) / 2, w === 0 ? "Victory" : w === 1 ? "Defeat" : "Draw");
    if (time - f.endedAt > PAUSE) start(f.seed + 1);
  };

  return (
    <div className="showcase">
      <FieldCanvas tile={TILE} field={{ w: ARENA.fieldW, h: ARENA.fieldH }} draw={draw} className="showcase-field" />
      <div className="showcase-sides small">
        <span style={{ color: SIDE_COLORS[0] }}>{lineup([...Array(sc.squads ?? 1).fill(def.id), ...(sc.allies ?? [])], name)}</span>
        <span className="muted">vs</span>
        <span style={{ color: SIDE_COLORS[1] }}>{lineup(sc.vs, name)}</span>
      </div>
      <p className="showcase-caption">{sc.caption}</p>
      <p className="muted small">
        <a href={`#counters/${def.id}`}>What beats {def.name}?</a>
      </p>
    </div>
  );
}

// "Knights ×2 + Cleric"
function lineup(ids: string[], name: (id: string) => string): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => (n > 1 ? `${name(id)} ×${n}` : name(id))).join(" + ");
}
