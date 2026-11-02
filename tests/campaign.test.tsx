import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAST, MISSIONS, type MissionDef, type SquadSpec } from "../src/data/campaign";
import { deployZone } from "../src/data/rules";
import { DEFAULT_UNITS } from "../src/data/units";
import { canPlace, defMap } from "../src/game/army";
import { applyRound, applyTurn, nextRound } from "../src/game/match";
import { missionOutcome, missionPlan, missionSquads, newMissionMatch } from "../src/game/mission";
import { prepareBattle } from "../src/game/pvp";
import { Battle } from "../src/sim/battle";
import type { PlacedSquad, Side } from "../src/sim/types";
import { CodexView } from "../src/ui/CodexView";
import { Briefing } from "../src/ui/Mission";

const defs = defMap(DEFAULT_UNITS);

// Every squad fits its side's zone without overlapping another (or a Keep, when the mission has them).
function placeable(specs: SquadSpec[], side: Side, towers: boolean): string[] {
  const problems: string[] = [];
  const placed: PlacedSquad[] = [];
  for (const sq of missionSquads(specs, 1, `t${side}`)) {
    const def = defs.get(sq.defId);
    if (!def) problems.push(`unknown unit ${sq.defId}`);
    else if (!canPlace(def, sq.x, sq.y, side, placed, defs, undefined, sq.rot, towers)) problems.push(`${sq.defId} at ${sq.x},${sq.y}`);
    placed.push(sq);
  }
  return problems;
}

// The mission as the game plays it: the player fields `army` in round 1 and adds nothing after; the enemy plays its
// script. Returns the outcome once the match is over.
function play(m: MissionDef, army: SquadSpec[]) {
  let state = newMissionMatch(m);
  state = { ...state, armies: [missionSquads(army, 1, "p"), state.armies[1]] };
  for (let guard = 0; guard < 20; guard++) {
    const plan = missionPlan(m, state.round);
    state = applyTurn(state, 1, { army: [...state.armies[1], ...plan.squads], unlocks: [], upgrades: [], towerUpgrades: [] }, defs, 0);
    const f = prepareBattle(state, defs, 0);
    const result = new Battle(f.canon.defs, f.canon.armies, { seed: f.canon.seed, towerLevels: f.canon.towerLevels, towers: f.canon.towers }).run();
    state = applyRound(state, result, defs);
    if (state.phase === "over") return missionOutcome(m, state, result);
    state = nextRound(state);
  }
  throw new Error(`${m.id} never ended`);
}

const cost = (specs: SquadSpec[]) => specs.reduce((n, [id]) => n + (defs.get(id)?.cost ?? 0), 0);

describe("story missions", () => {
  it("has at least one playable mission, with unique ids", () => {
    expect(MISSIONS.length).toBeGreaterThan(0);
    expect(new Set(MISSIONS.map((m) => m.def.id)).size).toBe(MISSIONS.length);
  });

  for (const { def: m } of MISSIONS) {
    describe(m.id, () => {
      it("uses real units, and every scripted squad fits the enemy's zone", () => {
        for (const id of [...m.units, ...(m.shop ?? []), ...m.enemy.units]) expect(defs.has(id), id).toBe(true);
        m.enemy.rounds.forEach((r, i) => expect(placeable(r, 1, m.towers), `round ${i + 1}`).toEqual([]));
        for (const [id] of m.enemy.rounds.flat()) expect(m.enemy.units, `${id} isn't among the enemy's units`).toContain(id);
        for (const rank of m.page.diagram ?? []) for (const id of rank) expect(defs.has(id), id).toBe(true);
        for (const l of [...m.briefing, ...m.win, ...m.hints.map((h) => h.line)]) expect(CAST[l.who]).toBeDefined();
        expect(m.hints.some((h) => !h.when), "a loss always gets a hint").toBe(true);
      });

      it("its reference armies are legal: the player's units, in the player's zone, within the mission's supply", () => {
        const { reference } = m;
        for (const army of [...reference.wins, ...reference.loses, ...(reference.commended ? [reference.commended] : [])]) {
          expect(placeable(army, 0, m.towers)).toEqual([]);
          for (const [id] of army) expect(m.units, id).toContain(id);
          expect(cost(army)).toBeLessThanOrEqual(m.supply);
          for (const [, , y] of army) expect(y).toBeGreaterThanOrEqual(deployZone(0).y0);
        }
      });

      it("the armies that should win do, and the ones that should lose do", () => {
        m.reference.wins.forEach((army, i) => expect(play(m, army).won, `wins[${i}]`).toBe(true));
        m.reference.loses.forEach((army, i) => expect(play(m, army).won, `loses[${i}]`).toBe(false));
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
