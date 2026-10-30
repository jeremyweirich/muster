import { deployZone, RULES } from "../data/rules";
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

export function canPlace(def: UnitDef, x: number, y: number, side: Side, squads: PlacedSquad[], defs: DefMap, ignoreUid?: string): boolean {
  const { y0, y1 } = deployZone(side);
  const { w, h } = def.footprint;
  if (x < 0 || x + w > RULES.fieldW || y < y0 || y + h > y1) return false;
  for (const s of squads) {
    if (s.uid === ignoreUid) continue;
    const d = defs.get(s.defId);
    if (!d) continue;
    if (overlaps(x, y, w, h, s.x, s.y, d.footprint.w, d.footprint.h)) return false;
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

// Automatic placement used by the AI and the balance lab.
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
  const styleBias = style === "left" ? -6 : style === "right" ? 6 : 0;
  for (const def of order) {
    const { w, h } = def.footprint;
    const pref = preferredDepth(def);
    let best: { x: number; y: number; score: number } | null = null;
    for (let y = y0; y + h <= y1; y++) {
      // depth from the front edge of this side's zone
      const depth = side === 0 ? y - y0 : y1 - (y + h);
      for (let x = 0; x + w <= RULES.fieldW; x++) {
        if (!canPlace(def, x, y, side, [...existing, ...placed], defs)) continue;
        const cx = x + w / 2 - (mid + styleBias);
        const lateral = style === "spread" ? Math.abs(Math.abs(cx) - 6) : Math.abs(cx);
        const score = Math.abs(depth - pref) * 3 + lateral * 0.35 + rng.next() * 2;
        if (!best || score < best.score) best = { x, y, score };
      }
    }
    if (best) placed.push({ uid: newUid(side === 0 ? "p" : "e"), defId: def.id, x: best.x, y: best.y, round });
  }
  return placed;
}

// Mirror an army from one side's zone to the other (used by the lab).
export function mirror(squads: PlacedSquad[], defs: DefMap): PlacedSquad[] {
  return squads.map((s) => {
    const d = defs.get(s.defId)!;
    return { ...s, y: RULES.fieldH - s.y - d.footprint.h };
  });
}
