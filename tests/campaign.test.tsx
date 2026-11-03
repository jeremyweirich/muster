import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAST, MISSIONS, planKeeps, planSquads, type MissionDef, type Plan, type SquadSpec } from "../src/data/campaign";
import { DEFAULT_UNITS } from "../src/data/units";
import { canPlace, defMap, towerUpgradePrice } from "../src/game/army";
import { applyRound, applyTurn, nextRound, type MatchState } from "../src/game/match";
import { missionOutcome, missionPlan, missionSquads, newMissionMatch } from "../src/game/mission";
import { prepareBattle } from "../src/game/pvp";
import { Battle, type BattleResult } from "../src/sim/battle";
import type { PlacedSquad, Side } from "../src/sim/types";
import { CodexView } from "../src/ui/CodexView";
import { Briefing } from "../src/ui/Mission";

const defs = defMap(DEFAULT_UNITS);

// Squads that don't fit their side's zone, or overlap a squad already there (or a Keep, when the mission has them).
function misplaced(squads: PlacedSquad[], side: Side, existing: PlacedSquad[], towers: boolean): string[] {
  const problems: string[] = [];
  const placed = [...existing];
  for (const sq of squads) {
    const def = defs.get(sq.defId);
    if (!def) problems.push(`unknown unit ${sq.defId}`);
    else if (!canPlace(def, sq.x, sq.y, side, placed, defs, undefined, sq.rot, towers)) problems.push(`${sq.defId} at ${sq.x},${sq.y}`);
    placed.push(sq);
  }
  return problems;
}

const cost = (specs: SquadSpec[]) => specs.reduce((n, [id]) => n + (defs.get(id)?.cost ?? 0), 0);

// The mission as the game plays it: each round the player adds that round's squads from `plan` (nothing once the
// plan runs out) and the enemy plays its script against what it saw. Checks both sides' placements and the
// player's supply on the way, and returns the outcome and every battle.
function play(m: MissionDef, plan: Plan) {
  let state: MatchState = newMissionMatch(m);
  const results: BattleResult[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const enemy = missionPlan(m, state);
    const round = plan[state.round - 1];
    const mine = missionSquads(planSquads(round), state.round, "p");
    expect(misplaced(mine, 0, state.armies[0], m.towers), `my round ${state.round}`).toEqual([]);
    expect(misplaced(enemy.squads, 1, state.armies[1], m.towers), `enemy round ${state.round}`).toEqual([]);
    for (const sq of enemy.squads) expect(m.enemy.units, `${sq.defId} isn't among the enemy's units`).toContain(sq.defId);
    const levels = [...state.towerLevels[0]];
    let spent = cost(planSquads(round));
    for (const k of planKeeps(round)) {
      expect(m.towers, "Keep levels without Keeps").toBe(true);
      spent += towerUpgradePrice(levels[k]) ?? Infinity;
      levels[k]++;
    }
    expect(spent, `round ${state.round} overspends`).toBeLessThanOrEqual(state.supply[0]);
    state = {
      ...state,
      armies: [[...state.armies[0], ...mine], state.armies[1]],
      supply: [state.supply[0] - spent, state.supply[1]],
      towerLevels: [levels, state.towerLevels[1]],
    };
    state = applyTurn(state, 1, { army: [...state.armies[1], ...enemy.squads], unlocks: [], upgrades: [], towerUpgrades: [] }, defs, 0);
    const f = prepareBattle(state, defs, 0);
    const result = new Battle(f.canon.defs, f.canon.armies, { seed: f.canon.seed, towerLevels: f.canon.towerLevels, towers: f.canon.towers, terrain: f.canon.terrain }).run();
    results.push(result);
    state = applyRound(state, result, defs);
    if (state.phase === "over") return { ...missionOutcome(m, state, results), results, state };
    state = nextRound(state);
  }
  throw new Error(`${m.id} never ended`);
}

describe("story missions", () => {
  it("has at least one playable mission, with unique ids", () => {
    expect(MISSIONS.length).toBeGreaterThan(0);
    expect(new Set(MISSIONS.map((m) => m.def.id)).size).toBe(MISSIONS.length);
  });

  for (const { def: m } of MISSIONS) {
    describe(m.id, () => {
      it("uses real units, a real cast and a hint for every loss", () => {
        for (const id of [...m.units, ...(m.shop ?? []), ...m.enemy.units]) expect(defs.has(id), id).toBe(true);
        for (const rank of m.page.diagram ?? []) for (const id of rank) expect(defs.has(id), id).toBe(true);
        for (const l of [...m.briefing, ...m.win, ...m.hints.map((h) => h.line)]) expect(CAST[l.who]).toBeDefined();
        expect(m.hints.some((h) => !h.when), "a loss always gets a hint").toBe(true);
        for (const plan of [...m.reference.wins, ...m.reference.loses]) for (const round of plan) for (const [id] of planSquads(round)) expect(m.units, id).toContain(id);
      });

      // whole matches, several per mission: CI runs several times slower than a desktop
      it("the armies that should win do, and the ones that should lose do", { timeout: 30_000 }, () => {
        m.reference.wins.forEach((plan, i) => expect(play(m, plan).won, `wins[${i}]`).toBe(true));
        m.reference.loses.forEach((plan, i) => expect(play(m, plan).won, `loses[${i}]`).toBe(false));
        if (m.reference.commended) expect(play(m, m.reference.commended).commended).toBe(true);
      });

      it("a lost mission's debrief has a hint", () => {
        expect(play(m, m.reference.loses[0]).hint).not.toBeNull();
      });
    });
  }

  it("every Codex link in a briefing has a target", () => {
    const codex = renderToStaticMarkup(<CodexView />);
    for (const entry of MISSIONS) {
      const html = renderToStaticMarkup(<Briefing entry={entry} onStart={() => {}} onBack={() => {}} />);
      for (const [, topic] of html.matchAll(/href="#codex\/([^"]+)"/g)) expect(codex, topic).toContain(`id="codex-${topic}"`);
    }
  });
});

