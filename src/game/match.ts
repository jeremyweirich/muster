import { RULES } from "../data/rules";
import type { BattleResult } from "../sim/battle";
import type { UpgradeState } from "../sim/upgrades";
import { capXp, earnedLevel } from "../sim/levels";
import { Rng } from "../sim/rng";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { startingUnlocks, type DefMap, type UnlockDiscounts } from "./army";

export type Phase = "deploy" | "battle" | "result" | "over";

export interface RoundReport {
  round: number;
  winner: Side | null;
  timedOut: boolean;
  damage: [number, number]; // damage taken by [player, ai]
}

// A small, fair bit of variety at the start of each match: both sides are offered the same
// random unit with RULES.openingDiscount off its unlock, or RULES.openingBonus supply.
// Sharing the unit lets each side guess what the other might build.
export interface Opening {
  unitId: string | null; // the unit offered a cheaper unlock (null if no unit qualifies)
  choice: "discount" | "bonus" | null;
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

export function openingPool(units: UnitDef[]): UnitDef[] {
  return units.filter((u) => (u.unlockCost ?? 0) >= RULES.openingMinUnlock);
}

// The AI (side 1) takes its opening straight away; the player chooses during round 1.
export function newMatch(units: UnitDef[], seed = 1): MatchState {
  const income = RULES.income(1);
  const start = startingUnlocks(units);
  const rng = new Rng(seed);
  const pool = openingPool(units);
  const unitId = pool.length ? rng.pick(pool).id : null;
  const offer = (): Opening => ({ unitId, choice: null });
  let state: MatchState = {
    round: 1,
    hp: [RULES.startHp, RULES.startHp],
    supply: [income, income],
    armies: [[], []],
    unlocked: [start, [...start]],
    upgrades: [{}, {}],
    towerLevels: [RULES.towers.map(() => 0), RULES.towers.map(() => 0)],
    openings: [offer(), offer()],
    phase: "deploy",
    history: [],
  };
  state = chooseOpening(state, 1, state.openings[1].unitId && rng.next() < 0.5 ? "discount" : "bonus");
  return state;
}

export function chooseOpening(state: MatchState, side: Side, choice: "discount" | "bonus"): MatchState {
  const cur = state.openings[side];
  if (cur.choice || (choice === "discount" && !cur.unitId)) return state;
  const openings: [Opening, Opening] = [...state.openings];
  openings[side] = { ...cur, choice };
  const supply: [number, number] = [...state.supply];
  if (choice === "bonus") supply[side] += RULES.openingBonus;
  return { ...state, openings, supply };
}

export function unlockDiscounts(state: MatchState, side: Side): UnlockDiscounts {
  const o = state.openings[side];
  return o.choice === "discount" && o.unitId ? { [o.unitId]: RULES.openingDiscount } : {};
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
