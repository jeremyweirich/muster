import { RULES } from "../data/rules";
import type { BattleResult } from "../sim/battle";
import type { UpgradeState } from "../sim/upgrades";
import { capXp, earnedLevel } from "../sim/levels";
import { Rng } from "../sim/rng";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { OPENING_PACKS, type OpeningPack } from "../data/openings";
import { autoPlace, defMap, type DefMap } from "./army";

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
// read. The player chooses during round 1.
export function newMatch(units: UnitDef[], seed = 1): MatchState {
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
  state = chooseOpening(state, 1, rng.pick(packs), units, seed);
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

export function applyRound(state: MatchState, result: BattleResult, defs: DefMap): MatchState {
  const damage = roundDamage(result, defs);
  const hp: [number, number] = [Math.max(0, state.hp[0] - damage[0]), Math.max(0, state.hp[1] - damage[1])];
  const report: RoundReport = { round: state.round, winner: result.winner, timedOut: result.timedOut, damage };
  const gain = (army: PlacedSquad[]) =>
    army.map((sq) => ({ ...sq, xp: capXp((sq.xp ?? 0) + battleXp(result, sq.uid), sq.level ?? 1, RULES) || undefined }));
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
