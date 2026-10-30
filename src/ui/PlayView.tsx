import { useEffect, useMemo, useRef, useState } from "react";
import { RULES } from "../data/rules";
import { TOWER_MAP, towerPlacements } from "../data/towers";
import { planAiRound, type AiPlan, type Difficulty } from "../game/ai";
import { canPlace, defMap, newUid, squadRect, type DefMap } from "../game/army";
import { applyRound, newMatch, nextRound, type MatchState } from "../game/match";
import { drawBackground, drawSquad, drawTowers } from "../render/draw";
import { Battle, footprintOf, type BattleResult } from "../sim/battle";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { useRoster } from "../store/roster";
import { SquadDetail, SquadList } from "./BattleReport";
import { useBattlePlayer } from "./battlePlayer";
import { FieldCanvas, type FieldPointer } from "./FieldCanvas";
import { Swatch, UnitInfo } from "./UnitInfo";

const TILE = 22;

// Everything needed to show (and replay) the last battle.
interface FoughtBattle {
  armies: [PlacedSquad[], PlacedSquad[]];
  defs: DefMap;
  seed: number;
  result: BattleResult | null;
}

export function PlayView() {
  const units = useRoster();
  const defs = useMemo(() => defMap(units), [units]);
  const [match, setMatch] = useState<MatchState>(() => newMatch(units));
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [selected, setSelected] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [rot, setRot] = useState(false);
  const [armedUnlock, setArmedUnlock] = useState<string | null>(null);
  const [hoverDef, setHoverDef] = useState<UnitDef | null>(null);
  const [speed, setSpeed] = useState(1);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [fought, setFought] = useState<FoughtBattle | null>(null);
  const [view, setView] = useState<"report" | "replay">("report");
  const [pinned, setPinned] = useState<string | null>(null);
  const [hoverSquad, setHoverSquad] = useState<string | null>(null);
  const battleRef = useRef<Battle | null>(null);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const player = useBattlePlayer();

  // The AI plans at the start of each deployment, from what it saw last round.
  useEffect(() => {
    if (match.phase !== "deploy") return;
    setAiPlan(null);
    const id = setTimeout(() => {
      setAiPlan(
        planAiRound(units, defs, match.armies[1], match.unlocked[1], match.armies[0], match.supply[1], match.round, difficulty, match.round * 7919 + 13),
      );
    }, 30);
    return () => clearTimeout(id);
  }, [match.round, match.phase === "deploy"]);

  useEffect(() => {
    if (!armedUnlock) return;
    const t = setTimeout(() => setArmedUnlock(null), 3000);
    return () => clearTimeout(t);
  }, [armedUnlock]);

  const myArmy = match.armies[0];
  const unlocked = useMemo(() => new Set(match.unlocked[0]), [match.unlocked]);
  const isNew = (sq: PlacedSquad) => !RULES.lockPlacedSquads || sq.round === match.round;
  const heldSquad = held ? myArmy.find((s) => s.uid === held) : undefined;
  const placingDef = heldSquad ? defs.get(heldSquad.defId) : selected ? defs.get(selected) : undefined;
  const deploying = match.phase === "deploy";
  const reporting = (match.phase === "result" || match.phase === "over") && view === "report" && fought?.result;

  const ghostPos = (def: UnitDef, p: { x: number; y: number }) => {
    const { w, h } = footprintOf(def, rot);
    return { x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2) };
  };

  const hitSquad = (squads: PlacedSquad[], x: number, y: number, map: DefMap) =>
    squads.find((s) => {
      const d = map.get(s.defId) ?? TOWER_MAP.get(s.defId);
      if (!d) return false;
      const r = squadRect(s, d);
      return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    });

  const reportSquads = (): PlacedSquad[] =>
    fought ? [...fought.armies[0], ...fought.armies[1], ...towerPlacements(0), ...towerPlacements(1)] : [];

  const updateArmy = (army: PlacedSquad[]) => setMatch((m) => ({ ...m, armies: [army, m.armies[1]] }));

  const sell = (sq: PlacedSquad) => {
    const cost = defs.get(sq.defId)?.cost ?? 0;
    setMatch((m) => ({
      ...m,
      supply: [m.supply[0] + cost, m.supply[1]],
      armies: [m.armies[0].filter((s) => s.uid !== sq.uid), m.armies[1]],
    }));
  };

  const onPointer = (p: FieldPointer) => {
    if (p.type === "leave") {
      hover.current = null;
      setHoverSquad(null);
      return;
    }
    hover.current = { x: p.x, y: p.y };

    if (reporting) {
      const sq = hitSquad(reportSquads(), p.x, p.y, fought!.defs);
      if (p.type === "move") setHoverSquad(sq?.uid ?? null);
      else setPinned(sq && sq.uid !== pinned ? sq.uid : null);
      return;
    }
    if (!deploying) {
      if (p.type === "move") {
        const m = battleRef.current?.models.find((m) => m.alive && Math.hypot(m.x - p.x, m.y - p.y) < Math.max(0.5, m.def.size));
        setHoverDef(m ? m.def : null);
      }
      return;
    }
    if (p.type === "move") {
      const sq = hitSquad([...myArmy, ...match.armies[1], ...towerPlacements(0), ...towerPlacements(1)], p.x, p.y, defs);
      setHoverDef(sq ? defs.get(sq.defId) ?? TOWER_MAP.get(sq.defId) ?? null : null);
      return;
    }
    // pointer down
    const existing = hitSquad(myArmy, p.x, p.y, defs);
    if (p.button === 2) {
      if (existing && isNew(existing)) sell(existing);
      setHeld(null);
      return;
    }
    if (placingDef) {
      const { x, y } = ghostPos(placingDef, p);
      if (held) {
        if (canPlace(placingDef, x, y, 0, myArmy, defs, held, rot)) {
          updateArmy(myArmy.map((s) => (s.uid === held ? { ...s, x, y, rot: rot || undefined } : s)));
          setHeld(null);
        }
        return;
      }
      if (existing && isNew(existing)) {
        pickUp(existing);
        return;
      }
      if (placingDef.cost <= match.supply[0] && canPlace(placingDef, x, y, 0, myArmy, defs, undefined, rot)) {
        setMatch((m) => ({
          ...m,
          supply: [m.supply[0] - placingDef.cost, m.supply[1]],
          armies: [[...m.armies[0], { uid: newUid("p"), defId: placingDef.id, x, y, rot: rot || undefined, round: m.round }], m.armies[1]],
        }));
      }
      return;
    }
    if (existing && isNew(existing)) pickUp(existing);
  };

  const pickUp = (sq: PlacedSquad) => {
    setHeld(sq.uid);
    setRot(!!sq.rot);
  };

  const clickShop = (u: UnitDef) => {
    setHeld(null);
    if (unlocked.has(u.id)) {
      setSelected(selected === u.id ? null : u.id);
      return;
    }
    if (armedUnlock !== u.id) {
      setArmedUnlock(u.id);
      return;
    }
    setArmedUnlock(null);
    const cost = u.unlockCost ?? 0;
    setMatch((m) => ({
      ...m,
      supply: [m.supply[0] - cost, m.supply[1]],
      unlocked: [[...m.unlocked[0], u.id], m.unlocked[1]],
    }));
    setSelected(u.id);
  };

  const fight = () => {
    if (!aiPlan) return;
    const armies: [PlacedSquad[], PlacedSquad[]] = [match.armies[0], [...match.armies[1], ...aiPlan.squads]];
    const seed = match.round * 104729 + 7;
    setMatch((m) => ({
      ...m,
      armies,
      supply: [m.supply[0], m.supply[1] - aiPlan.spent],
      unlocked: [m.unlocked[0], [...new Set([...m.unlocked[1], ...aiPlan.unlocks])]],
      phase: "battle",
    }));
    battleRef.current = new Battle(defs, armies, { seed, recordFx: true });
    setFought({ armies, defs, seed, result: null });
    player.reset();
    setSelected(null);
    setHeld(null);
    setView("report");
    setPinned(null);
  };

  const onBattleEnd = (r: BattleResult) => {
    setFought((f) => (f ? { ...f, result: r } : f));
    setMatch((m) => applyRound(m, r, defs));
  };

  const replay = () => {
    if (!fought) return;
    battleRef.current = new Battle(fought.defs, fought.armies, { seed: fought.seed, recordFx: true });
    player.reset();
    setView("replay");
  };

  const next = () => {
    battleRef.current = null;
    setFought(null);
    setMatch((m) => nextRound(m));
  };

  const restart = () => {
    battleRef.current = null;
    setFought(null);
    setSelected(null);
    setHeld(null);
    setMatch(newMatch(units));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") {
        setSelected(null);
        setHeld(null);
      } else if (e.key === "r" || e.key === "R") setRot((r) => !r);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const drawReport = (ctx: CanvasRenderingContext2D) => {
    const f = fought!;
    const stats = f.result!.stats;
    drawBackground(ctx, TILE, { zones: true });
    const focus = hoverSquad ?? pinned;
    for (const sq of reportSquads()) {
      const def = f.defs.get(sq.defId) ?? TOWER_MAP.get(sq.defId);
      const st = stats[sq.uid];
      if (!def || !st) continue;
      const isFocus = sq.uid === focus || sq.uid === pinned;
      drawSquad(ctx, sq, def, st.side, TILE, {
        alive: st.alive,
        outline: isFocus ? "#ffffff" : st.alive === 0 ? "rgba(255,255,255,0.08)" : undefined,
        fill: isFocus ? "rgba(255,255,255,0.08)" : undefined,
      });
      if (st.alive === 0) {
        const r = squadRect(sq, def);
        ctx.strokeStyle = "rgba(255,84,104,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r.x * TILE + 4, r.y * TILE + 4);
        ctx.lineTo((r.x + r.w) * TILE - 4, (r.y + r.h) * TILE - 4);
        ctx.stroke();
      }
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, dt: number, time: number) => {
    if (reporting) return drawReport(ctx);
    const b = battleRef.current;
    if (b && !deploying) {
      const live = match.phase === "battle" || view === "replay";
      player.frame(ctx, b, TILE, dt, time, live ? speed : 0, match.phase === "battle" ? onBattleEnd : undefined);
      return;
    }
    drawBackground(ctx, TILE, { zones: true, grid: [0] });
    drawTowers(ctx, TILE);
    for (const sq of match.armies[1]) {
      const d = defs.get(sq.defId);
      if (d) drawSquad(ctx, sq, d, 1, TILE, { alpha: 0.75 });
    }
    for (const sq of myArmy) {
      const d = defs.get(sq.defId);
      if (!d) continue;
      if (sq.uid === held) {
        drawSquad(ctx, sq, d, 0, TILE, { alpha: 0.25, outline: "#ffffff", dashed: true });
        continue;
      }
      drawSquad(ctx, sq, d, 0, TILE, { outline: isNew(sq) ? "rgba(140,220,140,0.8)" : "rgba(255,255,255,0.15)" });
    }
    const h = hover.current;
    if (h && placingDef) {
      const { x, y } = ghostPos(placingDef, h);
      const { w, h: fh } = footprintOf(placingDef, rot);
      const ok = canPlace(placingDef, x, y, 0, myArmy, defs, held ?? undefined, rot) && (held || placingDef.cost <= match.supply[0]);
      ctx.fillStyle = ok ? "rgba(120,230,120,0.18)" : "rgba(255,80,80,0.22)";
      ctx.fillRect(x * TILE, y * TILE, w * TILE, fh * TILE);
      drawSquad(ctx, { uid: "ghost", defId: placingDef.id, x, y, rot, round: 0 }, placingDef, 0, TILE, { alpha: 0.55 });
      if (placingDef.attack) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc((x + w / 2) * TILE, (y + fh / 2) * TILE, placingDef.attack.range * TILE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  const report = match.history[match.history.length - 1];
  const infoDef = hoverDef ?? (selected ? defs.get(selected) : undefined);
  const newThisRound = myArmy.filter((s) => s.round === match.round).length;
  const focusStats = fought?.result ? fought.result.stats[hoverSquad ?? pinned ?? ""] : undefined;
  const enemyUnlocks = match.unlocked[1].map((id) => defs.get(id)).filter((d): d is UnitDef => !!d);

  return (
    <div className="play">
      <aside className="panel shop">
        <h3>Recruit</h3>
        <div className="supply">
          <span className="supply-num">{match.supply[0]}</span> supply
        </div>
        <div className="shop-list">
          {units.map((u) => {
            const locked = RULES.unlocks && !unlocked.has(u.id);
            const affordable = locked ? (u.unlockCost ?? 0) <= match.supply[0] : u.cost <= match.supply[0];
            return (
              <button
                key={u.id}
                className={`shop-item ${selected === u.id ? "active" : ""} ${locked ? "locked" : ""} ${armedUnlock === u.id ? "armed" : ""}`}
                disabled={!deploying || !affordable}
                onClick={() => clickShop(u)}
                onMouseEnter={() => setHoverDef(u)}
                onMouseLeave={() => setHoverDef(null)}
              >
                <Swatch def={u} />
                <span className="shop-name">{u.name}</span>
                {locked ? (
                  <span className="shop-cost lock" title={`Unlock ${u.unlockCost}, then ${u.cost} per squad`}>
                    {armedUnlock === u.id ? `Unlock ${u.unlockCost}?` : `🔒 ${u.unlockCost}`}
                  </span>
                ) : (
                  <span className="shop-cost">{u.cost}</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="hint">
          Click a unit, then click your (blue) zone to place it. <b>R</b> rotates. Click a green-outlined squad to move it, right-click to
          sell. Squads from earlier rounds are locked. 🔒 units cost a one-time unlock per match (click twice).
        </p>
      </aside>

      <main className="board">
        <div className="hud">
          <HpBar label="You" hp={match.hp[0]} side={0} />
          <div className="round">Round {match.round}</div>
          <HpBar label="Enemy" hp={match.hp[1]} side={1} />
        </div>
        <FieldCanvas tile={TILE} draw={draw} onPointer={onPointer} />
      </main>

      <aside className="panel side">
        {deploying && (
          <>
            <button className="primary big" disabled={!aiPlan} onClick={fight}>
              {aiPlan ? "Fight!" : "Enemy is planning…"}
            </button>
            {(placingDef || held) && (
              <div className="held">
                <span className="small">{held ? `Moving ${placingDef?.name}. Click a free spot to drop it.` : `Placing ${placingDef?.name}.`}</span>
                <div className="list-actions">
                  <button onClick={() => setRot(!rot)}>Rotate (R)</button>
                  {heldSquad && (
                    <button
                      onClick={() => {
                        sell(heldSquad);
                        setHeld(null);
                      }}
                    >
                      Sell (+{placingDef?.cost})
                    </button>
                  )}
                </div>
              </div>
            )}
            <p className="muted small">
              {newThisRound
                ? `${newThisRound} new squad${newThisRound > 1 ? "s" : ""} this round.`
                : "You see the enemy as they stood last round. Their new recruits are hidden until the battle."}
            </p>
            <div className="enemy-unlocks">
              <div className="muted small">Enemy has unlocked</div>
              <div className="swatches">
                {enemyUnlocks.map((d) => (
                  <span key={d.id} title={d.name} onMouseEnter={() => setHoverDef(d)} onMouseLeave={() => setHoverDef(null)}>
                    <Swatch def={d} size={20} />
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
        {(match.phase === "battle" || view === "replay") && match.phase !== "deploy" && (
          <div className="speed">
            {[0, 0.5, 1, 2, 4].map((s) => (
              <button key={s} className={speed === s ? "active" : ""} onClick={() => setSpeed(s)}>
                {s === 0 ? "❚❚" : `${s}×`}
              </button>
            ))}
            <button onClick={() => battleRef.current && player.skip(battleRef.current)}>Skip</button>
            {view === "replay" && match.phase !== "battle" && (
              <button className="primary" onClick={() => setView("report")}>
                Back to report
              </button>
            )}
          </div>
        )}
        {(match.phase === "result" || match.phase === "over") && report && (
          <div className="result">
            <h2 className={report.winner === 0 ? "win" : report.winner === 1 ? "lose" : ""}>
              {report.winner === 0 ? "Victory" : report.winner === 1 ? "Defeat" : report.timedOut ? "Time out" : "Draw"}
            </h2>
            <p>
              You took <b>{report.damage[0]}</b> · Enemy took <b>{report.damage[1]}</b>
            </p>
            {match.phase === "over" ? (
              <>
                <h2>{match.hp[0] > 0 ? "You win the war!" : match.hp[1] > 0 ? "You have been defeated." : "Mutual ruin."}</h2>
                <button className="primary big" onClick={restart}>
                  New game
                </button>
              </>
            ) : (
              <button className="primary big" onClick={next}>
                Next round (+{RULES.income(match.round + 1)})
              </button>
            )}
            {view === "report" && (
              <button onClick={replay} disabled={!fought}>
                ▶ Watch replay
              </button>
            )}
          </div>
        )}
        {reporting && fought?.result && (
          <>
            {focusStats ? (
              <SquadDetail stats={focusStats} def={fought.defs.get(focusStats.defId) ?? TOWER_MAP.get(focusStats.defId)} />
            ) : (
              <p className="muted small">Hover a squad on the field or in the list for its battle stats. Click to pin it.</p>
            )}
            <SquadList result={fought.result} defs={new Map([...fought.defs, ...TOWER_MAP])} selected={pinned} onSelect={setPinned} onHover={setHoverSquad} />
          </>
        )}
        {!reporting && infoDef && <UnitInfo def={infoDef} />}
        <div className="spacer" />
        <div className="game-opts">
          <label>
            AI{" "}
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <button onClick={restart}>Restart</button>
        </div>
        {aiPlan && deploying && <p className="muted small">AI tested {aiPlan.candidatesTried} plans against your last army.</p>}
      </aside>
    </div>
  );
}

function HpBar({ label, hp, side }: { label: string; hp: number; side: Side }) {
  const frac = Math.max(0, hp / RULES.startHp);
  return (
    <div className={`hp hp-${side}`}>
      <span>{label}</span>
      <div className="hp-track">
        <div className="hp-fill" style={{ width: `${frac * 100}%` }} />
      </div>
      <span className="hp-num">{hp}</span>
    </div>
  );
}
