import { ELEMENT_COLORS, STATUSES, SURFACES, UNIT_REACTIONS } from "../data/elements";
import { RULES } from "../data/rules";
import { towerDef, towerPlacements } from "../data/towers";
import { levelDef } from "./levels";
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
  StatusDef,
  StatusId,
  TraitDef,
  UnitDef,
  UnitReaction,
} from "./types";

export interface Model {
  id: number;
  squad: number; // index into Battle.squads
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
  statusOwner: Partial<Record<StatusId, number>>; // squad credited for each status
  periodic: number[];
  charged: boolean; // a charge trait's first-hit bonus is still unused
  shield: number; // hits it can still ignore (shield trait)
  ambush: number; // ambush trait: seconds it stays targetable after attacking (0 = always targetable)
  revealedUntil: number; // ambush: battle time until which it can be targeted
  rampTarget: number; // ramp trait: the target of its current streak of hits
  rampHits: number;
  summoned: boolean; // spawned mid-battle (Warboss); not part of the placed squad's survivors
  engaged: boolean; // in range of its target this tick (spacing only applies while advancing)
  buffAttack: number;
  buffMove: number;
  buffDamage: number;
  facing: number;
  flash: number; // seconds of hit flash, for rendering
  attackAnim: number; // seconds left of the attack lunge/recoil, for rendering
}

// Everything the post-battle report shows for one squad.
export interface SquadStats {
  uid: string;
  defId: string;
  name: string;
  side: Side;
  structure: boolean;
  total: number;
  alive: number;
  dealt: number; // to enemies
  friendly: number; // to own side (elemental friendly fire)
  taken: number;
  kills: number;
  teamKills: number;
  lost: number;
  healed: number;
  dealtTo: Record<string, number>; // squad uid -> damage this squad dealt to it
  takenFrom: Record<string, number>; // squad uid -> damage it dealt to this squad
  dealtBy: Record<string, number>; // mechanism: Attack, Burning, Fire (surface), Conduct...
  takenBySource: Record<string, number>; // unit name, status or surface
  takenByElement: Record<string, number>;
  takenByReaction: Record<string, number>; // extra damage caused by reactions
}

interface SquadInfo {
  uid: string;
  def: UnitDef;
  side: Side;
  stats: SquadStats;
}

// Who gets credit for a piece of damage, and how it shows up in reports.
interface Attr {
  squad: number; // -1 = nobody
  label: string; // as seen by the victim ("Fire Mage", "Burning", "Electrified Water")
  mech: string; // as seen by the dealer ("Attack", "Burning", ...)
  model?: number; // the attacking model, when it was an attack (for onKill traits)
}

interface Source {
  side: Side;
  def: UnitDef;
  squad: number;
  model: number; // attacking model id, for retaliation
  dmgMult: number;
}

export interface Projectile {
  x: number;
  y: number;
  px: number; // previous position, for trails
  py: number;
  side: Side;
  damage: number; // for sizing the projectile
  tx: number;
  ty: number;
  targetId: number;
  layer: Layer;
  speed: number;
  src: Source;
  color: string;
}

export type Fx =
  | { kind: "beam"; x1: number; y1: number; x2: number; y2: number; color: string; side?: Side; width?: number }
  | { kind: "burst"; x: number; y: number; r: number; color: string }
  | { kind: "heal"; x: number; y: number; r: number }
  | { kind: "slash"; x: number; y: number; angle: number; color: string; size: number }
  | { kind: "text"; x: number; y: number; text: string; color: string; big?: boolean }
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
  survivors: [SquadSurvival[], SquadSurvival[]]; // excludes towers
  stats: Record<string, SquadStats>;
}

export interface BattleOptions {
  seed?: number;
  rules?: Rules;
  recordFx?: boolean;
  towers?: boolean; // default true; the lab and sandbox turn them off
  towerLevels?: [number[], number[]]; // upgrade level of each tower, per side
}

export type DefMap = Map<string, UnitDef>;

const UNIT_REACTION_MAP = new Map<string, UnitReaction>();
for (const r of UNIT_REACTIONS) UNIT_REACTION_MAP.set(`${r.status}|${r.element}`, r);
const STATUS_IDS = Object.keys(STATUSES) as StatusId[];
const RANGED = 2.5; // attacks longer than this count as ranged (blocked by steam)
const SURFACE_TICK = 0.5;
const AURA_TICK = 0.25;

export function footprintOf(def: UnitDef, rot?: boolean): { w: number; h: number } {
  return rot ? { w: def.footprint.h, h: def.footprint.w } : def.footprint;
}

// Lay out a squad's models inside its (possibly rotated) footprint.
export function formation(def: UnitDef, sx: number, sy: number, rot?: boolean): [number, number][] {
  const { w, h } = footprintOf(def, rot);
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

function emptyStats(uid: string, def: UnitDef, side: Side): SquadStats {
  return {
    uid,
    defId: def.id,
    name: def.name,
    side,
    structure: !!def.structure,
    total: def.squadSize,
    alive: def.squadSize,
    dealt: 0,
    friendly: 0,
    taken: 0,
    kills: 0,
    teamKills: 0,
    lost: 0,
    healed: 0,
    dealtTo: {},
    takenFrom: {},
    dealtBy: {},
    takenBySource: {},
    takenByElement: {},
    takenByReaction: {},
  };
}

// The first trait of a type on a unit, typed.
function trait<T extends TraitDef["type"]>(def: UnitDef, type: T): Extract<TraitDef, { type: T }> | undefined {
  return def.traits?.find((t): t is Extract<TraitDef, { type: T }> => t.type === type);
}

function add(rec: Record<string, number>, key: string, v: number) {
  if (v > 0) rec[key] = (rec[key] ?? 0) + v;
}

export class Battle {
  readonly rules: Rules;
  readonly models: Model[] = [];
  readonly squads: SquadInfo[] = [];
  readonly projectiles: Projectile[] = [];
  readonly surfaces: SurfaceGrid;
  readonly fx: Fx[] = [];
  readonly recordFx: boolean;
  time = 0;
  over = false;
  winner: Side | null = null;
  timedOut = false;

  private rng: Rng;
  private byId = new Map<number, Model>();
  private surfaceTimer = 0;
  private auraTimer = 0;
  private deathQueue: Model[] = [];
  private sideDefs: [DefMap, DefMap];

  // `defs` may differ per side, since each side has its own upgrades.
  constructor(defs: DefMap | [DefMap, DefMap], armies: [PlacedSquad[], PlacedSquad[]], opts: BattleOptions = {}) {
    this.rules = opts.rules ?? RULES;
    this.recordFx = opts.recordFx ?? false;
    this.rng = new Rng(opts.seed ?? 1);
    this.surfaces = new SurfaceGrid(this.rules.fieldW, this.rules.fieldH, this.rules.surfaceRes);
    this.sideDefs = Array.isArray(defs) ? defs : [defs, defs];
    for (const side of [0, 1] as Side[]) {
      const sideDefs = this.sideDefs[side];
      for (const sq of armies[side]) {
        const def = sideDefs.get(sq.defId);
        if (def) this.addSquad(sq, levelDef(def, sq.level ?? 1), side);
      }
      if (opts.towers ?? true) {
        towerPlacements(side, this.rules).forEach((t, i) => {
          this.addSquad(t, towerDef(t.defId, opts.towerLevels?.[side]?.[i] ?? 0, this.rules, this.rules.towers[i]?.name), side);
        });
      }
    }
    if (!this.armyAlive(0) || !this.armyAlive(1)) this.finish();
  }

  private addSquad(sq: PlacedSquad, def: UnitDef, side: Side) {
    const squad = this.squads.length;
    this.squads.push({ uid: sq.uid, def, side, stats: emptyStats(sq.uid, def, side) });
    for (const [x, y] of formation(def, sq.x, sq.y, sq.rot)) this.addModel(def, squad, side, x, y);
  }

  private addModel(def: UnitDef, squad: number, side: Side, x: number, y: number, summoned = false): Model {
    const m: Model = {
      id: this.models.length + 1,
      squad,
      squadUid: this.squads[squad].uid,
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
      statusOwner: {},
      periodic: (def.traits ?? []).map((t) => (t.type === "periodic" && !t.atTarget ? t.interval : 0)),
      charged: !!trait(def, "charge"),
      shield: trait(def, "shield")?.hits ?? 0,
      ambush: trait(def, "ambush")?.reveal ?? 0,
      revealedUntil: -1,
      rampTarget: -1,
      rampHits: 0,
      summoned,
      engaged: false,
      buffAttack: 1,
      buffMove: 1,
      buffDamage: 1,
      facing: side === 0 ? -Math.PI / 2 : Math.PI / 2,
      flash: 0,
      attackAnim: 0,
    };
    this.models.push(m);
    this.byId.set(m.id, m);
    return m;
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

    if (!this.armyAlive(0) || !this.armyAlive(1)) this.finish();
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
    const alive = new Array(this.squads.length).fill(0);
    for (const m of this.models) if (m.alive && !m.summoned) alive[m.squad]++;
    const stats: Record<string, SquadStats> = {};
    this.squads.forEach((sq, i) => {
      sq.stats.alive = alive[i];
      stats[sq.uid] = sq.stats;
      if (alive[i] > 0 && !sq.def.structure) {
        survivors[sq.side].push({ uid: sq.uid, defId: sq.def.id, alive: alive[i], total: sq.def.squadSize });
      }
    });
    return { winner: this.winner, timedOut: this.timedOut, time: this.time, survivors, stats };
  }

  get(id: number): Model | undefined {
    return this.byId.get(id);
  }

  // ------------------------------------------------------------------ update

  // Towers don't count: a side is beaten when its army is gone.
  private armyAlive(side: Side): boolean {
    return this.models.some((m) => m.alive && m.side === side && !m.def.structure);
  }

  private finish() {
    this.over = true;
    const alive0 = this.armyAlive(0);
    const alive1 = this.armyAlive(1);
    this.winner = this.timedOut ? null : alive0 && !alive1 ? 0 : alive1 && !alive0 ? 1 : null;
  }

  private attrFor(squad: number, mech: string): Attr {
    return { squad, label: squad >= 0 ? this.squads[squad].def.name : mech, mech };
  }

  private updateStatuses(dt: number) {
    for (const m of this.models) {
      if (!m.alive) continue;
      if (m.flash > 0) m.flash -= dt;
      if (m.attackAnim > 0) m.attackAnim -= dt;
      for (const id of STATUS_IDS) {
        const t = m.statuses[id];
        if (t === undefined) continue;
        const def = STATUSES[id];
        if (def.dps) {
          this.rawDamage(m, def.dps.amount * dt, def.dps.element, { squad: m.statusOwner[id] ?? -1, label: def.name, mech: def.name });
        }
        const left = t - dt;
        if (left <= 0) {
          delete m.statuses[id];
          delete m.statusOwner[id];
        } else m.statuses[id] = left;
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
        if (t.type === "regen") {
          if (t.suppressedBy === undefined || m.statuses[t.suppressedBy] === undefined) m.hp = Math.min(m.maxHp, m.hp + t.perSecond * dt);
        }
        else if (t.type === "periodic") {
          m.periodic[i] = Math.max(0, m.periodic[i] - dt);
          if (m.periodic[i] > 0) return;
          const attr = this.attrFor(m.squad, "Periodic");
          if (t.atTarget) {
            // used on the current target: it waits, ready, until there's one in range
            const target = m.engaged ? this.byId.get(m.targetId) : undefined;
            if (!target?.alive) return;
            m.periodic[i] = t.once ? Infinity : t.interval;
            const r = Math.max(0.6, ...t.effects.map((e) => ("radius" in e && e.radius) || 0));
            const e0 = t.effects[0];
            const color = e0?.type === "damage" ? ELEMENT_COLORS[e0.element] : e0?.type === "status" ? STATUSES[e0.status].color : "#ffffff";
            this.emit({ kind: "burst", x: target.x, y: target.y, r, color });
            for (const e of t.effects) this.applyEffect(e, target.x, target.y, target.def.layer, m.side, target, attr);
            return;
          }
          m.periodic[i] = t.once ? Infinity : t.interval;
          for (const e of t.effects) {
            // an area status or blast around the unit reaches both layers, so a bat's shriek hits the ground below
            const layers: Layer[] = (e.type === "status" || e.type === "damage") && e.radius ? ["ground", "air"] : [m.def.layer];
            for (const layer of layers) this.applyEffect(e, m.x, m.y, layer, m.side, null, attr);
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
      const name = SURFACES[s].name;
      const attr = { squad: this.surfaces.ownerAt(m.x, m.y), label: name, mech: name };
      // Surfaces are neutral: no source side, so they hit everyone standing in them.
      for (const e of SURFACES[s].onTick ?? []) this.applyEffect(e, m.x, m.y, "ground", null, m, attr);
    }
  }

  private isStunned(m: Model): boolean {
    for (const id of STATUS_IDS) if (m.statuses[id] !== undefined && STATUSES[id].stun) return true;
    return false;
  }

  private statusMult(m: Model, key: keyof Pick<StatusDef, "moveMult" | "attackMult" | "damageDealtMult" | "damageTakenMult">): number {
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
    if (t.ambush && this.time > t.revealedUntil) return false;
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
      // extra range against a target counts as it being that much closer
      const d = Math.sqrt(dist2(m, t)) - t.def.size - this.rangeBonus(m, atk, t);
      let score = d;
      if (atk?.targeting === "towers" && t.def.structure) score = d - 1000;
      else if (atk?.prefers && matches(atk.prefers, t.def, t.side, m.side)) score = d - 500;
      else if (atk?.targeting === "highestHp" && d < reach) score = -t.hp * 1000 + d;
      else if (atk?.targeting === "lowestHp" && d < reach) score = -1e7 + t.hp * 1000 + d;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  private rangeBonus(m: Model, atk: AttackDef | undefined, t: Model): number {
    let add = 0;
    for (const r of atk?.rangeVs ?? []) if (matches(r.selector, t.def, t.side, m.side)) add += r.add;
    return add;
  }

  private findEscort(m: Model): Model | undefined {
    let best: Model | undefined;
    let bestD = Infinity;
    for (const t of this.models) {
      if (t.side !== m.side || t === m || !t.alive || !t.def.attack || t.def.structure) continue;
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
    const anchored = m.def.speed <= 0;
    if (!atk && anchored) return;
    let attackRate = this.statusMult(m, "attackMult") * m.buffAttack;
    const unhurt = trait(m.def, "unhurt");
    if (unhurt && m.hp >= m.maxHp) attackRate *= unhurt.attackSpeed;
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
    const range = atk ? atk.range + this.rangeBonus(m, atk, target) : 1;
    if (!anchored) m.facing = Math.atan2(dy, dx);

    m.engaged = gap <= range;
    if (gap <= range) {
      if (atk && m.cooldown <= 0) {
        m.cooldown = atk.cooldown;
        this.fire(m, target, atk);
        if (atk.selfDestruct) this.die(m);
      }
      return;
    }
    if (anchored) return;
    let speed = m.def.speed * this.rules.speedScale * this.statusMult(m, "moveMult") * m.buffMove;
    const sprint = trait(m.def, "sprint");
    if (sprint && this.time < sprint.duration) speed *= sprint.mult;
    if (m.def.layer === "ground") {
      const s = this.surfaces.at(m.x, m.y);
      if (s && SURFACES[s].moveMult) speed *= SURFACES[s].moveMult!;
    }
    const stepLen = Math.min(speed * dt, gap - range + 0.01);
    m.x += (dx / d) * stepLen;
    m.y += (dy / d) * stepLen;
  }

  private sourceOf(m: Model): Source {
    return { side: m.side, def: m.def, squad: m.squad, model: m.id, dmgMult: m.buffDamage * this.statusMult(m, "damageDealtMult") };
  }

  private fire(m: Model, target: Model, atk: AttackDef) {
    const src = this.sourceOf(m);
    m.attackAnim = 0.18;
    if (m.ambush) m.revealedUntil = this.time + m.ambush;
    const ramp = trait(m.def, "ramp");
    if (ramp) {
      m.rampHits = m.rampTarget === target.id ? m.rampHits + 1 : 0;
      m.rampTarget = target.id;
      src.dmgMult *= Math.min(ramp.max, 1 + ramp.perHit * m.rampHits);
    }
    if (m.charged) {
      m.charged = false;
      for (const t of m.def.traits ?? []) if (t.type === "charge") src.dmgMult *= t.mult;
      this.emit({ kind: "text", x: m.x, y: m.y - 0.6, text: "Charge!", color: "#e2b45a" });
    }
    if (atk.delivery === "projectile") {
      this.projectiles.push({
        x: m.x,
        y: m.y,
        px: m.x,
        py: m.y,
        side: m.side,
        damage: atk.damage * src.dmgMult,
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
    if (atk.delivery === "beam") {
      this.emit({ kind: "beam", x1: m.x, y1: m.y, x2: target.x, y2: target.y, color: ELEMENT_COLORS[atk.element], side: m.side, width: beamWidth(atk.damage * src.dmgMult) });
    } else {
      this.emit({ kind: "slash", x: target.x, y: target.y, angle: m.facing, color: ELEMENT_COLORS[atk.element], size: Math.max(0.35, target.def.size + 0.15) });
    }
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
      this.emit({ kind: "beam", x1: cur.x, y1: cur.y, x2: next.x, y2: next.y, color: ELEMENT_COLORS[atk.element], side: src.side, width: beamWidth(atk.damage * scale * src.dmgMult) });
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
      p.px = p.x;
      p.py = p.y;
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
    const attr: Attr = { ...this.attrFor(src.squad, "Attack"), model: src.model };
    if (atk.splash) {
      this.emit({ kind: "burst", x, y, r: atk.splash, color: ELEMENT_COLORS[atk.element] });
      for (const m of this.inRadius(x, y, atk.splash, layer)) {
        if (m.side !== src.side) this.hit(m, dmg, atk.element, attr, src);
      }
    } else if (target && target.alive) {
      this.hit(target, dmg, atk.element, attr, src);
    }
    if (layer === "ground") this.surfaces.element(x, y, Math.max(0.5, atk.splash ?? 0), atk.element, src.squad);
    for (const e of atk.onHit ?? []) this.applyEffect(e, x, y, layer, src.side, target, attr);
  }

  private applyEffect(e: Effect, x: number, y: number, layer: Layer, side: Side | null, direct: Model | null, attr: Attr) {
    switch (e.type) {
      case "damage":
        if (e.radius) {
          for (const m of this.inRadius(x, y, e.radius, layer)) if (side === null || m.side !== side) this.hit(m, e.amount, e.element, attr, null);
          if (layer === "ground") this.surfaces.element(x, y, e.radius, e.element, attr.squad);
        } else if (direct) this.hit(direct, e.amount, e.element, attr, null);
        break;
      case "status": {
        const mode = e.affects ?? (side === null || this.rules.elementalFriendlyFire ? "all" : "enemies");
        const ok = (m: Model) => side === null || mode === "all" || (mode === "enemies" ? m.side !== side : m.side === side);
        let targets: Model[];
        if (e.global) targets = this.models.filter((m) => m.alive);
        else if (e.radius) targets = this.inRadius(x, y, e.radius, layer);
        else targets = direct && direct.alive ? [direct] : [];
        for (const m of targets) if (ok(m)) this.applyStatus(m, e.status, e.duration, attr);
        break;
      }
      case "surface":
        if (layer === "ground") this.surfaces.create(x, y, e.radius, e.surface, e.duration, attr.squad);
        break;
      case "heal": {
        let healed = 0;
        for (const layerOf of ["ground", "air"] as Layer[]) {
          for (const m of this.inRadius(x, y, e.radius, layerOf)) {
            if (side !== null && m.side !== side) continue;
            const amt = Math.min(e.amount, m.maxHp - m.hp);
            m.hp += amt;
            healed += amt;
          }
        }
        if (attr.squad >= 0) this.squads[attr.squad].stats.healed += healed;
        if (healed > 0) this.emit({ kind: "heal", x, y, r: e.radius });
        break;
      }
      case "cleanse": {
        let any = false;
        for (const layerOf of ["ground", "air"] as Layer[]) {
          for (const m of this.inRadius(x, y, e.radius, layerOf)) {
            if (side !== null && m.side !== side) continue;
            for (const id of STATUS_IDS) {
              if (m.statuses[id] === undefined) continue;
              delete m.statuses[id];
              delete m.statusOwner[id];
              any = true;
            }
          }
        }
        if (any) this.emit({ kind: "heal", x, y, r: e.radius });
        break;
      }
      case "summon": {
        // summoned models join the source's squad, built from that side's (upgraded) def
        const def = side === null || attr.squad < 0 ? undefined : this.sideDefs[side].get(e.unit);
        if (!def || side === null) break;
        for (let k = 0; k < e.count; k++) {
          const a = this.rng.range(0, Math.PI * 2);
          const m = this.addModel(def, attr.squad, side, x + Math.cos(a) * 0.8, y + Math.sin(a) * 0.8, true);
          this.emit({ kind: "burst", x: m.x, y: m.y, r: 0.4, color: def.look.color });
        }
        break;
      }
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
  private hit(m: Model, amount: number, element: Element, attr: Attr, src: Source | null) {
    if (!m.alive) return;
    if (src && src.side !== m.side && this.meatShield(m)) return;
    let rmult = 1;
    const reacted: string[] = [];
    for (const id of STATUS_IDS) {
      if (m.statuses[id] === undefined) continue;
      const r = UNIT_REACTION_MAP.get(`${id}|${element}`);
      if (!r) continue;
      const k = this.react(m, id, r, attr);
      if (k !== 1) {
        rmult *= k;
        if (r.name) reacted.push(r.name);
      }
    }
    let bonus = 1;
    if (src?.def.attack?.bonusVs) {
      for (const b of src.def.attack.bonusVs) if (matches(b.selector, m.def, m.side, src.side)) bonus *= b.mult;
    }
    const share = rmult > 1 && reacted.length ? { names: reacted, share: 1 - 1 / rmult } : undefined;
    this.rawDamage(m, amount * bonus * rmult, element, attr, share);
    if (src && src.side !== m.side) this.retaliate(m, src);
  }

  // A nearby ally (the smallest first) dies in m's place. True if one did.
  private meatShield(m: Model): boolean {
    const t = trait(m.def, "meatShield");
    if (!t || this.rng.next() >= t.chance) return false;
    let best: Model | undefined;
    for (const o of this.models) {
      if (!o.alive || o === m || o.side !== m.side || o.def.structure || !matches(t.selector, o.def, o.side, m.side)) continue;
      if (dist2(m, o) > t.radius * t.radius) continue;
      if (!best || o.maxHp < best.maxHp || (o.maxHp === best.maxHp && dist2(m, o) < dist2(m, best))) best = o;
    }
    if (!best) return false;
    this.emit({ kind: "text", x: best.x, y: best.y - 0.5, text: "Meat shield!", color: "#e2b45a" });
    this.die(best);
    return true;
  }

  private retaliate(m: Model, src: Source) {
    const attacker = this.byId.get(src.model);
    if (!attacker || !attacker.alive || !m.def.traits) return;
    for (const t of m.def.traits) {
      if (t.type !== "retaliate") continue;
      if (t.maxRange !== undefined && Math.sqrt(dist2(m, attacker)) - m.def.size - attacker.def.size > t.maxRange) continue;
      const attr = this.attrFor(m.squad, "Retaliation");
      for (const e of t.effects) this.applyEffect({ ...e, radius: undefined } as Effect, attacker.x, attacker.y, attacker.def.layer, m.side, attacker, attr);
    }
  }

  private react(m: Model, status: StatusId, r: UnitReaction, attr: Attr): number {
    if (r.removeStatus) {
      delete m.statuses[status];
      delete m.statusOwner[status];
    }
    if (r.addStatus && !m.def.immuneStatuses?.includes(r.addStatus.status)) {
      m.statuses[r.addStatus.status] = r.addStatus.duration ?? STATUSES[r.addStatus.status].duration;
      m.statusOwner[r.addStatus.status] = attr.squad;
    }
    if (r.bonusDamage) this.rawDamage(m, r.bonusDamage.amount, r.bonusDamage.element, { squad: attr.squad, label: r.name, mech: r.name });
    if (r.name) this.emit({ kind: "text", x: m.x, y: m.y - 0.6, text: r.name, color: STATUSES[status].color });
    return r.damageMult ?? 1;
  }

  private applyStatus(m: Model, id: StatusId, duration: number | undefined, attr: Attr) {
    if (!m.alive || m.def.immuneStatuses?.includes(id)) return;
    const def = STATUSES[id];
    let consumed = false;
    if (def.element) {
      for (const cur of STATUS_IDS) {
        if (m.statuses[cur] === undefined) continue;
        const r = UNIT_REACTION_MAP.get(`${cur}|${def.element}`);
        if (!r) continue;
        if (r.consumeIncoming) consumed = true;
        this.react(m, cur, r, attr);
      }
    }
    if (!consumed) {
      m.statuses[id] = Math.max(m.statuses[id] ?? 0, duration ?? def.duration);
      m.statusOwner[id] = attr.squad;
    }
  }

  private rawDamage(m: Model, amount: number, element: Element, attr: Attr, reaction?: { names: string[]; share: number }) {
    if (!m.alive) return;
    const resist = m.def.resist?.[element] ?? 0;
    const dmg = amount * (1 - resist) * this.statusMult(m, "damageTakenMult");
    if (dmg <= 0) return;
    if (m.shield > 0) {
      m.shield--;
      m.flash = 0.1;
      this.emit({ kind: "text", x: m.x, y: m.y - 0.5, text: "Blocked", color: ELEMENT_COLORS.physical });
      return;
    }
    const applied = Math.min(dmg, m.hp);
    m.hp -= dmg;
    m.flash = 0.1;

    const dealer = attr.squad >= 0 ? this.squads[attr.squad] : null;
    const friendly = dealer !== null && dealer.side === m.side;
    const victim = this.squads[m.squad].stats;
    victim.taken += applied;
    add(victim.takenBySource, friendly ? `${attr.label} (ally)` : attr.label, applied);
    add(victim.takenByElement, element, applied);
    const extra = reaction ? applied * reaction.share : 0;
    if (reaction) for (const n of reaction.names) add(victim.takenByReaction, n, extra / reaction.names.length);

    if (dealer) {
      add(dealer.stats.dealtTo, victim.uid, applied);
      add(victim.takenFrom, dealer.uid, applied);
      if (friendly) dealer.stats.friendly += applied;
      else {
        dealer.stats.dealt += applied;
        if (attr.model !== undefined) this.lifesteal(attr.model, applied);
        add(dealer.stats.dealtBy, attr.mech, applied - extra);
        if (reaction) for (const n of reaction.names) add(dealer.stats.dealtBy, n, extra / reaction.names.length);
      }
    }

    if (m.hp <= 0) {
      if (dealer) friendly ? dealer.stats.teamKills++ : dealer.stats.kills++;
      this.die(m);
      if (!friendly && attr.model !== undefined) this.onKill(attr.model);
    }
  }

  private lifesteal(attackerId: number, dealt: number) {
    const a = this.byId.get(attackerId);
    const t = a?.alive ? trait(a.def, "lifesteal") : undefined;
    if (!a || !t) return;
    const amt = Math.min(dealt * t.fraction, a.maxHp - a.hp);
    a.hp += amt;
    this.squads[a.squad].stats.healed += amt;
  }

  private onKill(killerId: number) {
    const k = this.byId.get(killerId);
    if (!k || !k.alive || !k.def.traits) return;
    for (const t of k.def.traits) {
      if (t.type !== "onKill") continue;
      if (t.recharge && !k.charged) k.charged = k.def.traits.some((c) => c.type === "charge");
      for (const e of t.effects) this.applyEffect(e, k.x, k.y, k.def.layer, k.side, k, this.attrFor(k.squad, "On kill"));
    }
  }

  // Remove a model; onDeath traits fire in processDeaths.
  private die(m: Model) {
    if (!m.alive) return;
    m.alive = false;
    m.hp = Math.min(m.hp, 0);
    if (!m.summoned) this.squads[m.squad].stats.lost++;
    this.deathQueue.push(m);
    this.emit({ kind: "death", x: m.x, y: m.y, color: m.def.look.color, size: m.def.size });
    if (m.def.structure) this.emit({ kind: "text", x: m.x, y: m.y - 1.2, text: `${m.def.name} falls!`, color: "#c77dff", big: true });
  }

  private processDeaths() {
    let guard = 0;
    while (this.deathQueue.length && guard++ < 1000) {
      const m = this.deathQueue.shift()!;
      for (const t of m.def.traits ?? []) {
        if (t.type !== "onDeath") continue;
        for (const e of t.effects) this.applyEffect(e, m.x, m.y, m.def.layer, m.side, null, this.attrFor(m.squad, "On death"));
      }
    }
  }

  // Simple circle separation using a spatial hash; ground and air don't collide.
  // Anchored units (towers) never get pushed. Enemies block each other fully; allies only nudge each other
  // (rules.allyPush), so units behind a front line can squeeze through to reach their targets.
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
      const reach = Math.ceil((m.def.size + 1.7 + (m.def.spacing ?? 0)) / cell);
      const am = m.def.speed <= 0;
      for (let oy = -reach; oy <= reach; oy++) {
        for (let ox = -reach; ox <= reach; ox++) {
          const b = grid.get(key(cx + ox, cy + oy, m.def.layer));
          if (!b) continue;
          for (const o of b) {
            if (o.id <= m.id) continue;
            const ao = o.def.speed <= 0;
            if (am && ao) continue;
            const dx = o.x - m.x;
            const dy = o.y - m.y;
            // spread out while advancing; close ranks once fighting
            const spacing = m.side === o.side && !m.engaged && !o.engaged ? Math.max(m.def.spacing ?? 0, o.def.spacing ?? 0) : 0;
            const min = m.def.size + o.def.size + spacing;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min) continue;
            const d = Math.sqrt(d2) || 0.001;
            const overlap = (min - d) * 0.5 * (m.side === o.side && !am && !ao ? this.rules.allyPush : 1);
            const wm = m.def.size * m.def.size;
            const wo = o.def.size * o.def.size;
            // heavier models get pushed less
            const fm = am ? 0 : ao ? 1 : wo / (wm + wo);
            const fo = 1 - fm;
            const nx = d2 === 0 ? 1 : dx / d;
            const ny = d2 === 0 ? 0 : dy / d;
            m.x -= nx * overlap * fm;
            m.y -= ny * overlap * fm;
            o.x += nx * overlap * fo;
            o.y += ny * overlap * fo;
          }
        }
      }
      if (!am) {
        m.x = clamp(m.x, m.def.size, this.rules.fieldW - m.def.size);
        m.y = clamp(m.y, m.def.size, this.rules.fieldH - m.def.size);
      }
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

// Visual thickness of a beam, by damage per hit.
function beamWidth(damage: number): number {
  return Math.min(6, 1.5 + Math.sqrt(damage) / 4);
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
