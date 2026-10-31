import { useEffect, useMemo, useRef, useState } from "react";
import { FACTIONS, factionOf } from "../data/roles";
import { RULES } from "../data/rules";
import { towerDaze, towerDef, towerPlacements, TOWER_MAP } from "../data/towers";
import { planAiRound, promoted, type AiPlan, type Difficulty } from "../game/ai";
import { canPlace, defMap, newUid, squadRect, towerUpgradePrice, unlockPrice, upgradePrice, type DefMap } from "../game/army";
import { applyRound, battleXp, canPromote, chooseOpening, newMatch, nextRound, promotePrice, unlockDiscounts, type MatchState } from "../game/match";
import { drawBackground, drawPromoteIcon, drawSquad } from "../render/draw";
import { earnedLevel, levelDef, xpForLevel } from "../sim/levels";
import { Battle, footprintOf, type BattleResult } from "../sim/battle";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { upgradedDefs, type UpgradeState } from "../sim/upgrades";
import { useRoster } from "../store/roster";
import { MEDAL_COLORS, MvpBoard, SquadDetail, SquadList, topSquads } from "./BattleReport";
import { useBattlePlayer } from "./battlePlayer";
import { FieldCanvas, type FieldPointer } from "./FieldCanvas";
import { Swatch, UnitInfo } from "./UnitInfo";

const TILE = 24;

// Each match rolls its own opening offers; the sim itself stays seeded and deterministic.
const matchSeed = () => Math.floor(Math.random() * 2 ** 31);

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
  | { kind: "tower"; index: number; cost: number }
  | { kind: "promote"; uid: string; cost: number };

function actionLabel(a: Action, defs: DefMap): string {
  switch (a.kind) {
    case "place":
      return "placement";
    case "unlock":
      return `unlock ${defs.get(a.unitId)?.name ?? ""}`;
    case "upgrade":
      return `upgrade ${defs.get(a.unitId)?.upgrades?.find((u) => u.id === a.upgradeId)?.name ?? ""}`;
    case "promote":
      return "promotion";
    case "tower":
      return `${RULES.towers[a.index].name ?? TOWER_MAP.get(RULES.towers[a.index].defId)?.name ?? "tower"} upgrade`;
  }
}

export function PlayView() {
  const units = useRoster();
  const defs = useMemo(() => defMap(units), [units]);
  const [match, setMatch] = useState<MatchState>(() => newMatch(units, matchSeed()));
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [selected, setSelected] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [rot, setRot] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ def: UnitDef; side: Side; fromShop?: boolean; squad?: PlacedSquad } | null>(null);
  const [speed, setSpeed] = useState(1);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [fought, setFought] = useState<FoughtBattle | null>(null);
  const [view, setView] = useState<"report" | "replay">("report");
  const [pinned, setPinned] = useState<string | null>(null);
  const [hoverSquad, setHoverSquad] = useState<string | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [fightArmed, setFightArmed] = useState(false);
  const [portraitOk, setPortraitOk] = useState(false);
  const [sideTab, setSideTab] = useState<"recruit" | "upgrades">("recruit");
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
            discounts: unlockDiscounts(match, 1),
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
  const myDiscounts = unlockDiscounts(match, 0);
  const openingPending = match.round === 1 && match.openings[0].choice === null;
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
        case "promote": {
          const demote = (s: PlacedSquad) => (s.uid === last.uid ? { ...s, level: (s.level ?? 2) - 1 > 1 ? (s.level ?? 2) - 1 : undefined } : s);
          return { ...m, supply, armies: [m.armies[0].map(demote), m.armies[1]] };
        }
      }
    });
  };

  const promote = (sq: PlacedSquad) => {
    const def = defs.get(sq.defId);
    if (!def || !deploying || !canPromote(sq)) return;
    const cost = promotePrice(def);
    if (cost > match.supply[0]) return;
    spend(cost, { kind: "promote", uid: sq.uid, cost }, (m) => ({
      armies: [m.armies[0].map((s) => (s.uid === sq.uid ? { ...s, level: (s.level ?? 1) + 1 } : s)), m.armies[1]],
    }));
  };

  // A squad as it will fight: its unit with upgrades, then its level.
  const squadDef = (sq: PlacedSquad, side: Side) => {
    const d = (side === 0 ? myDefs : enemyDefs).get(sq.defId);
    return d && levelDef(d, sq.level ?? 1);
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
    return t ? towerDef(t.defId, levels[+side as Side][+i] ?? 0, RULES, t.name) : undefined;
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
      if (mine) setHoverInfo({ def: squadDef(mine, 0)!, side: 0, squad: mine });
      else if (theirs) setHoverInfo({ def: squadDef(theirs, 1)!, side: 1, squad: theirs });
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
    else if (existing && canPromote(existing)) promote(existing);
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
    const cost = unlockPrice(u, myDiscounts);
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
    if (!aiPlan || openingPending) return;
    if (!actions.length && match.supply[0] > 0 && !fightArmed) {
      setFightArmed(true);
      return;
    }
    setFightArmed(false);
    const aiUpgrades = { ...match.upgrades[1] };
    for (const u of aiPlan.upgrades) aiUpgrades[u.unitId] = [...(aiUpgrades[u.unitId] ?? []), u.upgradeId];
    const aiLevels = [...match.towerLevels[1]];
    for (const i of aiPlan.towerUpgrades) aiLevels[i]++;
    const armies: [PlacedSquad[], PlacedSquad[]] = [match.armies[0], [...promoted(match.armies[1], aiPlan.promotions), ...aiPlan.squads]];
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
    setSpeed(1); // every battle starts at normal speed, even if the last one was fast-forwarded
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
    setSpeed(1); // every battle starts at normal speed, even if the last one was fast-forwarded
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
    setMatch(newMatch(units, matchSeed()));
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
    const medals = new Map<string, number>();
    for (const side of [0, 1] as Side[]) topSquads(f.result!, side).forEach((s, i) => medals.set(s.uid, i));
    for (const sq of squads) {
      const st = stats[sq.uid];
      const def = st && defOf(sq, st.side);
      if (!def || !st) continue;
      const isFocus = sq.uid === focus;
      const involved = focusStats && (focusStats.dealtTo[sq.uid] || focusStats.takenFrom[sq.uid]);
      const medal = medals.get(sq.uid);
      drawSquad(ctx, sq, def, st.side, TILE, {
        alive: st.alive,
        alpha: focusStats && !isFocus && !involved ? 0.45 : undefined,
        outline: isFocus
          ? "#ffffff"
          : medal !== undefined && !focusStats
            ? MEDAL_COLORS[medal]
            : st.alive === 0
              ? "rgba(255,255,255,0.08)"
              : undefined,
        fill: isFocus ? "rgba(255,255,255,0.08)" : medal !== undefined && !focusStats ? "rgba(245,197,66,0.06)" : undefined,
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
    // MVP medals: the top three damage dealers on each side, with what they dealt
    for (const sq of squads) {
      const medal = medals.get(sq.uid);
      const st = stats[sq.uid];
      const def = st && defOf(sq, st.side);
      if (medal === undefined || !def) continue;
      const r = squadRect(sq, def);
      const mx = (r.x + r.w) * TILE - 2;
      const my = r.y * TILE + 2;
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, Math.PI * 2);
      ctx.fillStyle = MEDAL_COLORS[medal];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(10,14,18,0.9)";
      ctx.stroke();
      ctx.fillStyle = "#14110a";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(medal + 1), mx, my + 0.5);
      if (!focusStats) {
        const below = (r.y + r.h) * TILE + 16;
        pill(ctx, `${Math.round(st.dealt).toLocaleString()} dmg`, (r.x + r.w / 2) * TILE, below > RULES.fieldH * TILE - 2 ? r.y * TILE - 4 : below, MEDAL_COLORS[medal]);
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
      if (d) drawSquad(ctx, sq, d, 1, TILE, { alpha: 0.75, time });
    }
    for (const sq of myArmy) {
      const d = myDefs.get(sq.defId);
      if (!d) continue;
      if (sq.uid === held) {
        drawSquad(ctx, sq, d, 0, TILE, { alpha: 0.25, outline: "#ffffff", dashed: true, time });
        continue;
      }
      drawSquad(ctx, sq, d, 0, TILE, { outline: isNew(sq) ? "rgba(140,220,140,0.8)" : canPromote(sq) ? "rgba(245,197,66,0.7)" : "rgba(255,255,255,0.15)", time });
      if (canPromote(sq)) {
        const r = squadRect(sq, d);
        drawPromoteIcon(ctx, (r.x + r.w / 2) * TILE, r.y * TILE, time);
      }
    }
    const h = hover.current;
    if (h && placingDef) {
      const { x, y } = ghostPos(placingDef, h);
      const { w, h: fh } = footprintOf(placingDef, rot);
      const ok = canPlace(placingDef, x, y, 0, myArmy, defs, held ?? undefined, rot) && (held || placingDef.cost <= match.supply[0]);
      ctx.fillStyle = ok ? "rgba(120,230,120,0.18)" : "rgba(255,80,80,0.22)";
      ctx.fillRect(x * TILE, y * TILE, w * TILE, fh * TILE);
      drawSquad(ctx, { uid: "ghost", defId: placingDef.id, x, y, rot, round: 0 }, placingDef, 0, TILE, { alpha: 0.55, time });
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
  const myUnlocks = match.unlocked[0].map((id) => myDefs.get(id)).filter((d): d is UnitDef => !!d);
  // the enemy's opening shows once round 1 is over: a discount badge on that unit, or a supply note
  const enemyRevealed = match.round > 1;
  const enemyDiscount = enemyRevealed ? enemyDefs.get(Object.keys(unlockDiscounts(match, 1))[0] ?? "") : undefined;
  const myDiscount = myDefs.get(Object.keys(unlockDiscounts(match, 0))[0] ?? "");
  const enemyOpening = enemyRevealed && match.openings[1].choice === "bonus" ? `opened with +${RULES.openingBonus} supply` : null;
  const selectedDef = selected ? myDefs.get(selected) : undefined;
  const card = hoverInfo ?? (selectedDef ? { def: selectedDef, side: 0 as Side, fromShop: true } : null);
  const lastAction = actions[actions.length - 1];
  // how many upgrades (unit or tower) the player can buy right now, shown on the Upgrades tab
  const affordableUpgrades =
    units.reduce((n, u) => {
      if (!unlocked.has(u.id) || !u.upgrades?.length) return n;
      const bought = match.upgrades[0][u.id] ?? [];
      const price = upgradePrice(u, bought.length);
      return price !== null && price <= match.supply[0] ? n + u.upgrades.filter((up) => !bought.includes(up.id)).length : n;
    }, 0) +
    match.towerLevels[0].filter((l) => (towerUpgradePrice(l) ?? Infinity) <= match.supply[0]).length +
    myArmy.filter((sq) => canPromote(sq) && promotePrice(defs.get(sq.defId)!) <= match.supply[0]).length;
  const promotable = myArmy.filter(canPromote);

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

  const unitCard = card && (
    <>
    {card.squad && !card.def.structure && (
      <Veterancy
        squad={card.squad}
        canBuy={card.side === 0 && deploying}
        price={promotePrice(defs.get(card.squad.defId)!)}
        supply={match.supply[0]}
        onPromote={() => promote(card.squad!)}
      />
    )}
    <UnitInfo
      def={card.def}
      owned={card.def.structure ? undefined : match.upgrades[card.side][card.def.id] ?? []}
      detailedRoles={card.fromShop}
      upgradeAction={upgradeAction(card.def)}
    />
    </>
  );

  return (
    <div className={`play ${portraitOk ? "portrait-ok" : ""}`}>
      <main className="board">
        <div className="hud">
          <UnlockStrip units={myUnlocks} owned={match.upgrades[0]} side={0} discount={myDiscount} />
          <HpBar label="You" hp={match.hp[0]} side={0} />
          <div className="round">Round {match.round}</div>
          <HpBar label="Enemy" hp={match.hp[1]} side={1} />
          <UnlockStrip units={enemyUnlocks} owned={match.upgrades[1]} side={1} discount={enemyDiscount} note={enemyOpening} />
        </div>
        <div className="field-wrap" style={{ "--field-ratio": RULES.fieldW / RULES.fieldH } as React.CSSProperties}>
          <FieldCanvas tile={TILE} draw={draw} onPointer={onPointer} />
        </div>
      </main>

      <aside className="panel side">
        {deploying && (
          <>
            <div className="deploy-bar">
              <div className="supply-row">
                <div className="supply">
                  <span className="supply-num">{match.supply[0]}</span> supply
                </div>
                <button
                  className="small-btn"
                  disabled={!lastAction}
                  onClick={undo}
                  title={lastAction ? `Undo ${actionLabel(lastAction, defs)} (+${lastAction.cost}) · Ctrl+Z` : "Ctrl+Z"}
                >
                  ↶ Undo{lastAction ? ` +${lastAction.cost}` : ""}
                </button>
              </div>
              <button className={`primary big ${fightArmed ? "warn-btn" : ""}`} disabled={!aiPlan || openingPending} onClick={fight}>
                {openingPending ? "Pick your opening first" : !aiPlan ? "Enemy is planning…" : fightArmed ? `Fight without spending ${match.supply[0]}?` : "Fight!"}
              </button>
            </div>
            {openingPending && <OpeningOffer unit={defs.get(match.openings[0].unitId ?? "")} onChoose={(c) => setMatch((m) => chooseOpening(m, 0, c))} />}
            {(placingDef || held) && (
              <div className="held">
                <span className="small">{held ? `Moving ${placingDef?.name}. Click a free spot to drop it.` : `Placing ${placingDef?.name}.`}</span>
                <div className="list-actions">
                  <button className="small-btn" onClick={() => setRot(!rot)}>Rotate</button>
                  {heldSquad && (
                    <button
                      className="small-btn"
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
            <div className="side-tabs">
              <button className={sideTab === "recruit" ? "active" : ""} onClick={() => setSideTab("recruit")}>
                Recruit
              </button>
              <button className={sideTab === "upgrades" ? "active" : ""} onClick={() => setSideTab("upgrades")}>
                Upgrades{affordableUpgrades > 0 && <span className="tab-badge">{affordableUpgrades}</span>}
              </button>
            </div>
            {sideTab === "upgrades" && (
              <>
                <UpgradePanel
                  units={units.filter((u) => unlocked.has(u.id) && u.upgrades?.length)}
                  owned={match.upgrades[0]}
                  supply={match.supply[0]}
                  onBuy={buyUpgrade}
                />
                <PromotionPanel squads={promotable} defs={defs} supply={match.supply[0]} onPromote={promote} onHover={(sq) => setHoverInfo(sq ? { def: squadDef(sq, 0)!, side: 0, squad: sq } : null)} />
                <TowerPanel levels={match.towerLevels} supply={match.supply[0]} onBuy={buyTower} />
              </>
            )}
            {sideTab === "recruit" && (
            <div className="recruit">
              <div className="shop-list">
                {FACTIONS.map((f) => {
                  const list = units.filter((u) => factionOf(u.tags) === f.id);
                  if (!list.length) return null;
                  return (
                    <div key={f.id} className="shop-group">
                      <div className="shop-faction">{f.name}</div>
                      <div className="shop-items">
                        {list.map((u) => {
                          const locked = RULES.unlocks && !unlocked.has(u.id);
                          const unlockCost = unlockPrice(u, myDiscounts);
                          const bargain = locked && unlockCost < (u.unlockCost ?? 0);
                          const affordable = locked ? unlockCost <= match.supply[0] : u.cost <= match.supply[0];
                          const ups = match.upgrades[0][u.id]?.length ?? 0;
                          return (
                            <button
                              key={u.id}
                              className={`shop-item ${selected === u.id ? "active" : ""} ${locked ? "locked" : ""}`}
                              disabled={!affordable && !(selected === u.id)}
                              onClick={() => clickShop(u)}
                              onMouseEnter={() => setHoverInfo({ def: myDefs.get(u.id) ?? u, side: 0, fromShop: true })}
                              onMouseLeave={() => setHoverInfo(null)}
                            >
                              <Swatch def={u} size={16} />
                              <span className="shop-name">
                                {u.name}
                                {ups > 0 && <span className="pips">{"★".repeat(ups)}</span>}
                              </span>
                              {locked ? (
                                <span className={`shop-cost lock ${bargain ? "bargain" : ""}`} title={`Unlock ${unlockCost}${bargain ? ` (opening discount, was ${u.unlockCost})` : ""}, then ${u.cost} per squad`}>
                                  🔒 {unlockCost}
                                </span>
                              ) : (
                                <span className="shop-cost">{u.cost}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="recruit-detail">
                {unitCard ?? <p className="muted small">Hover a unit to see what it does.</p>}
              </div>
            </div>
            )}
            <div className="enemy-unlocks">
              <div className="muted small">
                Enemy has unlocked
                {enemyOpening && ` · ${enemyOpening}`}
              </div>
              <div className="swatches">
                {withDiscount(enemyUnlocks, enemyDiscount).map((d) => (
                  <span
                    key={d.id}
                    className={`unlock-chip ${enemyUnlocks.includes(d) ? "" : "locked"}`}
                    title={d === enemyDiscount ? `${d.name} (cheaper unlock)` : d.name}
                    onMouseEnter={() => setHoverInfo({ def: d, side: 1 })}
                    onMouseLeave={() => setHoverInfo(null)}
                  >
                    <Swatch def={d} size={20} />
                    {d === enemyDiscount && <DiscountBadge />}
                    {(match.upgrades[1][d.id]?.length ?? 0) > 0 && <span className="pips">{"★".repeat(match.upgrades[1][d.id].length)}</span>}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
        {(match.phase === "battle" || view === "replay") && match.phase !== "deploy" && (
          <div className="speed">
            {[0, 0.5, 1, 2, 4, 8].map((s) => (
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
            {fought?.result && <PromotionsEarned result={fought.result} army={match.armies[0]} defs={defs} />}
            {fought?.result && view === "report" && (
              <MvpBoard result={fought.result} defs={defs} selected={pinned} onSelect={setPinned} onHover={setHoverSquad} />
            )}
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
        {!reporting && !deploying && (unitCard ?? <p className="muted small">Hover a unit on the field to see its stats.</p>)}
        <div className="spacer" />
        {deploying && (
          <p className="hint">
            Click a unit, then click your (blue) zone to place it. <b>Right-click</b> or <b>R</b> rotates. Click a green-outlined squad to move
            it; <b>Delete</b> sells it. <b>Ctrl+Z</b> undoes your last purchase. 🔒 units cost a one-time unlock per match. Click a squad with a gold ▲ to promote it.
          </p>
        )}
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

      <div className="rotate-hint">
        <div className="rotate-icon">📱↻</div>
        <p>Turn your phone sideways to play.</p>
        {canLockLandscape && <button className="primary" onClick={goLandscape}>Full screen, landscape</button>}
        <button onClick={() => setPortraitOk(true)}>Play in portrait anyway</button>
      </div>
    </div>
  );
}

// Fullscreen plus an orientation lock works on Android browsers; iOS has neither, so the button is hidden there.
const canLockLandscape = typeof document !== "undefined" && !!document.fullscreenEnabled && typeof screen !== "undefined" && "orientation" in screen;

async function goLandscape() {
  try {
    await document.documentElement.requestFullscreen();
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    // not supported here; the player can still rotate by hand
  }
}

// XP and level of a placed squad, with a Promote button when a level is waiting.
function Veterancy({ squad, canBuy, price, supply, onPromote }: { squad: PlacedSquad; canBuy: boolean; price: number; supply: number; onPromote: () => void }) {
  const level = squad.level ?? 1;
  const xp = squad.xp ?? 0;
  const earned = earnedLevel(xp, RULES);
  const next = xpForLevel(earned, RULES);
  return (
    <div className={`veterancy ${earned > level ? "ready" : ""}`}>
      <span>
        <b>Level {level}</b>{" "}
        <span className="muted small">
          {Math.round(xp).toLocaleString()} XP{next !== null ? ` / ${next.toLocaleString()} for level ${earned + 1}` : " (max)"}
        </span>
      </span>
      {earned > level &&
        (canBuy ? (
          <button className="small-btn promote-btn" disabled={price > supply} onClick={onPromote}>
            Promote to Lv {level + 1} · {price}
          </button>
        ) : (
          <span className="muted small">can promote</span>
        ))}
    </div>
  );
}

// Squads ready for promotion, as buttons in the Upgrades tab.
function PromotionPanel({
  squads,
  defs,
  supply,
  onPromote,
  onHover,
}: {
  squads: PlacedSquad[];
  defs: DefMap;
  supply: number;
  onPromote: (sq: PlacedSquad) => void;
  onHover: (sq: PlacedSquad | null) => void;
}) {
  if (!squads.length) return null;
  return (
    <div className="promotions">
      <div className="muted small">Promotions: veterans that earned a level. Each level adds the unit's base HP and damage again.</div>
      {squads.map((sq) => {
        const def = defs.get(sq.defId)!;
        const price = promotePrice(def);
        const level = sq.level ?? 1;
        return (
          <button
            key={sq.uid}
            className={`up-btn ${price <= supply ? "can-buy" : ""}`}
            disabled={price > supply}
            onClick={() => onPromote(sq)}
            onMouseEnter={() => onHover(sq)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="up-btn-head">
              <span className="up-name">
                <Swatch def={def} size={14} /> {def.name} → Lv {level + 1}
              </span>
              <span className="up-price">Promote · {price}</span>
            </span>
            <span className="up-desc">
              ×{level + 1} HP and damage (now ×{level}). {Math.round(sq.xp ?? 0).toLocaleString()} XP.
            </span>
          </button>
        );
      })}
    </div>
  );
}

// After a battle: which of your squads just earned a level.
function PromotionsEarned({ result, army, defs }: { result: BattleResult; army: PlacedSquad[]; defs: DefMap }) {
  const fresh = army.filter((sq) => {
    const xp = sq.xp ?? 0;
    return earnedLevel(xp, RULES) > earnedLevel(xp - battleXp(result, sq.uid), RULES);
  });
  if (!fresh.length) return null;
  return (
    <p className="promotions-earned">
      ▲ Level earned: {fresh.map((sq) => defs.get(sq.defId)?.name).join(", ")}. Promote them next round.
    </p>
  );
}

// The round-1 choice: a random unit's unlock gets cheaper, or a little extra supply.
function OpeningOffer({ unit, onChoose }: { unit: UnitDef | undefined; onChoose: (c: "discount" | "bonus") => void }) {
  return (
    <div className="opening">
      <div className="muted small">Opening: pick one</div>
      <div className="opening-buttons">
        {unit && (
          <button className="up-btn can-buy" onClick={() => onChoose("discount")}>
            <span className="up-btn-head">
              <span className="up-name">
                <Swatch def={unit} size={14} /> {unit.name}
              </span>
              <span className="up-price">
                🔒 <s>{unit.unlockCost}</s> {unlockPrice(unit, { [unit.id]: RULES.openingDiscount })}
              </span>
            </span>
            <span className="up-desc">Unlock it {RULES.openingDiscount} cheaper this match.</span>
          </button>
        )}
        <button className="up-btn can-buy" onClick={() => onChoose("bonus")}>
          <span className="up-btn-head">
            <span className="up-name">War chest</span>
            <span className="up-price">+{RULES.openingBonus}</span>
          </span>
          <span className="up-desc">{RULES.openingBonus} extra supply right now.</span>
        </button>
      </div>
    </div>
  );
}

// Every unlocked unit with all of its upgrades as big buy buttons, so buying one is a single click.
function UpgradePanel({
  units,
  owned,
  supply,
  onBuy,
}: {
  units: UnitDef[];
  owned: Record<string, string[]>;
  supply: number;
  onBuy: (unitId: string, upgradeId: string) => void;
}) {
  if (!units.length) return <p className="muted small">Unlock units to upgrade them.</p>;
  return (
    <div className="upgrade-panel">
      <p className="muted small">
        An upgrade changes every squad of that unit, including ones already placed. Each unit's upgrades cost {RULES.upgradeCosts.join(" / ")} in the
        order you buy them, so every step deeper into a specialist costs more.
      </p>
      {units.map((u) => {
        const bought = owned[u.id] ?? [];
        const price = upgradePrice(u, bought.length);
        return (
          <div key={u.id} className="up-unit">
            <div className="up-unit-head">
              <Swatch def={u} size={18} />
              <b>{u.name}</b>
              {bought.length > 0 && <span className="pips">{"★".repeat(bought.length)}</span>}
            </div>
            <div className="up-buttons">
              {u.upgrades!.map((up) => {
                const has = bought.includes(up.id);
                const canBuy = !has && price !== null && price <= supply;
                return (
                  <button
                    key={up.id}
                    className={`up-btn ${has ? "owned" : canBuy ? "can-buy" : ""}`}
                    disabled={has || !canBuy}
                    onClick={() => onBuy(u.id, up.id)}
                  >
                    <span className="up-btn-head">
                      <span className="up-name">{up.name}</span>
                      <span className="up-price">{has ? "★ Owned" : price === null ? "—" : `Buy · ${price}`}</span>
                    </span>
                    {up.description && <span className="up-desc">{up.description}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TowerPanel({ levels, supply, onBuy }: { levels: [number[], number[]]; supply: number; onBuy: (i: number) => void }) {
  return (
    <div className="towers">
      <div className="muted small">Your towers</div>
      {RULES.towers.map((t, i) => {
        const level = levels[0][i] ?? 0;
        const def = towerDef(t.defId, level, RULES, t.name);
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
        Enemy: {RULES.towers.map((t, i) => `${t.name ?? TOWER_MAP.get(t.defId)?.name} Lv ${levels[1][i] ?? 0}`).join(" · ")}
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

// Unlocked units, plus the opening's discounted unit (shown dimmed) if it isn't unlocked yet.
function withDiscount(units: UnitDef[], discount: UnitDef | undefined): UnitDef[] {
  return discount && !units.includes(discount) ? [...units, discount] : units;
}

function DiscountBadge() {
  return (
    <span className="discount-badge" aria-label="cheaper unlock">
      %
    </span>
  );
}

// A side's unlocked units beside its health bar. Hovering one shows its name and which upgrades it has.
// The unit its opening made cheaper to unlock wears a discount badge.
function UnlockStrip({ units, owned, side, discount, note }: { units: UnitDef[]; owned: UpgradeState; side: Side; discount?: UnitDef; note?: string | null }) {
  return (
    <div className={`hud-unlocks hud-unlocks-${side}`} aria-label={side === 0 ? "Your unlocks" : "Enemy unlocks"}>
      {withDiscount(units, discount).map((d) => {
        const bought = owned[d.id] ?? [];
        const locked = !units.includes(d);
        return (
          <span key={d.id} className={`unlock-chip ${locked ? "locked" : ""}`} tabIndex={0}>
            <Swatch def={d} size={20} />
            {bought.length > 0 && <span className="unlock-count">{bought.length}</span>}
            {d === discount && <DiscountBadge />}
            <span className="unlock-tip" role="tooltip">
              <b>{d.name}</b>
              {d === discount && <span className="muted small">{locked ? "Cheaper unlock, not unlocked yet" : "Unlocked at a discount"}</span>}
              {d.upgrades?.length ? (
                <span className="tip-ups">
                  {d.upgrades.map((up) => {
                    const has = bought.includes(up.id);
                    return (
                      <span key={up.id} className={has ? "tip-up owned" : "tip-up"}>
                        {has ? "★" : "·"} {up.name}
                      </span>
                    );
                  })}
                </span>
              ) : null}
            </span>
          </span>
        );
      })}
      {note && <span className="muted small hud-note">{note}</span>}
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
