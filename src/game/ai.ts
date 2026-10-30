import { Battle } from "../sim/battle";
import { Rng } from "../sim/rng";
import type { PlacedSquad, UnitDef } from "../sim/types";
import { upgradedDefs, type UpgradeState } from "../sim/upgrades";
import { armyValue, autoPlace, priceOf, towerUpgradePrice, upgradePrice, type DefMap, type PlacementStyle } from "./army";

export type Difficulty = "easy" | "normal" | "hard";

const CANDIDATES: Record<Difficulty, number> = { easy: 3, normal: 12, hard: 30 };
const TIME_BUDGET_MS: Record<Difficulty, number> = { easy: 400, normal: 1500, hard: 3500 };
const STYLES: PlacementStyle[] = ["center", "spread", "left", "right"];
// How much one-time purchases (unlocks, upgrades, tower levels) are worth beyond
// this round, as a fraction of their price.
const FUTURE_VALUE = 0.5;

export interface AiSide {
  army: PlacedSquad[];
  unlocked: string[];
  upgrades: UpgradeState;
  towerLevels: number[];
  supply: number;
}

export interface AiPlan {
  squads: PlacedSquad[];
  unlocks: string[];
  upgrades: { unitId: string; upgradeId: string }[];
  towerUpgrades: number[]; // tower indexes, one entry per level bought
  spent: number;
  candidatesTried: number;
  bestScore: number | null;
}

interface Candidate {
  units: UnitDef[];
  unlocks: UnitDef[];
  upgrades: { unitId: string; upgradeId: string }[];
  towerUpgrades: number[];
  investment: number; // spent on one-time purchases
}

function randomPurchase(units: UnitDef[], me: AiSide, rng: Rng, focus?: UnitDef): Candidate {
  const unlocked = new Set(me.unlocked);
  const out: Candidate = { units: [], unlocks: [], upgrades: [], towerUpgrades: [], investment: 0 };
  let left = me.supply;
  const levels = [...me.towerLevels];

  // sometimes reinforce a tower first
  if (rng.next() < 0.2) {
    const i = rng.int(levels.length);
    const p = towerUpgradePrice(levels[i]);
    if (p !== null && p <= left * 0.5) {
      out.towerUpgrades.push(i);
      levels[i]++;
      left -= p;
      out.investment += p;
    }
  }
  // sometimes upgrade something already in the army
  if (rng.next() < 0.35) {
    const owned = [...new Set(me.army.map((s) => s.defId))].map((id) => units.find((u) => u.id === id)).filter((u): u is UnitDef => !!u);
    const def = owned.length ? rng.pick(owned) : undefined;
    const bought = def ? me.upgrades[def.id] ?? [] : [];
    const options = def?.upgrades?.filter((u) => !bought.includes(u.id)) ?? [];
    const price = def ? upgradePrice(def, bought.length) : null;
    if (def && options.length && price !== null && price <= left * 0.6) {
      out.upgrades.push({ unitId: def.id, upgradeId: rng.pick(options).id });
      left -= price;
      out.investment += price;
    }
  }

  // usually stick with what's already unlocked; sometimes reach for something new
  const allowNew = rng.next() < 0.45;
  for (let guard = 0; guard < 12; guard++) {
    const affordable = units.filter((u) => priceOf(u, unlocked) <= left && (allowNew || unlocked.has(u.id)));
    if (!affordable.length) break;
    const pick = focus && priceOf(focus, unlocked) <= left && rng.next() < 0.6 ? focus : rng.pick(affordable);
    const price = priceOf(pick, unlocked);
    if (!unlocked.has(pick.id)) {
      unlocked.add(pick.id);
      out.unlocks.push(pick);
      out.investment += pick.unlockCost ?? 0;
    }
    out.units.push(pick);
    left -= price;
    if (out.units.length >= 8) break;
  }
  return out;
}

export interface PlayerView {
  army: PlacedSquad[];
  upgrades: UpgradeState;
  towerLevels: number[];
}

// The AI plans by simulation: generate candidate purchases + placements, play
// each against the army the player fielded last round, keep the best. Since it
// only uses the simulator, it automatically understands any unit you design.
export function planAiRound(
  units: UnitDef[],
  defs: DefMap,
  me: AiSide,
  player: PlayerView,
  round: number,
  difficulty: Difficulty,
  seed: number,
): AiPlan {
  const rng = new Rng(seed);
  const n = CANDIDATES[difficulty];
  const start = performance.now();
  const playerDefs = upgradedDefs(defs, player.upgrades);
  const candidates: { squads: PlacedSquad[]; c: Candidate }[] = [];

  for (let i = 0; i < n; i++) {
    const focus = i % 2 === 0 ? rng.pick(units) : undefined;
    const c = randomPurchase(units, me, rng, focus);
    const squads = autoPlace(c.units, me.army, 1, defs, round, rng, rng.pick(STYLES));
    candidates.push({ squads, c });
  }

  const planOf = (cand: (typeof candidates)[number] | undefined, tried: number, score: number | null): AiPlan => {
    if (!cand) return { squads: [], unlocks: [], upgrades: [], towerUpgrades: [], spent: 0, candidatesTried: 0, bestScore: null };
    // a squad that didn't fit on the field isn't paid for
    const spent = armyValue(cand.squads, defs) + cand.c.investment;
    return {
      squads: cand.squads,
      unlocks: cand.c.unlocks.map((u) => u.id),
      upgrades: cand.c.upgrades,
      towerUpgrades: cand.c.towerUpgrades,
      spent,
      candidatesTried: tried,
      bestScore: score,
    };
  };

  if (units.length === 0) return planOf(candidates[0], 1, null);

  // Before the player has shown anything (round 1), test plans against a stand-in
  // army of starter units bought with the same supply.
  let opponent = player.army;
  if (opponent.length === 0) {
    const starters = units.filter((u) => !u.unlockCost);
    const pool = starters.length ? starters : units;
    const buy: UnitDef[] = [];
    let left = me.supply;
    for (let guard = 0; guard < 10; guard++) {
      const affordable = pool.filter((u) => u.cost <= left);
      if (!affordable.length) break;
      const pick = rng.pick(affordable);
      buy.push(pick);
      left -= pick.cost;
    }
    opponent = autoPlace(buy, [], 0, defs, round, rng, "center");
  }

  let best = candidates[0];
  let bestScore = -Infinity;
  let tried = 0;
  for (const cand of candidates) {
    if (tried > 0 && performance.now() - start > TIME_BUDGET_MS[difficulty]) break;
    tried++;
    const myUpgrades: UpgradeState = { ...me.upgrades };
    for (const u of cand.c.upgrades) myUpgrades[u.unitId] = [...(myUpgrades[u.unitId] ?? []), u.upgradeId];
    const myLevels = [...me.towerLevels];
    for (const i of cand.c.towerUpgrades) myLevels[i]++;
    const battle = new Battle([playerDefs, upgradedDefs(defs, myUpgrades)], [opponent, [...me.army, ...cand.squads]], {
      seed: seed + tried,
      towerLevels: [player.towerLevels, myLevels],
    });
    const r = battle.run();
    const value = (side: 0 | 1) =>
      r.survivors[side].reduce((s, q) => s + (defs.get(q.defId)?.cost ?? 0) * (q.alive / q.total), 0);
    let score = value(1) - value(0);
    if (r.winner === 1) score += 1000;
    if (r.winner === 0) score -= 1000;
    score += cand.c.investment * FUTURE_VALUE;
    // a little personality on easier settings
    if (difficulty === "easy") score += rng.range(-800, 800);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return planOf(best, tried, bestScore);
}
