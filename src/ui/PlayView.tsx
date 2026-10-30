import { useEffect, useMemo, useRef, useState } from "react";
import { FACTIONS, factionOf } from "../data/roles";
import { RULES } from "../data/rules";
import { towerDaze, towerDef, towerPlacements, TOWER_MAP } from "../data/towers";
import { planAiRound, type AiPlan, type Difficulty } from "../game/ai";
import { canPlace, defMap, newUid, squadRect, towerUpgradePrice, upgradePrice, type DefMap } from "../game/army";
import { applyRound, newMatch, nextRound, type MatchState } from "../game/match";
import { drawBackground, drawSquad } from "../render/draw";
import { Battle, footprintOf, type BattleResult } from "../sim/battle";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { upgradedDefs } from "../sim/upgrades";
import { useRoster } from "../store/roster";
import { SquadDetail, SquadList } from "./BattleReport";
import { useBattlePlayer } from "./battlePlayer";
import { FieldCanvas, type FieldPointer } from "./FieldCanvas";
import { Swatch, UnitInfo } from "./UnitInfo";

const TILE = 22;

// Everything needed to show (and replay) the last battle.
interface FoughtBattle {
  armies: [PlacedSquad[], PlacedSquad[]];
  defs: [DefMap, DefMap];
  towerLevels: [number[], number[]];
  seed: number;
  result: BattleResult | null;
}

// Spending actions this round, newest last, so they can be undone.
type Action =
  | { kind: "place"; uid: string; cost: number }
  | { kind: "unlock"; unitId: string; cost: number }
  | { kind: "upgrade"; unitId: string; upgradeId: string; cost: number }
  | { kind: "tower"; index: number; cost: number };

function actionLabel(a: Action, defs: DefMap): string {
  switch (a.kind) {
    case "place":
      return "placement";
    case "unlock":
      return `unlock ${defs.get(a.unitId)?.name ?? ""}`;
    case "upgrade":
      return `upgrade ${defs.get(a.unitId)?.upgrades?.find((u) => u.id === a.upgradeId)?.name ?? ""}`;
    case "tower":
      return `${TOWER_MAP.get(RULES.towers[a.index].defId)?.name ?? "tower"} upgrade`;
  }
}

export function PlayView() {
  const units = useRoster();
  const defs = useMemo(() => defMap(units), [units]);
  const [match, setMatch] = useState<MatchState>(() => newMatch(units));
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [selected, setSelected] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [rot, setRot] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ def: UnitDef; side: Side; fromShop?: boolean } | null>(null);
  const [speed, setSpeed] = useState(1);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [fought, setFought] = useState<FoughtBattle | null>(null);
  const [view, setView] = useState<"report" | "replay">("report");
  const [pinned, setPinned] = useState<string | null>(null);
  const [hoverSquad, setHoverSquad] = useState<string | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [fightArmed, setFightArmed] = useState(false);
  const battleRef = useRef<Battle | null>(null);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const player = useBattlePlayer();

  const myDefs = useMemo(() => upgradedDefs(defs, match.upgrades[0]), [defs, match.upgrades]);
  const enemyDefs = useMemo(() => upgradedDefs(defs, match.upgrades[1]), [defs, match.upgrades]);

  // The AI plans at the start of each deployment, from what it saw last round.
  useEffect(() => {
    if (match.phase !== "deploy") return;
    setAiPlan(null);
    const id = setTimeout(() => {
      setAiPlan(
        planAiRound(
          units,
          defs,
          {
            army: match.armies[1],
            unlocked: match.unlocked[1],
            upgrades: match.upgrades[1],
            towerLevels: match.towerLevels[1],
            supply: match.supply[1],
          },
          { army: match.armies[0], upgrades: match.upgrades[0], towerLevels: match.towerLevels[0] },
          match.round,
          difficulty,
          match.round * 7919 + 13,
        ),
      );
    }, 30);
    return () => clearTimeout(id);
  }, [match.round, match.phase === "deploy"]);

  useEffect(() => {
    if (!fightArmed) return;
    const t = setTimeout(() => setFightArmed(false), 3000);
    return () => clearTimeout(t);
  }, [fightArmed]);

  const myArmy = match.armies[0];
  const unlocked = useMemo(() => new Set(match.unlocked[0]), [match.unlocked]);
  const isNew = (sq: PlacedSquad) => !RULES.lockPlacedSquads || sq.round === match.round;
  const heldSquad = held ? myArmy.find((s) => s.uid === held) : undefined;
  const placingDef = heldSquad ? myDefs.get(heldSquad.defId) : selected ? myDefs.get(selected) : undefined;
  const deploying = match.phase === "deploy";
  const reporting = (match.phase === "result" || match.phase === "over") && view === "report" && !!fought?.result;

  const spend = (cost: number, action: Action, patch: (m: MatchState) => Partial<MatchState>) => {
    setMatch((m) => ({ ...m, ...patch(m), supply: [m.supply[0] - cost, m.supply[1]] }));
    setActions((a) => [...a, action]);
  };

  const undo = () => {
    const last = actions[actions.length - 1];
    if (!last || !deploying) return;
    setActions((a) => a.slice(0, -1));
    setHeld(null);
    setMatch((m) => {
      const supply: [number, number] = [m.supply[0] + last.cost, m.supply[1]];
      switch (last.kind) {
        case "place":
          return { ...m, supply, armies: [m.armies[0].filter((s) => s.uid !== last.uid), m.armies[1]] };
        case "unlock":
          return { ...m, supply, unlocked: [m.unlocked[0].filter((id) => id !== last.unitId), m.unlocked[1]] };
        case "upgrade": {
          const ups = { ...m.upgrades[0], [last.unitId]: (m.upgrades[0][last.unitId] ?? []).filter((id) => id !== last.upgradeId) };
          return { ...m, supply, upgrades: [ups, m.upgrades[1]] };
        }
        case "tower": {
          const levels = m.towerLevels[0].map((l, i) => (i === last.index ? l - 1 : l));
          return { ...m, supply, towerLevels: [levels, m.towerLevels[1]] };
        }
      }
    });
  };

  const sell = (sq: PlacedSquad) => {
    const cost = defs.get(sq.defId)?.cost ?? 0;
    setMatch((m) => ({
      ...m,
      supply: [m.supply[0] + cost, m.supply[1]],
      armies: [m.armies[0].filter((s) => s.uid !== sq.uid), m.armies[1]],
    }));
    setActions((a) => a.filter((x) => !(x.kind === "place" && x.uid === sq.uid)));
  };

  const ghostPos = (def: UnitDef, p: { x: number; y: number }) => {
    const { w, h } = footprintOf(def, rot);
    return { x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2) };
  };

  const hitSquad = (squads: PlacedSquad[], x: number, y: number) =>
    squads.find((s) => {
      const d = defs.get(s.defId) ?? TOWER_MAP.get(s.defId);
      if (!d) return false;
      const r = squadRect(s, d);
      return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    });

  const allTowers = () => [...towerPlacements(0), ...towerPlacements(1)];
  const reportSquads = (): PlacedSquad[] => (fought ? [...fought.armies[0], ...fought.armies[1], ...allTowers()] : []);

  const towerInfo = (uid: string, levels: [number[], number[]]) => {
    const [, side, i] = uid.split("-");
    const t = RULES.towers[+i];
    return t ? towerDef(t.defId, levels[+side as Side][+i] ?? 0) : undefined;
  };

  const rotateInPlace = (sq: PlacedSquad) => {
    const d = defs.get(sq.defId);
    if (!d) return;
    const next = !sq.rot;
    const before = footprintOf(d, sq.rot);
    const after = footprintOf(d, next);
    // keep the squad centered where it was
    const x = Math.round(sq.x + (before.w - after.w) / 2);
    const y = Math.round(sq.y + (before.h - after.h) / 2);
    for (const [px, py] of [[x, y], [sq.x, sq.y]]) {
      if (canPlace(d, px, py, 0, myArmy, defs, sq.uid, next)) {
        setMatch((m) => ({ ...m, armies: [m.armies[0].map((s) => (s.uid === sq.uid ? { ...s, x: px, y: py, rot: next || undefined } : s)), m.armies[1]] }));
        return;
      }
    }
  };

  const onPointer = (p: FieldPointer) => {
    if (p.type === "leave") {
      hover.current = null;
      setHoverSquad(null);
      return;
    }
    hover.current = { x: p.x, y: p.y };

    if (reporting) {
      const sq = hitSquad(reportSquads(), p.x, p.y);
      if (p.type === "move") setHoverSquad(sq?.uid ?? null);
      else setPinned(sq && sq.uid !== pinned ? sq.uid : null);
      return;
    }
    if (!deploying) {
      if (p.type === "move") {
        const m = battleRef.current?.models.find((m) => m.alive && Math.hypot(m.x - p.x, m.y - p.y) < Math.max(0.5, m.def.size));
        setHoverInfo(m ? { def: m.def, side: m.side } : null);
      }
      return;
    }
    if (p.type === "move") {
      const mine = hitSquad(myArmy, p.x, p.y);
      const theirs = hitSquad(match.armies[1], p.x, p.y);
      const tower = hitSquad(allTowers(), p.x, p.y);
      if (mine) setHoverInfo({ def: myDefs.get(mine.defId)!, side: 0 });
      else if (theirs) setHoverInfo({ def: enemyDefs.get(theirs.defId)!, side: 1 });
      else if (tower) setHoverInfo({ def: towerInfo(tower.uid, match.towerLevels)!, side: tower.uid.startsWith("tower-0") ? 0 : 1 });
      else setHoverInfo(null);
      return;
    }
    // pointer down
    const existing = hitSquad(myArmy, p.x, p.y);
    if (p.button === 2) {
      // right-click rotates
      if (placingDef) setRot((r) => !r);
      else if (existing && isNew(existing)) rotateInPlace(existing);
      return;
    }
    if (placingDef) {
      const { x, y } = ghostPos(placingDef, p);
      if (held) {
        if (canPlace(placingDef, x, y, 0, myArmy, defs, held, rot)) {
          setMatch((m) => ({ ...m, armies: [m.armies[0].map((s) => (s.uid === held ? { ...s, x, y, rot: rot || undefined } : s)), m.armies[1]] }));
          setHeld(null);
        }
        return;
      }
      if (existing && isNew(existing)) {
        pickUp(existing);
        return;
      }
      if (placingDef.cost <= match.supply[0] && canPlace(placingDef, x, y, 0, myArmy, defs, undefined, rot)) {
        const uid = newUid("p");
        const sq: PlacedSquad = { uid, defId: placingDef.id, x, y, rot: rot || undefined, round: match.round };
        spend(placingDef.cost, { kind: "place", uid, cost: placingDef.cost }, (m) => ({ armies: [[...m.armies[0], sq], m.armies[1]] }));
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
    const cost = u.unlockCost ?? 0;
    spend(cost, { kind: "unlock", unitId: u.id, cost }, (m) => ({ unlocked: [[...m.unlocked[0], u.id], m.unlocked[1]] }));
    setSelected(u.id);
  };

  const buyUpgrade = (unitId: string, upgradeId: string) => {
    const def = defs.get(unitId);
    const bought = match.upgrades[0][unitId] ?? [];
    const price = def ? upgradePrice(def, bought.length) : null;
    if (price === null || price > match.supply[0]) return;
    spend(price, { kind: "upgrade", unitId, upgradeId, cost: price }, (m) => ({
      upgrades: [{ ...m.upgrades[0], [unitId]: [...(m.upgrades[0][unitId] ?? []), upgradeId] }, m.upgrades[1]],
    }));
  };

  const buyTower = (index: number) => {
    const price = towerUpgradePrice(match.towerLevels[0][index]);
    if (price === null || price > match.supply[0]) return;
    spend(price, { kind: "tower", index, cost: price }, (m) => ({
      towerLevels: [m.towerLevels[0].map((l, i) => (i === index ? l + 1 : l)), m.towerLevels[1]],
    }));
  };

  const fight = () => {
    if (!aiPlan) return;
    if (!actions.length && match.supply[0] > 0 && !fightArmed) {
      setFightArmed(true);
      return;
    }
    setFightArmed(false);
    const aiUpgrades = { ...match.upgrades[1] };
    for (const u of aiPlan.upgrades) aiUpgrades[u.unitId] = [...(aiUpgrades[u.unitId] ?? []), u.upgradeId];
    const aiLevels = [...match.towerLevels[1]];
    for (const i of aiPlan.towerUpgrades) aiLevels[i]++;
    const armies: [PlacedSquad[], PlacedSquad[]] = [match.armies[0], [...match.armies[1], ...aiPlan.squads]];
    const towerLevels: [number[], number[]] = [match.towerLevels[0], aiLevels];
    const sideDefs: [DefMap, DefMap] = [myDefs, upgradedDefs(defs, aiUpgrades)];
    const seed = match.round * 104729 + 7;
    setMatch((m) => ({
      ...m,
      armies,
      supply: [m.supply[0], m.supply[1] - aiPlan.spent],
      unlocked: [m.unlocked[0], [...new Set([...m.unlocked[1], ...aiPlan.unlocks])]],
      upgrades: [m.upgrades[0], aiUpgrades],
      towerLevels,
      phase: "battle",
    }));
    battleRef.current = new Battle(sideDefs, armies, { seed, recordFx: true, towerLevels });
    setFought({ armies, defs: sideDefs, towerLevels, seed, result: null });
    setActions([]);
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
    battleRef.current = new Battle(fought.defs, fought.armies, { seed: fought.seed, recordFx: true, towerLevels: fought.towerLevels });
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
    setActions([]);
    setMatch(newMatch(units));
  };

  // keyboard: Esc cancels, R rotates, Ctrl/Cmd+Z undoes, Delete sells the held squad
  const keyState = useRef({ undo, heldSquad, sell });
  keyState.current = { undo, heldSquad, sell };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") {
        setSelected(null);
        setHeld(null);
      } else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        keyState.current.undo();
      } else if (e.key === "r" || e.key === "R") setRot((r) => !r);
      else if ((e.key === "Delete" || e.key === "Backspace") && keyState.current.heldSquad) {
        keyState.current.sell(keyState.current.heldSquad);
        setHeld(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const drawReport = (ctx: CanvasRenderingContext2D) => {
    const f = fought!;
    const stats = f.result!.stats;
    drawBackground(ctx, TILE, { zones: true });
    const focus = hoverSquad ?? pinned;
    const focusStats = focus ? stats[focus] : undefined;
    const squads = reportSquads();
    const defOf = (sq: PlacedSquad, side: Side) => (sq.uid.startsWith("tower-") ? towerInfo(sq.uid, f.towerLevels) : f.defs[side].get(sq.defId));
    for (const sq of squads) {
      const st = stats[sq.uid];
      const def = st && defOf(sq, st.side);
      if (!def || !st) continue;
      const isFocus = sq.uid === focus;
      const involved = focusStats && (focusStats.dealtTo[sq.uid] || focusStats.takenFrom[sq.uid]);
      drawSquad(ctx, sq, def, st.side, TILE, {
        alive: st.alive,
        alpha: focusStats && !isFocus && !involved ? 0.45 : undefined,
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
    // damage exchanged with the focused squad, labelled above each other squad
    if (focusStats) {
      for (const sq of squads) {
        if (sq.uid === focus) continue;
        const st = stats[sq.uid];
        const def = st && defOf(sq, st.side);
        if (!def) continue;
        const dealt = focusStats.dealtTo[sq.uid] ?? 0;
        const taken = focusStats.takenFrom[sq.uid] ?? 0;
        if (dealt < 1 && taken < 1) continue;
        const r = squadRect(sq, def);
        const ally = st.side === focusStats.side;
        const labels: [string, string][] = [];
        if (dealt >= 1) labels.push([`${ally ? "hit ally" : "dealt"} ${Math.round(dealt)}`, ally ? "#ff9f43" : "#e2b45a"]);
        if (taken >= 1) labels.push([`took ${Math.round(taken)}`, "#ff5468"]);
        // stack above the squad, or below it when there's no room at the top edge
        const above = r.y * TILE - 4 - (labels.length - 1) * 15;
        let ly = above >= 14 ? above : (r.y + r.h) * TILE + 16;
        for (const [text, color] of labels) {
          pill(ctx, text, (r.x + r.w / 2) * TILE, ly, color);
          ly += 15;
        }
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
    for (const side of [0, 1] as Side[]) {
      towerPlacements(side).forEach((t, i) => {
        const level = match.towerLevels[side][i] ?? 0;
        drawSquad(ctx, t, towerDef(t.defId, level), side, TILE);
        if (level > 0) {
          const r = squadRect(t, TOWER_MAP.get(t.defId)!);
          pill(ctx, `Lv ${level}`, (r.x + r.w / 2) * TILE, side === 0 ? r.y * TILE - 4 : (r.y + r.h) * TILE + 14, "#c9d1d9");
        }
      });
    }
    for (const sq of match.armies[1]) {
      const d = enemyDefs.get(sq.defId);
      if (d) drawSquad(ctx, sq, d, 1, TILE, { alpha: 0.75 });
    }
    for (const sq of myArmy) {
      const d = myDefs.get(sq.defId);
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
  const focusStats = fought?.result ? fought.result.stats[hoverSquad ?? pinned ?? ""] : undefined;
  const enemyUnlocks = match.unlocked[1].map((id) => enemyDefs.get(id)).filter((d): d is UnitDef => !!d);
  const selectedDef = selected ? myDefs.get(selected) : undefined;
  const card = hoverInfo ?? (selectedDef ? { def: selectedDef, side: 0 as Side, fromShop: true } : null);
  const lastAction = actions[actions.length - 1];

  const upgradeAction = (def: UnitDef) => (upId: string) => {
    if (card?.side !== 0 || !deploying || def.structure) return null;
    const bought = match.upgrades[0][def.id] ?? [];
    if (bought.includes(upId)) return <span className="owned-tag">Owned</span>;
    if (!unlocked.has(def.id)) return <span className="muted small">unlock first</span>;
    const price = upgradePrice(def, bought.length);
    if (price === null) return null;
    return (
      <button className="small-btn" disabled={price > match.supply[0]} onClick={() => buyUpgrade(def.id, upId)}>
        Buy · {price}
      </button>
    );
  };

  return (
    <div className="play">
      <aside className="panel shop">
        <h3>Recruit</h3>
        <div className="supply">
          <span className="supply-num">{match.supply[0]}</span> supply
        </div>
        <div className="shop-list">
          {FACTIONS.map((f) => {
            const list = units.filter((u) => factionOf(u.tags) === f.id);
            if (!list.length) return null;
            return (
              <div key={f.id} className="shop-group">
                <div className="shop-faction">{f.name}</div>
                {list.map((u) => {
                  const locked = RULES.unlocks && !unlocked.has(u.id);
                  const affordable = locked ? (u.unlockCost ?? 0) <= match.supply[0] : u.cost <= match.supply[0];
                  const ups = match.upgrades[0][u.id]?.length ?? 0;
                  return (
                    <button
                      key={u.id}
                      className={`shop-item ${selected === u.id ? "active" : ""} ${locked ? "locked" : ""}`}
                      disabled={!deploying || (!affordable && !(selected === u.id))}
                      onClick={() => clickShop(u)}
                      onMouseEnter={() => setHoverInfo({ def: myDefs.get(u.id) ?? u, side: 0, fromShop: true })}
                      onMouseLeave={() => setHoverInfo(null)}
                    >
                      <Swatch def={u} />
                      <span className="shop-name">
                        {u.name}
                        {ups > 0 && <span className="pips">{"★".repeat(ups)}</span>}
                      </span>
                      {locked ? (
                        <span className="shop-cost lock" title={`Unlock ${u.unlockCost}, then ${u.cost} per squad`}>
                          🔒 {u.unlockCost}
                        </span>
                      ) : (
                        <span className="shop-cost">{u.cost}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="hint">
          Click a unit, then click your (blue) zone to place it. <b>Right-click</b> or <b>R</b> rotates. Click a green-outlined squad to move
          it; <b>Delete</b> sells it. <b>Ctrl+Z</b> undoes your last purchase. 🔒 units cost a one-time unlock per match.
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
            <button className={`primary big ${fightArmed ? "warn-btn" : ""}`} disabled={!aiPlan} onClick={fight}>
              {!aiPlan ? "Enemy is planning…" : fightArmed ? `Fight without spending ${match.supply[0]}?` : "Fight!"}
            </button>
            <div className="list-actions">
              <button disabled={!lastAction} onClick={undo} title="Ctrl+Z">
                ↶ Undo{lastAction ? ` ${actionLabel(lastAction, defs)} (+${lastAction.cost})` : ""}
              </button>
            </div>
            {(placingDef || held) && (
              <div className="held">
                <span className="small">{held ? `Moving ${placingDef?.name}. Click a free spot to drop it.` : `Placing ${placingDef?.name}.`}</span>
                <div className="list-actions">
                  <button onClick={() => setRot(!rot)}>Rotate</button>
                  {heldSquad && (
                    <button
                      onClick={() => {
                        sell(heldSquad);
                        setHeld(null);
                      }}
                    >
                      Sell (+{defs.get(heldSquad.defId)?.cost})
                    </button>
                  )}
                </div>
              </div>
            )}
            <TowerPanel levels={match.towerLevels} supply={match.supply[0]} onBuy={buyTower} />
            <div className="enemy-unlocks">
              <div className="muted small">Enemy has unlocked</div>
              <div className="swatches">
                {enemyUnlocks.map((d) => (
                  <span key={d.id} title={d.name} onMouseEnter={() => setHoverInfo({ def: d, side: 1 })} onMouseLeave={() => setHoverInfo(null)}>
                    <Swatch def={d} size={20} />
                    {(match.upgrades[1][d.id]?.length ?? 0) > 0 && <span className="pips">{"★".repeat(match.upgrades[1][d.id].length)}</span>}
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
              <>
                <p className="muted small">
                  On the field: <span className="key-dealt">dealt</span> = damage it did to that squad, <span className="key-taken">took</span> =
                  damage that squad did to it.
                </p>
                <SquadDetail
                  stats={focusStats}
                  def={fought.defs[focusStats.side].get(focusStats.defId) ?? TOWER_MAP.get(focusStats.defId)}
                />
              </>
            ) : (
              <p className="muted small">Hover a squad on the field or in the list to see who it hurt and who hurt it. Click to pin it.</p>
            )}
            <SquadList
              result={fought.result}
              defs={new Map([...defs, ...TOWER_MAP])}
              selected={pinned}
              onSelect={setPinned}
              onHover={setHoverSquad}
            />
          </>
        )}
        {!reporting && card && (
          <UnitInfo
            def={card.def}
            owned={card.def.structure ? undefined : match.upgrades[card.side][card.def.id] ?? []}
            detailedRoles={card.fromShop}
            upgradeAction={upgradeAction(card.def)}
          />
        )}
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

function TowerPanel({ levels, supply, onBuy }: { levels: [number[], number[]]; supply: number; onBuy: (i: number) => void }) {
  return (
    <div className="towers">
      <div className="muted small">Your towers</div>
      {RULES.towers.map((t, i) => {
        const level = levels[0][i] ?? 0;
        const def = towerDef(t.defId, level);
        const price = towerUpgradePrice(level);
        return (
          <div key={i} className="tower-row">
            <span>
              <b>{def.name}</b> <span className="muted small">Lv {level}</span>
              <div className="muted small">
                {def.hp} HP · falls → your army Dazed {towerDaze(level)}s
              </div>
            </span>
            {price !== null ? (
              <button
                className="small-btn"
                disabled={price > supply}
                title={`+${RULES.towerHpPerLevel} HP, Daze ${towerDaze(level)}s → ${towerDaze(level + 1)}s`}
                onClick={() => onBuy(i)}
              >
                +{RULES.towerHpPerLevel} HP · {price}
              </button>
            ) : (
              <span className="muted small">max</span>
            )}
          </div>
        );
      })}
      <div className="muted small">
        Enemy: {RULES.towers.map((t, i) => `${TOWER_MAP.get(t.defId)?.name} Lv ${levels[1][i] ?? 0}`).join(" · ")}
      </div>
    </div>
  );
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string) {
  ctx.font = "bold 11px system-ui, sans-serif";
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = "rgba(10,14,18,0.85)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y - 12, w, 15, 4);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y - 4.5);
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
