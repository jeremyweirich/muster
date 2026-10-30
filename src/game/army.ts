import { deployZone, RULES } from "../data/rules";
import { TOWER_MAP, towerPlacements } from "../data/towers";
import { footprintOf } from "../sim/battle";
import { Rng } from "../sim/rng";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";

let uidCounter = 0;
export function newUid(prefix = "sq"): string {
  uidCounter++;
  return `${prefix}${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

export type DefMap = Map<string, UnitDef>;

export function defMap(units: UnitDef[]): DefMap {
  return new Map(units.map((u) => [u.id, u]));
}

export function armyValue(squads: PlacedSquad[], defs: DefMap): number {
  return squads.reduce((s, q) => s + (defs.get(q.defId)?.cost ?? 0), 0);
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}

export function squadRect(sq: PlacedSquad, def: UnitDef) {
  const { w, h } = footprintOf(def, sq.rot);
  return { x: sq.x, y: sq.y, w, h };
}

export function canPlace(
  def: UnitDef,
  x: number,
  y: number,
  side: Side,
  squads: PlacedSquad[],
  defs: DefMap,
  ignoreUid?: string,
  rot?: boolean,
): boolean {
  const { y0, y1 } = deployZone(side);
  const { w, h } = footprintOf(def, rot);
  if (x < 0 || x + w > RULES.fieldW || y < y0 || y + h > y1) return false;
  for (const t of towerPlacements(side)) {
    const r = squadRect(t, TOWER_MAP.get(t.defId)!);
    if (overlaps(x, y, w, h, r.x, r.y, r.w, r.h)) return false;
  }
  for (const s of squads) {
    if (s.uid === ignoreUid) continue;
    const d = defs.get(s.defId);
    if (!d) continue;
    const r = squadRect(s, d);
    if (overlaps(x, y, w, h, r.x, r.y, r.w, r.h)) return false;
  }
  return true;
}

// Where in the deployment zone a unit wants to stand: 0 = front line.
export function preferredDepth(def: UnitDef): number {
  const range = def.attack?.range ?? 3;
  if (def.layer === "air") return 2;
  if (range <= 1.5) return def.hp >= 400 ? 0 : 1;
  if (range <= 5) return 3;
  return 5;
}

export type PlacementStyle = "center" | "spread" | "left" | "right";

// Automatic placement used by the AI and the balance lab. Tries both
// orientations and prefers wide lines.
export function autoPlace(
  toPlace: UnitDef[],
  existing: PlacedSquad[],
  side: Side,
  defs: DefMap,
  round: number,
  rng: Rng,
  style: PlacementStyle = "center",
): PlacedSquad[] {
  const { y0, y1 } = deployZone(side);
  const placed: PlacedSquad[] = [];
  const order = [...toPlace].sort((a, b) => preferredDepth(a) - preferredDepth(b));
  const mid = RULES.fieldW / 2;
  const styleBias = style === "left" ? -8 : style === "right" ? 8 : 0;
  for (const def of order) {
    const pref = preferredDepth(def);
    let best: { x: number; y: number; rot: boolean; score: number } | null = null;
    for (const rot of def.footprint.w === def.footprint.h ? [false] : [false, true]) {
      const { w, h } = footprintOf(def, rot);
      for (let y = y0; y + h <= y1; y++) {
        // depth from the front edge of this side's zone
        const depth = side === 0 ? y - y0 : y1 - (y + h);
        for (let x = 0; x + w <= RULES.fieldW; x++) {
          if (!canPlace(def, x, y, side, [...existing, ...placed], defs, undefined, rot)) continue;
          const cx = x + w / 2 - (mid + styleBias);
          const lateral = style === "spread" ? Math.abs(Math.abs(cx) - 8) : Math.abs(cx);
          const tall = h > w ? 1.5 : 0;
          const score = Math.abs(depth - pref) * 3 + lateral * 0.3 + tall + rng.next() * 2;
          if (!best || score < best.score) best = { x, y, rot, score };
        }
      }
    }
    if (best) {
      placed.push({ uid: newUid(side === 0 ? "p" : "e"), defId: def.id, x: best.x, y: best.y, rot: best.rot || undefined, round });
    }
  }
  return placed;
}

// Total cost of buying `def` given what's already unlocked.
export function priceOf(def: UnitDef, unlocked: Set<string>): number {
  return def.cost + (RULES.unlocks && !unlocked.has(def.id) ? def.unlockCost ?? 0 : 0);
}

export function startingUnlocks(units: UnitDef[]): string[] {
  return units.filter((u) => !RULES.unlocks || !u.unlockCost).map((u) => u.id);
}

// Price of the next upgrade for a unit: the first costs its upgradeCost (default: unit cost), the second double.
export function upgradePrice(def: UnitDef, alreadyBought: number): number | null {
  const mult = RULES.upgradeCostMult[alreadyBought];
  if (mult === undefined) return null;
  return Math.round((def.upgradeCost ?? def.cost) * mult);
}

export function towerUpgradePrice(level: number): number | null {
  return RULES.towerUpgradeCosts[level] ?? null;
}
