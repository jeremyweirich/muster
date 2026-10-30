import { SURFACES, SURFACE_REACTIONS } from "../data/elements";
import type { Element, SurfaceId, SurfaceReaction } from "./types";

const IDS = Object.keys(SURFACES) as SurfaceId[];
const REACTIONS = new Map<string, SurfaceReaction>();
for (const r of SURFACE_REACTIONS) REACTIONS.set(`${r.surface}|${r.element}`, r);

const SPREAD_CAP = 600;

export interface SurfaceEvent {
  name: string;
  x: number;
  y: number;
}

// Ground surfaces live on a fine grid (surfaceRes cells per tile), independent
// of the deployment grid. Surfaces are neutral: they affect both sides.
export class SurfaceGrid {
  readonly w: number;
  readonly h: number;
  readonly res: number;
  readonly type: Int8Array;
  readonly time: Float32Array;
  events: SurfaceEvent[] = [];

  constructor(fieldW: number, fieldH: number, res: number) {
    this.res = res;
    this.w = fieldW * res;
    this.h = fieldH * res;
    this.type = new Int8Array(this.w * this.h).fill(-1);
    this.time = new Float32Array(this.w * this.h);
  }

  at(x: number, y: number): SurfaceId | null {
    const cx = Math.floor(x * this.res);
    const cy = Math.floor(y * this.res);
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return null;
    const t = this.type[cy * this.w + cx];
    return t < 0 ? null : IDS[t];
  }

  private set(i: number, id: SurfaceId | null, duration?: number) {
    if (id === null) {
      this.type[i] = -1;
      this.time[i] = 0;
    } else {
      this.type[i] = IDS.indexOf(id);
      this.time[i] = duration ?? SURFACES[id].duration;
    }
  }

  private cellsInRadius(x: number, y: number, r: number): number[] {
    const out: number[] = [];
    const res = this.res;
    const x0 = Math.max(0, Math.floor((x - r) * res));
    const x1 = Math.min(this.w - 1, Math.floor((x + r) * res));
    const y0 = Math.max(0, Math.floor((y - r) * res));
    const y1 = Math.min(this.h - 1, Math.floor((y + r) * res));
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const dx = (cx + 0.5) / res - x;
        const dy = (cy + 0.5) / res - y;
        if (dx * dx + dy * dy <= r2) out.push(cy * this.w + cx);
      }
    }
    return out;
  }

  // Place a surface. Where it lands on an existing surface that reacts with
  // its element (puddle onto fire, fire onto oil...), the reaction wins.
  create(x: number, y: number, r: number, id: SurfaceId, duration?: number) {
    const el = SURFACES[id].element;
    const seen = new Set<string>();
    for (const i of this.cellsInRadius(x, y, r)) {
      const cur = this.type[i];
      const reaction = cur >= 0 && el ? REACTIONS.get(`${IDS[cur]}|${el}`) : undefined;
      if (reaction) {
        this.react(i, reaction);
        seen.add(reaction.name);
      } else {
        this.set(i, id, duration);
      }
    }
    for (const name of seen) this.events.push({ name, x, y });
  }

  // An element touching the ground (a fireball landing, a lightning strike).
  element(x: number, y: number, r: number, el: Element) {
    if (el === "physical") return;
    const seen = new Set<string>();
    for (const i of this.cellsInRadius(x, y, r)) {
      const cur = this.type[i];
      if (cur < 0) continue;
      const reaction = REACTIONS.get(`${IDS[cur]}|${el}`);
      if (reaction) {
        this.react(i, reaction);
        seen.add(reaction.name);
      }
    }
    for (const name of seen) this.events.push({ name, x, y });
  }

  private react(start: number, reaction: SurfaceReaction) {
    if (!reaction.spread) {
      this.set(start, reaction.becomes);
      return;
    }
    // Flood through connected cells of the same surface type.
    const from = this.type[start];
    const queue = [start];
    const visited = new Set<number>([start]);
    let count = 0;
    while (queue.length && count < SPREAD_CAP) {
      const i = queue.shift()!;
      this.set(i, reaction.becomes);
      count++;
      const cx = i % this.w;
      const cy = (i / this.w) | 0;
      const ns = [
        cx > 0 ? i - 1 : -1,
        cx < this.w - 1 ? i + 1 : -1,
        cy > 0 ? i - this.w : -1,
        cy < this.h - 1 ? i + this.w : -1,
      ];
      for (const n of ns) {
        if (n >= 0 && !visited.has(n) && this.type[n] === from) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
  }

  update(dt: number) {
    const n = this.type.length;
    for (let i = 0; i < n; i++) {
      const t = this.type[i];
      if (t < 0) continue;
      this.time[i] -= dt;
      if (this.time[i] <= 0) {
        const def = SURFACES[IDS[t]];
        if (def.revertTo) this.set(i, def.revertTo, SURFACES[def.revertTo].duration * 0.5);
        else this.set(i, null);
      }
    }
  }

  static ids(): SurfaceId[] {
    return IDS;
  }
}
