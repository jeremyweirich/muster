import { ELEMENT_COLORS, STATUSES, SURFACES, UNIT_REACTIONS } from "../data/elements";
import { RULES } from "../data/rules";
import { Rng } from "./rng";
import { matches } from "./selectors";
import { SurfaceGrid } from "./surfaces";
import type {
  AttackDef,
  Effect,
  Element,
  Layer,
  PlacedSquad,
  Rules,
  Side,
  StatusId,
  UnitDef,
  UnitReaction,
} from "./types";

export interface Model {
  id: number;
  squadUid: string;
  side: Side;
  def: UnitDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  cooldown: number;
  targetId: number;
  retarget: number;
  statuses: Partial<Record<StatusId, number>>;
  periodic: number[];
  buffAttack: number;
  buffMove: number;
  buffDamage: number;
  facing: number;
  flash: number; // seconds of hit flash, for rendering
}

interface Source {
  side: Side;
  def: UnitDef;
  squadUid: string;
  dmgMult: number;
}

interface Projectile {
  x: number;
  y: number;
  tx: number;
  ty: number;
  targetId: number;
  layer: Layer;
  speed: number;
  src: Source;
  color: string;
}

export type Fx =
  | { kind: "beam"; x1: number; y1: number; x2: number; y2: number; color: string }
  | { kind: "burst"; x: number; y: number; r: number; color: string }
  | { kind: "text"; x: number; y: number; text: string; color: string }
  | { kind: "death"; x: number; y: number; color: string; size: number };

export interface SquadSurvival {
  uid: string;
  defId: string;
  alive: number;
  total: number;
}

export interface BattleResult {
  winner: Side | null;
  timedOut: boolean;
  time: number;
  survivors: [SquadSurvival[], SquadSurvival[]];
  damageBySquad: Record<string, number>;
}

export interface BattleOptions {
  seed?: number;
  rules?: Rules;
  recordFx?: boolean;
}

const UNIT_REACTION_MAP = new Map<string, UnitReaction>();
for (const r of UNIT_REACTIONS) UNIT_REACTION_MAP.set(`${r.status}|${r.element}`, r);
const STATUS_IDS = Object.keys(STATUSES) as StatusId[];
const RANGED = 2.5; // attacks longer than this count as ranged (blocked by steam)
const SURFACE_TICK = 0.5;
const AURA_TICK = 0.25;

export class Battle {
  readonly rules: Rules;
  readonly models: Model[] = [];
  readonly projectiles: Projectile[] = [];
  readonly surfaces: SurfaceGrid;
  readonly fx: Fx[] = [];
  readonly recordFx: boolean;
  time = 0;
  over = false;
  winner: Side | null = null;
  timedOut = false;
  damageBySquad: Record<string, number> = {};

  private rng: Rng;
  private byId = new Map<number, Model>();
  private surfaceTimer = 0;
  private auraTimer = 0;
  private deathQueue: Model[] = [];
  private squadSizes = new Map<string, { defId: string; side: Side; total: number }>();

  constructor(defs: Map<string, UnitDef>, armies: [PlacedSquad[], PlacedSquad[]], opts: BattleOptions = {}) {
    this.rules = opts.rules ?? RULES;
    this.recordFx = opts.recordFx ?? false;
    this.rng = new Rng(opts.seed ?? 1);
    this.surfaces = new SurfaceGrid(this.rules.fieldW, this.rules.fieldH, this.rules.surfaceRes);
    let nextId = 1;
    for (const side of [0, 1] as Side[]) {
      for (const sq of armies[side]) {
        const def = defs.get(sq.defId);
        if (!def) continue;
        this.squadSizes.set(sq.uid, { defId: def.id, side, total: def.squadSize });
        for (const [x, y] of formation(def, sq.x, sq.y)) {
          const m: Model = {
            id: nextId++,
            squadUid: sq.uid,
            side,
            def,
            x,
            y,
            hp: def.hp,
            maxHp: def.hp,
            alive: true,
            cooldown: def.attack ? this.rng.range(0, def.attack.cooldown * 0.3) : 0,
            targetId: -1,
            retarget: this.rng.range(0, 0.3),
            statuses: {},
            periodic: (def.traits ?? []).map((t) => (t.type === "periodic" ? t.interval : 0)),
            buffAttack: 1,
            buffMove: 1,
            buffDamage: 1,
            facing: side === 0 ? -Math.PI / 2 : Math.PI / 2,
            flash: 0,
          };
          this.models.push(m);
          this.byId.set(m.id, m);
        }
      }
    }
    if (!this.models.some((m) => m.side === 0) || !this.models.some((m) => m.side === 1)) this.finish();
  }

  // ------------------------------------------------------------------ public

  step() {
    if (this.over) return;
    const dt = this.rules.tick;
    this.time += dt;

    this.updateStatuses(dt);
    this.auraTimer -= dt;
    if (this.auraTimer <= 0) {
      this.auraTimer += AURA_TICK;
      this.updateAuras();
    }
    this.updateTraits(dt);

    this.surfaces.update(dt);
    this.surfaceTimer -= dt;
    if (this.surfaceTimer <= 0) {
      this.surfaceTimer += SURFACE_TICK;
      this.applySurfaceTicks();
    }

    for (const m of this.models) if (m.alive) this.updateModel(m, dt);
    this.updateProjectiles(dt);
    this.separate();
    this.processDeaths();
    this.flushSurfaceEvents();

    const alive0 = this.models.some((m) => m.alive && m.side === 0);
    const alive1 = this.models.some((m) => m.alive && m.side === 1);
    if (!alive0 || !alive1) this.finish();
    else if (this.time >= this.rules.battleTimeLimit) {
      this.timedOut = true;
      this.finish();
    }
  }

  run(): BattleResult {
    while (!this.over) this.step();
    return this.result();
  }

  result(): BattleResult {
    const survivors: [SquadSurvival[], SquadSurvival[]] = [[], []];
    const alive = new Map<string, number>();
    for (const m of this.models) if (m.alive) alive.set(m.squadUid, (alive.get(m.squadUid) ?? 0) + 1);
    for (const [uid, info] of this.squadSizes) {
      const n = alive.get(uid) ?? 0;
      if (n > 0) survivors[info.side].push({ uid, defId: info.defId, alive: n, total: info.total });
    }
    return {
      winner: this.winner,
      timedOut: this.timedOut,
      time: this.time,
      survivors,
      damageBySquad: this.damageBySquad,
    };
  }

  get(id: number): Model | undefined {
    return this.byId.get(id);
  }

  // ------------------------------------------------------------------ update

  private finish() {
    this.over = true;
    const alive0 = this.models.some((m) => m.alive && m.side === 0);
    const alive1 = this.models.some((m) => m.alive && m.side === 1);
    this.winner = this.timedOut ? null : alive0 && !alive1 ? 0 : alive1 && !alive0 ? 1 : null;
  }

  private updateStatuses(dt: number) {
    for (const m of this.models) {
      if (!m.alive) continue;
      if (m.flash > 0) m.flash -= dt;
      for (const id of STATUS_IDS) {
        const t = m.statuses[id];
        if (t === undefined) continue;
        const def = STATUSES[id];
        if (def.dps) this.rawDamage(m, def.dps.amount * dt, def.dps.element, null);
        const left = t - dt;
        if (left <= 0) delete m.statuses[id];
        else m.statuses[id] = left;
      }
    }
  }

  private updateAuras() {
    for (const m of this.models) {
      m.buffAttack = 1;
      m.buffMove = 1;
      m.buffDamage = 1;
    }
    for (const src of this.models) {
      if (!src.alive || !src.def.traits) continue;
      for (const t of src.def.traits) {
        if (t.type !== "aura") continue;
        const r2 = t.radius * t.radius;
        for (const m of this.models) {
          if (!m.alive || dist2(src, m) > r2) continue;
          if (!matches(t.selector, m.def, m.side, src.side)) continue;
          if (t.attackSpeed) m.buffAttack = Math.max(m.buffAttack, t.attackSpeed);
          if (t.moveSpeed) m.buffMove = Math.max(m.buffMove, t.moveSpeed);
          if (t.damage) m.buffDamage = Math.max(m.buffDamage, t.damage);
        }
      }
    }
  }

  private updateTraits(dt: number) {
    for (const m of this.models) {
      if (!m.alive || !m.def.traits) continue;
      m.def.traits.forEach((t, i) => {
        if (t.type === "regen") m.hp = Math.min(m.maxHp, m.hp + t.perSecond * dt);
        else if (t.type === "periodic") {
          m.periodic[i] -= dt;
          if (m.periodic[i] <= 0) {
            m.periodic[i] += t.interval;
            for (const e of t.effects) this.applyEffect(e, m.x, m.y, m.def.layer, m.side, null, this.sourceOf(m));
          }
        }
      });
    }
  }

  private applySurfaceTicks() {
    for (const m of this.models) {
      if (!m.alive || m.def.layer !== "ground") continue;
      const s = this.surfaces.at(m.x, m.y);
      if (!s) continue;
      for (const e of SURFACES[s].onTick ?? []) {
        // Surfaces are neutral: no source side, so they hit everyone.
        this.applyEffect(e, m.x, m.y, "ground", null, m, null);
      }
    }
  }

  private isStunned(m: Model): boolean {
    for (const id of STATUS_IDS) if (m.statuses[id] !== undefined && STATUSES[id].stun) return true;
    return false;
  }

  private statusMult(m: Model, key: "moveMult" | "attackMult"): number {
    let mult = 1;
    for (const id of STATUS_IDS) {
      if (m.statuses[id] === undefined) continue;
      const v = STATUSES[id][key];
      if (v !== undefined) mult *= v;
    }
    return mult;
  }

  private canTarget(atk: AttackDef | undefined, t: Model): boolean {
    if (!t.alive) return false;
    if (atk && !atk.targets.includes(t.def.layer)) return false;
    if (atk && atk.range > RANGED && t.def.layer === "ground") {
      const s = this.surfaces.at(t.x, t.y);
      if (s && SURFACES[s].blocksRanged) return false;
    }
    return true;
  }

  private findTarget(m: Model): Model | undefined {
    const atk = m.def.attack;
    let best: Model | undefined;
    let bestScore = Infinity;
    const reach = (atk?.range ?? 0) + 4;
    for (const t of this.models) {
      if (t.side === m.side || !this.canTarget(atk, t)) continue;
      const d = Math.sqrt(dist2(m, t)) - t.def.size;
      let score = d;
      if (atk?.targeting === "highestHp" && d < reach) score = -t.hp * 1000 + d;
      else if (atk?.targeting === "lowestHp" && d < reach) score = -1e7 + t.hp * 1000 + d;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  private findEscort(m: Model): Model | undefined {
    let best: Model | undefined;
    let bestD = Infinity;
    for (const t of this.models) {
      if (t.side !== m.side || t === m || !t.alive || !t.def.attack) continue;
      const d = dist2(m, t);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private updateModel(m: Model, dt: number) {
    const atk = m.def.attack;
    const attackRate = this.statusMult(m, "attackMult") * m.buffAttack;
    if (m.cooldown > 0) m.cooldown -= dt * attackRate;
    if (this.isStunned(m)) return;

    m.retarget -= dt;
    let target = m.targetId >= 0 ? this.byId.get(m.targetId) : undefined;
    const stale = !target || (atk ? !this.canTarget(atk, target) : !target.alive);
    if (stale || m.retarget <= 0) {
      // units without an attack (support) follow the nearest ally that has one
      target = atk ? this.findTarget(m) : this.findEscort(m);
      m.targetId = target ? target.id : -1;
      m.retarget = 0.6 + this.rng.next() * 0.4;
    }
    if (!target) return;

    const dx = target.x - m.x;
    const dy = target.y - m.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const gap = d - m.def.size - target.def.size;
    const range = atk ? atk.range : 1;
    m.facing = Math.atan2(dy, dx);

    if (gap <= range) {
      if (atk && m.cooldown <= 0) {
        m.cooldown = atk.cooldown;
        this.fire(m, target, atk);
      }
      return;
    }
    let speed = m.def.speed * this.statusMult(m, "moveMult") * m.buffMove;
    if (m.def.layer === "ground") {
      const s = this.surfaces.at(m.x, m.y);
      if (s && SURFACES[s].moveMult) speed *= SURFACES[s].moveMult!;
    }
    const stepLen = Math.min(speed * dt, gap - range + 0.01);
    m.x += (dx / d) * stepLen;
    m.y += (dy / d) * stepLen;
  }

  private sourceOf(m: Model): Source {
    return { side: m.side, def: m.def, squadUid: m.squadUid, dmgMult: m.buffDamage };
  }

  private fire(m: Model, target: Model, atk: AttackDef) {
    const src = this.sourceOf(m);
    if (atk.delivery === "projectile") {
      this.projectiles.push({
        x: m.x,
        y: m.y,
        tx: target.x,
        ty: target.y,
        targetId: target.id,
        layer: target.def.layer,
        speed: atk.projectileSpeed ?? 10,
        src,
        color: ELEMENT_COLORS[atk.element],
      });
      return;
    }
    if (atk.delivery === "beam") this.emit({ kind: "beam", x1: m.x, y1: m.y, x2: target.x, y2: target.y, color: ELEMENT_COLORS[atk.element] });
    this.impact(src, target, target.x, target.y, target.def.layer, 1);
    if (atk.chain) this.chain(src, target, atk);
  }

  private chain(src: Source, first: Model, atk: AttackDef) {
    const chain = atk.chain!;
    const hit = new Set<number>([first.id]);
    let cur = first;
    let scale = 1;
    for (let k = 0; k < chain.count; k++) {
      let next: Model | undefined;
      let bestD = chain.range * chain.range;
      for (const t of this.models) {
        if (t.side === src.side || hit.has(t.id) || !this.canTarget(atk, t)) continue;
        const d = dist2(cur, t);
        if (d <= bestD) {
          bestD = d;
          next = t;
        }
      }
      if (!next) break;
      scale *= chain.falloff;
      hit.add(next.id);
      this.emit({ kind: "beam", x1: cur.x, y1: cur.y, x2: next.x, y2: next.y, color: ELEMENT_COLORS[atk.element] });
      this.impact(src, next, next.x, next.y, next.def.layer, scale);
      cur = next;
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const t = this.byId.get(p.targetId);
      if (t && t.alive) {
        p.tx = t.x;
        p.ty = t.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const stepLen = p.speed * dt;
      if (d <= stepLen) {
        this.projectiles.splice(i, 1);
        this.impact(p.src, t && t.alive ? t : null, p.tx, p.ty, p.layer, 1);
      } else {
        p.x += (dx / d) * stepLen;
        p.y += (dy / d) * stepLen;
      }
    }
  }

  // An attack landing at (x, y). Main damage only ever hits enemies; the
  // elemental side effects (statuses, surfaces) are neutral.
  private impact(src: Source, target: Model | null, x: number, y: number, layer: Layer, scale: number) {
    const atk = src.def.attack;
    if (!atk) return;
    const dmg = atk.damage * scale * src.dmgMult;
    if (atk.splash) {
      this.emit({ kind: "burst", x, y, r: atk.splash, color: ELEMENT_COLORS[atk.element] });
      for (const m of this.inRadius(x, y, atk.splash, layer)) {
        if (m.side !== src.side) this.hit(m, dmg, atk.element, src);
      }
    } else if (target && target.alive) {
      this.hit(target, dmg, atk.element, src);
    }
    if (layer === "ground") this.surfaces.element(x, y, Math.max(0.5, atk.splash ?? 0), atk.element);
    for (const e of atk.onHit ?? []) this.applyEffect(e, x, y, layer, src.side, target, src);
  }

  private applyEffect(e: Effect, x: number, y: number, layer: Layer, side: Side | null, direct: Model | null, src: Source | null) {
    const ff = side === null || this.rules.elementalFriendlyFire;
    switch (e.type) {
      case "damage":
        if (e.radius) {
          for (const m of this.inRadius(x, y, e.radius, layer)) if (side === null || m.side !== side) this.hit(m, e.amount, e.element, src);
          if (layer === "ground") this.surfaces.element(x, y, e.radius, e.element);
        } else if (direct) this.hit(direct, e.amount, e.element, src);
        break;
      case "status":
        if (e.radius) {
          for (const m of this.inRadius(x, y, e.radius, layer)) if (ff || m.side !== side) this.applyStatus(m, e.status, e.duration);
        } else if (direct && direct.alive) this.applyStatus(direct, e.status, e.duration);
        break;
      case "surface":
        if (layer === "ground") this.surfaces.create(x, y, e.radius, e.surface, e.duration);
        break;
      case "heal":
        for (const m of this.inRadius(x, y, e.radius, layer)) if (side === null || m.side === side) m.hp = Math.min(m.maxHp, m.hp + e.amount);
        break;
    }
  }

  private inRadius(x: number, y: number, r: number, layer: Layer): Model[] {
    const out: Model[] = [];
    for (const m of this.models) {
      if (!m.alive || m.def.layer !== layer) continue;
      const dx = m.x - x;
      const dy = m.y - y;
      const rr = r + m.def.size;
      if (dx * dx + dy * dy <= rr * rr) out.push(m);
    }
    return out;
  }

  // Elemental damage hitting a unit: check reactions with its statuses first.
  private hit(m: Model, amount: number, element: Element, src: Source | null) {
    if (!m.alive) return;
    let mult = 1;
    for (const id of STATUS_IDS) {
      if (m.statuses[id] === undefined) continue;
      const r = UNIT_REACTION_MAP.get(`${id}|${element}`);
      if (!r) continue;
      mult *= this.react(m, id, r);
    }
    if (src?.def.attack?.bonusVs) {
      for (const b of src.def.attack.bonusVs) if (matches(b.selector, m.def, m.side, src.side)) mult *= b.mult;
    }
    this.rawDamage(m, amount * mult, element, src);
  }

  private react(m: Model, status: StatusId, r: UnitReaction): number {
    if (r.removeStatus) delete m.statuses[status];
    if (r.addStatus && !m.def.immuneStatuses?.includes(r.addStatus.status)) {
      m.statuses[r.addStatus.status] = r.addStatus.duration ?? STATUSES[r.addStatus.status].duration;
    }
    if (r.bonusDamage) this.rawDamage(m, r.bonusDamage.amount, r.bonusDamage.element, null);
    if (r.name) this.emit({ kind: "text", x: m.x, y: m.y - 0.6, text: r.name, color: STATUSES[status].color });
    return r.damageMult ?? 1;
  }

  private applyStatus(m: Model, id: StatusId, duration?: number) {
    if (!m.alive || m.def.immuneStatuses?.includes(id)) return;
    const def = STATUSES[id];
    let consumed = false;
    if (def.element) {
      for (const cur of STATUS_IDS) {
        if (m.statuses[cur] === undefined) continue;
        const r = UNIT_REACTION_MAP.get(`${cur}|${def.element}`);
        if (!r) continue;
        if (r.consumeIncoming) consumed = true;
        this.react(m, cur, r);
      }
    }
    if (!consumed) m.statuses[id] = Math.max(m.statuses[id] ?? 0, duration ?? def.duration);
  }

  private rawDamage(m: Model, amount: number, element: Element, src: Source | null) {
    if (!m.alive) return;
    const resist = m.def.resist?.[element] ?? 0;
    const dmg = amount * (1 - resist);
    if (dmg <= 0) return;
    m.hp -= dmg;
    m.flash = 0.1;
    if (src) this.damageBySquad[src.squadUid] = (this.damageBySquad[src.squadUid] ?? 0) + Math.min(dmg, m.hp + dmg);
    if (m.hp <= 0) {
      m.alive = false;
      this.deathQueue.push(m);
      this.emit({ kind: "death", x: m.x, y: m.y, color: m.def.look.color, size: m.def.size });
    }
  }

  private processDeaths() {
    let guard = 0;
    while (this.deathQueue.length && guard++ < 1000) {
      const m = this.deathQueue.shift()!;
      for (const t of m.def.traits ?? []) {
        if (t.type !== "onDeath") continue;
        for (const e of t.effects) this.applyEffect(e, m.x, m.y, m.def.layer, m.side, null, this.sourceOf(m));
      }
    }
  }

  // Simple circle separation using a spatial hash; ground and air don't collide.
  private separate() {
    const cell = 1;
    const grid = new Map<number, Model[]>();
    const key = (cx: number, cy: number, layer: Layer) => (layer === "air" ? 1 : 0) + 2 * (cx + 1000 * cy);
    for (const m of this.models) {
      if (!m.alive) continue;
      const k = key(Math.floor(m.x / cell), Math.floor(m.y / cell), m.def.layer);
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(m);
    }
    for (const m of this.models) {
      if (!m.alive) continue;
      const cx = Math.floor(m.x / cell);
      const cy = Math.floor(m.y / cell);
      const reach = Math.ceil((m.def.size + 1.1) / cell);
      for (let oy = -reach; oy <= reach; oy++) {
        for (let ox = -reach; ox <= reach; ox++) {
          const b = grid.get(key(cx + ox, cy + oy, m.def.layer));
          if (!b) continue;
          for (const o of b) {
            if (o.id <= m.id) continue;
            const dx = o.x - m.x;
            const dy = o.y - m.y;
            const min = m.def.size + o.def.size;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min) continue;
            const d = Math.sqrt(d2) || 0.001;
            const overlap = (min - d) * 0.5;
            const wm = m.def.size * m.def.size;
            const wo = o.def.size * o.def.size;
            const fm = wo / (wm + wo);
            const fo = wm / (wm + wo);
            const nx = d2 === 0 ? 1 : dx / d;
            const ny = d2 === 0 ? 0 : dy / d;
            m.x -= nx * overlap * fm;
            m.y -= ny * overlap * fm;
            o.x += nx * overlap * fo;
            o.y += ny * overlap * fo;
          }
        }
      }
      m.x = clamp(m.x, m.def.size, this.rules.fieldW - m.def.size);
      m.y = clamp(m.y, m.def.size, this.rules.fieldH - m.def.size);
    }
  }

  private flushSurfaceEvents() {
    for (const ev of this.surfaces.events) this.emit({ kind: "text", x: ev.x, y: ev.y, text: ev.name, color: "#ffffff" });
    this.surfaces.events.length = 0;
  }

  private emit(f: Fx) {
    if (this.recordFx) this.fx.push(f);
  }
}

// Lay out a squad's models inside its footprint.
export function formation(def: UnitDef, sx: number, sy: number): [number, number][] {
  const { w, h } = def.footprint;
  const n = Math.max(1, def.squadSize);
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * w) / h))));
  const rows = Math.ceil(n / cols);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
    const offset = (cols - inRow) / 2;
    out.push([sx + ((c + offset + 0.5) * w) / cols, sy + ((r + 0.5) * h) / rows]);
  }
  return out;
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
