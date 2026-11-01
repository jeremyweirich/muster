import { describe, expect, it } from "vitest";
import { DEFAULT_UNITS } from "../src/data/units";
import { autoPlace, canPlace, defMap, priceOf, upgradePrice } from "../src/game/army";
import { applyRound, battleXp, canPromote, chooseOpening, newMatch, packLabel, roundDamage } from "../src/game/match";
import { OPENING_PACKS } from "../src/data/openings";
import { capXp, earnedLevel, levelDef } from "../src/sim/levels";
import { ROLES } from "../src/data/roles";
import { applyUpgrades, upgradedDefs } from "../src/sim/upgrades";
import { towerPlacements } from "../src/data/towers";
import { deployZone, RULES } from "../src/data/rules";
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
    const a = army(0, ["knights", "crossbowmen", "fire_elemental"]);
    const b = army(1, ["grunts", "grunts", "ogre_brute"]);
    const r1 = new Battle(defs, [a, b], { seed: 5 }).run();
    const r2 = new Battle(defs, [a, b], { seed: 5 }).run();
    expect(r1).toEqual(r2);
  });

  it("finishes with a winner when one side is outmatched", () => {
    const a = army(0, ["knights", "knights", "knights"]);
    const b = army(1, ["grunts"]);
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

  it("water douses fire into steam, but fire doesn't boil puddles or melt ice", () => {
    const g = new SurfaceGrid(10, 10, 2);
    g.create(3, 3, 1, "fire");
    g.create(3, 3, 0.5, "puddle");
    expect(g.at(3, 3)).toBe("steam");
    g.create(7, 7, 1, "ice");
    g.element(7, 7, 0.5, "fire");
    expect(g.at(7, 7)).toBe("ice");
  });
});

describe("combos", () => {
  it("air elementals deal more lightning damage when a water elemental soaks the enemy", () => {
    const enemy = (s: number) => army(1, ["knights", "knights", "grunts"], s);
    const airDamage = (support: string) => {
      let total = 0;
      for (let s = 0; s < 4; s++) {
        const r = new Battle(defs, [army(0, [support, "air_elemental", "air_elemental"], s), enemy(s)], { seed: s, towers: false }).run();
        for (const st of Object.values(r.stats)) if (st.defId === "air_elemental") total += st.dealt / Math.max(1, r.time);
      }
      return total;
    };
    expect(airDamage("water_elemental")).toBeGreaterThan(airDamage("fire_elemental"));
  });
});

describe("ai and lab", () => {
  it("ai spends within budget", () => {
    const player = army(0, ["knights", "crossbowmen"]);
    const plan = planAiRound(
      DEFAULT_UNITS,
      defs,
      { army: [], unlocked: ["knights", "crossbowmen", "grunts"], upgrades: {}, towerLevels: [0, 0], supply: 500 },
      { army: player, upgrades: {}, towerLevels: [0, 0] },
      1,
      "easy",
      3,
    );
    expect(plan.spent).toBeLessThanOrEqual(500);
    expect(plan.squads.length).toBeGreaterThan(0);
  });

  it("matchup runs quickly", () => {
    const t = performance.now();
    const r = runMatchup(DEFAULT_UNITS, "grunts", "fire_elemental", 1000, 2);
    expect(r.winRate).toBeGreaterThanOrEqual(0);
    expect(performance.now() - t).toBeLessThan(5000);
  });
});

describe("towers", () => {
  it("towers don't count toward winning", () => {
    const r = new Battle(defs, [army(0, ["knights", "knights", "knights"]), army(1, ["grunts"])], { seed: 2 }).run();
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

  it("towers are unarmed ground keeps", () => {
    const b = new Battle(defs, [army(0, ["knights"]), army(1, ["knights"])], { seed: 1 });
    const towers = b.models.filter((m) => m.def.structure);
    expect(towers).toHaveLength(2 * RULES.towers.length);
    for (const t of towers) {
      expect(t.def.layer).toBe("ground");
      expect(t.def.attack).toBeUndefined();
    }
  });

  it("towers stand towerInset rows in from each side's back edge", () => {
    for (const side of [0, 1] as const) {
      for (const t of towerPlacements(side)) {
        const gap = side === 0 ? RULES.fieldH - (t.y + 2) : t.y;
        expect(gap).toBe(RULES.towerInset);
      }
    }
  });

  it("burning stops a troll from regenerating", () => {
    // an unarmed troll at the back, with distant knights so the battle doesn't end
    const troll = { ...byId("troll"), attack: undefined };
    const t = new Battle(
      defMap([...DEFAULT_UNITS.filter((u) => u.id !== "troll"), troll]),
      [[{ uid: "t", defId: "troll", x: 10, y: RULES.fieldH - 1, round: 1 }], army(1, ["knights"])],
      { towers: false },
    );
    const m = t.models.find((x) => x.def.id === "troll")!;
    m.hp = 100;
    m.statuses.burning = 10;
    for (let i = 0; i < 20; i++) t.step();
    const burningHp = m.hp;
    delete m.statuses.burning;
    m.hp = 100;
    for (let i = 0; i < 20; i++) t.step();
    expect(burningHp).toBeLessThan(100);
    expect(m.hp).toBeGreaterThan(100);
  });
});

describe("fire elemental upgrades", () => {
  it("Controlled Burn stops its flames from burning allies", () => {
    const friendly = (ups: string[]) => {
      let total = 0;
      for (let s = 0; s < 4; s++) {
        const a = army(0, ["fire_elemental", "knights", "knights"], s);
        const b = army(1, ["troll", "troll", "grunts"], s);
        const r = new Battle([upgradedDefs(defs, { fire_elemental: ups }), defs], [a, b], { seed: s, towers: false }).run();
        total += Object.values(r.stats).reduce((t, st) => t + (st.side === 0 && st.defId === "fire_elemental" ? st.friendly : 0), 0);
      }
      return total;
    };
    expect(friendly([])).toBeGreaterThan(0);
    expect(friendly(["controlled_burn"])).toBe(0);
  });
});

describe("targeting and self-destruct", () => {
  it("self-destructing attackers die after their first blast", () => {
    const g = byId("grunts");
    const kegs = { ...g, attack: { ...g.attack!, element: "fire" as const, damage: 125, splash: 1.4, selfDestruct: true } };
    const b = new Battle(new Map(defs).set("grunts", kegs), [army(0, ["grunts"]), army(1, ["knights", "knights", "knights"])], { seed: 1, towers: false });
    for (let i = 0; i < 400; i++) b.step();
    expect(b.models.filter((m) => m.def.id === "grunts" && m.alive)).toHaveLength(0);
    const knights = b.squads.find((s) => s.def.id === "knights")!.stats;
    expect(knights.takenByElement.fire ?? 0).toBeGreaterThan(0); // the kegs went off
  });

  it("preferences are local: bats pick out nearby shooters, but don't cross the field for them", () => {
    const sq = (defId: string, x: number, y: number) => ({ uid: `${defId}${y}`, defId, x, y, round: 1 });
    const targets = (crossbowY: number) => {
      const b = new Battle(defs, [[sq("giant_bats", 22, 14)], [sq("knights", 20, 12), sq("crossbowmen", 22, crossbowY)]], { seed: 1, towers: false });
      b.step();
      return b.models.filter((m) => m.def.id === "giant_bats").map((m) => b.get(m.targetId)?.def.id);
    };
    expect(targets(11)).toEqual(Array(4).fill("crossbowmen")); // just behind the knights
    expect(targets(0)).toEqual(Array(4).fill("knights")); // the far side of the field
  });
});

describe("rotation and unlocks", () => {
  it("rotation swaps the footprint", () => {
    const k = byId("knights"); // 4x1
    const y = deployZone(0).y0;
    expect(canPlace(k, 0, y, 0, [], defs, undefined, true)).toBe(true);
    expect(canPlace(k, RULES.fieldW - 2, y, 0, [], defs)).toBe(false); // 4 wide doesn't fit 2 from the edge
    expect(canPlace(k, RULES.fieldW - 1, y, 0, [], defs, undefined, true)).toBe(true); // 1 wide does
  });

  it("price includes the unlock cost until unlocked", () => {
    const f = byId("fire_elemental");
    expect(priceOf(f, new Set())).toBe(f.cost + (f.unlockCost ?? 0));
    expect(priceOf(f, new Set(["fire_elemental"]))).toBe(f.cost);
  });

  it("ai pays for unlocks within its budget", () => {
    for (let seed = 1; seed < 6; seed++) {
      const mine = army(1, ["grunts"]);
      const plan = planAiRound(
        DEFAULT_UNITS,
        defs,
        { army: mine, unlocked: ["grunts"], upgrades: {}, towerLevels: [0, 0], supply: 400 },
        { army: army(0, ["knights"]), upgrades: {}, towerLevels: [0, 0] },
        2,
        "normal",
        seed,
      );
      expect(plan.spent).toBeLessThanOrEqual(400);
      for (const sq of plan.squads) expect(["grunts", ...plan.unlocks]).toContain(sq.defId);
      for (const u of plan.upgrades) expect(u.unitId).toBe("grunts");
    }
  });
});

describe("battle report stats", () => {
  it("lightning sparks oiled targets", () => {
    const b = new Battle(defs, [army(0, ["air_elemental"]), army(1, ["knights"])], { seed: 1, towers: false });
    for (const m of b.models) if (m.side === 1) m.statuses.oiled = 60;
    let lit = false;
    for (let i = 0; i < 400 && !b.over && !lit; i++) {
      b.step();
      lit = b.models.some((m) => m.side === 1 && m.statuses.burning !== undefined);
    }
    expect(lit).toBe(true);
  });

  it("credits reactions and tracks friendly fire", () => {
    const a = army(0, ["water_elemental", "air_elemental", "air_elemental", "knights"]);
    const b = army(1, ["knights", "knights", "grunts"]);
    const r = new Battle(defs, [a, b], { seed: 4, towers: false }).run();
    const storm = Object.values(r.stats).filter((s) => s.defId === "air_elemental");
    const conduct = storm.reduce((t, s) => t + (s.dealtBy["Conduct"] ?? 0), 0);
    expect(conduct).toBeGreaterThan(0);
    const total = Object.values(r.stats).reduce((t, s) => t + s.taken, 0);
    const dealt = Object.values(r.stats).reduce((t, s) => t + s.dealt + s.friendly, 0);
    // everything dealt by a squad shows up as taken by someone
    expect(dealt).toBeLessThanOrEqual(total + 1e-6);
  });
});

describe("upgrades", () => {
  it("apply stat mods, effects and traits", () => {
    const dragon = byId("dragon");
    const up = applyUpgrades(dragon, ["inferno", "ancient_scales"]);
    expect(up.hp).toBe(Math.round(dragon.hp * 1.4));
    expect(up.attack!.onHit!.some((e) => e.type === "surface" && e.surface === "fire")).toBe(true);
    expect(dragon.attack!.onHit!.some((e) => e.type === "surface")).toBe(false); // base def untouched
    expect(applyUpgrades(byId("cloudlings"), ["downpour"]).traits!.some((t) => t.type === "periodic")).toBe(true);
    expect(applyUpgrades(byId("air_elemental"), ["take_flight"]).layer).toBe("air");
    const fire = applyUpgrades(byId("fire_elemental"), ["controlled_burn", "meteor"]);
    expect(fire.attack!.onHit!.every((e) => e.type !== "status" || e.affects === "enemies")).toBe(true);
    expect(fire.attack!.range).toBe(byId("fire_elemental").attack!.range + 4);
  });

  it("cost 200 / 400 / 600 / 800 in buy order, whatever the unit", () => {
    for (const id of ["grunts", "dragon"]) {
      const u = byId(id);
      expect([0, 1, 2, 3].map((n) => upgradePrice(u, n))).toEqual([200, 400, 600, 800]);
      expect(upgradePrice(u, 4)).toBeNull();
    }
  });

  it("every unit has four described upgrades and the required tags", () => {
    for (const u of DEFAULT_UNITS) {
      expect(u.upgrades?.length, u.id).toBe(4);
      expect(new Set(u.upgrades!.map((x) => x.id)).size, u.id).toBe(4);
      for (const up of u.upgrades!) expect(up.description, `${u.id}.${up.id}`).toBeTruthy();
      for (const cat of ["faction:", "race:", "size:"]) expect(u.tags.some((t) => t.startsWith(cat)), `${u.id} ${cat}`).toBe(true);
      const roles = u.tags.filter((t) => t.startsWith("role:"));
      expect(roles.length, u.id).toBeGreaterThanOrEqual(2);
      for (const r of roles) expect(ROLES[r.slice(5)], `${u.id} ${r}`).toBeDefined();
    }
  });

  it("the ballista has no splash, even fully upgraded", () => {
    const b = byId("ballista");
    expect(applyUpgrades(b, b.upgrades!.map((u) => u.id)).attack!.splash).toBeUndefined();
  });

  it("upgrades can add bonus damage, preferred targets and immunities", () => {
    const w = applyUpgrades(byId("wolf_riders"), ["flankers"]);
    expect(w.attack!.prefers).toBeDefined();
    expect(w.attack!.bonusVs!.length).toBe(1);
    const k = applyUpgrades(byId("knights"), ["warded_plate"]);
    expect(k.resist!.fire).toBeCloseTo(0.5);
  });

  it("Bloodthirst re-arms the wolves' charge after a kill", () => {
    const wolves = applyUpgrades(byId("wolf_riders"), ["bloodthirst"]);
    const b = new Battle([new Map(defs).set("wolf_riders", wolves), defs], [army(0, ["wolf_riders"]), army(1, ["crossbowmen", "crossbowmen"])], { seed: 1, towers: false });
    let recharged = false;
    let sawKill = false;
    while (!b.over && b.time < 30) {
      const before = b.models.filter((m) => m.side === 1 && m.alive).length;
      b.step();
      const after = b.models.filter((m) => m.side === 1 && m.alive).length;
      if (after < before) sawKill = true;
      if (sawKill && b.models.some((m) => m.def.id === "wolf_riders" && m.alive && m.charged)) recharged = true;
    }
    expect(recharged).toBe(true);
  });

  it("Pike Wall kills goblins that stab the pikemen", () => {
    const pikes = applyUpgrades(byId("pikemen"), ["pike_wall"]);
    const goblinsLost = (d: typeof defs) => {
      const r = new Battle([d, defs], [army(0, ["pikemen"]), army(1, ["grunts", "grunts", "grunts"])], { seed: 2, towers: false }).run();
      const st = Object.values(r.stats).find((s) => s.defId === "pikemen")!;
      return st.dealtBy["Retaliation"] ?? 0;
    };
    expect(goblinsLost(defs)).toBe(0);
    expect(goblinsLost(new Map(defs).set("pikemen", pikes))).toBeGreaterThan(0);
  });

  it("Purify washes statuses off allies", () => {
    const cleric = applyUpgrades(byId("cleric"), ["purify"]);
    const b = new Battle([new Map(defs).set("cleric", cleric), defs], [army(0, ["cleric", "knights"]), army(1, ["knights"])], { towers: false });
    const k = b.models.find((m) => m.side === 0 && m.def.id === "knights")!;
    k.statuses.wet = 30;
    for (let i = 0; i < 80; i++) b.step();
    expect(k.statuses.wet).toBeUndefined();
  });

  it("each side fights with its own upgrades", () => {
    const a = army(0, ["grunts", "grunts"]);
    const b = army(1, ["grunts", "grunts"]);
    let wins = 0;
    for (let s = 0; s < 6; s++) {
      const r = new Battle([upgradedDefs(defs, { grunts: ["feral_frenzy", "party_time"] }), defs], [a, b], { seed: s, towers: false }).run();
      if (r.winner === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it("retaliation chills attackers", () => {
    const water = applyUpgrades(byId("water_elemental"), ["glacial_heart"]);
    const map = new Map(defs);
    map.set("water_elemental", water);
    const b = new Battle([map, defs], [army(0, ["water_elemental"]), army(1, ["knights"])], { seed: 1, towers: false });
    let chilledOrFrozen = false;
    for (let i = 0; i < 600 && !b.over; i++) {
      b.step();
      if (b.models.some((m) => m.side === 1 && (m.statuses.chilled !== undefined || m.statuses.frozen !== undefined))) chilledOrFrozen = true;
    }
    expect(chilledOrFrozen).toBe(true);
  });

  it("tower levels add hp", () => {
    const b0 = new Battle(defs, [army(0, ["knights"]), army(1, ["knights"])], { towerLevels: [[0, 0], [0, 0]] });
    const b2 = new Battle(defs, [army(0, ["knights"]), army(1, ["knights"])], { towerLevels: [[2, 0], [0, 0]] });
    const keep = (b: Battle) => b.models.find((m) => m.squadUid === "tower-0-0")!.maxHp;
    expect(keep(b2) - keep(b0)).toBe(600);
  });
});

describe("match opening", () => {
  it("every pack is two real units whose squads add up to the same value", () => {
    for (const pack of OPENING_PACKS) {
      expect(pack.units).toHaveLength(2);
      const value = pack.units.reduce((t, u) => t + byId(u.id).cost * u.count, 0);
      expect(value, packLabel(pack, DEFAULT_UNITS)).toBe(RULES.openingPackValue);
      for (const u of pack.units) expect(byId(u.id).tags, u.id).not.toContain("faction:independent");
    }
  });

  it("nothing starts unlocked; both sides see the same three packs; the AI picks at once", () => {
    for (let seed = 1; seed < 20; seed++) {
      const m = newMatch(DEFAULT_UNITS, seed);
      expect(m.unlocked[0]).toEqual([]);
      expect(m.armies[0]).toEqual([]);
      expect(new Set(m.openings[0].packs).size).toBe(RULES.openingChoices);
      expect(m.openings[1].packs).toEqual(m.openings[0].packs);
      expect(m.openings[0].choice).toBeNull();
      expect(m.openings[1].choice).not.toBeNull();
    }
  });

  it("a pack unlocks its units, places its squads for free and adds supply; the war chest is flat supply", () => {
    const m = newMatch(DEFAULT_UNITS, 3);
    const i = m.openings[0].packs[0];
    const pack = OPENING_PACKS[i];
    const took = chooseOpening(m, 0, i, DEFAULT_UNITS);
    expect(took.supply[0]).toBe(m.supply[0] + RULES.openingPackSupply);
    expect(took.unlocked[0].sort()).toEqual(pack.units.map((u) => u.id).sort());
    expect(took.armies[0]).toHaveLength(pack.units.reduce((t, u) => t + u.count, 0));
    for (const sq of took.armies[0]) {
      expect(sq.free).toBe(true);
      expect(canPlace(byId(sq.defId), sq.x, sq.y, 0, took.armies[0], defs, sq.uid, sq.rot)).toBe(true);
    }
    expect(chooseOpening(took, 0, "flat", DEFAULT_UNITS)).toBe(took); // one choice only
    const unoffered = OPENING_PACKS.findIndex((_, j) => !m.openings[0].packs.includes(j));
    expect(chooseOpening(m, 0, unoffered, DEFAULT_UNITS)).toBe(m);
    const flat = chooseOpening(m, 0, "flat", DEFAULT_UNITS);
    expect(flat.supply[0]).toBe(m.supply[0] + RULES.openingFlat);
    expect(flat.unlocked[0]).toEqual([]);
    expect(flat.armies[0]).toEqual([]);
  });

  it("the war chest is a little behind a pack once it pays for two unlocks", () => {
    const pack = RULES.openingPackValue + RULES.openingPackSupply + 2 * 100;
    const behind = pack - (RULES.openingFlat);
    expect(behind).toBeGreaterThanOrEqual(50);
    expect(behind).toBeLessThanOrEqual(100);
  });
});

describe("ai opening", () => {
  it("round-one plans can actually fight, even with nothing unlocked", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const fresh = planAiRound(DEFAULT_UNITS, defs, { army: [], unlocked: [], upgrades: {}, towerLevels: [0, 0], supply: RULES.openingFlat }, { army: [], upgrades: {}, towerLevels: [0, 0] }, 1, "normal", seed);
      expect(fresh.squads.some((s) => defs.get(s.defId)?.attack)).toBe(true);
      const plan = planAiRound(
        DEFAULT_UNITS,
        defs,
        { army: [], unlocked: ["grunts", "knights", "crossbowmen"], upgrades: {}, towerLevels: [0, 0], supply: 300 },
        { army: [], upgrades: {}, towerLevels: [0, 0] },
        1,
        "normal",
        seed,
      );
      expect(plan.squads.some((s) => defs.get(s.defId)?.attack)).toBe(true);
    }
  });
});

describe("veterancy", () => {
  it("levels scale HP, damage, healing and regeneration linearly", () => {
    const k = levelDef(byId("knights"), 3);
    expect(k.hp).toBe(byId("knights").hp * 3);
    expect(k.attack!.damage).toBe(byId("knights").attack!.damage * 3);
    expect(k.attack!.cooldown).toBe(byId("knights").attack!.cooldown);
    const c = levelDef(byId("cleric"), 2);
    const heal = (d: typeof c) => (d.traits![0] as { effects: { amount: number }[] }).effects[0].amount;
    expect(heal(c)).toBe(heal(byId("cleric")) * 2);
    const t = levelDef(byId("troll"), 2);
    expect((t.traits![0] as { perSecond: number }).perSecond).toBe((byId("troll").traits![0] as { perSecond: number }).perSecond * 2);
    expect(levelDef(byId("knights"), 1)).toBe(byId("knights"));
  });

  it("XP thresholds unlock levels, which cost more XP each time", () => {
    expect(earnedLevel(0, RULES)).toBe(1);
    expect(earnedLevel(RULES.levelXp[0], RULES)).toBe(2);
    expect(earnedLevel(RULES.levelXp[1] - 1, RULES)).toBe(2);
    for (let i = 1; i < RULES.levelXp.length; i++) {
      expect(RULES.levelXp[i] - RULES.levelXp[i - 1]).toBeGreaterThan(i > 1 ? RULES.levelXp[i - 1] - RULES.levelXp[i - 2] : RULES.levelXp[0]);
    }
  });

  it("squads earn XP from battle and fight at their level", () => {
    let m = newMatch(DEFAULT_UNITS, 1);
    m = { ...m, armies: [army(0, ["knights", "crossbowmen"]), army(1, ["grunts"])] };
    const r = new Battle(defs, m.armies, { seed: 1 }).run();
    const after = applyRound(m, r, defs);
    const top = [...after.armies[0]].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))[0];
    expect(top.xp).toBe(Math.min(battleXp(r, top.uid), RULES.levelXp[0]));
    expect(top.xp).toBeGreaterThan(0);
    const vet = { ...top, xp: RULES.levelXp[0] };
    expect(canPromote(vet)).toBe(true);
    expect(canPromote({ ...vet, level: 2 })).toBe(false);
    const b = new Battle(defs, [[{ ...vet, level: 2 }], []], { towers: false });
    expect(b.models[0].maxHp).toBe(byId(vet.defId).hp * 2);
  });

  it("a squad holds at most one unpaid level", () => {
    expect(capXp(99999, 1, RULES)).toBe(RULES.levelXp[0]);
    expect(capXp(99999, 2, RULES)).toBe(RULES.levelXp[1]);
    expect(capXp(500, 1, RULES)).toBe(500);
    let m = newMatch(DEFAULT_UNITS, 1);
    m = { ...m, armies: [army(0, ["knights"]).map((s) => ({ ...s, xp: RULES.levelXp[0] })), army(1, ["grunts"])] };
    const after = applyRound(m, new Battle(defs, m.armies, { seed: 1 }).run(), defs);
    const sq = after.armies[0][0];
    expect(sq.xp).toBe(RULES.levelXp[0]); // the level waiting soaks up nothing more
    expect(canPromote(sq)).toBe(true);
    expect(canPromote({ ...sq, level: 2 })).toBe(false); // so promoting once uses it all up
  });

  it("levels don't change round damage", () => {
    const a = army(0, ["knights", "knights"]);
    const r = new Battle(defs, [a, []], { towers: false }).run();
    const vets = a.map((s) => ({ ...s, level: 3 }));
    const rv = new Battle(defs, [vets, []], { towers: false }).run();
    expect(roundDamage(rv, defs)).toEqual(roundDamage(r, defs));
  });

  it("the AI promotes veterans it can afford", () => {
    const vets = army(1, ["knights", "knights"]).map((s) => ({ ...s, xp: 99999 }));
    let promotedAny = false;
    for (let seed = 1; seed < 6 && !promotedAny; seed++) {
      const plan = planAiRound(DEFAULT_UNITS, defs, { army: vets, unlocked: ["knights", "crossbowmen", "grunts"], upgrades: {}, towerLevels: [0, 0], supply: 800 }, { army: army(0, ["knights"]), upgrades: {}, towerLevels: [0, 0] }, 2, "normal", seed);
      promotedAny = plan.promotions.length > 0;
      for (const uid of plan.promotions) expect(vets.some((v) => v.uid === uid)).toBe(true);
    }
    expect(promotedAny).toBe(true);
  });
});

describe("goblin mechanics", () => {
  const up = (state: Record<string, string[]>) => upgradedDefs(defs, state);
  const fxTexts = (b: Battle, text: string) => b.fx.filter((f) => f.kind === "text" && f.text === text).length;
  const runFor = (b: Battle, seconds: number) => {
    for (let i = 0; i < seconds / RULES.tick && !b.over; i++) b.step();
    return b;
  };

  it("Scrap Armor blocks each grunt's first hit, so bolts need two shots", () => {
    const fight = (ups: string[]) =>
      runFor(new Battle([defs, up({ grunts: ups })], [army(0, ["crossbowmen", "crossbowmen"]), army(1, ["grunts"])], { seed: 1, towers: false, recordFx: true }), 15);
    expect(fxTexts(fight([]), "Blocked")).toBe(0);
    const armored = fight(["scrap_armor"]);
    expect(fxTexts(armored, "Blocked")).toBeGreaterThan(0);
    for (const m of armored.models) if (m.def.id === "grunts" && m.alive) expect(m.hp).toBeLessThanOrEqual(60);
  });

  it("Ambush hides skirmishers from archers until they shoot", () => {
    const targetsSkirmishers = (ups: string[]) => {
      const b = runFor(new Battle([defs, up({ skirmishers: ups })], [army(0, ["crossbowmen"]), army(1, ["skirmishers"])], { seed: 1, towers: false }), 1);
      return b.models.filter((m) => m.def.id === "crossbowmen" && b.get(m.targetId)?.def.id === "skirmishers").length;
    };
    expect(targetsSkirmishers([])).toBeGreaterThan(0);
    expect(targetsSkirmishers(["ambush"])).toBe(0);
  });

  it("Improvised Bombs throw fire at the skirmishers' targets", () => {
    const b = runFor(new Battle([defs, up({ skirmishers: ["improvised_bombs"] })], [army(0, ["knights"]), army(1, ["skirmishers"])], { seed: 1, towers: false }), 12);
    expect(b.result().stats[b.squads.find((s) => s.def.id === "knights")!.uid].takenByElement.fire ?? 0).toBeGreaterThan(0);
    // one grenade each: once thrown, the timer never comes back
    expect(b.models.some((m) => m.def.id === "skirmishers" && m.periodic.includes(Infinity))).toBe(true);
  });

  it("Oil Bombs leave oil where grunts fall", () => {
    const b = runFor(new Battle([defs, up({ grunts: ["oil_bombs"] })], [army(0, ["knights", "knights"]), army(1, ["grunts"])], { seed: 1, towers: false }), 8);
    const fallen = b.models.filter((m) => m.def.id === "grunts" && !m.alive);
    expect(fallen.length).toBeGreaterThan(0);
    expect(fallen.some((m) => b.surfaces.at(m.x, m.y) === "oil")).toBe(true);
  });

  it("Berserk makes trolls much better against one big target", () => {
    const troll = byId("troll");
    const calm = { ...troll, traits: troll.traits!.filter((t) => t.type !== "ramp" && t.type !== "unhurt") };
    const dealt = (d: typeof troll) => {
      const b = runFor(new Battle([new Map(defs).set("troll", d), defs], [army(0, ["troll"]), army(1, ["stone_golem"])], { seed: 1, towers: false }), 15);
      return b.result().stats[b.squads.find((s) => s.def.id === "troll")!.uid].dealt;
    };
    expect(dealt(troll)).toBeGreaterThan(dealt(calm) * 1.3);
  });

  it("Warboss summons grunts that fight but don't count as the ogre's survivors", () => {
    const b = runFor(new Battle([up({ ogre_brute: ["warboss"] }), defs], [army(0, ["ogre_brute"]), army(1, ["knights", "knights"])], { seed: 1, towers: false }), 6);
    const summoned = b.models.filter((m) => m.summoned);
    expect(summoned.length).toBe(1);
    for (const m of summoned) expect(m.def.id).toBe("grunts");
    const ogre = b.result().survivors[0].find((s) => s.defId === "ogre_brute");
    if (ogre) expect(ogre.alive).toBeLessThanOrEqual(ogre.total);
  });

  it("Thick Skull lets nearby goblins take hits for the ogre", () => {
    // Ballistae already in range of the ogre, with the mob still standing beside it.
    const sq = (defId: string, x: number, y: number) => ({ uid: `${defId}${x}${y}`, defId, x, y, round: 1 });
    const b = runFor(
      new Battle([up({ ogre_brute: ["thick_skull"] }), defs], [[sq("ogre_brute", 22, 14), sq("grunts", 21, 16)], [sq("ballista", 18, 4), sq("ballista", 22, 4), sq("ballista", 26, 4)]], { seed: 3, towers: false, recordFx: true }),
      1.5,
    );
    expect(fxTexts(b, "Meat shield!")).toBeGreaterThan(0);
  });

  it("Bloodsuckers heal the bats and Shriek dazes enemies below", () => {
    const b = new Battle([up({ giant_bats: ["bloodsuckers", "shriek"] }), defs], [army(0, ["giant_bats"]), army(1, ["crossbowmen", "knights"])], { seed: 1, towers: false });
    let dazed = false;
    for (let i = 0; i < 12 / RULES.tick && !b.over; i++) {
      b.step();
      dazed ||= b.models.some((m) => m.side === 1 && m.statuses.dazed !== undefined);
    }
    expect(dazed).toBe(true);
    expect(b.result().stats[b.squads.find((s) => s.def.id === "giant_bats")!.uid].healed).toBeGreaterThan(0);
  });
});
