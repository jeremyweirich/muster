import { RULES } from "../data/rules";
import type { BattleResult } from "../sim/battle";
import type { UpgradeState } from "../sim/upgrades";
import { capXp, earnedLevel } from "../sim/levels";
import { Rng } from "../sim/rng";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { OPENING_PACKS, type OpeningPack } from "../data/openings";
import { autoPlace, defMap, towerUpgradePrice, unlockPrice, upgradePrice, type DefMap } from "./army";

export type Phase = "deploy" | "battle" | "result" | "over";

export interface RoundReport {
  round: number;
  winner: Side | null;
  timedOut: boolean;
  damage: [number, number]; // damage taken by [player, ai]
}

// A small, fair bit of variety at the start of each match: both sides are offered the same three packs (two units,
// unlocked, with squads already placed, plus some supply) or flat supply with nothing unlocked. Sharing the offer
// lets each side guess what the other might start with.
export type OpeningChoice = number | "flat"; // a pack's index in OPENING_PACKS, or the flat supply

export interface Opening {
  packs: number[]; // indexes into OPENING_PACKS
  choice: OpeningChoice | null;
}

export interface MatchState {
  round: number;
  hp: [number, number];
  supply: [number, number];
  armies: [PlacedSquad[], PlacedSquad[]];
  unlocked: [string[], string[]];
  upgrades: [UpgradeState, UpgradeState];
  towerLevels: [number[], number[]];
  openings: [Opening, Opening];
  phase: Phase;
  history: RoundReport[];
}

export function packSquads(pack: OpeningPack, units: UnitDef[]): UnitDef[] {
  return pack.units.flatMap((u) => Array(u.count).fill(units.find((d) => d.id === u.id)!));
}

// "Knights + 2 Crossbowmen"
export function packLabel(pack: OpeningPack, units: UnitDef[]): string {
  return pack.units.map((u) => `${u.count > 1 ? `${u.count} ` : ""}${units.find((d) => d.id === u.id)?.name ?? u.id}`).join(" + ");
}

// The AI (side 1) takes its opening straight away: always a pack, never the war chest, so its opening is easier to
// read. The player chooses during round 1. In PvP (`aiOpening: false`) both sides choose.
export function newMatch(units: UnitDef[], seed = 1, opts: { aiOpening?: boolean } = {}): MatchState {
  const rng = new Rng(seed);
  const pool = OPENING_PACKS.map((_, i) => i);
  const packs: number[] = [];
  while (packs.length < Math.min(RULES.openingChoices, pool.length)) packs.push(pool.splice(rng.int(pool.length), 1)[0]);
  let state: MatchState = {
    round: 1,
    hp: [RULES.startHp, RULES.startHp],
    supply: [RULES.income(1), RULES.income(1)],
    armies: [[], []],
    unlocked: [[], []],
    upgrades: [{}, {}],
    towerLevels: [RULES.towers.map(() => 0), RULES.towers.map(() => 0)],
    openings: [{ packs, choice: null }, { packs: [...packs], choice: null }],
    phase: "deploy",
    history: [],
  };
  const aiPack = rng.pick(packs);
  if (opts.aiOpening !== false) state = chooseOpening(state, 1, aiPack, units, seed);
  return state;
}

// Take an opening: the flat supply, or a pack's supply, unlocks and squads (placed for you, and free, so not sellable).
export function chooseOpening(state: MatchState, side: Side, choice: OpeningChoice, units: UnitDef[], seed = 1): MatchState {
  const cur = state.openings[side];
  if (cur.choice !== null || (choice !== "flat" && !cur.packs.includes(choice))) return state;
  const openings: [Opening, Opening] = [...state.openings];
  openings[side] = { ...cur, choice };
  const supply: [number, number] = [...state.supply];
  const unlocked: [string[], string[]] = [...state.unlocked];
  const armies: [PlacedSquad[], PlacedSquad[]] = [...state.armies];
  if (choice === "flat") supply[side] += RULES.openingFlat;
  else {
    const pack = OPENING_PACKS[choice];
    supply[side] += RULES.openingPackSupply;
    unlocked[side] = [...new Set([...unlocked[side], ...pack.units.map((u) => u.id)])];
    const placed = autoPlace(packSquads(pack, units), armies[side], side, defMap(units), state.round, new Rng(seed * 31 + side), "center");
    armies[side] = [...armies[side], ...placed.map((q) => ({ ...q, free: true }))];
  }
  return { ...state, openings, supply, unlocked, armies };
}

// Each round's battle seed. Both PvP browsers derive it the same way.
export function roundSeed(round: number): number {
  return round * 104729 + 7;
}

// Damage each side takes from the other's survivors.
export function roundDamage(result: BattleResult, defs: DefMap): [number, number] {
  const dmgFrom = (side: Side) => {
    let total = 0;
    for (const s of result.survivors[side]) {
      const cost = defs.get(s.defId)?.cost ?? 0;
      total += cost * (s.alive / s.total) * RULES.damagePerSupply + RULES.damagePerSquad;
    }
    return Math.round(total);
  };
  return [dmgFrom(1), dmgFrom(0)];
}

// XP a squad earned in a battle: damage dealt to enemies plus healing done.
export function battleXp(result: BattleResult, uid: string): number {
  const s = result.stats[uid];
  return s ? Math.round(s.dealt + s.healed) : 0;
}

// Squads whose XP unlocks a level they haven't been promoted to yet.
export function canPromote(sq: PlacedSquad): boolean {
  return earnedLevel(sq.xp ?? 0, RULES) > (sq.level ?? 1);
}

// Promotions cost half the unit's base price, every level: a reward for the XP it took.
export function promotePrice(def: UnitDef): number {
  return Math.round(def.cost / 2);
}

// What a battle changes in the match: who won, the damage each side takes, and the XP each squad earned.
export interface RoundOutcome {
  winner: Side | null;
  timedOut: boolean;
  damage: [number, number]; // damage taken by [side 0, side 1]
  xp: Record<string, number>; // squad uid -> XP earned
}

export function outcomeOf(result: BattleResult, defs: DefMap): RoundOutcome {
  const xp: Record<string, number> = {};
  for (const [uid, s] of Object.entries(result.stats)) {
    const gained = battleXp(result, uid);
    if (!s.structure && gained) xp[uid] = gained;
  }
  return { winner: result.winner, timedOut: result.timedOut, damage: roundDamage(result, defs), xp };
}

export function applyRound(state: MatchState, result: BattleResult, defs: DefMap): MatchState {
  return applyOutcome(state, outcomeOf(result, defs));
}

export function applyOutcome(state: MatchState, outcome: RoundOutcome): MatchState {
  const { damage } = outcome;
  const hp: [number, number] = [Math.max(0, state.hp[0] - damage[0]), Math.max(0, state.hp[1] - damage[1])];
  const report: RoundReport = { round: state.round, winner: outcome.winner, timedOut: outcome.timedOut, damage };
  const gain = (army: PlacedSquad[]) =>
    army.map((sq) => ({ ...sq, xp: capXp((sq.xp ?? 0) + (outcome.xp[sq.uid] ?? 0), sq.level ?? 1, RULES) || undefined }));
  return {
    ...state,
    hp,
    armies: [gain(state.armies[0]), gain(state.armies[1])],
    phase: hp[0] <= 0 || hp[1] <= 0 ? "over" : "result",
    history: [...state.history, report],
  };
}

export function nextRound(state: MatchState): MatchState {
  const round = state.round + 1;
  const income = RULES.income(round);
  return {
    ...state,
    round,
    supply: [state.supply[0] + income, state.supply[1] + income],
    phase: "deploy",
  };
}

// One side's deployment for a round, as a delta from the round's start: the whole army as it will fight, plus what
// was bought. The AI's plan and a PvP friend's message both become one of these.
export interface Turn {
  opening?: OpeningChoice; // round 1 only
  army: PlacedSquad[];
  unlocks: string[]; // bought this round (a pack's units come with the opening, not here)
  upgrades: { unitId: string; upgradeId: string }[]; // in the order bought
  towerUpgrades: number[]; // tower indexes, one entry per level bought
}

// The supply a turn spends, priced as the deploy screen prices it: new squads (not the opening's free ones), unlocks,
// upgrades and tower levels in the order bought, and promotions.
export function turnCost(state: MatchState, side: Side, turn: Turn, defs: DefMap): number {
  const before = new Map(state.armies[side].map((sq) => [sq.uid, sq]));
  let cost = 0;
  for (const sq of turn.army) {
    const def = defs.get(sq.defId);
    if (!def) continue;
    const prev = before.get(sq.uid);
    if (!prev && !sq.free) cost += def.cost;
    cost += Math.max(0, (sq.level ?? 1) - (prev?.level ?? 1)) * promotePrice(def);
  }
  for (const id of turn.unlocks) {
    const def = defs.get(id);
    if (def) cost += unlockPrice(def);
  }
  const bought: Record<string, number> = {};
  for (const u of turn.upgrades) {
    const def = defs.get(u.unitId);
    const n = (bought[u.unitId] ??= (state.upgrades[side][u.unitId] ?? []).length);
    cost += (def && upgradePrice(def, n)) ?? 0;
    bought[u.unitId]++;
  }
  const levels = [...state.towerLevels[side]];
  for (const i of turn.towerUpgrades) {
    cost += towerUpgradePrice(levels[i] ?? 0) ?? 0;
    levels[i] = (levels[i] ?? 0) + 1;
  }
  return cost;
}

// Apply a side's turn: its opening (supply and unlocks; the pack's squads are in the army), purchases and army.
// `spent` defaults to the turn's price; the AI passes its own count.
export function applyTurn(state: MatchState, side: Side, turn: Turn, defs: DefMap, spent?: number): MatchState {
  let s = state;
  if (turn.opening !== undefined && s.openings[side].choice === null) {
    const openings: [Opening, Opening] = [...s.openings];
    openings[side] = { ...openings[side], choice: turn.opening };
    const supply: [number, number] = [...s.supply];
    const unlocked: [string[], string[]] = [...s.unlocked];
    if (turn.opening === "flat") supply[side] += RULES.openingFlat;
    else {
      supply[side] += RULES.openingPackSupply;
      unlocked[side] = [...new Set([...unlocked[side], ...OPENING_PACKS[turn.opening].units.map((u) => u.id)])];
    }
    s = { ...s, openings, supply, unlocked };
  }
  const cost = spent ?? turnCost(s, side, turn, defs);
  const pick = <T,>(pair: [T, T], value: T): [T, T] => (side === 0 ? [value, pair[1]] : [pair[0], value]);
  const upgrades = { ...s.upgrades[side] };
  for (const u of turn.upgrades) upgrades[u.unitId] = [...(upgrades[u.unitId] ?? []), u.upgradeId];
  const levels = [...s.towerLevels[side]];
  for (const i of turn.towerUpgrades) levels[i]++;
  return {
    ...s,
    armies: pick(s.armies, turn.army),
    supply: pick(s.supply, s.supply[side] - cost),
    unlocked: pick(s.unlocked, [...new Set([...s.unlocked[side], ...turn.unlocks])]),
    upgrades: pick(s.upgrades, upgrades),
    towerLevels: pick(s.towerLevels, levels),
  };
}
