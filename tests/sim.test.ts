import { describe, expect, it } from "vitest";
import { DEFAULT_UNITS } from "../src/data/units";
import { autoPlace, defMap } from "../src/game/army";
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
    const r = new Battle(defs, [army(0, ["knights"]), []]).run();
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
    const plan = planAiRound(DEFAULT_UNITS, defs, [], player, 500, 1, "easy", 3);
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
