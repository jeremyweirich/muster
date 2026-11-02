// Terrain: ground conditions that are part of the map (data in src/data/terrain.ts, DESIGN.md §3). Rocks and ponds
// block ground units; rough ground slows them; tall grass hides them from ground shooters. Fliers ignore all of it.
// Units don't plan around terrain: they walk straight at their target and slide along an obstacle they run into.
// Deterministic and PvP-safe: only + − × ÷ and sqrt.

export type TerrainKind = "rocks" | "pond" | "rough" | "grass";

// A patch in field tiles: a circle of radius `r`, or for rough ground and grass an ellipse `r` wide and `ry` tall.
// Rocks and ponds are always circles.
export interface TerrainPatch {
  kind: TerrainKind;
  x: number;
  y: number;
  r: number;
  ry?: number;
}

export interface Obstacle {
  x: number;
  y: number;
  r: number;
}

export const AREA_NONE = 0;
export const AREA_ROUGH = 1;
export const AREA_GRASS = 2;

const RES = 2; // area cells per tile

export function isObstacle(kind: TerrainKind): boolean {
  return kind === "rocks" || kind === "pond";
}

export class Terrain {
  readonly obstacles: Obstacle[] = [];
  private cells: Uint8Array;
  private w: number;
  private h: number;

  constructor(
    readonly patches: TerrainPatch[],
    fieldW: number,
    fieldH: number,
  ) {
    this.w = fieldW * RES;
    this.h = fieldH * RES;
    this.cells = new Uint8Array(this.w * this.h);
    for (const p of patches) {
      if (isObstacle(p.kind)) {
        this.obstacles.push({ x: p.x, y: p.y, r: p.r });
        continue;
      }
      const code = p.kind === "rough" ? AREA_ROUGH : AREA_GRASS;
      const ry = p.ry ?? p.r;
      for (let cy = 0; cy < this.h; cy++) {
        const dy = ((cy + 0.5) / RES - p.y) / ry;
        if (dy * dy > 1) continue;
        for (let cx = 0; cx < this.w; cx++) {
          const dx = ((cx + 0.5) / RES - p.x) / p.r;
          if (dx * dx + dy * dy <= 1) this.cells[cy * this.w + cx] = code;
        }
      }
    }
  }

  // the area under a point: AREA_NONE, AREA_ROUGH or AREA_GRASS
  at(x: number, y: number): number {
    const cx = Math.floor(x * RES);
    const cy = Math.floor(y * RES);
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return AREA_NONE;
    return this.cells[cy * this.w + cx];
  }

  // A ground model of radius `size` at (x, y) wants to move `len` along the unit vector (ux, uy). If that would take
  // it into an obstacle, it slides along the obstacle's edge instead: the part of the move heading into the obstacle
  // is dropped and the rest keeps its full length. Head-on (nothing left to slide along), it goes round on the side
  // its target (gx, gy) is on, or by `tieBreak` when the target is dead behind. Returns the new position.
  slide(x: number, y: number, size: number, ux: number, uy: number, len: number, gx: number, gy: number, tieBreak: boolean): [number, number] {
    let nx = x + ux * len;
    let ny = y + uy * len;
    for (const o of this.obstacles) {
      const min = o.r + size;
      const dx = nx - o.x;
      const dy = ny - o.y;
      if (dx * dx + dy * dy >= min * min) continue;
      // outward normal at the model's current spot
      let ox = x - o.x;
      let oy = y - o.y;
      const od = Math.sqrt(ox * ox + oy * oy) || 0.001;
      ox /= od;
      oy /= od;
      const into = ux * ox + uy * oy;
      if (into >= 0) continue; // already moving away
      let tx = ux - into * ox;
      let ty = uy - into * oy;
      let tl = Math.sqrt(tx * tx + ty * ty);
      if (tl < 0.25) {
        // head-on: of the two ways round, the one toward the target
        const lean = oy * (gx - x) - ox * (gy - y);
        const first = lean > 0.01 || (lean >= -0.01 && tieBreak);
        tx = first ? oy : -oy;
        ty = first ? -ox : ox;
        tl = 1;
      }
      ux = tx / tl;
      uy = ty / tl;
      nx = x + ux * len;
      ny = y + uy * len;
    }
    return this.pushOut(nx, ny, size);
  }

  // Moves a point of radius `size` out of any obstacle it overlaps (after a push from other models, or a slide that
  // cut a corner of a circle).
  pushOut(x: number, y: number, size: number): [number, number] {
    for (const o of this.obstacles) {
      const min = o.r + size;
      const dx = x - o.x;
      const dy = y - o.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.001;
      x = o.x + (d2 === 0 ? min : (dx / d) * min);
      y = o.y + (d2 === 0 ? 0 : (dy / d) * min);
    }
    return [x, y];
  }
}
