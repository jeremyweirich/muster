import { describe, expect, it } from "vitest";
import { RULES } from "../src/data/rules";
import { DEFAULT_UNITS } from "../src/data/units";
import { planAiRound } from "../src/game/ai";
import { canPlace, defMap } from "../src/game/army";
import { nextRound } from "../src/game/match";
import { playSpectatedRound, spectateMatch, spectateRequest } from "../src/game/spectate";
import type { Side } from "../src/sim/types";

const units = DEFAULT_UNITS;
const defs = defMap(units);

describe("spectate", () => {
  // Two rounds, not a whole match, to keep it quick: round 2 is the first where each planner sees an army it has to turn round.
  it("plays AI-vs-AI rounds, each side deploying on its own side of the field", () => {
    let state = spectateMatch(units, 5);
    expect(state.openings[0].choice).not.toBeNull();
    expect(state.openings[1].choice).not.toBeNull();
    for (let n = 0; n < 2; n++) {
      const plans = ([0, 1] as Side[]).map((side) => {
        const r = spectateRequest(state, side, units, defs, "easy", 5);
        return planAiRound(r.units, defs, r.me, r.player, r.round, r.difficulty, r.seed, r.opts);
      });
      const round = playSpectatedRound(state, [plans[0], plans[1]], defs);
      for (const side of [0, 1] as Side[]) {
        const army = round.fought.armies[side];
        expect(round.after.supply[side]).toBeGreaterThanOrEqual(0);
        for (const sq of army) expect(canPlace(defs.get(sq.defId)!, sq.x, sq.y, side, army, defs, sq.uid, sq.rot)).toBe(true);
      }
      expect(round.fought.result).not.toBeNull();
      state = nextRound(round.after);
    }
  });

  it("each AI answers a recruit offer: its squads come free and placed, its unlock and price in the state", { timeout: 60_000 }, () => {
    let state = spectateMatch(units, 9);
    for (let n = 0; n < 1 + RULES.recruitEvery && state.phase !== "over"; n++) {
      const plans = ([0, 1] as Side[]).map((side) => {
        const r = spectateRequest(state, side, units, defs, "easy", 9);
        return planAiRound(r.units, defs, r.me, r.player, r.round, r.difficulty, r.seed, { ...r.opts, budgetMs: 200 });
      });
      const round = playSpectatedRound(state, [plans[0], plans[1]], defs);
      const offer = state.recruit;
      if (!offer) expect(plans.map((p) => p.recruit)).toEqual([undefined, undefined]);
      else
        for (const side of [0, 1] as Side[]) {
          const c = plans[side].recruit;
          expect(c).toBeDefined();
          expect(round.after.recruit!.choice[side]).toBe(c);
          if (c === undefined || c === "skip") continue;
          const o = offer.options[c];
          expect(round.after.unlocked[side]).toContain(o.unitId);
          expect(plans[side].unlocks).not.toContain(o.unitId);
          expect(round.after.supply[side]).toBe(state.supply[side] - plans[side].spent - o.price);
          const free = round.fought.armies[side].filter((sq) => sq.free && sq.round === state.round);
          expect(free.map((sq) => [sq.defId, sq.level ?? 1])).toEqual(Array(free.length).fill([o.unitId, o.level]));
          expect(free.length).toBeGreaterThan(0);
        }
      for (const side of [0, 1] as Side[]) expect(round.after.supply[side]).toBeGreaterThanOrEqual(0);
      state = nextRound(round.after);
    }
    expect(state.lastRecruit?.choice.every((c) => c !== null)).toBe(true);
  });
});
