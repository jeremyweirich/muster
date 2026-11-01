import { ELEMENT_COLORS } from "../data/elements";
import type { Projectile } from "../sim/battle";
import type { Element, ProjectileLook, UnitDef } from "../sim/types";

// Combat flourishes that live only in the renderer: projectile art, trails and particles. Nothing here feeds back into
// the sim, so it may use Math.random freely.

export function hexAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const ELEMENT_OF_COLOR = new Map(Object.entries(ELEMENT_COLORS).map(([el, c]) => [c, el as Element]));
// The element an fx color stands for, or null for other colors (an on-death burst in the unit's own color).
export const elementOfColor = (color: string): Element | null => ELEMENT_OF_COLOR.get(color) ?? null;

// ------------------------------------------------------------------ particles

interface Particle {
  x: number; // tiles
  y: number;
  vx: number; // tiles/s
  vy: number;
  grav: number; // tiles/s², +y is down the screen
  age: number;
  life: number;
  size: number; // px
  color: string;
  glow: boolean; // drawn additively
}

const MAX_PARTICLES = 700;

// What bits fly off an impact of each element.
const DEBRIS: Record<Element, { colors: string[]; glow: boolean; grav: number; speed: number; life: number }> = {
  fire: { colors: ["#ffd35a", "#ff8a2b", "#ff5a1f"], glow: true, grav: -1.2, speed: 2.2, life: 0.55 },
  water: { colors: ["#7fb6ff", "#3d8bff", "#cfe3ff"], glow: false, grav: 7, speed: 2.6, life: 0.5 },
  frost: { colors: ["#e6fbff", "#9be7ff", "#6fcfff"], glow: true, grav: 3, speed: 2.4, life: 0.5 },
  lightning: { colors: ["#fff6b0", "#ffe14a"], glow: true, grav: 0, speed: 4, life: 0.25 },
  physical: { colors: ["#b9ab92", "#8d8170", "#6f6557"], glow: false, grav: 5, speed: 2, life: 0.45 },
};

export class Particles {
  items: Particle[] = [];
  spawn(x: number, y: number, n: number, opts: { colors: string[]; glow: boolean; grav: number; speed: number; life: number; size?: number }) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = opts.speed * (0.35 + Math.random() * 0.65);
      this.items.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - opts.grav * 0.12,
        grav: opts.grav,
        age: 0,
        life: opts.life * (0.6 + Math.random() * 0.5),
        size: (opts.size ?? 2) * (0.6 + Math.random() * 0.6),
        color: opts.colors[(Math.random() * opts.colors.length) | 0],
        glow: opts.glow,
      });
    }
    if (this.items.length > MAX_PARTICLES) this.items.splice(0, this.items.length - MAX_PARTICLES);
  }
  debris(x: number, y: number, n: number, el: Element, size = 2, speedMult = 1) {
    const d = DEBRIS[el];
    this.spawn(x, y, n, { ...d, speed: d.speed * speedMult, size });
  }
  update(dt: number) {
    for (const p of this.items) {
      p.age += dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - Math.min(1, dt * 2.5);
      p.vy *= 1 - Math.min(1, dt * 1.5);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }
  draw(ctx: CanvasRenderingContext2D, tile: number) {
    for (const glow of [false, true]) {
      if (glow) ctx.globalCompositeOperation = "lighter";
      for (const p of this.items) {
        if (p.glow !== glow) continue;
        const k = 1 - p.age / p.life;
        ctx.globalAlpha = Math.min(1, k * 1.4);
        ctx.fillStyle = p.color;
        const s = p.size * (glow ? 0.5 + 0.5 * k : 1);
        ctx.fillRect(p.x * tile - s / 2, p.y * tile - s / 2, s, s);
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- projectiles

type ShotKind = ProjectileLook | "fireball" | "water" | "shard" | "spark";

export function shotKind(def: UnitDef): ShotKind {
  if (def.look.projectile) return def.look.projectile;
  switch (def.attack?.element) {
    case "fire":
      return "fireball";
    case "water":
      return "water";
    case "frost":
      return "shard";
    case "lightning":
      return "spark";
    default:
      return "arrow";
  }
}

// Arc height as a fraction of the throw's length: boulders and fireballs are lobbed, bolts fly flat.
const ARC: Record<ShotKind, number> = { arrow: 0.1, bolt: 0.04, javelin: 0.13, boulder: 0.3, hail: 0.05, fireball: 0.18, water: 0.24, shard: 0.03, spark: 0 };
// How long (sim seconds) a trail lingers behind each kind.
const TRAIL: Record<ShotKind, number> = { arrow: 0.07, bolt: 0.08, javelin: 0.07, boulder: 0.18, hail: 0.06, fireball: 0.22, water: 0.16, shard: 0.12, spark: 0.1 };
// Rock outline, as radius multipliers around the rim.
const ROCK = [1, 0.8, 0.96, 0.76, 1, 0.86, 0.82];

interface Track {
  sx: number; // where the shot started, for its arc
  sy: number;
  kind: ShotKind;
  element: Element;
  trail: { x: number; y: number; t: number }[]; // tiles, with arc lift applied
  x: number; // last drawn ground position
  y: number;
  dist: number; // tiles flown since the last ember was shed
  spin: number;
}

// Tracks the shots in flight between frames: their start (for arcs), trails, and where they land.
export class Shots {
  tracks = new Map<Projectile, Track>();
  private live = new Set<Projectile>();

  draw(ctx: CanvasRenderingContext2D, p: Projectile, tile: number, alpha: number, simT: number, team: string, parts: Particles) {
    this.live.add(p);
    let tr = this.tracks.get(p);
    if (!tr) {
      tr = { sx: p.px, sy: p.py, kind: shotKind(p.src.def), element: p.src.def.attack?.element ?? "physical", trail: [], x: p.px, y: p.py, dist: 0, spin: Math.random() * 6 };
      this.tracks.set(p, tr);
    }
    const x = p.px + (p.x - p.px) * alpha;
    const y = p.py + (p.y - p.py) * alpha;
    const total = Math.hypot(p.tx - tr.sx, p.ty - tr.sy);
    const rem = Math.hypot(p.tx - x, p.ty - y);
    const prog = total > 0.05 ? Math.max(0, Math.min(1, 1 - rem / total)) : 1;
    const arc = ARC[tr.kind];
    const lift = arc * total * Math.sin(Math.PI * prog);
    const ux = rem > 1e-6 ? (p.tx - x) / rem : 0;
    const uy = rem > 1e-6 ? (p.ty - y) / rem : 0;
    const heading = Math.atan2(uy - arc * Math.PI * Math.cos(Math.PI * prog), ux);
    tr.dist += Math.hypot(x - tr.x, y - tr.y);
    tr.x = x;
    tr.y = y;
    const ay = y - lift;
    const last = tr.trail[tr.trail.length - 1];
    if (!last || last.t !== simT) tr.trail.push({ x, y: ay, t: simT });
    while (tr.trail.length > 2 && simT - tr.trail[0].t > TRAIL[tr.kind]) tr.trail.shift();

    const s = Math.max(0.8, Math.min(1.7, 0.75 + Math.sqrt(p.damage) / 20)); // bigger hits, bigger shots
    const px = x * tile;
    const py = ay * tile;
    const el = tr.element;
    if (lift > 0.15) {
      // shadow on the ground under a lobbed shot
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.1, 0.3 - lift * 0.08)})`;
      ctx.beginPath();
      ctx.ellipse(px, y * tile, tile * 0.1 * s, tile * 0.05 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // shed embers (or droplets, frost glints) as non-physical shots travel
    const shedEvery = tr.kind === "fireball" ? 0.18 : 0.35;
    if (el !== "physical" && tr.dist > shedEvery) {
      tr.dist = 0;
      parts.debris(x + (Math.random() - 0.5) * 0.1, ay, 1, el, 2, 0.25);
    }
    switch (tr.kind) {
      case "arrow":
      case "bolt":
      case "javelin":
        if (el !== "physical") glowTrail(ctx, tr.trail, tile, ELEMENT_COLORS[el], 3 * s);
        else streak(ctx, tr.trail, tile, 1);
        drawShaft(ctx, tr.kind, px, py, heading, tile * s, team, el);
        break;
      case "boulder": {
        const r = tile * 0.21 * s;
        const frost = el === "frost";
        dustTrail(ctx, tr.trail, tile, r, frost ? "#cfefff" : "#a69a86");
        if (el !== "physical") glow(ctx, px, py, r * 2.2, ELEMENT_COLORS[el], 0.45);
        ctx.beginPath();
        const rot = tr.spin + simT * 7;
        for (let k = 0; k < ROCK.length; k++) {
          const a = rot + (k / ROCK.length) * Math.PI * 2;
          const rx = px + Math.cos(a) * r * ROCK[k];
          const ry = py + Math.sin(a) * r * ROCK[k];
          k === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.fillStyle = frost ? "#a9d6ea" : el === "fire" ? "#a2654a" : "#8b8070";
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath();
        ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = team;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        break;
      }
      case "hail": {
        const r = Math.max(1.6, tile * 0.055 * s);
        streak(ctx, tr.trail, tile, 0.8);
        if (el !== "physical") glow(ctx, px, py, r * 3, ELEMENT_COLORS[el], 0.5);
        ctx.fillStyle = el === "frost" ? "#d8f6ff" : "#eef2f6";
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = team;
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
      case "fireball": {
        const r = tile * 0.19 * s;
        emberTrail(ctx, tr.trail, tile, r);
        glow(ctx, px, py, r * 2.6, "#ff7a2b", 0.55);
        const flick = 0.92 + 0.08 * Math.sin(simT * 60 + tr.spin);
        const g = ctx.createRadialGradient(px - r * 0.2, py - r * 0.2, 0, px, py, r * flick);
        g.addColorStop(0, "#fffbe0");
        g.addColorStop(0.35, "#ffd45a");
        g.addColorStop(0.75, "#ff7a2b");
        g.addColorStop(1, "rgba(220,60,20,0.9)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r * flick, 0, Math.PI * 2);
        ctx.fill();
        teamRing(ctx, px, py, r * 1.25, team);
        break;
      }
      case "water": {
        const r = tile * 0.16 * s;
        dropTrail(ctx, tr.trail, tile, r);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(heading);
        ctx.scale(1.25, 0.9); // a blob stretched along its flight
        const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, 0, 0, 0, r);
        g.addColorStop(0, "#d6e8ff");
        g.addColorStop(0.4, "#6aa8ff");
        g.addColorStop(1, "#2a6fd6");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        teamRing(ctx, px, py, r * 1.35, team);
        break;
      }
      case "shard": {
        const len = tile * 0.46 * s;
        glowTrail(ctx, tr.trail, tile, "#9be7ff", 2.5 * s);
        glow(ctx, px, py, len * 0.8, "#9be7ff", 0.4);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(heading);
        ctx.beginPath();
        ctx.moveTo(len * 0.55, 0);
        ctx.lineTo(0, len * 0.13);
        ctx.lineTo(-len * 0.45, 0);
        ctx.lineTo(0, -len * 0.13);
        ctx.closePath();
        const g = ctx.createLinearGradient(-len * 0.45, 0, len * 0.55, 0);
        g.addColorStop(0, "#5fc4ee");
        g.addColorStop(1, "#f2fdff");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = team;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "spark": {
        const r = tile * 0.09 * s;
        glowTrail(ctx, tr.trail, tile, ELEMENT_COLORS.lightning, 2.5 * s);
        glow(ctx, px, py, r * 3, ELEMENT_COLORS.lightning, 0.6);
        ctx.strokeStyle = "#fffbe0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = simT * 40 + k * (Math.PI / 2) + Math.random() * 0.6;
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(a) * r * 1.6, py + Math.sin(a) * r * 1.6);
        }
        ctx.stroke();
        teamRing(ctx, px, py, r * 1.1, team);
        break;
      }
    }
  }

  // Shots that vanished since the last frame have landed. Splash shots get the sim's own burst; the rest throw sparks.
  settle(parts: Particles) {
    for (const [p, tr] of this.tracks) {
      if (this.live.has(p)) continue;
      this.tracks.delete(p);
      if (p.src.def.attack?.splash) continue;
      const big = tr.kind === "boulder" || tr.kind === "bolt";
      parts.debris(p.tx, p.ty, big ? 6 : 3, tr.element, big ? 2.4 : 1.8, big ? 1 : 0.7);
    }
    this.live.clear();
  }

  clear() {
    this.tracks.clear();
    this.live.clear();
  }
}

// Arrow, crossbow bolt or javelin: a shaft, a head, and team-colored fletching or wrap.
function drawShaft(ctx: CanvasRenderingContext2D, kind: "arrow" | "bolt" | "javelin", x: number, y: number, heading: number, tile: number, team: string, el: Element) {
  const len = tile * (kind === "javelin" ? 0.6 : kind === "bolt" ? 0.36 : 0.42);
  const w = Math.max(1, tile * (kind === "bolt" ? 0.06 : kind === "javelin" ? 0.05 : 0.035));
  const head = el === "physical" ? (kind === "bolt" ? "#6b7480" : "#e6e9ee") : ELEMENT_COLORS[el];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.lineCap = "round";
  ctx.strokeStyle = kind === "bolt" ? "#8a6a44" : "#c9b48a";
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(-len * 0.5, 0);
  ctx.lineTo(len * 0.32, 0);
  ctx.stroke();
  // head
  const hl = len * (kind === "bolt" ? 0.26 : 0.2);
  const hw = Math.max(1.6, len * (kind === "bolt" ? 0.13 : 0.09));
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.moveTo(len * 0.5, 0);
  ctx.lineTo(len * 0.5 - hl, hw);
  ctx.lineTo(len * 0.5 - hl, -hw);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = team;
  ctx.lineWidth = Math.max(1.2, w);
  ctx.beginPath();
  if (kind === "javelin") {
    // a team-colored grip wrap
    ctx.moveTo(-len * 0.12, 0);
    ctx.lineTo(len * 0.04, 0);
  } else {
    // fletching
    const f = len * 0.16;
    for (const side of [-1, 1]) {
      ctx.moveTo(-len * 0.5 + f, 0);
      ctx.lineTo(-len * 0.5, side * hw * 0.9);
    }
  }
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.restore();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexAlpha(color, a));
  g.addColorStop(1, hexAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function teamRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, team: string) {
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = team;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

type Trail = Track["trail"];

// A faint white motion streak behind a plain physical shot.
function streak(ctx: CanvasRenderingContext2D, trail: Trail, tile: number, width: number) {
  if (trail.length < 2) return;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(trail[0].x * tile, trail[0].y * tile);
  for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x * tile, trail[i].y * tile);
  ctx.stroke();
}

// A glowing, tapering ribbon in the element's color.
function glowTrail(ctx: CanvasRenderingContext2D, trail: Trail, tile: number, color: string, width: number) {
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  for (let i = 1; i < trail.length; i++) {
    const k = i / trail.length;
    ctx.globalAlpha = 0.55 * k;
    ctx.lineWidth = width * (0.3 + 0.7 * k);
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x * tile, trail[i - 1].y * tile);
    ctx.lineTo(trail[i].x * tile, trail[i].y * tile);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

// Fireball tail: puffs that shrink and redden behind the head.
function emberTrail(ctx: CanvasRenderingContext2D, trail: Trail, tile: number, r: number) {
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < trail.length - 1; i++) {
    const k = (i + 1) / trail.length;
    ctx.globalAlpha = 0.5 * k;
    ctx.fillStyle = k > 0.6 ? "#ff9a3a" : "#e0461c";
    ctx.beginPath();
    ctx.arc(trail[i].x * tile, trail[i].y * tile, r * (0.35 + 0.6 * k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function dropTrail(ctx: CanvasRenderingContext2D, trail: Trail, tile: number, r: number) {
  ctx.fillStyle = "#6aa8ff";
  for (let i = 0; i < trail.length - 1; i += 2) {
    const k = (i + 1) / trail.length;
    ctx.globalAlpha = 0.6 * k;
    ctx.beginPath();
    ctx.arc(trail[i].x * tile, trail[i].y * tile, r * 0.45 * k + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function dustTrail(ctx: CanvasRenderingContext2D, trail: Trail, tile: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < trail.length - 1; i += 2) {
    const k = (i + 1) / trail.length;
    ctx.globalAlpha = 0.25 * k;
    ctx.beginPath();
    ctx.arc(trail[i].x * tile, trail[i].y * tile, r * (1.1 - 0.5 * k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
