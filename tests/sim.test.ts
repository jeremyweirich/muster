import { describe, expect, it } from "vitest";
import { DEFAULT_UNITS } from "../src/data/units";
import { autoPlace, canPlace, defMap, priceOf } from "../src/game/army";
import { towerPlacements } from "../src/data/towers";
import { planAiRound } from "../src/game/ai";
import { runMatchup } from "../src/game/lab";
import { Battle } from "../src/sim/battle";
import { Rng } from "../src/sim/rng";
import { SurfaceGrid } from "../src/sim/surfaces";

const defs = defMap(DEFAULT_UNITS);
const byId = (id: string) => defs.get(id)!;

function army(side: 0 | 1, ids: string[], seed = 1) {
  return autoPlace(ids.map(byId), [], side, defs, 1, new Rng(seed));
}

describe("battle", () => {
  it("is deterministic for the same seed", () => {
    const a = army(0, ["knights", "longbowmen", "fire_mage"]);
    const b = army(1, ["goblin_horde", "goblin_horde", "ogre_brute"]);
    const r1 = new Battle(defs, [a, b], { seed: 5 }).run();
    const r2 = new Battle(defs, [a, b], { seed: 5 }).run();
    expect(r1).toEqual(r2);
  });

  it("finishes with a winner when one side is outmatched", () => {
    const a = army(0, ["knights", "knights", "knights"]);
    const b = army(1, ["goblin_horde"]);
    const r = new Battle(defs, [a, b], { seed: 1 }).run();
    expect(r.winner).toBe(0);
  });

  it("an empty side loses immediately", () => {
    const r = new Battle(defs, [army(0, ["knights"]), []], { towers: false }).run();
    expect(r.winner).toBe(0);
    expect(r.time).toBe(0);
  });
});

describe("surfaces", () => {
  it("electrifies connected puddle cells", () => {
    const g = new SurfaceGrid(10, 10, 2);
    g.create(3, 3, 1.5, "puddle");
    g.create(5, 3, 1.5, "puddle");
    g.element(2.5, 3, 0.5, "lightning");
    expect(g.at(5.5, 3)).toBe("shockwater");
    expect(g.events[0].name).toBe("Electrify");
  });

  it("fire on puddle boils to steam, ice melts to puddle", () => {
    const g = new SurfaceGrid(10, 10, 2);
    g.create(3, 3, 1, "puddle");
    g.create(3, 3, 0.5, "fire");
    expect(g.at(3, 3)).toBe("steam");
    g.create(7, 7, 1, "ice");
    g.element(7, 7, 0.5, "fire");
    expect(g.at(7, 7)).toBe("puddle");
  });
});

describe("combos", () => {
  it("tidecaller + stormcaller beats stormcaller alone against the same army", () => {
    const enemy = (s: number) => army(1, ["knights", "knights", "goblin_horde"], s);
    let combo = 0;
    let solo = 0;
    for (let s = 0; s < 4; s++) {
      const r1 = new Battle(defs, [army(0, ["tidecaller", "stormcaller", "stormcaller"], s), enemy(s)], { seed: s }).run();
      const r2 = new Battle(defs, [army(0, ["stormcaller", "stormcaller"], s), enemy(s)], { seed: s }).run();
      combo += r1.survivors[1].reduce((t, q) => t + q.alive, 0);
      solo += r2.survivors[1].reduce((t, q) => t + q.alive, 0);
    }
    expect(combo).toBeLessThan(solo);
  });
});

describe("ai and lab", () => {
  it("ai spends within budget", () => {
    const player = army(0, ["knights", "longbowmen"]);
    const plan = planAiRound(DEFAULT_UNITS, defs, [], ["knights", "longbowmen", "goblin_horde"], player, 500, 1, "easy", 3);
    expect(plan.spent).toBeLessThanOrEqual(500);
    expect(plan.squads.length).toBeGreaterThan(0);
  });

  it("matchup runs quickly", () => {
    const t = performance.now();
    const r = runMatchup(DEFAULT_UNITS, "goblin_horde", "fire_mage", 1000, 2);
    expect(r.winRate).toBeGreaterThanOrEqual(0);
    expect(performance.now() - t).toBeLessThan(5000);
  });
});

describe("towers", () => {
  it("towers don't count toward winning", () => {
    const r = new Battle(defs, [army(0, ["knights", "knights", "knights"]), army(1, ["goblin_horde"])], { seed: 2 }).run();
    expect(r.winner).toBe(0);
    expect(r.survivors[1]).toHaveLength(0);
    expect(r.stats["tower-1-0"].structure).toBe(true);
  });

  it("a falling tower dazes its own whole army", () => {
    // knights can't hit the enemy's fliers, so the Keep is the only thing they can attack
    const b = new Battle(defs, [army(0, ["knights", "knights", "knights"]), army(1, ["griffon_riders"])], { seed: 3 });
    let dazedAt = -1;
    let fellAt = -1;
    while (!b.over) {
      b.step();
      const towerDown = b.models.some((m) => m.side === 1 && m.def.structure && !m.alive);
      if (towerDown && fellAt < 0) fellAt = b.time;
      if (dazedAt < 0 && b.models.some((m) => m.side === 1 && m.alive && !m.def.structure && m.statuses.dazed !== undefined)) dazedAt = b.time;
    }
    expect(fellAt).toBeGreaterThan(0);
    expect(dazedAt).toBeCloseTo(fellAt, 1);
  });

  it("squads can't be placed on towers", () => {
    const t = towerPlacements(0)[0];
    expect(canPlace(byId("knights"), t.x, t.y, 0, [], defs)).toBe(false);
  });
});

describe("rotation and unlocks", () => {
  it("rotation swaps the footprint", () => {
    const k = byId("knights"); // 4x1
    expect(canPlace(k, 0, 22, 0, [], defs, undefined, true)).toBe(true);
    expect(canPlace(k, 30, 22, 0, [], defs)).toBe(false); // 4 wide doesn't fit at x=30
    expect(canPlace(k, 31, 22, 0, [], defs, undefined, true)).toBe(true); // 1 wide does
  });

  it("price includes the unlock cost until unlocked", () => {
    const f = byId("fire_mage");
    expect(priceOf(f, new Set())).toBe(f.cost + (f.unlockCost ?? 0));
    expect(priceOf(f, new Set(["fire_mage"]))).toBe(f.cost);
  });

  it("ai pays for unlocks within its budget", () => {
    for (let seed = 1; seed < 6; seed++) {
      const plan = planAiRound(DEFAULT_UNITS, defs, [], ["goblin_horde"], army(0, ["knights"]), 400, 2, "normal", seed);
      expect(plan.spent).toBeLessThanOrEqual(400);
      for (const sq of plan.squads) expect(["goblin_horde", ...plan.unlocks]).toContain(sq.defId);
    }
  });
});

describe("battle report stats", () => {
  it("credits reactions and tracks friendly fire", () => {
    const a = army(0, ["tidecaller", "stormcaller", "stormcaller", "knights"]);
    const b = army(1, ["knights", "knights", "goblin_horde"]);
    const r = new Battle(defs, [a, b], { seed: 4, towers: false }).run();
    const storm = Object.values(r.stats).filter((s) => s.defId === "stormcaller");
    const conduct = storm.reduce((t, s) => t + (s.dealtBy["Conduct"] ?? 0), 0);
    expect(conduct).toBeGreaterThan(0);
    const total = Object.values(r.stats).reduce((t, s) => t + s.taken, 0);
    const dealt = Object.values(r.stats).reduce((t, s) => t + s.dealt + s.friendly, 0);
    // everything dealt by a squad shows up as taken by someone
    expect(dealt).toBeLessThanOrEqual(total + 1e-6);
  });
});
