import { describe, expect, it } from "vitest";
import { BALANCE_TARGETS, BASELINE_UNIT, ROLE_INFO } from "../src/data/balance";
import { RULES } from "../src/data/rules";
import { DEFAULT_UNITS } from "../src/data/units";
import { autoPlace, defMap } from "../src/game/army";
import { lanchesterValue, nashMix, selfTtk } from "../src/game/balance";
import { equalCostCounts } from "../src/game/lab";
import { Battle, footprintOf } from "../src/sim/battle";
import { Rng } from "../src/sim/rng";

const defs = defMap(DEFAULT_UNITS);
const byId = (id: string) => defs.get(id)!;

describe("balance targets", () => {
  it("every unit has a role and only lists real units", () => {
    for (const u of DEFAULT_UNITS) {
      const t = BALANCE_TARGETS[u.id];
      expect(t, u.id).toBeDefined();
      expect(ROLE_INFO[t.role], u.id).toBeDefined();
      for (const id of [...t.beats, ...t.losesTo]) expect(defs.has(id), `${u.id} lists ${id}`).toBe(true);
    }
    for (const id of Object.keys(BALANCE_TARGETS)) expect(defs.has(id), id).toBe(true);
  });
});

describe("balance metrics", () => {
  it("self-TTK is HP over own DPS, with armor against its own element", () => {
    const k = byId("knights");
    expect(selfTtk(k)).toBeCloseTo(k.hp / (k.attack!.damage / k.attack!.cooldown));
    expect(selfTtk(k, true)!).toBeGreaterThan(selfTtk(k)!);
    expect(selfTtk(byId("cleric"))).toBeNull();
  });

  it("the baseline unit is worth exactly 1.0", () => {
    expect(lanchesterValue(byId(BASELINE_UNIT), byId(BASELINE_UNIT))).toBeCloseTo(1);
  });

  it("equal-cost armies field the same supply when the prices allow", () => {
    for (const [a, b] of [[100, 150], [600, 100], [350, 250], [200, 200], [250, 150]]) {
      const [nA, nB] = equalCostCounts(a, b, 1000);
      expect(nA * a, `${a} vs ${b}`).toBe(nB * b);
    }
  });

  it("the Nash mix of rock-paper-scissors is even, and drops dominated strategies", () => {
    const rps = [[0, -1, 1], [1, 0, -1], [-1, 1, 0]];
    for (const w of nashMix(rps)) expect(w).toBeCloseTo(1 / 3, 1);
    const dominated = [[0, -1, 1, 1], [1, 0, -1, 1], [-1, 1, 0, 1], [-1, -1, -1, 0]];
    expect(nashMix(dominated)[3]).toBeLessThan(0.01);
  });
});

describe("side fairness", () => {
  it("neither side always wins a mirror", () => {
    // One placement reflected onto the other side: the sides differ only in which one they are.
    const knights = byId("knights");
    let wins = 0;
    for (let s = 0; s < 8; s++) {
      const bottom = autoPlace(Array(5).fill(knights), [], 0, defs, 1, new Rng(10 + s));
      const top = bottom.map((q) => ({ ...q, uid: `m${q.uid}`, y: RULES.fieldH - q.y - footprintOf(knights, q.rot).h }));
      const r = new Battle(defs, [bottom, top], { seed: 20 + s, towers: false }).run();
      if (r.winner === 0) wins++;
    }
    expect(wins).toBeGreaterThan(0);
    expect(wins).toBeLessThan(8);
  });
});
