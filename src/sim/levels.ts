import type { Effect, Rules, TraitDef, UnitDef } from "./types";

// Veterancy: squads earn XP (damage dealt + healing done) in battle. Enough XP
// unlocks a level, which the player then pays for. A level-N squad has N× the
// HP, damage, healing and regeneration of a fresh one; nothing else changes.

// The highest level a squad's XP has unlocked (paid for or not).
export function earnedLevel(xp: number, rules: Rules): number {
  let level = 1;
  for (const need of rules.levelXp) if (xp >= need) level++;
  return level;
}

// XP needed to unlock the level after `level`, or null at the cap.
export function xpForLevel(level: number, rules: Rules): number | null {
  return rules.levelXp[level - 1] ?? null;
}

// XP can't run past the next level's threshold: a squad holds at most one unpaid level,
// so it can never be promoted twice in a row. Extra XP while a level waits is lost.
export function capXp(xp: number, level: number, rules: Rules): number {
  const next = xpForLevel(level, rules);
  return next === null ? xp : Math.min(xp, next);
}

function scaleEffect(e: Effect, k: number): Effect {
  return e.type === "damage" || e.type === "heal" ? { ...e, amount: e.amount * k } : e;
}

function scaleTrait(t: TraitDef, k: number): TraitDef {
  switch (t.type) {
    case "regen":
      return { ...t, perSecond: t.perSecond * k };
    case "onDeath":
    case "periodic":
    case "retaliate":
    case "onKill":
      return { ...t, effects: t.effects.map((e) => scaleEffect(e, k)) };
    default:
      return t;
  }
}

// A unit at `level`. Pure: returns a new def (or the same one at level 1).
export function levelDef(def: UnitDef, level: number): UnitDef {
  if (level <= 1) return def;
  const out: UnitDef = { ...def, level, hp: def.hp * level };
  if (def.attack) {
    out.attack = { ...def.attack, damage: def.attack.damage * level, onHit: def.attack.onHit?.map((e) => scaleEffect(e, level)) };
  }
  if (def.traits) out.traits = def.traits.map((t) => scaleTrait(t, level));
  return out;
}
