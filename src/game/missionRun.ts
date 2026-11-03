import { planTurn, type Line, type MissionDef, type Plan } from "../data/campaign";
import { DEFAULT_UNITS } from "../data/units";
import { Battle, type BattleResult } from "../sim/battle";
import type { PlacedSquad, Side } from "../sim/types";
import { canPlace, defMap, type DefMap } from "./army";
import { applyRound, applyTurn, canPromote, chooseOpening, nextRound, promotePrice, turnCost, type MatchState, type Turn } from "./match";
import { missionOutcome, missionPlan, missionSquads, newMissionMatch, scriptedTurn, type MissionOutcome } from "./mission";
import { prepareBattle } from "./pvp";

// A story mission played from a plan, the way the game plays it: each round the player buys that round's part of the
// plan (nothing once it runs out) and the enemy plays its script against what it saw. tests/campaign.test.tsx and
// `npm run mission` both use it. Anything a real player couldn't do (overspending, placing off the zone, a unit the
// mission doesn't offer) is reported in `problems`, round by round.

export interface RoundLog {
  round: number;
  winner: Side | null;
  time: number;
  damage: [number, number]; // taken by [player, enemy]
  keepsLost: number; // the player's
  hp: [number, number]; // after the round
  line?: Line; // what the enemy said as it deployed (EnemyTurn.line)
}

export interface MissionRun extends MissionOutcome {
  results: BattleResult[];
  rounds: RoundLog[];
  state: MatchState;
  problems: string[];
}

const DEFS = defMap(DEFAULT_UNITS);

// Squads that don't fit their side's zone, or overlap a squad already there (or a Keep, when the mission has them).
function misplaced(squads: PlacedSquad[], side: Side, existing: PlacedSquad[], towers: boolean, defs: DefMap): string[] {
  const out: string[] = [];
  const placed = [...existing];
  for (const sq of squads) {
    const d = defs.get(sq.defId);
    if (!d || !canPlace(d, sq.x, sq.y, side, placed, defs, undefined, sq.rot, towers)) out.push(`${sq.defId} at ${sq.x},${sq.y}`);
    placed.push(sq);
  }
  return out;
}

// The player's turn for a round of the plan, priced as the deploy screen prices it.
function playerTurn(m: MissionDef, state: MatchState, plan: Plan, problems: string[], defs: DefMap): MatchState {
  const t = planTurn(plan[state.round - 1]);
  const at = `round ${state.round}`;
  let s = state;
  if (state.round === 1 && m.opening) {
    if (t.opening === undefined) problems.push(`${at}: no opening chosen`);
    else s = chooseOpening(s, 0, t.opening === "flat" ? "flat" : s.openings[0].packs[t.opening], DEFAULT_UNITS);
  }
  const offered = new Set([...m.units, ...(m.shop ?? []), ...s.unlocked[0]]);
  const unlocks: string[] = [];
  const unlock = (id: string) => {
    if (!offered.has(id)) problems.push(`${at}: ${id} isn't offered`);
    else if (!s.unlocked[0].includes(id) && !unlocks.includes(id)) unlocks.push(id);
  };
  const squads = missionSquads(t.squads ?? [], s.round, "p");
  for (const sq of squads) unlock(sq.defId);
  for (const [unitId] of t.upgrades ?? []) unlock(unitId);
  if (t.upgrades?.length && !m.upgrades) problems.push(`${at}: upgrades in a mission without them`);
  if (t.keeps?.length && !m.towers) problems.push(`${at}: Keep levels without Keeps`);
  const bad = misplaced(squads, 0, s.armies[0], m.towers, defs);
  if (bad.length) problems.push(`${at}: misplaced ${bad.join(", ")}`);
  const turn: Turn = {
    army: [...s.armies[0], ...squads],
    unlocks,
    upgrades: (t.upgrades ?? []).map(([unitId, upgradeId]) => ({ unitId, upgradeId })),
    towerUpgrades: t.keeps ?? [],
  };
  // promotions with whatever is left, in army order
  if (t.promote) {
    let left = s.supply[0] - turnCost(s, 0, turn, defs);
    turn.army = turn.army.map((sq) => {
      const price = promotePrice(defs.get(sq.defId)!);
      if (!canPromote(sq) || price > left) return sq;
      left -= price;
      return { ...sq, level: (sq.level ?? 1) + 1 };
    });
  }
  const cost = turnCost(s, 0, turn, defs);
  if (cost > s.supply[0]) problems.push(`${at}: overspends (${cost} of ${s.supply[0]})`);
  return applyTurn(s, 0, turn, defs, cost);
}

export function runMission(m: MissionDef, plan: Plan, defs: DefMap = DEFS): MissionRun {
  let state = newMissionMatch(m);
  const results: BattleResult[] = [];
  const rounds: RoundLog[] = [];
  const problems: string[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const enemy = missionPlan(m, state);
    const line = scriptedTurn(m, state).line;
    state = playerTurn(m, state, plan, problems, defs);
    const bad = misplaced(enemy.squads, 1, state.armies[1], m.towers, defs);
    if (bad.length) problems.push(`round ${state.round}: enemy misplaced ${bad.join(", ")}`);
    for (const sq of enemy.squads) if (!m.enemy.units.includes(sq.defId)) problems.push(`round ${state.round}: ${sq.defId} isn't among the enemy's units`);
    state = applyTurn(state, 1, { army: [...state.armies[1], ...enemy.squads], unlocks: [], upgrades: enemy.upgrades, towerUpgrades: [] }, defs, 0);
    const f = prepareBattle(state, defs, 0);
    const result = new Battle(f.canon.defs, f.canon.armies, { seed: f.canon.seed, towerLevels: f.canon.towerLevels, towers: f.canon.towers, terrain: f.canon.terrain }).run();
    results.push(result);
    state = applyRound(state, result, defs);
    const h = state.history[state.history.length - 1];
    const keepsLost = Object.values(result.stats).filter((s) => s.structure && s.side === 0 && s.alive === 0).length;
    rounds.push({ round: h.round, winner: h.winner, time: result.time, damage: h.damage, keepsLost, hp: [...state.hp], line });
    if (state.phase === "over") return { ...missionOutcome(m, state, results), results, rounds, state, problems };
    state = nextRound(state);
  }
  throw new Error(`${m.id} never ended`);
}
