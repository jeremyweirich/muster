import { matches, describeSelector } from "../sim/selectors";
import type { UnitDef } from "../sim/types";

// The Counters tab answers "I'm getting wrecked by X, what do I build?" with one-unit armies at equal
// supply (runMatchup), level 1 and no upgrades. These helpers explain a matchup in plain words, read
// from the two units' data. `topic` is a Codex anchor (see src/ui/codexLinks.tsx).

export const COUNTER_BUDGET = 1000;
export const COUNTER_SEEDS = 4;

export interface Reason {
  text: string;
  topic?: string;
}

const hitsAir = (d: UnitDef) => !!d.attack?.targets.includes("air");
const range = (d: UnitDef) => d.attack?.range ?? 0;
const hasRole = (d: UnitDef, role: string) => d.tags.includes(`role:${role}`);
const isSwarm = (d: UnitDef) => d.squadSize >= 8;
const isBackLine = (d: UnitDef) => range(d) >= 4 || hasRole(d, "slow");
const muchFaster = (a: UnitDef, b: UnitDef) => a.speed >= b.speed * 1.8;
const resist = (d: UnitDef, el: string) => d.resist?.[el as keyof NonNullable<UnitDef["resist"]>] ?? 0;
// Selectors are written from the attacker's side, so check the target as an enemy.
const hits = (sel: Parameters<typeof matches>[0], target: UnitDef) => matches(sel, target, 1, 0);

// Why `unit` does well against `enemy`.
export function strengths(unit: UnitDef, enemy: UnitDef): Reason[] {
  const out: Reason[] = [];
  const a = unit.attack;
  const e = enemy.attack;
  if (!a) return out;
  if (enemy.layer === "air" && hitsAir(unit)) out.push({ text: "Shoots down fliers", topic: "role-antiair" });
  if (unit.layer === "air" && (!e || !hitsAir(enemy))) out.push({ text: `Flies, and ${enemy.name} can't hit air`, topic: "role-flier" });
  if (!e) out.push({ text: `${enemy.name} can't fight back` });
  for (const b of a.bonusVs ?? [])
    if (hits(b.selector, enemy)) out.push({ text: `×${b.mult} damage to ${describeSelector(b.selector)}`, topic: hasRole(unit, "antilarge") ? "role-antilarge" : undefined });
  if (a.prefers && hits(a.prefers, enemy)) out.push({ text: "Goes for it first", topic: "role-raider" });
  if (e && range(unit) >= 4 && range(unit) > range(enemy) + 2) out.push({ text: `Outranges it (${range(unit)} vs ${range(enemy)} tiles)`, topic: "role-ranged" });
  if (a.splash && isSwarm(enemy)) out.push({ text: "Splash hits the whole swarm", topic: "role-splash" });
  if (muchFaster(unit, enemy) && isBackLine(enemy)) out.push({ text: "Fast enough to run it down", topic: "role-fast" });
  if (resist(enemy, a.element) < 0) out.push({ text: `Hits its weakness: ${a.element}`, topic: `element-${a.element}` });
  else if (a.element !== "physical" && resist(enemy, "physical") >= 0.2 && resist(enemy, a.element) <= 0)
    out.push({ text: `${a.element} goes through its armor`, topic: `element-${a.element}` });
  const regen = enemy.traits?.find((t) => t.type === "regen");
  if (regen?.type === "regen" && regen.suppressedBy && a.onHit?.some((h) => h.type === "status" && h.status === regen.suppressedBy))
    out.push({ text: "Stops it regenerating", topic: `status-${regen.suppressedBy}` });
  if (e && resist(unit, e.element) >= 0.3) out.push({ text: `Shrugs off its ${e.element} attacks`, topic: "resistance" });
  if (isSwarm(unit) && e && !e.splash && !e.chain && e.damage >= unit.hp * 3) out.push({ text: "Too many bodies for its big single hits", topic: "role-swarm" });
  return out;
}

// Why `unit` struggles against `enemy`.
export function weaknesses(unit: UnitDef, enemy: UnitDef): Reason[] {
  const out: Reason[] = [];
  const a = unit.attack;
  const e = enemy.attack;
  if (!a) out.push({ text: "Has no attack of its own", topic: "role-support" });
  else if (enemy.layer === "air" && !hitsAir(unit)) out.push({ text: "Can't hit fliers", topic: "layers" });
  if (!e) return out;
  for (const b of e.bonusVs ?? []) if (hits(b.selector, unit)) out.push({ text: `Takes ×${b.mult} damage from it`, topic: hasRole(enemy, "antilarge") ? "role-antilarge" : undefined });
  if (e.prefers && hits(e.prefers, unit)) out.push({ text: "Gets targeted first", topic: "role-raider" });
  if (e.splash && isSwarm(unit)) out.push({ text: "Its splash shreds swarms", topic: "role-splash" });
  if (a && range(enemy) >= 4 && range(enemy) > range(unit) + 2) out.push({ text: "Gets shot on the way in", topic: "role-ranged" });
  if (muchFaster(enemy, unit) && isBackLine(unit)) out.push({ text: "Gets run down", topic: "role-fast" });
  if (resist(unit, e.element) < 0) out.push({ text: `Weak to ${e.element}`, topic: `element-${e.element}` });
  if (a && resist(enemy, a.element) >= 0.3) out.push({ text: `Its ${a.element} attacks are resisted`, topic: "resistance" });
  return out;
}
