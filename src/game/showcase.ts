import { RULES } from "../data/rules";
import { SHOWCASES } from "../data/showcases";
import { Battle, footprintOf } from "../sim/battle";
import { applyUpgrades } from "../sim/upgrades";
import type { PlacedSquad, Rules, Side, UnitDef } from "../sim/types";
import { defMap, preferredDepth } from "./army";

// The Units tab's mini-fights (src/data/showcases.ts). A small arena, with the featured unit's side on the left and
// the enemy on the right, so the fight reads across a landscape panel. The sim doesn't care which way sides face.
export const ARENA: Rules = { ...RULES, fieldW: 24, fieldH: 13.5, towers: [], battleTimeLimit: 45 };
const FRONT = 7; // the front line's distance from each side's edge, in tiles

// Featured squads' uids start with this, so the renderer can pick them out.
export const FEATURED = "f";

// Each preferred depth gets its own column, front to back, so squads never overlap. Squads in a column are stacked
// and centered. Lines stand sideways (rotated) to face the enemy.
function place(squads: { def: UnitDef; uid: string }[], side: Side): PlacedSquad[] {
  const depths = [...new Set(squads.map((s) => preferredDepth(s.def)))].sort((a, b) => a - b);
  const out: PlacedSquad[] = [];
  let edge = FRONT;
  for (const depth of depths) {
    const column = squads.filter((s) => preferredDepth(s.def) === depth);
    const sizes = column.map(({ def }) => footprintOf(def, def.footprint.w > def.footprint.h));
    const width = Math.max(...sizes.map((s) => s.w));
    const height = sizes.reduce((sum, s) => sum + s.h, 0) + (sizes.length - 1) * 0.5;
    let y = Math.max(0, (ARENA.fieldH - height) / 2);
    column.forEach(({ def, uid }, i) => {
      const { w, h } = sizes[i];
      const x = edge - width + (width - w) / 2;
      out.push({ uid, defId: def.id, x: side === 0 ? x : ARENA.fieldW - x - w, y, rot: w !== def.footprint.w || undefined, round: 1 });
      y += h + 0.5;
    });
    edge -= width + 1;
  }
  return out;
}

// The showcase fight for `unitId`, with the featured unit's upgrades applied (to its own side only).
export function showcaseBattle(units: UnitDef[], unitId: string, upgrades: string[] = [], seed = 1): Battle {
  const sc = SHOWCASES[unitId];
  const theirs = defMap(units);
  const get = (id: string) => theirs.get(id)!;
  const featured = applyUpgrades(get(unitId), upgrades);
  const mine = defMap(units).set(unitId, featured);
  const left = [
    ...Array.from({ length: sc.squads ?? 1 }, (_, i) => ({ def: featured, uid: `${FEATURED}${i}` })),
    ...(sc.allies ?? []).map((id, i) => ({ def: mine.get(id)!, uid: `a${i}` })),
  ];
  const right = sc.vs.map((id, i) => ({ def: get(id), uid: `e${i}` }));
  return new Battle([mine, theirs], [place(left, 0), place(right, 1)], { seed, rules: ARENA, towers: false, recordFx: true });
}
