// The opening offer (DESIGN.md §5): in round 1 both sides are offered the same three packs, drawn from this pool,
// or flat supply instead (RULES.openingFlat). A pack is two units, already unlocked, with squads worth exactly
// RULES.openingPackValue (unlock prices don't count), placed for you, plus RULES.openingPackSupply to spend.
// The pool is every pair of faction units, from any factions, whose squads can make that value. Independents stay
// out: a pack's two unlocks are priced at 2 × 100. Same-faction packs are for the campaign. A test checks the sums.

import { RULES } from "./rules";
import { DEFAULT_UNITS } from "./units";
import type { UnitDef } from "../sim/types";

export interface OpeningPack {
  units: { id: string; count: number }[];
}

// One pack per pair: of the counts that make the value, the one that splits it most evenly between the two units.
export function openingPacks(units: UnitDef[], value = RULES.openingPackValue): OpeningPack[] {
  const pool = units.filter((u) => !u.tags.includes("faction:independent"));
  const packs: OpeningPack[] = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      const [a, b] = [pool[i], pool[j]];
      let best: [number, number] | null = null;
      for (let n = 1; n * a.cost + b.cost <= value; n++) {
        const rest = value - n * a.cost;
        if (rest % b.cost !== 0) continue;
        const gap = Math.abs(n * a.cost - rest);
        if (!best || gap < Math.abs(best[0] * a.cost - best[1] * b.cost)) best = [n, rest / b.cost];
      }
      if (best) packs.push({ units: [{ id: a.id, count: best[0] }, { id: b.id, count: best[1] }] });
    }
  return packs;
}

export const OPENING_PACKS: OpeningPack[] = openingPacks(DEFAULT_UNITS);
