import { OPENING_PACKS } from "../data/openings";
import { mapTerrain } from "../data/terrain";
import { Battle } from "../sim/battle";
import { Rng } from "../sim/rng";
import type { Side, UnitDef } from "../sim/types";
import { promoted, type AiPlan, type Difficulty } from "./ai";
import type { AiRequest } from "./ai.worker";
import type { DefMap } from "./army";
import { applyRound, applyTurn, chooseOpening, newMatch, type MatchState, type Turn } from "./match";
import { prepareBattle, turnArmy, type Fought } from "./pvp";

// The AI playing itself, for watching (the debug panel's Spectate). The planner always plans as side 1, the top of
// the field, so side 0 sees the match turned round, as a PvP guest does; the 180° turn maps each Keep to its twin.

// A new match where both sides take an opening pack, as the AI always does.
export function spectateMatch(units: UnitDef[], seed: number): MatchState {
  const m = newMatch(units, seed);
  return chooseOpening(m, 0, new Rng(seed * 17 + 3).pick(m.openings[0].packs), units, seed);
}

// What one side's planner is asked this round, seen from the top of the field.
export function spectateRequest(state: MatchState, side: Side, units: UnitDef[], defs: DefMap, difficulty: Difficulty, seed: number): AiRequest {
  const other: Side = side === 0 ? 1 : 0;
  const view = side === 0 ? (army: MatchState["armies"][0]) => turnArmy(army, defs) : (army: MatchState["armies"][0]) => army;
  return {
    id: state.round,
    units,
    me: { army: view(state.armies[side]), unlocked: state.unlocked[side], upgrades: state.upgrades[side], towerLevels: state.towerLevels[side], supply: state.supply[side] },
    // round 1's opening squads stay hidden until the battle, as they do from the player
    player: {
      army: view(state.armies[other].filter((sq) => sq.round < state.round)),
      upgrades: state.upgrades[other],
      towerLevels: state.towerLevels[other],
      unlocked: state.round > 1 ? state.unlocked[other] : [],
    },
    round: state.round,
    difficulty,
    seed: seed + state.round * 7919 + side * 104729,
    opts: { openingPacks: state.openings[side].packs.map((i) => OPENING_PACKS[i]), terrain: mapTerrain(state.map) },
  };
}

// A plan as a turn on its own side of the field.
export function planTurn(state: MatchState, side: Side, plan: AiPlan, defs: DefMap): Turn {
  const squads = side === 0 ? turnArmy(plan.squads, defs) : plan.squads;
  return { army: [...promoted(state.armies[side], plan.promotions), ...squads], unlocks: plan.unlocks, upgrades: plan.upgrades, towerUpgrades: plan.towerUpgrades };
}

export interface SpectatedRound {
  plans: [AiPlan, AiPlan];
  start: MatchState; // the round before either side deployed
  fought: Fought; // both turns applied, with the battle's result
  after: MatchState; // the round's damage and XP taken
}

// Both plans applied and the battle fought (headless: the result is known before it's watched).
export function playSpectatedRound(start: MatchState, plans: [AiPlan, AiPlan], defs: DefMap): SpectatedRound {
  let s = start;
  for (const side of [0, 1] as Side[]) s = applyTurn(s, side, planTurn(start, side, plans[side], defs), defs, plans[side].spent);
  const fought = prepareBattle(s, defs, 0);
  const result = new Battle(fought.defs, fought.armies, { seed: fought.seed, towerLevels: fought.towerLevels, terrain: fought.terrain }).run();
  return { plans, start, fought: { ...fought, result }, after: applyRound({ ...s, phase: "battle" }, result, defs) };
}
