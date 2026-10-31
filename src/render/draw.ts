import { STATUSES, SURFACES } from "../data/elements";
import { deployZone, RULES } from "../data/rules";
import { towerPlacements, TOWER_MAP } from "../data/towers";
import { footprintOf, formation, type Battle, type Fx, type Model, type Projectile } from "../sim/battle";
import { SurfaceGrid } from "../sim/surfaces";
import { drawIcon, ICONS, type IconId } from "./icons";
import type { PlacedSquad, Shape, Side, StatusId, UnitDef } from "../sim/types";

export const SIDE_COLORS = ["#4da3ff", "#ff5468"] as const;
const STATUS_IDS = Object.keys(STATUSES) as StatusId[];
const SURFACE_IDS = SurfaceGrid.ids();

type BackgroundOpts = { zones?: boolean; grid?: Side[] };

// The field never changes during a battle, so it's rendered once per size/options into an offscreen canvas.
const bgCache = new Map<string, HTMLCanvasElement>();

export function drawBackground(ctx: CanvasRenderingContext2D, tile: number, opts: BackgroundOpts = {}) {
  const W = RULES.fieldW * tile;
  const H = RULES.fieldH * tile;
  const dpr = ctx.getTransform().a || 1;
  const key = `${tile}|${dpr}|${opts.zones ? 1 : 0}|${(opts.grid ?? []).join(",")}`;
  let bg = bgCache.get(key);
  if (!bg) {
    bg = document.createElement("canvas");
    bg.width = Math.round(W * dpr);
    bg.height = Math.round(H * dpr);
    const c = bg.getContext("2d")!;
    c.scale(dpr, dpr);
    paintBackground(c, tile, opts);
    bgCache.set(key, bg);
  }
  ctx.drawImage(bg, 0, 0, W, H);
}

function paintBackground(ctx: CanvasRenderingContext2D, tile: number, opts: BackgroundOpts) {
  const W = RULES.fieldW * tile;
  const H = RULES.fieldH * tile;
  // grass: a slightly lighter band through the middle
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#1c2a1e");
  base.addColorStop(0.5, "#24372a");
  base.addColorStop(1, "#1c2a1e");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  // mowed stripes, two tiles wide, so distances still read at a glance
  ctx.fillStyle = "rgba(255,255,255,0.022)";
  for (let x = 0; x < RULES.fieldW; x += 4) ctx.fillRect(x * tile, 0, 2 * tile, H);
  // speckles and grass tufts from a fixed seed, so the field looks the same every time
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tufts = Math.round(RULES.fieldW * RULES.fieldH * 2.2);
  for (let i = 0; i < tufts; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const light = rnd() < 0.5;
    ctx.fillStyle = light ? "rgba(170,210,140,0.07)" : "rgba(0,0,0,0.12)";
    const s = (0.04 + rnd() * 0.08) * tile;
    ctx.fillRect(x, y, s, s);
    if (rnd() < 0.35) {
      ctx.strokeStyle = "rgba(150,200,120,0.09)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * tile * 0.25, y - tile * (0.15 + rnd() * 0.2));
      ctx.stroke();
    }
  }
  if (opts.zones) {
    for (const side of [0, 1] as Side[]) {
      const { y0, y1 } = deployZone(side);
      // tint fades from the back edge toward the front of the zone
      const g = ctx.createLinearGradient(0, (side === 0 ? y1 : y0) * tile, 0, (side === 0 ? y0 : y1) * tile);
      const rgb = side === 0 ? "77,163,255" : "255,84,104";
      g.addColorStop(0, `rgba(${rgb},0.13)`);
      g.addColorStop(1, `rgba(${rgb},0.04)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, y0 * tile, W, (y1 - y0) * tile);
      ctx.strokeStyle = side === 0 ? "rgba(77,163,255,0.45)" : "rgba(255,84,104,0.45)";
      ctx.lineWidth = 1;
      const edge = side === 0 ? y0 : y1;
      ctx.beginPath();
      ctx.moveTo(0, edge * tile + 0.5);
      ctx.lineTo(W, edge * tile + 0.5);
      ctx.stroke();
    }
  }
  for (const side of opts.grid ?? []) {
    const { y0, y1 } = deployZone(side);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= RULES.fieldW; x++) {
      ctx.moveTo(x * tile + 0.5, y0 * tile);
      ctx.lineTo(x * tile + 0.5, y1 * tile);
    }
    for (let y = y0; y <= y1; y++) {
      ctx.moveTo(0, y * tile + 0.5);
      ctx.lineTo(W, y * tile + 0.5);
    }
    ctx.stroke();
  }
  // midline
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(0, (RULES.fieldH / 2) * tile);
  ctx.lineTo(W, (RULES.fieldH / 2) * tile);
  ctx.stroke();
  ctx.setLineDash([]);
  // vignette pulls the eye to the middle
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

export function drawSurfaces(ctx: CanvasRenderingContext2D, grid: SurfaceGrid, tile: number, time: number) {
  const cs = tile / grid.res;
  for (let i = 0; i < grid.type.length; i++) {
    const t = grid.type[i];
    if (t < 0) continue;
    const def = SURFACES[SURFACE_IDS[t]];
    const left = grid.time[i];
    let a = def.alpha * Math.min(1, left / 1);
    if (def.id === "shockwater") a *= 0.7 + 0.3 * Math.sin(time * 40 + i);
    ctx.globalAlpha = a;
    ctx.fillStyle = def.color;
    const cx = i % grid.w;
    const cy = (i / grid.w) | 0;
    ctx.fillRect(cx * cs, cy * cs, cs + 0.5, cs + 0.5);
  }
  ctx.globalAlpha = 1;
}

function shapePath(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, r: number, facing: number) {
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
      break;
    case "triangle":
      for (let k = 0; k < 3; k++) {
        const a = facing + (k * Math.PI * 2) / 3;
        const px = x + Math.cos(a) * r * 1.15;
        const py = y + Math.sin(a) * r * 1.15;
        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(x, y - r * 1.15);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r * 1.15);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case "hex":
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3 + Math.PI / 6;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
  }
}

// How big an icon fits inside each token shape, as a multiple of the token radius.
const ICON_FIT: Record<Shape, number> = { circle: 1.5, square: 1.5, hex: 1.45, diamond: 1.15, triangle: 1.05 };

// Two flapping wings, perpendicular to the facing, drawn behind a winged flier's token.
function drawWings(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, facing: number, color: string, side: Side, time: number, phase: number) {
  const flap = 0.5 + 0.5 * Math.sin(time * 9 + phase); // 0 = folded in, 1 = spread
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  for (const s of [-1, 1]) {
    const ox = -fy * s; // outward, perpendicular to facing
    const oy = fx * s;
    const reach = r * (1.05 + 0.75 * flap);
    const at = (out: number, fwd: number) => [px + ox * out + fx * fwd, py + oy * out + fy * fwd] as const;
    const [ax, ay] = at(r * 0.55, r * 0.35);
    const [cx, cy] = at(r * 1.3, r * 0.75);
    const [tx, ty] = at(reach, -r * 0.35);
    const [bx, by] = at(r * 0.55, -r * 0.5);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(cx, cy, tx, ty);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    ctx.strokeStyle = SIDE_COLORS[side];
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.stroke();
  }
}

// A soft, flickering halo for elemental fliers (wisps, air elementals).
function drawGlow(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, color: string, time: number, phase: number) {
  const pulse = 0.75 + 0.25 * Math.sin(time * 7 + phase);
  const g = ctx.createRadialGradient(px, py, r * 0.4, px, py, r * 2.6);
  g.addColorStop(0, hexAlpha(color, 0.55 * pulse));
  g.addColorStop(1, hexAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, r * 2.6, 0, Math.PI * 2);
  ctx.fill();
}

function hexAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export interface UnitDrawOpts {
  time?: number; // seconds, for idle animation (wings, bobbing, glow)
  phase?: number; // per-model offset so a squad doesn't move in lockstep
  alpha?: number;
  facing?: number;
  hpFrac?: number;
  flash?: boolean;
  statuses?: Partial<Record<StatusId, number>>;
}

export function drawUnit(ctx: CanvasRenderingContext2D, def: UnitDef, side: Side, x: number, y: number, tile: number, o: UnitDrawOpts = {}) {
  const r = Math.max(2.5, def.size * tile);
  const px = x * tile;
  const gy = y * tile; // ground position
  const facing = o.facing ?? (side === 0 ? -Math.PI / 2 : Math.PI / 2);
  const time = o.time ?? 0;
  const phase = o.phase ?? 0;
  const air = def.layer === "air";
  // fliers hover above their ground position and bob gently
  const lift = air ? Math.max(5, r * 0.9) + Math.sin(time * 2.4 + phase) * r * 0.14 : 0;
  const py = gy - lift;
  ctx.globalAlpha = o.alpha ?? 1;
  if (air) {
    // shadow on the ground, where the flier really is; fainter the higher it hovers
    ctx.fillStyle = `rgba(0,0,0,${0.32 - Math.min(0.12, lift / 120)})`;
    ctx.beginPath();
    ctx.ellipse(px + lift * 0.25, gy + r * 0.25, r * 0.8, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    if (def.structure || def.tags.includes("race:elemental")) drawGlow(ctx, px, py, r, def.look.color, time, phase);
    else drawWings(ctx, px, py, r, facing, def.look.color, side, time, phase);
  } else if (r >= 4) {
    // contact shadow so ground units sit on the grass
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(px + r * 0.15, py + r * 0.55, r * 1.05, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  shapePath(ctx, def.look.shape, px, py, r, facing);
  ctx.fillStyle = o.flash ? "#ffffff" : def.look.color;
  ctx.fill();
  if (!o.flash && r >= 4) {
    // soft top-left highlight and bottom-right shade for a bit of volume
    const g = ctx.createRadialGradient(px - r * 0.4, py - r * 0.45, r * 0.1, px, py, r * 1.25);
    g.addColorStop(0, "rgba(255,255,255,0.35)");
    g.addColorStop(0.55, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.strokeStyle = SIDE_COLORS[side];
  ctx.stroke();
  if ((def.level ?? 1) > 1) {
    // veterans wear a gold ring, one per level above 1
    ctx.strokeStyle = VETERAN_GOLD;
    ctx.lineWidth = 1.2;
    for (let i = 1; i < Math.min(def.level!, 4); i++) {
      ctx.beginPath();
      ctx.arc(px, py, r + 1.5 + i * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (r >= 3.5 && def.speed > 0) {
    // facing notch in the team color
    ctx.fillStyle = SIDE_COLORS[side];
    ctx.beginPath();
    ctx.arc(px + Math.cos(facing) * r * 0.95, py + Math.sin(facing) * r * 0.95, Math.max(1.4, r * 0.22), 0, Math.PI * 2);
    ctx.fill();
  }

  const st = o.statuses;
  if (st) {
    if (st.frozen !== undefined) {
      shapePath(ctx, def.look.shape, px, py, r, facing);
      ctx.fillStyle = "rgba(220,247,255,0.7)";
      ctx.fill();
    }
    let k = 0;
    for (const id of STATUS_IDS) {
      if (st[id] === undefined || id === "frozen") continue;
      ctx.strokeStyle = STATUSES[id].color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, r + 2 + k * 2, 0, Math.PI * 2);
      ctx.stroke();
      k++;
    }
  }
  const icon = def.look.icon && def.look.icon in ICONS ? (def.look.icon as IconId) : null;
  if (icon && r >= 5.5) {
    drawIcon(ctx, icon, px, py + (def.look.shape === "triangle" ? r * 0.08 : 0), r * ICON_FIT[def.look.shape], "rgba(14,17,21,0.82)");
  } else if (def.look.glyph && r >= 5) {
    ctx.font = `${Math.round(r * 1.2)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#111";
    ctx.fillText(def.look.glyph, px, py + 1);
  }
  if (o.hpFrac !== undefined && o.hpFrac < 1 && (def.hp >= 300 || r >= 6)) {
    const w = Math.max(10, r * 2);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(px - w / 2, py - r - 6, w, 3);
    ctx.fillStyle = o.hpFrac > 0.5 ? "#6fdc6f" : o.hpFrac > 0.25 ? "#ffcc33" : "#ff4d4d";
    ctx.fillRect(px - w / 2, py - r - 6, w * Math.max(0, o.hpFrac), 3);
  }
  ctx.globalAlpha = 1;
}

export function drawSquad(
  ctx: CanvasRenderingContext2D,
  sq: PlacedSquad,
  def: UnitDef,
  side: Side,
  tile: number,
  o: { alpha?: number; outline?: string; dashed?: boolean; alive?: number; fill?: string; time?: number } = {},
) {
  const { w, h } = footprintOf(def, sq.rot);
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fillRect(sq.x * tile, sq.y * tile, w * tile, h * tile);
  }
  if (o.outline) {
    ctx.strokeStyle = o.outline;
    ctx.lineWidth = 1.5;
    if (o.dashed) ctx.setLineDash([3, 3]);
    ctx.strokeRect(sq.x * tile + 1, sq.y * tile + 1, w * tile - 2, h * tile - 2);
    ctx.setLineDash([]);
  }
  formation(def, sq.x, sq.y, sq.rot).forEach(([x, y], i) => {
    const dead = o.alive !== undefined && i >= o.alive;
    drawUnit(ctx, def, side, x, y, tile, { alpha: dead ? 0.18 : o.alpha, time: o.time, phase: i * 1.3 });
  });
  ctx.globalAlpha = 1;
  if ((sq.level ?? 1) > 1) drawLevelBadge(ctx, sq.x * tile + 1, sq.y * tile + 1, sq.level!);
}

export const VETERAN_GOLD = "#f5c542";

// A squad's level, as a small gold tag in the top-left corner of its footprint.
export function drawLevelBadge(ctx: CanvasRenderingContext2D, x: number, y: number, level: number) {
  const text = `Lv${level}`;
  ctx.font = "bold 10px system-ui, sans-serif";
  const w = ctx.measureText(text).width + 6;
  ctx.fillStyle = "rgba(10,14,18,0.85)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 13, 3);
  ctx.fill();
  ctx.fillStyle = VETERAN_GOLD;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 3, y + 7);
}

// "Ready to promote": a pulsing gold chevron above the squad's footprint.
export function drawPromoteIcon(ctx: CanvasRenderingContext2D, cx: number, top: number, time: number) {
  const bob = Math.sin(time * 4) * 1.5;
  const y = top - 10 + bob;
  ctx.fillStyle = "rgba(10,14,18,0.85)";
  ctx.beginPath();
  ctx.arc(cx, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = VETERAN_GOLD;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const dy of [-2.5, 2]) {
    ctx.beginPath();
    ctx.moveTo(cx - 4.5, y + dy + 2.5);
    ctx.lineTo(cx, y + dy - 2);
    ctx.lineTo(cx + 4.5, y + dy + 2.5);
    ctx.stroke();
  }
}

export function drawTowers(ctx: CanvasRenderingContext2D, tile: number, alpha = 1) {
  for (const side of [0, 1] as Side[]) {
    for (const t of towerPlacements(side)) drawSquad(ctx, t, TOWER_MAP.get(t.defId)!, side, tile, { alpha });
  }
}

// ------------------------------------------------------------------- battle

interface LiveFx {
  fx: Fx;
  age: number;
  life: number;
}

const FX_LIFE: Record<Fx["kind"], number> = { beam: 0.2, burst: 0.3, text: 1.1, death: 0.5, heal: 0.6, slash: 0.2 };
const BIG_TEXT_LIFE = 2.5;

export class FxLayer {
  items: LiveFx[] = [];
  take(battle: Battle) {
    for (const fx of battle.fx) {
      // keep reaction labels from piling up on top of each other
      if (fx.kind === "text" && this.items.some((i) => i.fx.kind === "text" && i.fx.text === fx.text && i.age < 0.3 && Math.hypot((i.fx as typeof fx).x - fx.x, (i.fx as typeof fx).y - fx.y) < 2)) continue;
      this.items.push({ fx, age: 0, life: fx.kind === "text" && fx.big ? BIG_TEXT_LIFE : FX_LIFE[fx.kind] });
    }
    battle.fx.length = 0;
  }
  update(dt: number) {
    for (const i of this.items) i.age += dt;
    this.items = this.items.filter((i) => i.age < i.life);
  }
  clear() {
    this.items = [];
  }
  draw(ctx: CanvasRenderingContext2D, tile: number) {
    for (const { fx, age, life } of this.items) {
      const k = 1 - age / life;
      ctx.globalAlpha = k;
      switch (fx.kind) {
        case "beam": {
          const w = fx.width ?? 2.5;
          const path = () => {
            ctx.beginPath();
            ctx.moveTo(fx.x1 * tile, fx.y1 * tile);
            // jagged line so lightning reads as lightning
            for (let s = 1; s < 5; s++) {
              const t = s / 5;
              const jx = (Math.sin(s * 12.9 + fx.x1 * 7) * tile) / 5;
              const jy = (Math.cos(s * 7.3 + fx.y1 * 5) * tile) / 5;
              ctx.lineTo((fx.x1 + (fx.x2 - fx.x1) * t) * tile + jx, (fx.y1 + (fx.y2 - fx.y1) * t) * tile + jy);
            }
            ctx.lineTo(fx.x2 * tile, fx.y2 * tile);
          };
          // team-colored glow underneath, element-colored core on top
          if (fx.side !== undefined) {
            ctx.strokeStyle = SIDE_COLORS[fx.side];
            ctx.globalAlpha = k * 0.45;
            ctx.lineWidth = w + 4;
            path();
            ctx.stroke();
            ctx.globalAlpha = k;
          }
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = w;
          path();
          ctx.stroke();
          break;
        }
        case "slash": {
          const r = fx.size * tile * (0.8 + (1 - k) * 0.6);
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fx.x * tile, fx.y * tile, r, fx.angle - 1.1, fx.angle + 1.1);
          ctx.stroke();
          break;
        }
        case "burst":
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fx.x * tile, fx.y * tile, fx.r * tile * (0.6 + 0.4 * (1 - k)), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = k * 0.25;
          ctx.fillStyle = fx.color;
          ctx.fill();
          break;
        case "heal":
          ctx.strokeStyle = "#7dffa0";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fx.x * tile, fx.y * tile, fx.r * tile * (0.3 + 0.7 * (1 - k)), 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "text":
          ctx.font = fx.big ? "bold 18px system-ui, sans-serif" : "bold 12px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.strokeText(fx.text, fx.x * tile, (fx.y - age * 0.8) * tile);
          ctx.fillStyle = fx.color;
          ctx.fillText(fx.text, fx.x * tile, (fx.y - age * 0.8) * tile);
          break;
        case "death":
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 2;
          const r = Math.max(3, fx.size * tile) * (1 + age * 2);
          ctx.beginPath();
          ctx.moveTo(fx.x * tile - r, fx.y * tile - r);
          ctx.lineTo(fx.x * tile + r, fx.y * tile + r);
          ctx.moveTo(fx.x * tile + r, fx.y * tile - r);
          ctx.lineTo(fx.x * tile - r, fx.y * tile + r);
          ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Render interpolation: where each model was one tick ago, and how far (0..1) playback is into the current tick.
export type Interp = { alpha: number; prev: Map<Model, { x: number; y: number; facing: number }> };

export function drawBattle(ctx: CanvasRenderingContext2D, battle: Battle, tile: number, fx: FxLayer, realTime: number, interp?: Interp) {
  drawBackground(ctx, tile);
  drawSurfaces(ctx, battle.surfaces, tile, realTime);
  const a = interp?.alpha ?? 1;
  const draw = (m: Model) => {
    const p = interp?.prev.get(m);
    let x = m.x;
    let y = m.y;
    let facing = m.facing;
    if (p) {
      x = p.x + (m.x - p.x) * a;
      y = p.y + (m.y - p.y) * a;
      const turn = Math.atan2(Math.sin(m.facing - p.facing), Math.cos(m.facing - p.facing));
      facing = p.facing + turn * a;
    }
    // melee units lunge toward their target, ranged units recoil slightly
    const anim = m.attackAnim > 0 ? Math.min(0.18, m.attackAnim + (1 - a) * battle.rules.tick) : 0;
    const t = anim > 0 ? Math.sin((anim / 0.18) * Math.PI) : 0;
    const melee = (m.def.attack?.range ?? 0) <= 1.5;
    const off = t * (melee ? 0.25 : -0.08);
    return drawUnit(ctx, m.def, m.side, x + Math.cos(facing) * off, y + Math.sin(facing) * off, tile, {
      facing,
      hpFrac: m.hp / m.maxHp,
      flash: m.flash > 0,
      statuses: m.statuses,
      time: realTime,
      phase: m.id * 1.618,
    });
  };
  for (const m of battle.models) if (m.alive && m.def.layer === "ground") draw(m);
  for (const p of battle.projectiles) drawProjectile(ctx, p, tile, a);
  for (const m of battle.models) if (m.alive && m.def.layer === "air") draw(m);
  fx.draw(ctx, tile);
}

// Projectiles: element-colored core inside a team-colored halo, sized by damage, with a team-colored trail.
function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, tile: number, alpha = 1) {
  const r = Math.min(7, 1.6 + Math.sqrt(p.damage) / 3.2);
  const x = (p.px + (p.x - p.px) * alpha) * tile;
  const y = (p.py + (p.y - p.py) * alpha) * tile;
  const dx = (p.x - p.px) * tile;
  const dy = (p.y - p.py) * tile;
  const team = SIDE_COLORS[p.side];
  ctx.strokeStyle = team;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1.5, r * 0.9);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - dx * 2.5, y - dy * 2.5);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
  ctx.fillStyle = team;
  ctx.beginPath();
  ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
