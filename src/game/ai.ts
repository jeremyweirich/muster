import { Battle } from "../sim/battle";
import { Rng } from "../sim/rng";
import type { PlacedSquad, UnitDef } from "../sim/types";
import { armyValue, autoPlace, type DefMap, type PlacementStyle } from "./army";

export type Difficulty = "easy" | "normal" | "hard";

const CANDIDATES: Record<Difficulty, number> = { easy: 3, normal: 12, hard: 30 };
const TIME_BUDGET_MS: Record<Difficulty, number> = { easy: 400, normal: 1500, hard: 3500 };
const STYLES: PlacementStyle[] = ["center", "spread", "left", "right"];

export interface AiPlan {
  squads: PlacedSquad[];
  spent: number;
  candidatesTried: number;
  bestScore: number | null;
}

function randomPurchase(units: UnitDef[], supply: number, rng: Rng, focus?: UnitDef): UnitDef[] {
  const out: UnitDef[] = [];
  let left = supply;
  const minCost = Math.min(...units.map((u) => u.cost));
  while (left >= minCost) {
    const affordable = units.filter((u) => u.cost <= left);
    const pick = focus && focus.cost <= left && rng.next() < 0.6 ? focus : rng.pick(affordable);
    out.push(pick);
    left -= pick.cost;
    if (out.length >= 8) break;
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
  playerArmy: PlacedSquad[],
  supply: number,
  round: number,
  difficulty: Difficulty,
  seed: number,
): AiPlan {
  const rng = new Rng(seed);
  const n = CANDIDATES[difficulty];
  const start = performance.now();
  const candidates: PlacedSquad[][] = [];

  for (let i = 0; i < n; i++) {
    const focus = i % 2 === 0 ? rng.pick(units) : undefined;
    const buy = randomPurchase(units, supply, rng, focus);
    candidates.push(autoPlace(buy, aiArmy, 1, defs, round, rng, rng.pick(STYLES)));
  }

  if (playerArmy.length === 0 || units.length === 0) {
    const pick = candidates[0] ?? [];
    return { squads: pick, spent: armyValue(pick, defs), candidatesTried: 1, bestScore: null };
  }

  let best: PlacedSquad[] = candidates[0];
  let bestScore = -Infinity;
  let tried = 0;
  for (const cand of candidates) {
    if (tried > 0 && performance.now() - start > TIME_BUDGET_MS[difficulty]) break;
    tried++;
    const battle = new Battle(defs, [playerArmy, [...aiArmy, ...cand]], { seed: seed + tried });
    const r = battle.run();
    const value = (side: 0 | 1) =>
      r.survivors[side].reduce((s, q) => s + (defs.get(q.defId)?.cost ?? 0) * (q.alive / q.total), 0);
    let score = value(1) - value(0);
    if (r.winner === 1) score += 1000;
    if (r.winner === 0) score -= 1000;
    // a little personality on easier settings
    if (difficulty === "easy") score += rng.range(-800, 800);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return { squads: best, spent: armyValue(best, defs), candidatesTried: tried, bestScore };
}
