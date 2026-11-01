import type { Rules } from "../sim/types";

export const RULES: Rules = {
  fieldW: 48,
  fieldH: 27,
  deployDepth: 7,
  surfaceRes: 2,
  tick: 0.05,
  battleTimeLimit: 120,
  startHp: 400,
  income: (round) => (round === 1 ? 400 : 200 + 100 * round), // round 1 starts a little richer
  damagePerSupply: 0.08,
  damagePerSquad: 4,
  elementalFriendlyFire: true,
  lockPlacedSquads: true,
  unlocks: true,
  towers: [
    { defId: "tower_keep", x: 11, name: "West Keep" },
    { defId: "tower_keep", x: 35, name: "East Keep" },
  ],
  towerInset: 2,
  speedScale: 0.1,
  allyPush: 0.15, // allies squeeze past each other, so melee units can reach the fight
  preferReach: 4, // preferred targets win only among enemies this close (beyond attack range); farther, nearest wins
  upgradeCosts: [200, 400, 600, 800], // flat, whatever the unit: each specialist step costs more
  openingDiscount: 100,
  openingBonus: 50,
  openingMinUnlock: 100,
  towerUpgradeCosts: [100, 200, 400, 800],
  towerHpPerLevel: 300,
  towerDazeBase: 4,
  towerDazePerLevel: 0.5,
  towerDazeMin: 2,
  // Veterancy: total XP (damage dealt + healing) that unlocks level 2, 3, 4, 5. A typical battle's MVP deals
  // about 2000, the runner-up about 1200 and third about 800, so one good fight usually earns the MVP a level.
  levelXp: [1200, 4000, 9000, 16000],
};

// Deployment zone rows (inclusive start, exclusive end) for each side.
export function deployZone(side: 0 | 1, rules: Rules = RULES): { y0: number; y1: number } {
  return side === 0
    ? { y0: rules.fieldH - rules.deployDepth, y1: rules.fieldH }
    : { y0: 0, y1: rules.deployDepth };
}
