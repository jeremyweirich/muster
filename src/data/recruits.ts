// Recruits (docs/RECRUITS.md, DESIGN.md §5): the opening offer, repeated. Every RULES.recruitEvery rounds both sides
// are offered the same RULES.recruitChoices options, or supply instead. An option is a unit neither side has
// unlocked, with X squads of it at level Y placed for you, for Z supply. All the round's options are worth the same at
// the game's own prices: unlock + X × (a level-Y squad) − Z = recruitValue(round).

import { RULES } from "./rules";
import { DEFAULT_UNITS } from "./units";
import { Rng } from "../sim/rng";
import type { UnitDef } from "../sim/types";

export interface RecruitOption {
  unitId: string;
  count: number; // X squads
  level: number; // at level Y
  price: number; // for Z supply
}
export type RecruitChoice = number | "skip"; // an index into the options, or the supply instead
export interface RecruitOffer {
  round: number;
  options: RecruitOption[];
  choice: [RecruitChoice | null, RecruitChoice | null]; // per side
}

export function recruitRound(round: number): boolean {
  return round > 1 && (round - 1) % RULES.recruitEvery === 0;
}

export function recruitValue(round: number): number {
  return RULES.recruitValue(round);
}

export function recruitSkipSupply(round: number): number {
  return Math.round((RULES.recruitSkip * recruitValue(round)) / 50) * 50;
}

// A level-Y squad at the game's prices: the squad plus Y − 1 promotions (half the unit's price each, as promotePrice).
function squadPrice(unit: UnitDef, level: number): number {
  return unit.cost + (level - 1) * Math.round(unit.cost / 2);
}

// Every valid (X, Y, Z) for a unit at this value.
export function recruitTriples(unit: UnitDef, value: number): RecruitOption[] {
  const out: RecruitOption[] = [];
  const unlock = unit.unlockCost ?? 0;
  for (let level = 1; level <= RULES.recruitMaxLevel; level++) {
    const each = squadPrice(unit, level);
    for (let count = 1; ; count++) {
      const price = unlock + count * each - value;
      if (price > RULES.recruitMaxPrice) break;
      if (price >= 0) out.push({ unitId: unit.id, count, level, price });
    }
  }
  return out;
}

// What an option looks like, so the three can read differently.
const shape = (o: RecruitOption) => (o.level > 1 ? "veteran" : o.count > 1 ? "many" : "plain");

// The round's options: a pure function of the match seed, the round and what both sides had unlocked when it
// started, so both PvP browsers compute the same ones (the two unlock lists only count as one set).
export function recruitOptions(seed: number, round: number, unlocked: [string[], string[]], units: UnitDef[] = DEFAULT_UNITS): RecruitOption[] {
  const taken = new Set([...unlocked[0], ...unlocked[1]]);
  const value = recruitValue(round);
  const pool = units
    .filter((u) => !u.structure && !taken.has(u.id))
    .map((u) => recruitTriples(u, value))
    .filter((t) => t.length > 0);
  const rng = new Rng((seed ^ 0x6a09e667 ^ (round * 2654435761)) >>> 0);
  const out: RecruitOption[] = [];
  while (out.length < RULES.recruitChoices && pool.length) {
    const triples = pool.splice(rng.int(pool.length), 1)[0];
    const shapes = new Set(out.map(shape));
    const fresh = triples.filter((t) => !shapes.has(shape(t)));
    out.push(rng.pick(fresh.length ? fresh : triples));
  }
  return out;
}

// The option's squads, one entry per squad.
export function recruitSquads(o: RecruitOption, units: UnitDef[]): UnitDef[] {
  const def = units.find((u) => u.id === o.unitId);
  return def ? Array(o.count).fill(def) : [];
}

// "2× Knights Lv 2"
export function recruitLabel(o: RecruitOption, units: UnitDef[]): string {
  const name = units.find((u) => u.id === o.unitId)?.name ?? o.unitId;
  return `${o.count > 1 ? `${o.count}× ` : ""}${name}${o.level > 1 ? ` Lv ${o.level}` : ""}`;
}
