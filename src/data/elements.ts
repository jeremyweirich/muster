import type {
  Element,
  StatusDef,
  StatusId,
  SurfaceDef,
  SurfaceId,
  SurfaceReaction,
  UnitReaction,
} from "../sim/types";

export const ELEMENT_COLORS: Record<Element, string> = {
  physical: "#c9c3b5",
  fire: "#ff6b2b",
  water: "#3d8bff",
  frost: "#9be7ff",
  lightning: "#ffe14a",
};

export const STATUSES: Record<StatusId, StatusDef> = {
  wet: { id: "wet", name: "Wet", element: "water", duration: 5, color: "#3d8bff" },
  burning: {
    id: "burning",
    name: "Burning",
    element: "fire",
    duration: 3,
    color: "#ff6b2b",
    dps: { amount: 14, element: "fire" },
  },
  chilled: {
    id: "chilled",
    name: "Chilled",
    element: "frost",
    duration: 3,
    color: "#9be7ff",
    moveMult: 0.6,
    attackMult: 0.7,
  },
  frozen: { id: "frozen", name: "Frozen", element: "frost", duration: 2, color: "#dff7ff", stun: true },
  shocked: { id: "shocked", name: "Shocked", element: "lightning", duration: 0.4, color: "#ffe14a", stun: true },
  oiled: { id: "oiled", name: "Oiled", element: null, duration: 5, color: "#8a6d3b", moveMult: 0.8 },
  dazed: {
    id: "dazed",
    name: "Dazed",
    element: null,
    duration: 4,
    color: "#c77dff",
    damageDealtMult: 0.1,
    damageTakenMult: 2,
  },
};

export const SURFACES: Record<SurfaceId, SurfaceDef> = {
  puddle: {
    id: "puddle",
    name: "Puddle",
    element: "water",
    duration: 12,
    color: "#2f6fd6",
    alpha: 0.4,
    onTick: [{ type: "status", status: "wet" }],
  },
  shockwater: {
    id: "shockwater",
    name: "Electrified Water",
    element: "lightning",
    duration: 2.5,
    revertTo: "puddle",
    color: "#ffe14a",
    alpha: 0.55,
    onTick: [
      { type: "damage", amount: 18, element: "lightning" },
      { type: "status", status: "shocked" },
    ],
  },
  ice: {
    id: "ice",
    name: "Ice",
    element: "frost",
    duration: 6,
    revertTo: "puddle",
    color: "#c8f1ff",
    alpha: 0.55,
    onTick: [{ type: "status", status: "chilled" }],
  },
  fire: {
    id: "fire",
    name: "Fire",
    element: "fire",
    duration: 4,
    color: "#ff5a1f",
    alpha: 0.5,
    onTick: [
      { type: "damage", amount: 10, element: "fire" },
      { type: "status", status: "burning" },
    ],
  },
  steam: {
    id: "steam",
    name: "Steam",
    element: null,
    duration: 4,
    color: "#e6e6e6",
    alpha: 0.45,
    blocksRanged: true,
  },
  oil: {
    id: "oil",
    name: "Oil",
    element: null,
    duration: 15,
    color: "#3b2f1a",
    alpha: 0.6,
    moveMult: 0.75,
    onTick: [{ type: "status", status: "oiled" }],
  },
};

export const SURFACE_REACTIONS: SurfaceReaction[] = [
  { surface: "puddle", element: "lightning", becomes: "shockwater", spread: true, name: "Electrify" },
  { surface: "puddle", element: "frost", becomes: "ice", name: "Freeze" },
  { surface: "puddle", element: "fire", becomes: "steam", name: "Boil" },
  { surface: "shockwater", element: "frost", becomes: "ice", name: "Freeze" },
  { surface: "shockwater", element: "fire", becomes: "steam", name: "Boil" },
  { surface: "ice", element: "fire", becomes: "puddle", name: "Melt" },
  { surface: "fire", element: "water", becomes: "steam", name: "Douse" },
  { surface: "fire", element: "frost", becomes: null, name: "Snuff" },
  { surface: "oil", element: "fire", becomes: "fire", spread: true, name: "Ignite" },
];

export const UNIT_REACTIONS: UnitReaction[] = [
  { status: "wet", element: "lightning", name: "Conduct", damageMult: 2 },
  { status: "wet", element: "frost", name: "Freeze", removeStatus: true, consumeIncoming: true, addStatus: { status: "frozen" } },
  { status: "wet", element: "fire", name: "Evaporate", removeStatus: true, consumeIncoming: true },
  { status: "chilled", element: "frost", name: "Freeze", removeStatus: true, consumeIncoming: true, addStatus: { status: "frozen" } },
  { status: "chilled", element: "fire", name: "Thaw", removeStatus: true, consumeIncoming: true },
  { status: "frozen", element: "physical", name: "Shatter", removeStatus: true, damageMult: 2 },
  { status: "frozen", element: "fire", name: "Thaw", removeStatus: true, consumeIncoming: true, addStatus: { status: "wet" } },
  { status: "frozen", element: "frost", name: "", consumeIncoming: true },
  { status: "burning", element: "water", name: "Douse", removeStatus: true },
  { status: "burning", element: "frost", name: "Snuff", removeStatus: true, consumeIncoming: true },
  { status: "oiled", element: "fire", name: "Ignite", removeStatus: true, bonusDamage: { amount: 60, element: "fire" } },
];
