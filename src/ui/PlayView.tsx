import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { OPENING_PACKS } from "../data/openings";
import { FACTIONS, factionOf } from "../data/roles";
import { deployZone, RULES } from "../data/rules";
import { towerDaze, towerDef, towerPlacements, TOWER_MAP } from "../data/towers";
import { DEFAULT_UNITS } from "../data/units";
import { planAiRound, promoted, type AiPlan, type Difficulty } from "../game/ai";
import type { AiRequest, AiResponse } from "../game/ai.worker";
import { canPlace, defMap, newUid, squadRect, towerUpgradePrice, unlockPrice, upgradePrice, type DefMap } from "../game/army";
import { applyRound, applyTurn, battleXp, canPromote, chooseOpening, newMatch, nextRound, outcomeOf, packLabel, promotePrice, survivorDamage, type MatchState, type OpeningChoice, type Turn } from "../game/match";
import {
  checkTurn,
  currentStart,
  findOutcome,
  latestHello,
  outcomeSig,
  prepareBattle,
  randomId,
  restore,
  roundTurns,
  swapOutcome,
  swapResult,
  turnAround,
  turnFrom,
  type Fought,
  type Restored,
} from "../game/pvp";
import { drawBackground, drawPromoteIcon, drawSquad } from "../render/draw";
import { earnedLevel, levelDef, xpForLevel } from "../sim/levels";
import { Battle, footprintOf, type BattleResult } from "../sim/battle";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { upgradedDefs, type UpgradeState } from "../sim/upgrades";
import { MEDAL_COLORS, MvpBoard, SquadDetail, SquadList, topSquads } from "./BattleReport";
import { useBattlePlayer } from "./battlePlayer";
import { DamageTally, type Strike } from "./DamageTally";
import { FieldCanvas, type FieldPointer } from "./FieldCanvas";
import { LoveLetter, loveLetterShown } from "./LoveLetter";
import { COMPACT_QUERY, DetailsSheet, Sheet, UnitSheet, UnitTile, UnlockSheet, useMedia } from "./MobileDeploy";
import { PvpPanel } from "./PvpPanel";
import type { PlayStatus } from "./PvpView";
import { Swatch, UnitInfo } from "./UnitInfo";
import { usePvpConnection, type PvpLink } from "./usePvp";

const TILE = 24;

// Each match rolls its own opening offers; the sim itself stays seeded and deterministic.
const matchSeed = () => Math.floor(Math.random() * 2 ** 31);


// Spending actions this round, newest last, so they can be undone.
type Action =
  | { kind: "place"; uid: string; cost: number }
  | { kind: "unlock"; unitId: string; cost: number }
  | { kind: "upgrade"; unitId: string; upgradeId: string; cost: number }
  | { kind: "tower"; index: number; cost: number }
  | { kind: "promote"; uids: string[]; cost: number };

function actionLabel(a: Action, defs: DefMap): string {
  switch (a.kind) {
    case "place":
      return "placement";
    case "unlock":
      return `unlock ${defs.get(a.unitId)?.name ?? ""}`;
    case "upgrade":
      return `upgrade ${defs.get(a.unitId)?.upgrades?.find((u) => u.id === a.upgradeId)?.name ?? ""}`;
    case "promote":
      return a.uids.length > 1 ? `${a.uids.length} promotions` : "promotion";
    case "tower":
      return `${RULES.towers[a.index].name ?? TOWER_MAP.get(RULES.towers[a.index].defId)?.name ?? "tower"} upgrade`;
  }
}

// Phone layout only: what the sheet over the field shows besides the selected unit.
type SheetKind = "unlock" | "keeps" | "promote" | "menu" | "details";
// a tapped squad or enemy unit, by id, so its sheet follows upgrades and promotions
type Inspected = { side: Side; defId: string; uid?: string };

// A PvP match (docs/MULTIPLAYER.md), or a game against the AI when absent.
export interface PvpProps {
  link: PvpLink;
  onLeave: () => void;
}

export function PlayView({ pvp, onStatus }: { pvp?: PvpProps; onStatus?: (s: PlayStatus) => void }) {
  const units = DEFAULT_UNITS;
  const defs = useMemo(() => defMap(units), [units]);
  const [match, setMatch] = useState<MatchState>(() => (pvp ? newMatch(units, 1, { aiOpening: false }) : newMatch(units, matchSeed())));
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [selected, setSelected] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [rot, setRot] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ def: UnitDef; side: Side; fromShop?: boolean; squad?: PlacedSquad } | null>(null);
  const [speed, setSpeed] = useState(1);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [fought, setFought] = useState<Fought | null>(null);
  const [view, setView] = useState<"report" | "replay">("report");
  const [pinned, setPinned] = useState<string | null>(null);
  const [hoverSquad, setHoverSquad] = useState<string | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [fightArmed, setFightArmed] = useState(false);
  const [fightQueued, setFightQueued] = useState(false);
  const [matchNo, setMatchNo] = useState(0); // a restart in round 1 needs a fresh plan too
  const [portraitOk, setPortraitOk] = useState(false);
  const [sideTab, setSideTab] = useState<"recruit" | "upgrades">("recruit");
  // phones held sideways deploy from a rail and sheets over the field (MobileDeploy.tsx)
  const compact = useMedia(COMPACT_QUERY);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [inspect, setInspect] = useState<Inspected | null>(null);
  // the survivors' damage flying to the HP bars after a battle; the bars show `before` until each strike lands
  const [tally, setTally] = useState<{ strikes: Strike[]; before: [number, number]; landed: number } | null>(null);
  // the easter egg for winning a match with the AI on Hard every round (LoveLetter.tsx)
  const allHard = useRef(true);
  const [loveLetter, setLoveLetter] = useState(false);
  const battleRef = useRef<Battle | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  // PvP: the connection, which match of the room is on screen (0 until it's rebuilt from the log), and notices
  const conn = usePvpConnection(pvp?.link ?? null);
  const seat: Side = conn.snap.seat ?? 0; // the battle runs in the host's view; a guest sees it turned round
  const other: Side = seat === 0 ? 1 : 0;
  const [pvpGame, setPvpGame] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const roundStart = useRef<MatchState>(match); // the state when this round's deployment began, for building a turn
  const desyncSeen = useRef(new Set<string>());
  const pvpReady = !pvp || pvpGame > 0;
  const entries = conn.entries;
  const turns = pvp && pvpGame ? roundTurns(entries, pvpGame, match.round) : null;
  const oppTurn = turns?.turns[other] ?? null;
  const locked = turns?.locked ?? null; // the relay has both turns: the battle starts
  const committed = !!pvp && pvpGame > 0 && match.phase === "deploy" && !!turns?.turns[seat];
  const friendJoined = !!pvp && (conn.snap.online[other] || entries.some((e) => e.from === other));
  const theirBuild = pvp ? latestHello(entries, other) : null;
  const hover = useRef<{ x: number; y: number } | null>(null);
  const player = useBattlePlayer();

  const myDefs = useMemo(() => upgradedDefs(defs, match.upgrades[0]), [defs, match.upgrades]);
  const enemyDefs = useMemo(() => upgradedDefs(defs, match.upgrades[1]), [defs, match.upgrades]);

  // The AI plans at the start of each deployment, from what it saw last round, in a worker so the page stays
  // responsive while the player builds. Fight only has to wait if the player is done first.
  useEffect(() => {
    if (pvp || match.phase !== "deploy") return;
    setAiPlan(null);
    const request: AiRequest = {
      id: match.round,
      units,
      me: { army: match.armies[1], unlocked: match.unlocked[1], upgrades: match.upgrades[1], towerLevels: match.towerLevels[1], supply: match.supply[1] },
      player: { army: match.armies[0], upgrades: match.upgrades[0], towerLevels: match.towerLevels[0], unlocked: match.unlocked[0] },
      round: match.round,
      difficulty,
      seed: match.round * 7919 + 13,
      opts: { openingPacks: match.openings[1].packs.map((i) => OPENING_PACKS[i]) },
    };
    const onMainThread = () => planAiRound(units, defs, request.me, request.player, request.round, request.difficulty, request.seed, request.opts);
    // Hard searches on several cores at once: each worker uses its own search seed against the same armies, and the
    // best plan wins. Easier settings use one.
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
    const searches = difficulty === "hard" ? Math.max(1, Math.min(4, cores - 1)) : 1;
    const workers: Worker[] = [];
    const plans: AiPlan[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      plans.sort((a, b) => (b.bestScore ?? -Infinity) - (a.bestScore ?? -Infinity));
      setAiPlan({ ...plans[0], candidatesTried: plans.reduce((t, p) => t + p.candidatesTried, 0) });
    };
    try {
      for (let i = 0; i < searches; i++) {
        const worker = new Worker(new URL("../game/ai.worker.ts", import.meta.url), { type: "module" });
        workers.push(worker);
        worker.onmessage = (e: MessageEvent<AiResponse>) => {
          worker.terminate();
          plans.push(e.data.plan);
          if (plans.length === searches) finish();
        };
        worker.onerror = () => {
          worker.terminate();
          plans.push(onMainThread());
          if (plans.length === searches) finish();
        };
        worker.postMessage({ ...request, opts: { ...request.opts, searchSeed: i } } satisfies AiRequest);
      }
    } catch {
      // no workers (old browsers, tests): plan on the page instead
      for (const w of workers) w.terminate();
      timer = setTimeout(() => setAiPlan(onMainThread()), 30);
    }
    return () => {
      for (const w of workers) w.terminate();
      clearTimeout(timer);
    };
  }, [matchNo, match.round, match.phase === "deploy", difficulty]); // a new difficulty replans this round

  // Fight pressed while the AI is still thinking: start as soon as it's ready.
  useEffect(() => {
    if (!pvp && fightQueued && aiPlan && match.phase === "deploy") {
      setFightQueued(false);
      launch();
    }
  }, [fightQueued, !!aiPlan]);

  // PvP: the battle starts once the relay has both turns, even if this player took theirs back a moment too late.
  useEffect(() => {
    if (pvp && locked && match.phase === "deploy") launch();
  }, [!!locked, match.phase, match.round, pvpGame]);

  // PvP: say hello, start the first match (host), and rebuild the match from the log when it first arrives or when a
  // rematch starts.
  useEffect(() => {
    if (!pvp || conn.snap.seat === null || conn.snap.status !== "open") return;
    if (latestHello(entries, seat) !== __APP_VERSION__) conn.post({ type: "hello", id: randomId(12), build: __APP_VERSION__ });
    const start = currentStart(entries);
    if (!start) {
      if (seat === 0) conn.post({ type: "start", id: randomId(12), game: 1, seed: matchSeed() });
      return;
    }
    if (start.game > pvpGame) {
      const r = restore(units, entries, seat);
      if (r) showRestored(r);
    }
  }, [entries, conn.snap.seat, conn.snap.status]);

  // PvP: post this browser's battle outcome, so the two can be compared.
  useEffect(() => {
    if (!pvp || !pvpGame || !fought?.result || (match.phase !== "result" && match.phase !== "over")) return;
    if (findOutcome(entries, pvpGame, match.round, seat)) return;
    const local = outcomeOf(fought.result, defs);
    const canon = seat === 0 ? local : swapOutcome(local);
    conn.post({ type: "outcome", id: randomId(12), game: pvpGame, round: match.round, sig: outcomeSig(canon), outcome: canon });
  }, [fought?.result, entries, match.phase]);

  // PvP: if the two browsers saw different battles (a bug), the host's result stands.
  useEffect(() => {
    if (!pvp || !pvpGame || (match.phase !== "result" && match.phase !== "over")) return;
    const mine = findOutcome(entries, pvpGame, match.round, seat);
    const theirs = findOutcome(entries, pvpGame, match.round, other);
    const key = `${pvpGame}:${match.round}`;
    if (!mine || !theirs || mine.sig === theirs.sig || desyncSeen.current.has(key)) return;
    desyncSeen.current.add(key);
    if (seat === 1) {
      const r = restore(units, entries, seat);
      if (r) showRestored(r);
      setNotice("This battle came out differently on your friend's computer, so the round uses their result. That's a bug: please report it.");
    } else setNotice("This battle came out differently on your friend's computer. Their game now uses your result. That's a bug: please report it.");
  }, [entries, match.phase]);

  // the PvP tab shows the match's state, and warns before a new match ends a game against the AI
  const host = seat === 0 && conn.snap.seat !== null;
  const aiInProgress = !pvp && (match.round > 1 || actions.length > 0);
  useEffect(() => {
    onStatus?.({ pvp: pvp ? { host, friendJoined, status: conn.snap.status, error: conn.snap.error } : null, aiInProgress });
  }, [host, friendJoined, conn.snap.status, conn.snap.error, aiInProgress]);

  // shown once the survivors' damage has landed
  const wonOnHard = !pvp && match.phase === "over" && match.hp[0] > 0 && match.hp[1] <= 0 && allHard.current;
  useEffect(() => {
    if (wonOnHard && !tally && !loveLetterShown()) setLoveLetter(true);
  }, [wonOnHard, !!tally]);

  useEffect(() => {
    if (!fightArmed) return;
    const t = setTimeout(() => setFightArmed(false), 3000);
    return () => clearTimeout(t);
  }, [fightArmed]);

  const myArmy = match.armies[0];
  // You see the enemy as it stood last round: its opening pack, placed in round 1, stays hidden until the battle.
  const enemySeen = match.armies[1].filter((sq) => sq.round < match.round);
  const unlocked = useMemo(() => new Set(match.unlocked[0]), [match.unlocked]);
  const openingPending = match.round === 1 && match.openings[0].choice === null;
  const isNew = (sq: PlacedSquad) => !RULES.lockPlacedSquads || sq.round === match.round;
  const heldSquad = held ? myArmy.find((s) => s.uid === held) : undefined;
  const placingDef = heldSquad ? myDefs.get(heldSquad.defId) : selected ? myDefs.get(selected) : undefined;
  const deploying = match.phase === "deploy" && pvpReady && !committed;
  const reporting = (match.phase === "result" || match.phase === "over") && view === "report" && !!fought?.result && !tally;

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
          const demote = (s: PlacedSquad) => (last.uids.includes(s.uid) ? { ...s, level: (s.level ?? 2) - 1 > 1 ? (s.level ?? 2) - 1 : undefined } : s);
          return { ...m, supply, armies: [m.armies[0].map(demote), m.armies[1]] };
        }
      }
    });
  };

  // promotes the squads in order while supply lasts, as one action so one undo takes it back
  const promoteSquads = (squads: PlacedSquad[]) => {
    if (!deploying) return;
    const uids: string[] = [];
    let cost = 0;
    for (const sq of squads) {
      const def = defs.get(sq.defId);
      if (!def || !canPromote(sq) || cost + promotePrice(def) > match.supply[0]) continue;
      uids.push(sq.uid);
      cost += promotePrice(def);
    }
    if (!uids.length) return;
    spend(cost, { kind: "promote", uids, cost }, (m) => ({
      armies: [m.armies[0].map((s) => (uids.includes(s.uid) ? { ...s, level: (s.level ?? 1) + 1 } : s)), m.armies[1]],
    }));
  };
  const promote = (sq: PlacedSquad) => promoteSquads([sq]);

  // A squad as it will fight: its unit with upgrades, then its level.
  const squadDef = (sq: PlacedSquad, side: Side) => {
    const d = (side === 0 ? myDefs : enemyDefs).get(sq.defId);
    return d && levelDef(d, sq.level ?? 1);
  };

  const sell = (sq: PlacedSquad) => {
    if (sq.free) return; // came with the opening pack
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
      if (p.type === "down" && tally) setTally(null);
      if (p.type === "move") {
        // a guest's battle is drawn turned round
        const bx = seat === 1 ? RULES.fieldW - p.x : p.x;
        const by = seat === 1 ? RULES.fieldH - p.y : p.y;
        const m = battleRef.current?.models.find((m) => m.alive && Math.hypot(m.x - bx, m.y - by) < Math.max(0.5, m.def.size));
        setHoverInfo(m ? { def: m.def, side: seat === 1 ? (m.side === 0 ? 1 : 0) : m.side } : null);
      }
      return;
    }
    if (p.type === "move") {
      const mine = hitSquad(myArmy, p.x, p.y);
      const theirs = hitSquad(enemySeen, p.x, p.y);
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
        // can't afford another: stop placing (phones keep the unit's sheet open for its upgrades)
        if (!compact && match.supply[0] - placingDef.cost < placingDef.cost) setSelected(null);
      }
      return;
    }
    if (existing && isNew(existing)) pickUp(existing);
    else if (compact) {
      // no hover on touch: a tap shows what's there, and the sheet has the buttons
      const theirs = hitSquad(enemySeen, p.x, p.y);
      const tower = hitSquad(allTowers(), p.x, p.y);
      setSheet(tower ? "keeps" : null);
      const sq = existing ?? theirs;
      setInspect(sq ? { side: existing ? 0 : 1, defId: sq.defId, uid: sq.uid } : null);
    } else if (existing && canPromote(existing)) promote(existing);
  };

  const stopPlacing = () => {
    setSelected(null);
    setHeld(null);
  };

  const pickUp = (sq: PlacedSquad) => {
    setHeld(sq.uid);
    setRot(!!sq.rot);
    setInspect(null);
  };

  // Phone rail: a tap selects a unit to place and opens its sheet; a second tap closes it.
  const pickTile = (u: UnitDef) => {
    setHeld(null);
    setInspect(null);
    setSheet(null);
    setSelected(selected === u.id ? null : u.id);
  };

  const clickShop = (u: UnitDef) => {
    setHeld(null);
    if (unlocked.has(u.id)) {
      setSelected(selected === u.id ? null : u.id);
      return;
    }
    const cost = unlockPrice(u);
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
    if (openingPending || fightQueued || !deploying) return;
    if (!actions.length && match.supply[0] > 0 && !fightArmed) {
      setFightArmed(true);
      return;
    }
    setFightArmed(false);
    if (pvp) {
      // send the turn; the battle starts once the friend's turn is in too
      setHeld(null);
      setSelected(null);
      conn.post({ type: "turn", id: randomId(12), game: pvpGame, round: match.round, turn: turnFrom(roundStart.current, match) });
    } else if (!aiPlan) setFightQueued(true);
    else launch();
  };

  // PvP: take the turn back and keep deploying, while the friend hasn't sent theirs.
  const unready = () => {
    if (committed && !locked) conn.post({ type: "cancel", id: randomId(12), game: pvpGame, round: match.round });
  };

  // This side as it fights and the other side's turn. In PvP both come from the log, so a cancel that lost the race
  // to the friend's turn still fights the turn that was sent.
  const sides = (): { mine: MatchState; turn: Turn; spent?: number } | null => {
    if (pvp) return locked ? { mine: applyTurn(roundStart.current, 0, locked[seat], defs), turn: turnAround(locked[other], defs) } : null;
    if (!aiPlan) return null;
    const army = [...promoted(match.armies[1], aiPlan.promotions), ...aiPlan.squads];
    return { mine: match, turn: { army, unlocks: aiPlan.unlocks, upgrades: aiPlan.upgrades, towerUpgrades: aiPlan.towerUpgrades }, spent: aiPlan.spent };
  };

  const launch = () => {
    const opp = sides();
    if (!opp) return;
    if (!pvp && difficulty !== "hard") allHard.current = false;
    if (pvp) {
      const problems = checkTurn(opp.mine, 1, opp.turn, defs);
      if (problems.length) setNotice(`Your friend's turn didn't add up: they ${problems.join("; ")}.`);
    }
    const next = applyTurn(opp.mine, 1, opp.turn, defs, opp.spent);
    const f = prepareBattle(next, defs, seat);
    setMatch({ ...next, phase: "battle" });
    battleRef.current = new Battle(f.canon.defs, f.canon.armies, { seed: f.canon.seed, recordFx: true, towerLevels: f.canon.towerLevels });
    setFought(f);
    setActions([]);
    player.reset();
    setSpeed(1); // every battle starts at normal speed, even if the last one was fast-forwarded
    setSelected(null);
    setHeld(null);
    setView("report");
    setPinned(null);
    setTally(null);
    setSheet(null);
    setInspect(null);
  };

  // The battle ran in the host's view; a guest turns the result round to their own.
  const onBattleEnd = (canonResult: BattleResult) => {
    const r = seat === 0 ? canonResult : swapResult(canonResult);
    const strikes = battleRef.current ? survivorStrikes(battleRef.current, canonResult, defs, seat === 1) : [];
    if (strikes.length) setTally({ strikes, before: match.hp, landed: 0 });
    setFought((f) => (f ? { ...f, result: r } : f));
    setMatch((m) => applyRound(m, r, defs));
  };

  const replay = () => {
    if (!fought) return;
    const c = fought.canon;
    battleRef.current = new Battle(c.defs, c.armies, { seed: c.seed, recordFx: true, towerLevels: c.towerLevels });
    player.reset();
    setSpeed(1); // every battle starts at normal speed, even if the last one was fast-forwarded
    setView("replay");
    setTally(null);
  };

  const next = () => {
    battleRef.current = null;
    setFought(null);
    setTally(null);
    const n = nextRound(match);
    roundStart.current = n; // the turn sent to a PvP friend is what changed since
    setMatch(n);
  };

  // A PvP match rebuilt from the log (on joining, reloading, a rematch, or after a desync).
  const showRestored = (r: Restored) => {
    battleRef.current = null;
    player.reset();
    roundStart.current = r.start;
    setMatch(r.match);
    setFought(r.fought);
    setTally(null);
    setActions([]);
    setSelected(null);
    setHeld(null);
    setFightArmed(false);
    setFightQueued(false);
    setView("report");
    setPinned(null);
    setSpeed(1);
    setPvpGame(r.game);
  };

  const rematch = () => conn.post({ type: "start", id: randomId(12), game: pvpGame + 1, seed: matchSeed() });


  const restart = () => {
    battleRef.current = null;
    setFought(null);
    setSelected(null);
    setHeld(null);
    setActions([]);
    setFightQueued(false);
    setTally(null);
    setSheet(null);
    setInspect(null);
    setMatchNo((n) => n + 1);
    allHard.current = true;
    const m = newMatch(units, matchSeed());
    roundStart.current = m;
    setMatch(m);
  };

  // keyboard: Esc cancels, R rotates, Ctrl/Cmd+Z undoes, Delete sells the held squad
  const keyState = useRef({ undo, heldSquad, sell });
  keyState.current = { undo, heldSquad, sell };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc always stops placing, wherever focus is (a focused shop button, the invite link, a menu)
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        setSelected(null);
        setHeld(null);
        setSheet(null);
        setInspect(null);
        return;
      }
      const el = e.target as HTMLElement;
      if (el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" || (el?.tagName === "INPUT" && !(el as HTMLInputElement).readOnly)) return;
      if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        keyState.current.undo();
      } else if (e.key === "r" || e.key === "R") setRot((r) => !r);
      else if ((e.key === "Delete" || e.key === "Backspace") && keyState.current.heldSquad) {
        keyState.current.sell(keyState.current.heldSquad);
        setHeld(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
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
      player.frame(ctx, b, TILE, dt, time, live ? speed : 0, match.phase === "battle" ? onBattleEnd : undefined, seat === 1);
      return;
    }
    drawBackground(ctx, TILE, { zones: true, grid: [0] });
    for (const side of [0, 1] as Side[]) {
      towerPlacements(side).forEach((t, i) => drawSquad(ctx, t, towerDef(t.defId, match.towerLevels[side][i] ?? 0), side, TILE));
    }
    for (const sq of enemySeen) {
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
    if (placingDef) {
      const { y0, y1 } = deployZone(0);
      ctx.fillStyle = `rgba(77,163,255,${0.07 + 0.04 * Math.sin(time * 4)})`;
      ctx.fillRect(0, y0 * TILE, RULES.fieldW * TILE, (y1 - y0) * TILE);
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
  // while the tally plays, each HP bar drops as the strikes against it land
  const hitsOn: [number, number] = [0, 0];
  const shownHp: [number, number] = [...match.hp];
  if (tally) {
    const landed: [number, number] = [0, 0];
    for (const st of tally.strikes.slice(0, tally.landed)) {
      const target = st.from === 0 ? 1 : 0;
      landed[target] += st.amount;
      hitsOn[target]++;
    }
    for (const side of [0, 1] as Side[]) shownHp[side] = Math.max(match.hp[side], tally.before[side] - Math.round(landed[side]));
  }
  const focusStats = fought?.result ? fought.result.stats[hoverSquad ?? pinned ?? ""] : undefined;
  // the AI's unlocks join when it fights, except its opening pack's, so hide round 1's
  const enemyUnlocks = (match.round > 1 ? match.unlocked[1] : []).map((id) => enemyDefs.get(id)).filter((d): d is UnitDef => !!d);
  const myUnlocks = match.unlocked[0].map((id) => myDefs.get(id)).filter((d): d is UnitDef => !!d);
  // the enemy's opening shows once round 1 is over
  const enemyChoice = match.round > 1 ? match.openings[1].choice : null;
  const enemyOpening =
    enemyChoice === null ? null : enemyChoice === "flat" ? `opened with ${RULES.openingFlat} supply` : `opened with ${packLabel(OPENING_PACKS[enemyChoice], units)}`;
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
  // Promote all is per unit type: the squads of one unit, when more than one has a level waiting
  const promoteAll = (defId: string): PromoteAll | undefined => {
    const squads = promotable.filter((sq) => sq.defId === defId);
    if (squads.length < 2) return undefined;
    const price = promotePrice(defs.get(defId)!);
    return { count: squads.length, price: price * squads.length, cheapest: price, onClick: () => promoteSquads(squads) };
  };

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

  const fightLabel = openingPending
    ? "Pick your opening first"
    : fightQueued
      ? pvp
        ? "Waiting for your friend…"
        : "The enemy is still deciding…"
      : fightArmed
        ? `Fight without spending ${match.supply[0]}?`
        : "Fight!";
  const gameOpts = pvp ? (
    <div className="game-opts">
      <button onClick={pvp.onLeave}>Leave match</button>
    </div>
  ) : (
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
  );
  const aiNote = deploying && !pvp && (
    <p className="muted small">{aiPlan ? `AI tested ${aiPlan.candidatesTried} plans against what it expects you to field.` : "AI is thinking while you build…"}</p>
  );

  // Phone layout: the sheet over the field. A unit being placed or moved comes first, then a tapped squad.
  const focus: Inspected | null = heldSquad
    ? { side: 0, defId: heldSquad.defId, uid: heldSquad.uid }
    : selected
      ? { side: 0, defId: selected }
      : inspect;
  const mobileSheet = (() => {
    const close = () => setSheet(null);
    if (openingPending)
      return (
        <Sheet kind="full">
          <OpeningOffer packs={match.openings[0].packs} units={units} rival={pvp ? "your friend" : "the enemy"} onChoose={(c) => setMatch((m) => chooseOpening(m, 0, c, units))} />
        </Sheet>
      );
    if (sheet === "unlock")
      return (
        <UnlockSheet
          units={units.filter((u) => !unlocked.has(u.id)).map((u) => myDefs.get(u.id) ?? u)}
          supply={match.supply[0]}
          onUnlock={(u) => {
            clickShop(u);
            close();
          }}
          onClose={close}
        />
      );
    if (sheet === "menu")
      return (
        <Sheet kind="band" title={<b>Game</b>} onClose={close}>
          {gameOpts}
          {aiNote}
        </Sheet>
      );
    if (sheet === "keeps")
      return (
        <Sheet kind="band" title={<b>Keeps</b>} onClose={close}>
          <TowerPanel levels={match.towerLevels} supply={match.supply[0]} onBuy={buyTower} />
        </Sheet>
      );
    if (sheet === "promote")
      return (
        <Sheet kind="band" title={<b>Promotions</b>} onClose={close}>
          <PromotionPanel squads={promotable} defs={defs} supply={match.supply[0]} onPromote={promote} promoteAll={promoteAll} onHover={() => {}} />
        </Sheet>
      );
    const army = focus?.side === 0 ? myArmy : enemySeen;
    const squad = focus?.uid ? army.find((s) => s.uid === focus.uid) : undefined;
    const def = focus && (squad ? squadDef(squad, focus.side) : (focus.side === 0 ? myDefs : enemyDefs).get(focus.defId));
    if (!focus || !def) return <div className="sheet-hint">Tap one of your units on the left to place it and buy its upgrades.</div>;
    const owned = match.upgrades[focus.side][def.id] ?? [];
    if (sheet === "details") return <DetailsSheet def={def} owned={owned} onClose={close} />;
    const base = defs.get(def.id);
    return (
      <UnitSheet
        def={def}
        owned={owned}
        rival={focus.side === 1 ? (pvp ? "Your friend's" : "Enemy's") : undefined}
        extra={
          squad && focus.side === 0 && canPromote(squad) && !heldSquad ? (
            <Veterancy squad={squad} canBuy={focus.side === 0} price={promotePrice(base!)} supply={match.supply[0]} onPromote={() => promote(squad)} promoteAll={promoteAll(squad.defId)} />
          ) : null
        }
        buy={
          focus.side === 0 && base
            ? { price: upgradePrice(base, owned.length), supply: match.supply[0], locked: !unlocked.has(def.id), onBuy: (id) => buyUpgrade(def.id, id) }
            : null
        }
        onDetails={() => setSheet("details")}
        onClose={() => {
          stopPlacing();
          setInspect(null);
        }}
      />
    );
  })();

  // health and round: above the field, or at the top of the sidebar on phones, where height is scarcer than width
  const hud = (
    <div className="hud">
      <UnlockStrip units={myUnlocks} owned={match.upgrades[0]} side={0} />
      <HpBar label="You" hp={shownHp[0]} side={0} hits={hitsOn[0]} />
      <div className="round">Round {match.round}</div>
      <HpBar label={pvp ? "Friend" : "Enemy"} hp={shownHp[1]} side={1} hits={hitsOn[1]} />
      <UnlockStrip units={enemyUnlocks} owned={match.upgrades[1]} side={1} note={enemyOpening} />
    </div>
  );

  const unitCard = card && (
    <>
    {card.squad && !card.def.structure && (
      <Veterancy
        squad={card.squad}
        canBuy={card.side === 0 && deploying}
        price={promotePrice(defs.get(card.squad.defId)!)}
        supply={match.supply[0]}
        onPromote={() => promote(card.squad!)}
        promoteAll={promoteAll(card.squad.defId)}
      />
    )}
    <UnitInfo
      def={card.def}
      owned={card.def.structure ? undefined : match.upgrades[card.side][card.def.id] ?? []}
      upgradeAction={upgradeAction(card.def)}
    />
    </>
  );

  return (
    <div className={`play ${portraitOk ? "portrait-ok" : ""}`} style={{ "--field-ratio": RULES.fieldW / RULES.fieldH } as React.CSSProperties}>
      <main className="board">
        {!compact && hud}
        <div
          ref={fieldRef}
          className={`field-wrap ${deploying && placingDef ? (held ? "moving" : "placing") : ""}`}
        >
          <div className="field-box">
          <FieldCanvas tile={TILE} draw={draw} onPointer={onPointer} />
          {compact && deploying && mobileSheet}
          {deploying && placingDef && !compact && (
            <div className="placing-banner">
              <Swatch def={placingDef} size={18} />
              <span>
                {held ? (
                  <>
                    Moving <b>{placingDef.name}</b>: click a free spot
                  </>
                ) : (
                  <>
                    Placing <b>{placingDef.name}</b> ({placingDef.cost} each): click your blue zone
                  </>
                )}
              </span>
              <button className="small-btn" onClick={stopPlacing}>
                {held ? "Cancel" : "Done"} <span className="muted">Esc</span>
              </button>
            </div>
          )}
          </div>
        </div>
        {tally && (
          <DamageTally
            strikes={tally.strikes}
            field={() => fieldRef.current?.querySelector("canvas") ?? null}
            onLand={(landed) => setTally((t) => (t ? { ...t, landed } : t))}
            onDone={() => setTally(null)}
          />
        )}
      </main>

      <aside className="panel side">
        {compact && hud}
        {pvp && (
          <PvpPanel
            configured={conn.configured}
            status={conn.snap.status}
            error={conn.snap.error}
            friendJoined={friendJoined}
            friendOnline={conn.snap.online[other]}
            friendReady={!!oppTurn}
            versionMismatch={!!theirBuild && theirBuild !== __APP_VERSION__}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
          />
        )}
        {committed && (
          <div className="deploy-bar">
            <button className="primary big" disabled>
              {locked ? "Both ready: starting…" : "Waiting for your friend…"}
            </button>
            <button onClick={unready} disabled={!!locked}>
              Not ready: keep deploying
            </button>
            <p className="muted small">The battle starts when your friend is ready too. Until then you can take your army back and change it.</p>
          </div>
        )}
        {deploying && compact && (
          <>
            <div className="rail-fight">
              <div className="supply">
                <span className="supply-num">{match.supply[0]}</span> supply
              </div>
              <button className="rail-undo" disabled={!lastAction} onClick={undo} aria-label="Undo">
                ↶{lastAction ? <span className="small"> +{lastAction.cost}</span> : null}
              </button>
              <button className={`primary big ${fightArmed ? "warn-btn" : ""}`} disabled={openingPending || fightQueued} onClick={fight}>
                {fightLabel}
              </button>
            </div>
            {/* one column keeps names whole; past four units the rail switches to two and the costs move to the sheet */}
            <div className={`rail-units ${myUnlocks.length > 4 ? "two" : ""}`}>
              {myUnlocks.map((d) => {
                const bought = match.upgrades[0][d.id] ?? [];
                const price = upgradePrice(defs.get(d.id)!, bought.length);
                return (
                  <UnitTile
                    key={d.id}
                    def={d}
                    active={selected === d.id || heldSquad?.defId === d.id}
                    ups={bought.length}
                    canUpgrade={price !== null && price <= match.supply[0]}
                    onClick={() => pickTile(d)}
                  />
                );
              })}
            </div>
            {/* veterans first: a promotion is the cheapest way to grow an army */}
            {promotable.length > 0 && (
              <button className={`rail-promote ${sheet === "promote" ? "active" : ""}`} onClick={() => setSheet(sheet === "promote" ? null : "promote")}>
                <span>
                  ▲ Promote {promotable.length} veteran{promotable.length > 1 ? "s" : ""}
                </span>
                <span className="small">cheaper than a new squad</span>
              </button>
            )}
            <div className="rail-actions">
              <button className={`rail-tile rail-add ${sheet === "unlock" ? "active" : ""}`} onClick={() => setSheet(sheet === "unlock" ? null : "unlock")}>
                ＋ Unlock a unit
              </button>
              <button className={`rail-tile ${sheet === "keeps" ? "active" : ""}`} onClick={() => setSheet(sheet === "keeps" ? null : "keeps")}>
                <Swatch def={TOWER_MAP.get(RULES.towers[0].defId)!} size={18} />
                Keeps
              </button>
            </div>
            {placingDef && (
              <div className="rail-placing">
                <div className="rail-caption">
                  {heldSquad ? "Moving: tap a free spot." : placingDef.cost > match.supply[0] ? "Not enough supply for another." : "Tap your blue zone to place."}
                </div>
                <div className="rail-actions">
                  <button className="rail-tile" onClick={() => setRot((r) => !r)}>
                    ↻ Rotate
                  </button>
                  {heldSquad && !heldSquad.free && (
                    <button
                      className="rail-tile"
                      onClick={() => {
                        sell(heldSquad);
                        setHeld(null);
                      }}
                    >
                      Sell +{placingDef.cost}
                    </button>
                  )}
                  <button className="rail-tile rail-done" onClick={stopPlacing}>
                    {heldSquad ? "Cancel" : "Done"}
                  </button>
                </div>
              </div>
            )}
            <div className="spacer" />
            <div className="rail-foot">
              {enemyUnlocks.length > 0 && <span className="muted small">{pvp ? "Friend" : "Enemy"}</span>}
              <span className="swatches">
                {enemyUnlocks.map((d) => (
                  <button key={d.id} className="unlock-chip chip-btn" title={d.name} onClick={() => setInspect({ side: 1, defId: d.id })}>
                    <Swatch def={d} size={20} />
                    {(match.upgrades[1][d.id]?.length ?? 0) > 0 && <span className="unlock-count">{match.upgrades[1][d.id].length}</span>}
                  </button>
                ))}
              </span>
              <button className={`small-btn rail-menu ${sheet === "menu" ? "active" : ""}`} onClick={() => setSheet(sheet === "menu" ? null : "menu")} aria-label="Game menu">
                ☰
              </button>
            </div>
          </>
        )}
        {deploying && !compact && (
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
              <button className={`primary big ${fightArmed ? "warn-btn" : ""}`} disabled={openingPending || fightQueued} onClick={fight}>
                {fightLabel}
              </button>
            </div>
            {openingPending && (
              <OpeningOffer packs={match.openings[0].packs} units={units} rival={pvp ? "your friend" : "the enemy"} onChoose={(c) => setMatch((m) => chooseOpening(m, 0, c, units))} />
            )}
            {(placingDef || held) && (
              <div className="held">
                <span className="small">{held ? `Moving ${placingDef?.name}. Click a free spot to drop it.` : `Placing ${placingDef?.name}.`}</span>
                <div className="list-actions">
                  <button className="small-btn" onClick={() => setRot(!rot)}>Rotate</button>
                  <button className="small-btn" onClick={stopPlacing}>
                    {held ? "Cancel" : "Done"}
                  </button>
                  {heldSquad && !heldSquad.free && (
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
                  {heldSquad?.free && <span className="muted small">From your opening: free, so it can't be sold.</span>}
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
                <PromotionPanel squads={promotable} defs={defs} supply={match.supply[0]} onPromote={promote} promoteAll={promoteAll} onHover={(sq) => setHoverInfo(sq ? { def: squadDef(sq, 0)!, side: 0, squad: sq } : null)} />
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
                          const unlockCost = unlockPrice(u);
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
                                <span className="shop-cost lock" title={`Unlock ${unlockCost}, then ${u.cost} per squad`}>
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
                {pvp ? "Your friend has unlocked" : "Enemy has unlocked"}
                {enemyOpening && ` · ${enemyOpening}`}
              </div>
              <div className="swatches">
                {enemyUnlocks.map((d) => (
                  <span
                    key={d.id}
                    className="unlock-chip"
                    title={d.name}
                    onMouseEnter={() => setHoverInfo({ def: d, side: 1 })}
                    onMouseLeave={() => setHoverInfo(null)}
                  >
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
              You took <b>{report.damage[0]}</b> · {pvp ? "Your friend" : "Enemy"} took <b>{report.damage[1]}</b>
            </p>
            {fought?.result && <PromotionsEarned result={fought.result} army={match.armies[0]} defs={defs} />}
            {fought?.result && view === "report" && (
              <MvpBoard result={fought.result} defs={defs} selected={pinned} onSelect={setPinned} onHover={setHoverSquad} />
            )}
            {match.phase === "over" ? (
              <>
                <h2>{match.hp[0] > 0 ? "You win the war!" : match.hp[1] > 0 ? "You have been defeated." : "Mutual ruin."}</h2>
                <button className="primary big" onClick={pvp ? rematch : restart}>
                  {pvp ? "Rematch" : "New game"}
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
        {!(compact && deploying) && <div className="spacer" />}
        {deploying && !compact && (
          <p className="hint">
            Click a unit, then click your (blue) zone to place it; <b>Esc</b> stops placing. <b>Right-click</b> or <b>R</b> rotates. Click a green-outlined squad to move
            it; <b>Delete</b> sells it. <b>Ctrl+Z</b> undoes your last purchase. 🔒 units cost a one-time unlock per match. Click a squad with a gold ▲ to promote it.
          </p>
        )}
        {!(compact && deploying) && gameOpts}
        {!compact && aiNote}
      </aside>

      {loveLetter && <LoveLetter onClose={() => setLoveLetter(false)} />}

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

// Promote every veteran of one unit at once, while supply lasts. Only offered when more than one of its squads has a level waiting.
interface PromoteAll {
  count: number;
  price: number;
  cheapest: number;
  onClick: () => void;
}

// In the Promotions list, `def` shows which unit it promotes.
function PromoteAllButton({ all, supply, def }: { all: PromoteAll; supply: number; def?: UnitDef }) {
  return (
    <button
      className="small-btn promote-btn"
      disabled={all.cheapest > supply}
      title={all.price > supply ? "Promotes as many as you can afford" : undefined}
      onClick={all.onClick}
    >
      {def ? (
        <>
          <Swatch def={def} size={14} /> Promote all {def.name} ×{all.count}
        </>
      ) : (
        `Promote all ${all.count}`
      )}{" "}
      · {all.price}
    </button>
  );
}

// XP and level of a placed squad, with a Promote button when a level is waiting.
function Veterancy({
  squad,
  canBuy,
  price,
  supply,
  onPromote,
  promoteAll,
}: {
  squad: PlacedSquad;
  canBuy: boolean;
  price: number;
  supply: number;
  onPromote: () => void;
  promoteAll?: PromoteAll;
}) {
  const level = squad.level ?? 1;
  const xp = squad.xp ?? 0;
  const earned = earnedLevel(xp, RULES);
  const next = xpForLevel(earned, RULES);
  return (
    <div className={`veterancy ${earned > level ? "ready" : ""}`}>
      <span>
        <b>Level {level}</b>{" "}
        <span className="muted small">
          {Math.round(xp).toLocaleString()} XP
          {earned > level ? " · full: promote to earn more" : next !== null ? ` / ${next.toLocaleString()} for level ${earned + 1}` : " (max)"}
        </span>
      </span>
      {earned > level &&
        (canBuy ? (
          <span className="promote-btns">
            <button className="small-btn promote-btn" disabled={price > supply} onClick={onPromote}>
              Promote to Lv {level + 1} · {price}
            </button>
            {promoteAll && <PromoteAllButton all={promoteAll} supply={supply} />}
          </span>
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
  promoteAll,
}: {
  squads: PlacedSquad[];
  defs: DefMap;
  supply: number;
  onPromote: (sq: PlacedSquad) => void;
  onHover: (sq: PlacedSquad | null) => void;
  promoteAll: (defId: string) => PromoteAll | undefined;
}) {
  if (!squads.length) return null;
  // grouped by unit, each group led by its Promote all
  const order = [...new Set(squads.map((sq) => sq.defId))];
  const grouped = [...squads].sort((a, b) => order.indexOf(a.defId) - order.indexOf(b.defId));
  return (
    <div className="promotions">
      <div className="promo-note small">
        Veterans who earned a level. A promotion costs <b>half a new squad</b> and adds as much HP and damage as a whole new one: the cheapest
        way to grow your army.
      </div>
      {grouped.map((sq, i) => {
        const def = defs.get(sq.defId)!;
        const price = promotePrice(def);
        const level = sq.level ?? 1;
        const all = grouped[i - 1]?.defId !== sq.defId ? promoteAll(sq.defId) : undefined;
        return (
          <Fragment key={sq.uid}>
          {all && <PromoteAllButton all={all} supply={supply} def={def} />}
          <button
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
              ×{level + 1} HP and damage · a new squad costs {def.cost}
            </span>
          </button>
          </Fragment>
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

// The round-1 choice: one of three packs (two units unlocked, their squads placed, plus supply), or flat supply.
function OpeningOffer({ packs, units, rival, onChoose }: { packs: number[]; units: UnitDef[]; rival: string; onChoose: (c: OpeningChoice) => void }) {
  return (
    <div className="opening">
      <div className="muted small">
        Opening: pick one ({rival} is offered the same). A pack&apos;s units come unlocked and placed for you, with{" "}
        {RULES.openingPackSupply} supply to spend.
      </div>
      <div className="opening-buttons">
        {packs.map((i) => (
          <button key={i} className="up-btn can-buy" onClick={() => onChoose(i)}>
            <span className="up-btn-head">
              <span className="up-name pack-units">
                {OPENING_PACKS[i].units.map((u) => {
                  const d = units.find((x) => x.id === u.id)!;
                  return (
                    <span key={u.id} className="pack-unit">
                      <Swatch def={d} size={14} /> {u.count > 1 ? `${u.count}× ` : ""}
                      {d.name}
                    </span>
                  );
                })}
              </span>
              <span className="up-price">+{RULES.openingPackSupply}</span>
            </span>
          </button>
        ))}
        <button className="up-btn can-buy" onClick={() => onChoose("flat")}>
          <span className="up-btn-head">
            <span className="up-name">War chest</span>
            <span className="up-price">+{RULES.openingFlat}</span>
          </span>
          <span className="up-desc">{RULES.openingFlat} supply and nothing unlocked: build exactly what you want.</span>
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

// A side's unlocked units beside its health bar. Hovering one shows its name and which upgrades it has.
function UnlockStrip({ units, owned, side, note }: { units: UnitDef[]; owned: UpgradeState; side: Side; note?: string | null }) {
  return (
    <div className={`hud-unlocks hud-unlocks-${side}`} aria-label={side === 0 ? "Your unlocks" : "Enemy unlocks"}>
      {units.map((d) => {
        const bought = owned[d.id] ?? [];
        return (
          <span key={d.id} className="unlock-chip" tabIndex={0}>
            <Swatch def={d} size={20} />
            {bought.length > 0 && <span className="unlock-count">{bought.length}</span>}
            <span className="unlock-tip" role="tooltip">
              <b>{d.name}</b>
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

// `hits` counts the strikes that have landed on it this tally; each one restarts the flash.
function HpBar({ label, hp, side, hits = 0 }: { label: string; hp: number; side: Side; hits?: number }) {
  const frac = Math.max(0, hp / RULES.startHp);
  return (
    <div className={`hp hp-${side}`}>
      <span>{label}</span>
      <div className="hp-track">
        <div className="hp-fill" style={{ width: `${frac * 100}%` }} />
        {hits > 0 && <div key={hits} className="hp-hit" />}
      </div>
      <span key={hits} className={`hp-num ${hits > 0 ? "hp-num-hit" : ""}`}>
        {hp}
      </span>
    </div>
  );
}

// Where each surviving squad stands when the battle ends and the damage it does to the other side, smallest first,
// in the local view (a PvP guest's battle runs in the host's view).
function survivorStrikes(b: Battle, result: BattleResult, defs: DefMap, flip: boolean): Strike[] {
  const sums = new Map<number, { x: number; y: number; n: number }>();
  for (const m of b.models) {
    if (!m.alive || m.summoned) continue;
    const p = sums.get(m.squad) ?? { x: 0, y: 0, n: 0 };
    p.x += m.x;
    p.y += m.y;
    p.n++;
    sums.set(m.squad, p);
  }
  const index = new Map(b.squads.map((sq, i) => [sq.uid, i]));
  const strikes: Strike[] = [];
  for (const side of [0, 1] as Side[]) {
    for (const sv of result.survivors[side]) {
      const p = sums.get(index.get(sv.uid) ?? -1);
      if (!p) continue;
      const x = p.x / p.n;
      const y = p.y / p.n;
      strikes.push({
        x: flip ? RULES.fieldW - x : x,
        y: flip ? RULES.fieldH - y : y,
        from: flip ? (side === 0 ? 1 : 0) : side,
        amount: survivorDamage(sv, defs),
        color: defs.get(sv.defId)?.look.color ?? "#ffffff",
      });
    }
  }
  return strikes.sort((a, b) => a.amount - b.amount);
}
