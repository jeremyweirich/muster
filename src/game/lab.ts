import { Battle } from "../sim/battle";
import { Rng } from "../sim/rng";
import type { PlacedSquad, UnitDef } from "../sim/types";
import { autoPlace, defMap, type DefMap, type PlacementStyle } from "./army";

export interface MatchupResult {
  a: string;
  b: string;
  winRate: number; // a's win rate, draws count as half
  avgRemainA: number; // fraction of a's value surviving
  avgRemainB: number;
  avgTime: number;
  supply: [number, number]; // supply each side actually fielded
}

// Squad counts that put both sides at the same supply (or as close as the prices allow), near `budget`.
// Buying floor(budget / cost) of each would leave a 600-cost unit fighting 1000 supply with 600.
export function equalCostCounts(costA: number, costB: number, budget: number): [number, number] {
  let best: [number, number] = [1, 1];
  let bestScore = Infinity;
  for (let nA = 1; nA * costA <= budget * 2; nA++) {
    const supplyA = nA * costA;
    const nB = Math.max(1, Math.round(supplyA / costB));
    const supplyB = nB * costB;
    const mismatch = Math.abs(supplyA - supplyB) / Math.max(supplyA, supplyB);
    const score = mismatch * 20 + Math.abs(Math.log(Math.max(supplyA, supplyB) / budget));
    if (score < bestScore) {
      bestScore = score;
      best = [nA, nB];
    }
  }
  return best;
}

// `count` squads of `def`, placed automatically.
export function massArmy(def: UnitDef, count: number, side: 0 | 1, defs: DefMap, rng: Rng, style: PlacementStyle = "center"): PlacedSquad[] {
  return autoPlace(Array(Math.max(1, count)).fill(def), [], side, defs, 1, rng, style);
}

const STYLES: PlacementStyle[] = ["center", "spread", "left", "right"];
// A placement style for one side of one fight: always "center", or drawn at random (balance harness).
export function pickStyle(rng: Rng, formations: "center" | "random"): PlacementStyle {
  return formations === "center" ? "center" : STYLES[Math.floor(rng.next() * STYLES.length)];
}

export interface ArmyRun {
  winRate: number;
  remain: [number, number]; // fraction of each side's supply still alive at the end
  supply: [number, number]; // mean supply each side fielded
  time: number;
}

// Fight army A against army B over `seeds` seeds, alternating sides so neither benefits from top/bottom
// asymmetries. `defs` can be one map for both, or [A's, B's] when one side is upgraded.
export function runArmies(
  defs: DefMap | [DefMap, DefMap],
  build: (sideA: 0 | 1, rng: Rng) => [PlacedSquad[], PlacedSquad[]],
  seeds: number,
  seedBase = 0,
): ArmyRun {
  const [defsA, defsB] = Array.isArray(defs) ? defs : [defs, defs];
  let wins = 0;
  const remain: [number, number] = [0, 0];
  const supply: [number, number] = [0, 0];
  let time = 0;
  for (let s = 0; s < seeds; s++) {
    const swap = s % 2 === 1;
    const rng = new Rng(1000 + seedBase + s);
    const sideA: 0 | 1 = swap ? 1 : 0;
    const sideB: 0 | 1 = swap ? 0 : 1;
    const [a, b] = build(sideA, rng);
    const armies: [PlacedSquad[], PlacedSquad[]] = swap ? [b, a] : [a, b];
    const sideDefs: [DefMap, DefMap] = swap ? [defsB, defsA] : [defsA, defsB];
    const r = new Battle(sideDefs, armies, { seed: 77 + seedBase + s, towers: false }).run();
    if (r.winner === sideA) wins++;
    else if (r.winner === null) wins += 0.5;
    const cost = (d: DefMap, id: string) => d.get(id)?.cost ?? 0;
    const total = (d: DefMap, army: PlacedSquad[]) => army.reduce((t, q) => t + cost(d, q.defId), 0);
    const left = (d: DefMap, side: 0 | 1) => r.survivors[side].reduce((t, q) => t + cost(d, q.defId) * (q.alive / q.total), 0);
    const totA = total(defsA, a), totB = total(defsB, b);
    supply[0] += totA;
    supply[1] += totB;
    remain[0] += left(defsA, sideA) / (totA || 1);
    remain[1] += left(defsB, sideB) / (totB || 1);
    time += r.time;
  }
  return {
    winRate: wins / seeds,
    remain: [remain[0] / seeds, remain[1] / seeds],
    supply: [supply[0] / seeds, supply[1] / seeds],
    time: time / seeds,
  };
}

export interface MatchupOptions {
  formations?: "center" | "random";
  defsA?: DefMap; // A's (upgraded) definitions; B always uses `units`
  levelA?: number; // A's veterancy level
  costA?: number; // what one A squad counts as when sizing the armies (a promoted squad cost more)
  seedBase?: number;
}

// One-unit armies of a and b at equal supply, near `budget`.
export function runMatchup(units: UnitDef[], aId: string, bId: string, budget: number, seeds: number, opts: MatchupOptions = {}): MatchupResult {
  const defs = defMap(units);
  const defsA = opts.defsA ?? defs;
  const a = defsA.get(aId)!;
  const b = defs.get(bId)!;
  const [nA, nB] = equalCostCounts(opts.costA ?? a.cost, b.cost, budget);
  const formations = opts.formations ?? "center";
  const level = opts.levelA ?? 1;
  const r = runArmies(
    [defsA, defs],
    (sideA, rng) => [
      massArmy(a, nA, sideA, defsA, rng, pickStyle(rng, formations)).map((q) => (level > 1 ? { ...q, level } : q)),
      massArmy(b, nB, sideA === 0 ? 1 : 0, defs, rng, pickStyle(rng, formations)),
    ],
    seeds,
    opts.seedBase,
  );
  return { a: aId, b: bId, winRate: r.winRate, avgRemainA: r.remain[0], avgRemainB: r.remain[1], avgTime: r.time, supply: r.supply };
}
