import type { Rules } from "../sim/types";

export const RULES: Rules = {
  fieldW: 48,
  fieldH: 27,
  deployDepth: 7,
  surfaceRes: 2,
  tick: 0.05,
  battleTimeLimit: 120,
  startHp: 400,
  income: (round) => (round === 1 ? 0 : 200 + 100 * round), // round 1's income is the opening offer
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
  // Opening offer (src/data/openings.ts): three packs, or flat supply. A pack's two unlocks are worth 2 × 100, so
  // flat 700 ends up 100 behind a pack once you unlock two units yourself: a mild price for choosing freely.
  openingChoices: 3,
  openingPackValue: 400, // supply's worth of squads in every pack (unlocks not counted)
  openingPackSupply: 200, // plus this to spend
  openingFlat: 700,
  towerUpgradeCosts: [100, 200, 400, 800],
  towerHpPerLevel: 3000, // about a Giant's worth: the first level turns a one-hit Keep into one a raid has to work at
  towerDazeBase: 4,
  towerDazePerLevel: 0.5,
  towerDazeMin: 2,
  // Veterancy: total XP (damage dealt + healing) that unlocks level 2, 3, 4, 5. See veterancyXp below.
  levelXp: veterancyXp(2500, 1.75),
};

// The veterancy XP table from two knobs. `base` is the XP for level 2: a typical battle's MVP deals about 2000, so
// it usually takes two good fights. `growth` is how many more fights each later level takes than the one before.
// A level-N squad deals N× damage, so it also earns N× XP; step k is scaled by k to cancel that, or the levels
// would all take about the same number of fights. With 2500 / 1.75: 2500 / 11,250 / 34,200 / 87,800 total XP, and
// the last level takes about 5× the fights of the first.
export function veterancyXp(base: number, growth: number, levels = 4): number[] {
  const out: number[] = [];
  let total = 0;
  for (let k = 1; k <= levels; k++) {
    total += base * k * growth ** (k - 1);
    out.push(Math.round(total / 100) * 100);
  }
  return out;
}

// Deployment zone rows (inclusive start, exclusive end) for each side.
export function deployZone(side: 0 | 1, rules: Rules = RULES): { y0: number; y1: number } {
  return side === 0
    ? { y0: rules.fieldH - rules.deployDepth, y1: rules.fieldH }
    : { y0: 0, y1: rules.deployDepth };
}
