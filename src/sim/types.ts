// Core data definitions. Units, statuses, surfaces and reactions are all plain
// data so they can be edited in the UI, saved as JSON and reasoned about
// generically by the AI.

export type Element = "physical" | "fire" | "water" | "frost" | "lightning";
export const ELEMENTS: Element[] = ["physical", "fire", "water", "frost", "lightning"];

export type Layer = "ground" | "air";
export type Side = 0 | 1; // 0 = player (bottom), 1 = enemy (top)

export type StatusId = "wet" | "burning" | "chilled" | "frozen" | "shocked" | "oiled" | "dazed";
export type SurfaceId = "puddle" | "fire" | "ice" | "shockwater" | "steam" | "oil";

// ---------------------------------------------------------------------------
// Selectors: one shared way of saying "which units does this apply to?".
// Used by auras and bonus damage now; faction bonuses and upgrades later.

export interface Selector {
  side?: "ally" | "enemy" | "any";
  hasTag?: string; // exact tag, e.g. "race:goblin"
  hasAnyTag?: string[];
  lacksTag?: string;
  layer?: Layer;
}

// ---------------------------------------------------------------------------
// Effects: the shared building blocks for attacks, traits, reactions and
// (later) spells.

export type Effect =
  | { type: "damage"; amount: number; element: Element; radius?: number }
  | {
      type: "status";
      status: StatusId;
      duration?: number;
      radius?: number;
      global?: boolean; // every unit on the field (filtered by affects), ignoring radius
      affects?: "all" | "enemies" | "allies"; // relative to the source; default follows the friendly-fire rule
    }
  | { type: "surface"; surface: SurfaceId; radius: number; duration?: number }
  | { type: "heal"; amount: number; radius: number };

export type Targeting = "nearest" | "highestHp" | "lowestHp" | "towers"; // towers: hunt towers first
export type Delivery = "instant" | "projectile" | "beam";

export interface AttackDef {
  damage: number;
  element: Element;
  cooldown: number; // seconds between attacks
  range: number; // tiles
  targets: Layer[];
  targeting: Targeting;
  delivery: Delivery;
  projectileSpeed?: number;
  splash?: number; // radius of the main damage, hits enemies only
  chain?: { count: number; range: number; falloff: number };
  bonusVs?: { selector: Selector; mult: number }[];
  onHit?: Effect[]; // extra effects at the impact point
}

export type TraitDef =
  | { type: "onDeath"; effects: Effect[] }
  | { type: "regen"; perSecond: number; suppressedBy?: StatusId } // no regen while that status is on the unit
  | {
      type: "aura";
      radius: number;
      selector: Selector;
      attackSpeed?: number; // multiplier, 1.25 = 25% faster
      moveSpeed?: number;
      damage?: number;
    }
  | { type: "periodic"; interval: number; effects: Effect[] }
  // effects applied to an enemy that hits this unit with an attack
  | { type: "retaliate"; effects: Effect[]; maxRange?: number }
  // the first attack of the battle deals extra damage
  | { type: "charge"; mult: number };

// Upgrades: one-time purchases per match that change every squad of a unit.
export type ModStat =
  | "hp"
  | "speed"
  | "size"
  | "spacing"
  | "squadSize"
  | "damage"
  | "cooldown"
  | "range"
  | "splash"
  | "chainCount";

export interface StatMod {
  stat: ModStat;
  mult?: number;
  add?: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  description?: string;
  mods?: StatMod[];
  element?: Element; // replaces the attack's element
  targets?: Layer[]; // replaces what the attack can hit
  targeting?: Targeting; // replaces the attack's targeting
  onHit?: Effect[]; // appended to the attack's on-hit effects
  traits?: TraitDef[]; // appended (or replace existing ones with replaceTraits)
  replaceTraits?: boolean;
  resist?: Partial<Record<Element, number>>; // added to existing resistances
  tags?: string[]; // added
}

export type Shape = "circle" | "square" | "triangle" | "diamond" | "hex";

export interface UnitDef {
  id: string;
  name: string;
  description?: string;
  cost: number;
  unlockCost?: number; // one-time cost per match before the first purchase; 0 = available from the start
  squadSize: number;
  footprint: { w: number; h: number }; // in deployment tiles
  layer: Layer;
  hp: number;
  speed: number; // speed points; tiles per second = speed × RULES.speedScale
  spacing?: number; // extra distance kept from allies (tiles); spreads squads out
  size: number; // model radius in tiles
  resist?: Partial<Record<Element, number>>; // 0.3 = takes 30% less, -0.5 = takes 50% more
  immuneStatuses?: StatusId[];
  attack?: AttackDef;
  traits?: TraitDef[];
  tags: string[];
  look: { shape: Shape; color: string; glyph?: string };
  structure?: boolean; // towers: never move, don't count toward winning the battle
  upgrades?: UpgradeDef[];
  upgradeCost?: number; // price of the first upgrade bought (default: unit cost); the second costs double
}

// ---------------------------------------------------------------------------
// Elemental system data.

export interface StatusDef {
  id: StatusId;
  name: string;
  element: Element | null; // the element this status carries when applied (drives reactions)
  duration: number;
  color: string;
  moveMult?: number;
  attackMult?: number; // multiplier on attack rate
  stun?: boolean;
  dps?: { amount: number; element: Element };
  damageDealtMult?: number; // multiplies the unit's outgoing attack damage
  damageTakenMult?: number;
}

export interface SurfaceDef {
  id: SurfaceId;
  name: string;
  element: Element | null; // element this surface "is", for surface-on-surface reactions
  duration: number;
  revertTo?: SurfaceId; // what it becomes when it expires (ice melts to puddle)
  color: string;
  alpha: number;
  onTick?: Effect[]; // applied to ground units standing in it, every surface tick, both sides
  moveMult?: number;
  blocksRanged?: boolean; // units inside can't be targeted from range
}

// An element hitting a cell of an existing surface.
export interface SurfaceReaction {
  surface: SurfaceId;
  element: Element;
  becomes: SurfaceId | null;
  spread?: boolean; // flood through connected cells of the same surface
  name: string;
}

// An element hitting a unit that already has a status.
export interface UnitReaction {
  status: StatusId;
  element: Element;
  name: string;
  removeStatus?: boolean;
  consumeIncoming?: boolean; // the incoming status (if any) is not applied
  addStatus?: { status: StatusId; duration?: number };
  damageMult?: number; // multiplies the incoming hit's damage
  bonusDamage?: { amount: number; element: Element };
}

// ---------------------------------------------------------------------------
// Armies and battles.

export interface PlacedSquad {
  uid: string;
  defId: string;
  x: number; // tile coords of footprint top-left, in absolute field coords
  y: number;
  rot?: boolean; // rotated 90°: footprint w and h swap
  round: number; // round it was placed in
}

export interface Rules {
  fieldW: number;
  fieldH: number;
  deployDepth: number; // rows each side may deploy into
  surfaceRes: number; // surface cells per tile
  tick: number;
  battleTimeLimit: number;
  startHp: number;
  income: (round: number) => number;
  damagePerSupply: number;
  damagePerSquad: number;
  elementalFriendlyFire: boolean;
  lockPlacedSquads: boolean;
  unlocks: boolean;
  towers: { defId: string; x: number }[]; // per side, x for the bottom side (mirrored for the top)
  towerInset: number; // rows between a tower and its side's back edge
  speedScale: number; // tiles per second per speed point
  upgradeCostMult: number[]; // price multiplier for the 1st, 2nd... upgrade bought for a unit
  towerUpgradeCosts: number[]; // price of each tower level
  towerHpPerLevel: number;
  towerDazeBase: number; // seconds of Daze when a level-0 tower falls
  towerDazeMin: number;
}
