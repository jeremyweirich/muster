import type { Rules } from "../sim/types";

export const RULES: Rules = {
  fieldW: 32,
  fieldH: 32,
  deployDepth: 10,
  surfaceRes: 2,
  tick: 0.05,
  battleTimeLimit: 90,
  startHp: 400,
  income: (round) => 200 + 100 * round,
  damagePerSupply: 0.08,
  damagePerSquad: 4,
  elementalFriendlyFire: true,
  lockPlacedSquads: true,
  unlocks: true,
  towers: [
    { defId: "tower_keep", x: 7 },
    { defId: "tower_spire", x: 23 },
  ],
  speedScale: 0.15,
  upgradeCostMult: [1, 2],
  towerUpgradeCosts: [100, 200, 400, 800],
  towerHpPerLevel: 300,
  towerDazeBase: 8,
  towerDazeMin: 4,
};

// Deployment zone rows (inclusive start, exclusive end) for each side.
export function deployZone(side: 0 | 1, rules: Rules = RULES): { y0: number; y1: number } {
  return side === 0
    ? { y0: rules.fieldH - rules.deployDepth, y1: rules.fieldH }
    : { y0: 0, y1: rules.deployDepth };
}
