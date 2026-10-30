import { RULES } from "../data/rules";
import type { BattleResult } from "../sim/battle";
import type { UpgradeState } from "../sim/upgrades";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { startingUnlocks, type DefMap } from "./army";

export type Phase = "deploy" | "battle" | "result" | "over";

export interface RoundReport {
  round: number;
  winner: Side | null;
  timedOut: boolean;
  damage: [number, number]; // damage taken by [player, ai]
}

export interface MatchState {
  round: number;
  hp: [number, number];
  supply: [number, number];
  armies: [PlacedSquad[], PlacedSquad[]];
  unlocked: [string[], string[]];
  upgrades: [UpgradeState, UpgradeState];
  towerLevels: [number[], number[]];
  phase: Phase;
  history: RoundReport[];
}

export function newMatch(units: UnitDef[]): MatchState {
  const income = RULES.income(1);
  const start = startingUnlocks(units);
  return {
    round: 1,
    hp: [RULES.startHp, RULES.startHp],
    supply: [income, income],
    armies: [[], []],
    unlocked: [start, [...start]],
    upgrades: [{}, {}],
    towerLevels: [RULES.towers.map(() => 0), RULES.towers.map(() => 0)],
    phase: "deploy",
    history: [],
  };
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

export function applyRound(state: MatchState, result: BattleResult, defs: DefMap): MatchState {
  const damage = roundDamage(result, defs);
  const hp: [number, number] = [Math.max(0, state.hp[0] - damage[0]), Math.max(0, state.hp[1] - damage[1])];
  const report: RoundReport = { round: state.round, winner: result.winner, timedOut: result.timedOut, damage };
  return {
    ...state,
    hp,
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
