import { STATUSES, SURFACES } from "../data/elements";
import { deployZone, RULES } from "../data/rules";
import { towerPlacements, TOWER_MAP } from "../data/towers";
import { footprintOf, formation, type Battle, type Fx, type Model, type Projectile } from "../sim/battle";
import { SurfaceGrid } from "../sim/surfaces";
import type { PlacedSquad, Shape, Side, StatusId, UnitDef } from "../sim/types";

export const SIDE_COLORS = ["#4da3ff", "#ff5468"] as const;
const STATUS_IDS = Object.keys(STATUSES) as StatusId[];
const SURFACE_IDS = SurfaceGrid.ids();

export function drawBackground(ctx: CanvasRenderingContext2D, tile: number, opts: { zones?: boolean; grid?: Side[] } = {}) {
  const W = RULES.fieldW * tile;
  const H = RULES.fieldH * tile;
  ctx.fillStyle = "#1d2a1f";
  ctx.fillRect(0, 0, W, H);
  // subtle checker so distances read at a glance
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = 0; y < RULES.fieldH; y++)
    for (let x = 0; x < RULES.fieldW; x++) if ((x + y) % 2 === 0) ctx.fillRect(x * tile, y * tile, tile, tile);
  if (opts.zones) {
    for (const side of [0, 1] as Side[]) {
      const { y0, y1 } = deployZone(side);
      ctx.fillStyle = side === 0 ? "rgba(77,163,255,0.07)" : "rgba(255,84,104,0.07)";
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

export interface UnitDrawOpts {
  alpha?: number;
  facing?: number;
  hpFrac?: number;
  flash?: boolean;
  statuses?: Partial<Record<StatusId, number>>;
}

export function drawUnit(ctx: CanvasRenderingContext2D, def: UnitDef, side: Side, x: number, y: number, tile: number, o: UnitDrawOpts = {}) {
  const r = Math.max(2.5, def.size * tile);
  const px = x * tile;
  const py = y * tile;
  const facing = o.facing ?? (side === 0 ? -Math.PI / 2 : Math.PI / 2);
  ctx.globalAlpha = o.alpha ?? 1;
  if (def.layer === "air") {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(px + r * 0.4, py + r * 0.9, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
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
  if (def.look.glyph && r >= 5) {
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
  o: { alpha?: number; outline?: string; dashed?: boolean; alive?: number; fill?: string } = {},
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
    drawUnit(ctx, def, side, x, y, tile, { alpha: dead ? 0.18 : o.alpha });
  });
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

export function drawBattle(ctx: CanvasRenderingContext2D, battle: Battle, tile: number, fx: FxLayer, realTime: number) {
  drawBackground(ctx, tile);
  drawSurfaces(ctx, battle.surfaces, tile, realTime);
  const draw = (m: Model) => {
    // melee units lunge toward their target, ranged units recoil slightly
    const t = m.attackAnim > 0 ? Math.sin((m.attackAnim / 0.18) * Math.PI) : 0;
    const melee = (m.def.attack?.range ?? 0) <= 1.5;
    const off = t * (melee ? 0.25 : -0.08);
    return drawUnit(ctx, m.def, m.side, m.x + Math.cos(m.facing) * off, m.y + Math.sin(m.facing) * off, tile, {
      facing: m.facing,
      hpFrac: m.hp / m.maxHp,
      flash: m.flash > 0,
      statuses: m.statuses,
    });
  };
  for (const m of battle.models) if (m.alive && m.def.layer === "ground") draw(m);
  for (const p of battle.projectiles) drawProjectile(ctx, p, tile);
  for (const m of battle.models) if (m.alive && m.def.layer === "air") draw(m);
  fx.draw(ctx, tile);
}

// Projectiles: element-colored core inside a team-colored halo, sized by damage, with a team-colored trail.
function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, tile: number) {
  const r = Math.min(7, 1.6 + Math.sqrt(p.damage) / 3.2);
  const x = p.x * tile;
  const y = p.y * tile;
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
