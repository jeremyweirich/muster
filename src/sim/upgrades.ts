import type { ModStat, UnitDef, UpgradeDef } from "./types";

function modValue(base: number, mods: { mult?: number; add?: number }[]): number {
  let v = base;
  for (const m of mods) v = v * (m.mult ?? 1) + (m.add ?? 0);
  return v;
}

// A unit with its purchased upgrades applied, in purchase order. Pure: returns a new def.
export function applyUpgrades(def: UnitDef, upgradeIds: string[]): UnitDef {
  const ups = upgradeIds.map((id) => def.upgrades?.find((u) => u.id === id)).filter((u): u is UpgradeDef => !!u);
  if (!ups.length) return def;
  const out: UnitDef = structuredClone(def);
  for (const up of ups) {
    const mods = (stat: ModStat) => (up.mods ?? []).filter((m) => m.stat === stat);
    out.hp = Math.round(modValue(out.hp, mods("hp")));
    out.speed = modValue(out.speed, mods("speed"));
    out.size = modValue(out.size, mods("size"));
    out.spacing = modValue(out.spacing ?? 0, mods("spacing")) || undefined;
    out.squadSize = Math.max(1, Math.round(modValue(out.squadSize, mods("squadSize"))));
    if (out.attack) {
      const a = out.attack;
      a.damage = modValue(a.damage, mods("damage"));
      a.cooldown = Math.max(0.1, modValue(a.cooldown, mods("cooldown")));
      a.range = modValue(a.range, mods("range"));
      a.splash = modValue(a.splash ?? 0, mods("splash")) || undefined;
      if (a.chain) a.chain = { ...a.chain, count: Math.round(modValue(a.chain.count, mods("chainCount"))) };
      if (up.element) a.element = up.element;
      if (up.targets) a.targets = [...up.targets];
      if (up.targeting) a.targeting = up.targeting;
      if (up.delivery) a.delivery = up.delivery;
      if (up.projectileSpeed) a.projectileSpeed = up.projectileSpeed;
      if (up.onHit?.length) a.onHit = [...(a.onHit ?? []), ...structuredClone(up.onHit)];
      if (up.onHitAffects) a.onHit = a.onHit?.map((e) => (e.type === "status" ? { ...e, affects: up.onHitAffects } : e));
      if (up.bonusVs?.length) a.bonusVs = [...(a.bonusVs ?? []), ...structuredClone(up.bonusVs)];
      if (up.rangeVs?.length) a.rangeVs = [...(a.rangeVs ?? []), ...structuredClone(up.rangeVs)];
      if (up.prefers) a.prefers = structuredClone(up.prefers);
    }
    if (up.traits?.length || up.replaceTraits) {
      const added = structuredClone(up.traits ?? []);
      out.traits = up.replaceTraits ? added : [...(out.traits ?? []), ...added];
    }
    if (up.resist) {
      const r = { ...out.resist };
      for (const [el, v] of Object.entries(up.resist)) r[el as keyof typeof r] = (r[el as keyof typeof r] ?? 0) + (v ?? 0);
      out.resist = r;
    }
    if (up.immuneStatuses?.length) out.immuneStatuses = [...new Set([...(out.immuneStatuses ?? []), ...up.immuneStatuses])];
    if (up.tags) out.tags = [...new Set([...out.tags, ...up.tags])];
  }
  return out;
}

export type UpgradeState = Record<string, string[]>; // unit id -> upgrade ids in purchase order

export function upgradedDefs(defs: Map<string, UnitDef>, state: UpgradeState): Map<string, UnitDef> {
  const out = new Map<string, UnitDef>();
  for (const [id, def] of defs) out.set(id, applyUpgrades(def, state[id] ?? []));
  return out;
}
