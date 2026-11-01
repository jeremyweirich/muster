import { BALANCE_TARGETS, ROLE_INFO, SIZE_CLASS, type SizeClass } from "../data/balance";
import type { UnitDef } from "../sim/types";

// Cost-normalized unit metrics and the Nash check from docs/BALANCE.md. They read raw stats only: splash,
// chains, statuses, ramping and closing time are what the simulator measures on top of them.

// Single-target damage per second of one model.
export function modelDps(def: UnitDef): number {
  const a = def.attack;
  return a ? a.damage / a.cooldown : 0;
}

// Self-TTK = HP ÷ own DPS: how long one model takes to kill a copy of itself, ignoring squad size.
// With `armor`, the unit's resistance to its own element counts (Knights resist their own swords).
// Null for units that don't attack; Infinity for units immune to their own element.
export function selfTtk(def: UnitDef, armor = false): number | null {
  const dps = modelDps(def);
  if (!dps) return null;
  const resist = armor ? (def.resist?.[def.attack!.element] ?? 0) : 0;
  if (resist >= 1) return Infinity;
  return def.hp / (dps * (1 - resist));
}

// The self-TTK the role bands are checked against: with armor, unless the unit is immune to its own element
// (a Fire Elemental can't burn itself), where only the raw number means anything.
export function bandTtk(def: UnitDef): number | null {
  const armored = selfTtk(def, true);
  return armored === Infinity ? selfTtk(def) : armored;
}

// HP and DPS bought by 100 supply.
export function perSupply(def: UnitDef): { hp: number; dps: number } {
  const k = (def.squadSize * 100) / def.cost;
  return { hp: def.hp * k, dps: modelDps(def) * k };
}

// Lanchester's square law: at equal cost, fighting strength ≈ total HP × total DPS. Relative to `baseline`
// (value 1.0), so 2.0 means twice the baseline's strength in a flat, open slugfest.
export function lanchesterValue(def: UnitDef, baseline: UnitDef): number {
  const s = perSupply(def), b = perSupply(baseline);
  return (s.hp * s.dps) / (b.hp * b.dps);
}

export function sizeClass(def: UnitDef): SizeClass | undefined {
  for (const t of def.tags) if (SIZE_CLASS[t]) return SIZE_CLASS[t];
  return undefined;
}

export function ttkBand(def: UnitDef): [number, number] | null {
  const t = BALANCE_TARGETS[def.id];
  if (!t) return null;
  return t.ttk ?? ROLE_INFO[t.role].ttk;
}

// The equilibrium mix of a symmetric zero-sum game, by fictitious play. `payoff[i][j]` is what strategy i
// earns against j; it's antisymmetrized first so sampling noise can't favor either side. Returns one weight
// per strategy, summing to 1. A healthy roster puts weight on many units.
export function nashMix(payoff: number[][], iterations = 20000): number[] {
  const n = payoff.length;
  const p = payoff.map((row, i) => row.map((v, j) => (v - payoff[j][i]) / 2));
  const counts = new Array(n).fill(0);
  const vsMix = new Array(n).fill(0); // sum over past plays j of p[i][j]
  counts[0] = 1;
  for (let i = 0; i < n; i++) vsMix[i] = p[i][0];
  for (let it = 1; it < iterations; it++) {
    let best = 0;
    for (let i = 1; i < n; i++) if (vsMix[i] > vsMix[best]) best = i;
    counts[best]++;
    for (let i = 0; i < n; i++) vsMix[i] += p[i][best];
  }
  return counts.map((c) => c / iterations);
}
