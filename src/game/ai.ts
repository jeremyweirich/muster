import { Battle } from "../sim/battle";
import { Rng } from "../sim/rng";
import type { PlacedSquad, UnitDef } from "../sim/types";
import { armyValue, autoPlace, priceOf, type DefMap, type PlacementStyle } from "./army";

export type Difficulty = "easy" | "normal" | "hard";

const CANDIDATES: Record<Difficulty, number> = { easy: 3, normal: 12, hard: 30 };
const TIME_BUDGET_MS: Record<Difficulty, number> = { easy: 400, normal: 1500, hard: 3500 };
const STYLES: PlacementStyle[] = ["center", "spread", "left", "right"];
// How much a fresh unlock is worth beyond this round, as a fraction of its price.
const UNLOCK_FUTURE_VALUE = 0.5;

export interface AiPlan {
  squads: PlacedSquad[];
  unlocks: string[];
  spent: number; // squads + unlocks
  candidatesTried: number;
  bestScore: number | null;
}

interface Purchase {
  units: UnitDef[];
  unlocks: UnitDef[];
  spent: number;
}

function randomPurchase(units: UnitDef[], unlockedIds: string[], supply: number, rng: Rng, focus?: UnitDef): Purchase {
  const unlocked = new Set(unlockedIds);
  const out: Purchase = { units: [], unlocks: [], spent: 0 };
  let left = supply;
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
    }
    out.units.push(pick);
    out.spent += price;
    left -= price;
    if (out.units.length >= 8) break;
  }
  return out;
}

// The AI plans by simulation: generate candidate purchases + placements, play
// each against the army the player fielded last round, keep the best. Since it
// only uses the simulator, it automatically understands any unit you design.
export function planAiRound(
  units: UnitDef[],
  defs: DefMap,
  aiArmy: PlacedSquad[],
  aiUnlocked: string[],
  playerArmy: PlacedSquad[],
  supply: number,
  round: number,
  difficulty: Difficulty,
  seed: number,
): AiPlan {
  const rng = new Rng(seed);
  const n = CANDIDATES[difficulty];
  const start = performance.now();
  const candidates: { squads: PlacedSquad[]; buy: Purchase }[] = [];

  for (let i = 0; i < n; i++) {
    const focus = i % 2 === 0 ? rng.pick(units) : undefined;
    const buy = randomPurchase(units, aiUnlocked, supply, rng, focus);
    const squads = autoPlace(buy.units, aiArmy, 1, defs, round, rng, rng.pick(STYLES));
    candidates.push({ squads, buy });
  }

  const planOf = (c: (typeof candidates)[number], tried: number, score: number | null): AiPlan => {
    // a squad that didn't fit on the field isn't paid for
    const placedValue = armyValue(c.squads, defs);
    const unlockCost = c.buy.unlocks.reduce((s, u) => s + (u.unlockCost ?? 0), 0);
    return { squads: c.squads, unlocks: c.buy.unlocks.map((u) => u.id), spent: placedValue + unlockCost, candidatesTried: tried, bestScore: score };
  };

  if (playerArmy.length === 0 || units.length === 0 || !candidates.length) {
    return candidates.length ? planOf(candidates[0], 1, null) : { squads: [], unlocks: [], spent: 0, candidatesTried: 0, bestScore: null };
  }

  let best = candidates[0];
  let bestScore = -Infinity;
  let tried = 0;
  for (const cand of candidates) {
    if (tried > 0 && performance.now() - start > TIME_BUDGET_MS[difficulty]) break;
    tried++;
    const battle = new Battle(defs, [playerArmy, [...aiArmy, ...cand.squads]], { seed: seed + tried });
    const r = battle.run();
    const value = (side: 0 | 1) =>
      r.survivors[side].reduce((s, q) => s + (defs.get(q.defId)?.cost ?? 0) * (q.alive / q.total), 0);
    let score = value(1) - value(0);
    if (r.winner === 1) score += 1000;
    if (r.winner === 0) score -= 1000;
    score += cand.buy.unlocks.reduce((s, u) => s + (u.unlockCost ?? 0), 0) * UNLOCK_FUTURE_VALUE;
    // a little personality on easier settings
    if (difficulty === "easy") score += rng.range(-800, 800);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return planOf(best, tried, bestScore);
}
