import type { Rules } from "../sim/types";

export const RULES: Rules = {
  fieldW: 48,
  fieldH: 27,
  deployDepth: 9,
  surfaceRes: 2,
  tick: 0.05,
  battleTimeLimit: 90,
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
  speedScale: 0.2,
  allyPush: 0.15, // allies squeeze past each other, so melee units can reach the fight
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
