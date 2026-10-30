import { RULES } from "./rules";
import type { PlacedSquad, Rules, Side, UnitDef } from "../sim/types";

// Each side gets one of each tower, placed at the back of its zone (see RULES.towers).
// When a tower falls, its owner's whole army is Dazed: 10% damage dealt, double
// damage taken, for 5 seconds. A strong central army has to protect its flanks.
const collapse = {
  type: "onDeath" as const,
  effects: [{ type: "status" as const, status: "dazed" as const, duration: 5, global: true, affects: "allies" as const }],
};

export const TOWER_DEFS: UnitDef[] = [
  {
    id: "tower_keep",
    name: "Keep",
    description: "Ground tower with a light crossbow. If it falls, your whole army is Dazed for 5s.",
    cost: 0,
    squadSize: 1,
    footprint: { w: 2, h: 2 },
    layer: "ground",
    hp: 1200,
    speed: 0,
    size: 0.9,
    structure: true,
    attack: {
      damage: 25, element: "physical", cooldown: 1, range: 6,
      targets: ["ground", "air"], targeting: "nearest", delivery: "projectile", projectileSpeed: 14,
    },
    traits: [collapse],
    tags: ["class:tower"],
    look: { shape: "hex", color: "#9aa4b1", glyph: "♜" },
  },
  {
    id: "tower_spire",
    name: "Sky Spire",
    description: "Floating tower with no weapons. Only anti-air can reach it. If it falls, your whole army is Dazed for 5s.",
    cost: 0,
    squadSize: 1,
    footprint: { w: 2, h: 2 },
    layer: "air",
    hp: 800,
    speed: 0,
    size: 0.8,
    structure: true,
    traits: [collapse],
    tags: ["class:tower"],
    look: { shape: "diamond", color: "#b9c6ff", glyph: "✧" },
  },
];

export const TOWER_MAP = new Map(TOWER_DEFS.map((d) => [d.id, d]));

// Where each side's towers stand: the back row, mirrored through the center for the top side.
export function towerPlacements(side: Side, rules: Rules = RULES): PlacedSquad[] {
  return rules.towers.flatMap((t, i) => {
    const def = TOWER_MAP.get(t.defId);
    if (!def) return [];
    const { w, h } = def.footprint;
    return [
      {
        uid: `tower-${side}-${i}`,
        defId: def.id,
        x: side === 0 ? t.x : rules.fieldW - t.x - w,
        y: side === 0 ? rules.fieldH - h : 0,
        round: 0,
      },
    ];
  });
}
