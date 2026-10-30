import { Battle } from "../sim/battle";
import { Rng } from "../sim/rng";
import type { PlacedSquad, UnitDef } from "../sim/types";
import { autoPlace, defMap, type DefMap } from "./army";

export interface MatchupResult {
  a: string;
  b: string;
  winRate: number; // a's win rate, draws count as half
  avgRemainA: number; // fraction of a's value surviving
  avgRemainB: number;
  avgTime: number;
}

// Buy as many squads of `def` as the budget allows (at least one).
export function massArmy(def: UnitDef, budget: number, side: 0 | 1, defs: DefMap, rng: Rng): PlacedSquad[] {
  const count = Math.max(1, Math.floor(budget / def.cost));
  return autoPlace(Array(count).fill(def), [], side, defs, 1, rng, "center");
}

export function runArmies(
  defs: DefMap,
  build: (side: 0 | 1, rng: Rng) => [PlacedSquad[], PlacedSquad[]],
  seeds: number,
): { winRate: number; remain: [number, number]; time: number } {
  let wins = 0;
  const remain: [number, number] = [0, 0];
  let time = 0;
  for (let s = 0; s < seeds; s++) {
    // alternate sides so neither army benefits from top/bottom asymmetries
    const swap = s % 2 === 1;
    const rng = new Rng(1000 + s);
    const [a, b] = build(swap ? 1 : 0, rng);
    const battle = new Battle(defs, swap ? [b, a] : [a, b], { seed: 77 + s, towers: false });
    const r = battle.run();
    const sideA = swap ? 1 : 0;
    const sideB = swap ? 0 : 1;
    if (r.winner === sideA) wins++;
    else if (r.winner === null) wins += 0.5;
    const val = (side: 0 | 1, army: PlacedSquad[]) => {
      const total = army.reduce((t, q) => t + (defs.get(q.defId)?.cost ?? 0), 0) || 1;
      const left = r.survivors[side].reduce((t, q) => t + (defs.get(q.defId)?.cost ?? 0) * (q.alive / q.total), 0);
      return left / total;
    };
    remain[0] += val(sideA, a);
    remain[1] += val(sideB, b);
    time += r.time;
  }
  return { winRate: wins / seeds, remain: [remain[0] / seeds, remain[1] / seeds], time: time / seeds };
}

export function runMatchup(units: UnitDef[], aId: string, bId: string, budget: number, seeds: number): MatchupResult {
  const defs = defMap(units);
  const a = defs.get(aId)!;
  const b = defs.get(bId)!;
  const r = runArmies(
    defs,
    (sideA, rng) => [massArmy(a, budget, sideA, defs, rng), massArmy(b, budget, sideA === 0 ? 1 : 0, defs, rng)],
    seeds,
  );
  return { a: aId, b: bId, winRate: r.winRate, avgRemainA: r.remain[0], avgRemainB: r.remain[1], avgTime: r.time };
}
