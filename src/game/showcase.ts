import { RULES } from "../data/rules";
import { SHOWCASES } from "../data/showcases";
import { Battle, footprintOf } from "../sim/battle";
import { applyUpgrades } from "../sim/upgrades";
import type { PlacedSquad, Rules, Side, UnitDef } from "../sim/types";
import { defMap, preferredDepth } from "./army";

// The Units tab's mini-fights (src/data/showcases.ts). A small arena, with the featured unit's side on the left and
// the enemy on the right, so the fight reads across a landscape panel. `forward` points the bats' dive that way.
export const ARENA: Rules = { ...RULES, fieldW: 24, fieldH: 13.5, towers: [], battleTimeLimit: 45, forward: { x: 1, y: 0 } };
const FRONT = 7; // the front line's distance from each side's edge, in tiles

// The arena's front lines are closer than the Field's, so a dive (Giant Bats) is shortened to match: it still ends
// where it would on the Field, on the enemy's back line.
const DIVE_SCALE = (ARENA.fieldW - 2 * FRONT) / (RULES.fieldH - 2 * RULES.deployDepth);
const arenaDef = (def: UnitDef): UnitDef =>
  def.traits?.some((t) => t.type === "dive")
    ? { ...def, traits: def.traits.map((t) => (t.type === "dive" ? { ...t, distance: t.distance * DIVE_SCALE } : t)) }
    : def;

// Featured squads' uids start with this, so the renderer can pick them out.
export const FEATURED = "f";

// Each preferred depth gets its own column, front to back, so squads never overlap. Squads in a column are stacked
// and centered; a column that would run off the arena continues in a new one behind it. Lines stand sideways
// (rotated) to face the enemy.
function place(squads: { def: UnitDef; uid: string }[], side: Side): PlacedSquad[] {
  const GAP = 0.5;
  const depths = [...new Set(squads.map((s) => preferredDepth(s.def)))].sort((a, b) => a - b);
  const columns: { def: UnitDef; uid: string; w: number; h: number }[][] = [];
  for (const depth of depths) {
    let column: (typeof columns)[number] = [];
    let height = 0;
    for (const s of squads.filter((s) => preferredDepth(s.def) === depth)) {
      const { w, h } = footprintOf(s.def, s.def.footprint.w > s.def.footprint.h);
      if (column.length && height + GAP + h > ARENA.fieldH) {
        columns.push(column);
        column = [];
        height = 0;
      }
      height += (column.length ? GAP : 0) + h;
      column.push({ ...s, w, h });
    }
    columns.push(column);
  }
  const out: PlacedSquad[] = [];
  // a deep army moves its front line up (short of the midline) rather than off the back of the arena
  const depth = columns.reduce((sum, c) => sum + Math.max(...c.map((s) => s.w)) + 1, -1);
  let edge = Math.min(Math.max(FRONT, depth), ARENA.fieldW / 2 - 1);
  for (const column of columns) {
    const width = Math.max(...column.map((s) => s.w));
    const height = column.reduce((sum, s) => sum + s.h, 0) + (column.length - 1) * GAP;
    let y = Math.max(0, (ARENA.fieldH - height) / 2);
    for (const { def, uid, w, h } of column) {
      const x = edge - width + (width - w) / 2;
      out.push({ uid, defId: def.id, x: side === 0 ? x : ARENA.fieldW - x - w, y, rot: w !== def.footprint.w || undefined, round: 1 });
      y += h + GAP;
    }
    edge -= width + 1;
  }
  return out;
}

// The showcase fight for `unitId`, with the featured unit's upgrades applied (to its own side only).
export function showcaseBattle(units: UnitDef[], unitId: string, upgrades: string[] = [], seed = 1): Battle {
  const sc = SHOWCASES[unitId];
  const theirs = defMap(units.map(arenaDef));
  const get = (id: string) => theirs.get(id)!;
  const featured = arenaDef(applyUpgrades(units.find((u) => u.id === unitId)!, upgrades));
  const mine = defMap(units.map(arenaDef)).set(unitId, featured);
  const left = [
    ...Array.from({ length: sc.squads ?? 1 }, (_, i) => ({ def: featured, uid: `${FEATURED}${i}` })),
    ...(sc.allies ?? []).map((id, i) => ({ def: mine.get(id)!, uid: `a${i}` })),
  ];
  const right = sc.vs.map((id, i) => ({ def: get(id), uid: `e${i}` }));
  return new Battle([mine, theirs], [place(left, 0), place(right, 1)], { seed, rules: ARENA, towers: false, recordFx: true });
}
