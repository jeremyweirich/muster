import { RULES } from "../data/rules";
import type { Line, MissionContext, MissionDef, SquadSpec } from "../data/campaign";
import type { BattleResult } from "../sim/battle";
import type { PlacedSquad } from "../sim/types";
import type { AiPlan } from "./ai";
import type { MatchState } from "./match";

// A story mission as an ordinary match (docs/CAMPAIGN.md §6): the mission's supply, units, HP, Keeps and map, and an
// enemy that plays a script instead of the AI.

export function missionSquads(specs: SquadSpec[], round: number, tag: string): PlacedSquad[] {
  return specs.map(([defId, x, y, rot], i) => ({ uid: `${tag}-${round}-${i}`, defId, x, y, rot: rot || undefined, round }));
}

// The squads the enemy's script adds in a round. `seen` is the player's army as the enemy saw it: squads placed in
// earlier rounds, as the AI sees it.
export function scriptedSquads(m: MissionDef, round: number, seen: PlacedSquad[]): SquadSpec[] {
  const r = m.enemy.rounds[round - 1];
  if (!r) return [];
  return typeof r === "function" ? r({ round, seen: seen.filter((sq) => sq.round < round) }) : r;
}

// A revealed round 1 is placed before the player deploys. Its squads count as round 0, so the deploy screen shows
// them the way it shows any army from an earlier round.
export function newMissionMatch(m: MissionDef): MatchState {
  return {
    round: 1,
    hp: m.hp ?? [1, 1], // one battle: the winner's survivors always deal at least RULES.damagePerSquad
    supply: [m.supply, 0],
    armies: [[], m.enemy.revealed ? missionSquads(scriptedSquads(m, 1, []), 0, "m") : []],
    unlocked: [[...m.units], [...m.enemy.units]],
    upgrades: [{}, { ...m.enemy.upgrades }],
    towerLevels: [RULES.towers.map(() => 0), RULES.towers.map(() => 0)],
    towers: m.towers,
    veterancy: m.veterancy,
    map: m.map,
    openings: [
      { packs: [], choice: null },
      { packs: [], choice: null },
    ],
    phase: "deploy",
    history: [],
  };
}

// The enemy's turn this round, from the state at the start of deployment: the script's squads (round 1's are
// already on the Field when revealed).
export function missionPlan(m: MissionDef, state: MatchState): AiPlan {
  const specs = state.round === 1 && m.enemy.revealed ? [] : scriptedSquads(m, state.round, state.armies[0]);
  return {
    squads: missionSquads(specs, state.round, "m"),
    unlocks: [],
    upgrades: [],
    towerUpgrades: [],
    promotions: [],
    spent: 0,
    candidatesTried: 0,
    bestScore: null,
  };
}

export interface MissionOutcome {
  won: boolean;
  commended: boolean;
  hint: Line | null; // after a loss
}

// Once the match is over: who won, the commendation, and a hint read from what the player fielded. `results` is
// every battle of the match, in order (the last is the one that ended it).
export function missionOutcome(m: MissionDef, state: MatchState, results: BattleResult[]): MissionOutcome {
  const won = state.hp[0] > 0 && state.hp[1] <= 0;
  const c: MissionContext = { army: state.armies[0], result: results[results.length - 1], results, towerLevels: state.towerLevels[0] };
  return {
    won,
    commended: won && !!m.commendation?.earned(c),
    hint: won ? null : (m.hints.find((h) => !h.when || h.when(c))?.line ?? null),
  };
}
