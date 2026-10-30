import { STATUSES, SURFACES } from "../data/elements";
import { describeSelector } from "../sim/selectors";
import type { Effect, TraitDef, UnitDef } from "../sim/types";

export function describeEffect(e: Effect): string {
  const area = "radius" in e && e.radius ? ` (radius ${e.radius})` : "";
  switch (e.type) {
    case "damage":
      return `${e.amount} ${e.element} damage${area}`;
    case "status":
      return `applies ${STATUSES[e.status].name}${e.duration ? ` for ${e.duration}s` : ""}${area}`;
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
      return `Regenerates ${t.perSecond} hp/s`;
    case "periodic":
      return `Every ${t.interval}s: ${t.effects.map(describeEffect).join(", ")}`;
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
