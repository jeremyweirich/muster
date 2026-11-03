import { OPENING_PACKS } from "../data/openings";
import { RULES } from "../data/rules";
import type { EnemyTurn, Line, MissionContext, MissionDef, SquadSpec } from "../data/campaign";
import type { BattleResult } from "../sim/battle";
import type { PlacedSquad } from "../sim/types";
import type { AiPlan } from "./ai";
import type { MatchState } from "./match";

// A story mission as an ordinary match (docs/CAMPAIGN.md §6): the mission's supply, units, HP, Keeps and map, and an
// enemy that plays a script instead of the AI.

export function missionSquads(specs: SquadSpec[], round: number, tag: string): PlacedSquad[] {
  return specs.map(([defId, x, y, rot, level], i) => ({ uid: `${tag}-${round}-${i}`, defId, x, y, rot: rot || undefined, round, level: level && level > 1 ? level : undefined }));
}

// What the enemy's script adds in a round, from the state at the start of its deployment: `seen` is the player's
// army as the enemy saw it (squads placed in earlier rounds, as the AI sees it).
export function scriptedTurn(m: MissionDef, state: Pick<MatchState, "round" | "armies" | "upgrades" | "history">): EnemyTurn {
  const r = m.enemy.rounds[state.round - 1];
  if (!r) return { squads: [] };
  const seen = state.armies[0].filter((sq) => sq.round < state.round);
  const winners = state.history.map((h) => h.winner);
  const lost = winners.filter((w) => w === 0).length;
  const t = typeof r === "function" ? r({ round: state.round, seen, upgrades: state.upgrades[0], winners, lost, own: state.armies[1] }) : r;
  return Array.isArray(t) ? { squads: t } : t;
}

// A mission's opening packs, as OPENING_PACKS indexes.
export function missionPacks(m: MissionDef): number[] {
  return (m.opening ?? []).map(([a, b]) => {
    const i = OPENING_PACKS.findIndex((p) => p.units.length === 2 && p.units.some((u) => u.id === a) && p.units.some((u) => u.id === b));
    if (i < 0) throw new Error(`no opening pack of ${a} and ${b}`);
    return i;
  });
}

// A revealed round 1 is placed before the player deploys. Its squads count as round 0, so the deploy screen shows
// them the way it shows any army from an earlier round.
export function newMissionMatch(m: MissionDef): MatchState {
  const start = { round: 1, armies: [[], []] as [PlacedSquad[], PlacedSquad[]], upgrades: [{}, {}] as MatchState["upgrades"], history: [] };
  return {
    round: 1,
    hp: m.hp ?? [1, 1], // one battle: the winner's survivors always deal at least RULES.damagePerSquad
    supply: [m.supply, 0],
    armies: [[], m.enemy.revealed ? missionSquads(scriptedTurn(m, start).squads, 0, "m") : []],
    unlocked: [[...m.units], [...m.enemy.units]],
    upgrades: [{}, { ...m.enemy.upgrades }],
    towerLevels: [RULES.towers.map(() => 0), RULES.towers.map(() => 0)],
    towers: m.towers,
    veterancy: m.veterancy,
    map: m.map,
    openings: [
      { packs: missionPacks(m), choice: null },
      { packs: [], choice: null },
    ],
    phase: "deploy",
    history: [],
  };
}

// The enemy's turn this round, from the state at the start of deployment: the script's squads (round 1's are
// already on the Field when revealed) and the upgrades it buys.
export function missionPlan(m: MissionDef, state: MatchState): AiPlan {
  const t: EnemyTurn = state.round === 1 && m.enemy.revealed ? { squads: [] } : scriptedTurn(m, state);
  const upgrades = Object.entries(t.upgrades ?? {}).flatMap(([unitId, ids]) =>
    ids.filter((id) => !state.upgrades[1][unitId]?.includes(id)).map((upgradeId) => ({ unitId, upgradeId })),
  );
  return {
    squads: missionSquads(t.squads, state.round, "m"),
    unlocks: [],
    upgrades,
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
  const c: MissionContext = { army: state.armies[0], result: results[results.length - 1], results, towerLevels: state.towerLevels[0], upgrades: state.upgrades[0] };
  return {
    won,
    commended: won && !!m.commendation?.earned(c),
    hint: won ? null : (m.hints.find((h) => !h.when || h.when(c))?.line ?? null),
  };
}
