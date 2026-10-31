import { RULES } from "./rules";
import type { PlacedSquad, Rules, Side, UnitDef } from "../sim/types";

// Each side gets two Keeps near the back of its zone (see RULES.towers). They have no weapons.
// Unupgraded towers die in a second or two. When a tower falls, its owner's whole
// army is Dazed (10% damage dealt, double damage taken). Levels bought between rounds
// add HP and shorten the Daze. A strong central army has to protect its flanks.
export const TOWER_DEFS: UnitDef[] = [
  {
    id: "tower_keep",
    name: "Keep",
    description: "A fortified keep with no weapons. If it falls, your whole army is Dazed.",
    cost: 0,
    squadSize: 1,
    footprint: { w: 2, h: 2 },
    layer: "ground",
    hp: 150,
    speed: 0,
    size: 0.9,
    structure: true,
    tags: ["class:tower"],
    look: { shape: "hex", color: "#9aa4b1", icon: "keep" },
  },
];

export const TOWER_MAP = new Map(TOWER_DEFS.map((d) => [d.id, d]));

export function towerDaze(level: number, rules: Rules = RULES): number {
  return Math.max(rules.towerDazeMin, rules.towerDazeBase - level * rules.towerDazePerLevel);
}

export function towerMaxLevel(rules: Rules = RULES): number {
  return rules.towerUpgradeCosts.length;
}

// A tower at a given upgrade level: more HP and a shorter Daze on collapse. `name` labels it (e.g. "West Keep").
export function towerDef(id: string, level: number, rules: Rules = RULES, name?: string): UnitDef {
  const base = TOWER_MAP.get(id)!;
  return {
    ...base,
    name: name ?? base.name,
    hp: base.hp + level * rules.towerHpPerLevel,
    traits: [
      {
        type: "onDeath",
        effects: [{ type: "status", status: "dazed", duration: towerDaze(level, rules), global: true, affects: "allies" }],
      },
    ],
  };
}

// Where each side's towers stand: towerInset rows in from the back edge, mirrored through the center for the top side.
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
        y: side === 0 ? rules.fieldH - h - rules.towerInset : rules.towerInset,
        round: 0,
      },
    ];
  });
}
