import { STATUSES, SURFACES } from "../data/elements";
import { describeSelector } from "../sim/selectors";
import type { Effect, StatMod, TraitDef, UnitDef, UpgradeDef } from "../sim/types";

export function describeEffect(e: Effect): string {
  const area = "radius" in e && e.radius ? ` (radius ${e.radius})` : "";
  switch (e.type) {
    case "damage":
      return `${e.amount} ${e.element} damage${area}`;
    case "status": {
      const who = e.affects && e.affects !== "all" ? ` to ${e.affects}` : "";
      const where = e.global ? " (whole field)" : area;
      return `applies ${STATUSES[e.status].name}${who}${e.duration ? ` for ${e.duration}s` : ""}${where}`;
    }
    case "surface":
      return `creates ${SURFACES[e.surface].name}${area}`;
    case "heal":
      return `heals allies ${e.amount}${area}`;
  }
}

export function describeTrait(t: TraitDef): string {
  switch (t.type) {
    case "onDeath":
      return `On death: ${t.effects.map(describeEffect).join(", ")}`;
    case "regen":
      return `Regenerates ${t.perSecond} hp/s${t.suppressedBy ? ` (not while ${STATUSES[t.suppressedBy].name})` : ""}`;
    case "periodic":
      return `Every ${t.interval}s: ${t.effects.map(describeEffect).join(", ")}`;
    case "retaliate":
      return `When hit: ${t.effects.map(describeEffect).join(", ")} on the attacker${t.maxRange !== undefined ? ` (within ${t.maxRange})` : ""}`;
    case "charge":
      return `First strike deals ×${t.mult} damage`;
    case "aura": {
      const bits: string[] = [];
      if (t.attackSpeed) bits.push(`+${Math.round((t.attackSpeed - 1) * 100)}% attack speed`);
      if (t.moveSpeed) bits.push(`+${Math.round((t.moveSpeed - 1) * 100)}% move speed`);
      if (t.damage) bits.push(`+${Math.round((t.damage - 1) * 100)}% damage`);
      return `Aura (${t.radius}): ${describeSelector(t.selector)} get ${bits.join(", ") || "nothing"}`;
    }
  }
}

export interface DerivedStats {
  squadHp: number;
  modelDps: number;
  squadDps: number;
  hpPerCost: number;
  dpsPerCost: number;
}

export function derived(def: UnitDef): DerivedStats {
  const modelDps = def.attack && def.attack.cooldown > 0 ? def.attack.damage / def.attack.cooldown : 0;
  const squadHp = def.hp * def.squadSize;
  const squadDps = modelDps * def.squadSize;
  return {
    squadHp,
    modelDps,
    squadDps,
    hpPerCost: def.cost ? squadHp / def.cost : 0,
    dpsPerCost: def.cost ? (squadDps / def.cost) * 100 : 0,
  };
}

const STAT_NAMES: Record<StatMod["stat"], string> = {
  hp: "HP",
  speed: "speed",
  size: "size",
  spacing: "spacing",
  squadSize: "squad size",
  damage: "damage",
  cooldown: "cooldown",
  range: "range",
  splash: "splash",
  chainCount: "chain jumps",
};

function describeMod(m: StatMod): string {
  const parts: string[] = [];
  if (m.mult !== undefined && m.mult !== 1) parts.push(`${m.mult > 1 ? "+" : "−"}${Math.round(Math.abs(m.mult - 1) * 100)}%`);
  if (m.add) parts.push(`${m.add > 0 ? "+" : "−"}${Math.abs(m.add)}`);
  return `${parts.join(" ")} ${STAT_NAMES[m.stat]}`;
}

// A mechanical summary of what an upgrade changes (the description is the flavor).
export function describeUpgrade(u: UpgradeDef): string[] {
  const out: string[] = [];
  for (const m of u.mods ?? []) out.push(describeMod(m));
  if (u.element) out.push(`attacks become ${u.element}`);
  if (u.targets) out.push(`hits ${u.targets.join(" + ")}`);
  if (u.targeting) out.push(u.targeting === "towers" ? "hunts towers first" : `targets ${u.targeting}`);
  for (const e of u.onHit ?? []) out.push(`on hit: ${describeEffect(e)}`);
  if (u.onHitAffects) out.push(`on-hit statuses only land on ${u.onHitAffects === "all" ? "anyone" : u.onHitAffects}`);
  for (const t of u.traits ?? []) out.push((u.replaceTraits ? "becomes: " : "") + describeTrait(t));
  for (const [el, v] of Object.entries(u.resist ?? {})) out.push(`${v! > 0 ? "+" : "−"}${Math.abs(Math.round(v! * 100))}% ${el} resistance`);
  return out;
}
