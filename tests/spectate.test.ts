import { describe, expect, it } from "vitest";
import { DEFAULT_UNITS } from "../src/data/units";
import { planAiRound } from "../src/game/ai";
import { canPlace, defMap } from "../src/game/army";
import { nextRound } from "../src/game/match";
import { playSpectatedRound, spectateMatch, spectateRequest } from "../src/game/spectate";
import type { Side } from "../src/sim/types";

const units = DEFAULT_UNITS;
const defs = defMap(units);

describe("spectate", () => {
  it("plays a whole AI-vs-AI match, each side deploying on its own side of the field", () => {
    let state = spectateMatch(units, 5);
    expect(state.openings[0].choice).not.toBeNull();
    expect(state.openings[1].choice).not.toBeNull();
    for (let n = 0; n < 30; n++) {
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
      if (round.after.phase === "over") return;
      state = nextRound(round.after);
    }
    throw new Error("the match didn't end in 30 rounds");
  });
});
