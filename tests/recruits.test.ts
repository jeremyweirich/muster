import { describe, expect, it } from "vitest";
import { recruitOptions, recruitRound, recruitSkipSupply, recruitTriples, recruitValue, type RecruitOption } from "../src/data/recruits";
import { RULES } from "../src/data/rules";
import { DEFAULT_UNITS } from "../src/data/units";
import { defMap } from "../src/game/army";
import { chooseRecruit, newMatch, nextRound, promotePrice, turnCost, type MatchState } from "../src/game/match";
import { newMissionMatch } from "../src/game/mission";
import { MISSIONS } from "../src/data/campaign";
import { Rng } from "../src/sim/rng";

const units = DEFAULT_UNITS;
const defs = defMap(units);
const ids = units.map((u) => u.id);

// what an option is worth at the game's own prices
const worth = (o: RecruitOption) => {
  const d = defs.get(o.unitId)!;
  return (d.unlockCost ?? 0) + o.count * (d.cost + (o.level - 1) * promotePrice(d)) - o.price;
};

// a random pair of unlock lists
function randomUnlocked(rng: Rng): [string[], string[]] {
  const pick = () => ids.filter(() => rng.next() < 0.25);
  return [pick(), pick()];
}

// a match at the start of a recruit round, with the given supply for side 0
function atRecruitRound(seed: number, supply = 1000): MatchState {
  let m = newMatch(units, seed);
  while (!m.recruit) m = nextRound({ ...m, phase: "result" });
  return { ...m, supply: [supply, m.supply[1]] };
}

describe("recruits", () => {
  it("come on rounds 4, 7, 10…, worth more each time, and the skip pays about 80%", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 10, 13].map(recruitRound)).toEqual([false, false, false, true, false, false, true, true, true]);
    expect([4, 7, 10, 13].map(recruitValue)).toEqual([300, 450, 600, 750]);
    expect([4, 7, 10, 13].map(recruitSkipSupply)).toEqual([250, 350, 500, 600]);
  });

  it("every option is worth exactly the round's value, within the limits", () => {
    const rng = new Rng(1);
    for (let n = 0; n < 300; n++) {
      const seed = rng.int(2 ** 31);
      const round = 1 + RULES.recruitEvery * (1 + rng.int(5));
      const unlocked = randomUnlocked(rng);
      const options = recruitOptions(seed, round, unlocked);
      expect(options.length).toBeLessThanOrEqual(RULES.recruitChoices);
      for (const o of options) {
        expect(worth(o)).toBe(recruitValue(round));
        expect(o.count).toBeGreaterThanOrEqual(1);
        expect(o.level).toBeGreaterThanOrEqual(1);
        expect(o.level).toBeLessThanOrEqual(RULES.recruitMaxLevel);
        expect(o.price).toBeGreaterThanOrEqual(0);
        expect(o.price).toBeLessThanOrEqual(RULES.recruitMaxPrice);
        expect(o.price % 50).toBe(0);
        // never a unit either side has unlocked
        expect(unlocked[0]).not.toContain(o.unitId);
        expect(unlocked[1]).not.toContain(o.unitId);
      }
      expect(new Set(options.map((o) => o.unitId)).size).toBe(options.length);
    }
  });

  it("offers three when there are units to offer, and the spec's worked examples hold", () => {
    expect(recruitOptions(1, 4, [[], []])).toHaveLength(RULES.recruitChoices);
    const knights = recruitTriples(defs.get("knights")!, 300).map((o) => [o.count, o.level, o.price]);
    expect(knights).toEqual(expect.arrayContaining([[1, 1, 0], [1, 2, 100], [2, 1, 200]]));
    expect(recruitTriples(defs.get("giant")!, 300)).toEqual([]);
    expect(recruitTriples(defs.get("dragon")!, 300)).toEqual([]);
    // with everything unlocked there's nothing to offer
    expect(recruitOptions(1, 4, [ids, []])).toEqual([]);
  });

  it("are the same for the same inputs, whichever side unlocked what, and usually differ between seeds", () => {
    const u: [string[], string[]] = [["knights", "crossbowmen"], ["grunts"]];
    expect(recruitOptions(42, 7, u)).toEqual(recruitOptions(42, 7, u));
    expect(recruitOptions(42, 7, u)).toEqual(recruitOptions(42, 7, [u[1], u[0]]));
    const distinct = new Set(Array.from({ length: 20 }, (_, s) => JSON.stringify(recruitOptions(s, 7, u))));
    expect(distinct.size).toBeGreaterThan(10);
  });

  it("keeps Giants and Dragons out of round 4, and a Dragon can come by round 10", () => {
    let dragon = false;
    for (let seed = 0; seed < 400; seed++) {
      const early = recruitOptions(seed, 4, [[], []]).map((o) => o.unitId);
      expect(early).not.toContain("giant");
      expect(early).not.toContain("dragon");
      if (recruitOptions(seed, 10, [[], []]).some((o) => o.unitId === "dragon")) dragon = true;
    }
    expect(dragon).toBe(true);
  });

  it("taking one unlocks the unit, takes its price and places its free squads at its level", () => {
    const m = atRecruitRound(3);
    const offer = m.recruit!;
    offer.options.forEach((o, i) => {
      const took = chooseRecruit(m, 0, i, units);
      expect(took.recruit!.choice).toEqual([i, null]);
      expect(took.unlocked[0]).toContain(o.unitId);
      expect(took.supply[0]).toBe(m.supply[0] - o.price);
      const added = took.armies[0].slice(m.armies[0].length);
      expect(added).toHaveLength(o.count);
      for (const sq of added) {
        expect(sq).toMatchObject({ defId: o.unitId, free: true, round: m.round });
        expect(sq.level ?? 1).toBe(o.level);
      }
      // the free squads cost nothing in a turn, levels included
      expect(turnCost(m, 0, { army: took.armies[0], unlocks: [], upgrades: [], towerUpgrades: [] }, defs)).toBe(0);
      // a second choice is refused
      expect(chooseRecruit(took, 0, "skip", units)).toBe(took);
    });
  });

  it("refuses an option it can't afford or isn't offered; skipping pays the skip supply", () => {
    const m = atRecruitRound(8, 0);
    const dear = m.recruit!.options.findIndex((o) => o.price > 0);
    if (dear >= 0) expect(chooseRecruit(m, 0, dear, units)).toBe(m);
    expect(chooseRecruit(m, 0, 7, units)).toBe(m);
    const skipped = chooseRecruit(m, 0, "skip", units);
    expect(skipped.supply[0]).toBe(recruitSkipSupply(m.round));
    expect(skipped.unlocked[0]).toEqual(m.unlocked[0]);
    expect(skipped.recruit!.choice[0]).toBe("skip");
  });

  it("nextRound sets the offer on recruit rounds only, keeps the last one, and never in a story mission", () => {
    let m = newMatch(units, 11);
    for (let round = 2; round <= 11; round++) {
      const before = m;
      m = nextRound({ ...m, phase: "result" });
      if (recruitRound(round)) {
        expect(m.recruit).toMatchObject({ round, choice: [null, null] });
        expect(m.recruit!.options).toEqual(recruitOptions(m.seed, round, before.unlocked));
      } else expect(m.recruit).toBeNull();
      if (round > 4) expect(m.lastRecruit?.round).toBe(Math.floor((round - 2) / RULES.recruitEvery) * RULES.recruitEvery + 1); // the latest before this round
      m = { ...m, recruit: m.recruit && { ...m.recruit, choice: ["skip", "skip"] } };
    }
    let mission = newMissionMatch(MISSIONS[MISSIONS.length - 1].def);
    for (let round = 2; round <= 10; round++) {
      mission = nextRound({ ...mission, phase: "result" });
      expect(mission.recruit).toBeNull();
    }
  });
});
