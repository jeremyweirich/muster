// Simulator benchmark: a fixed set of battles, timed, with a fingerprint of every outcome.
// Usage: npm run bench [-- --reps N]
// Run it before and after touching src/sim: the time should drop and the fingerprint must not change (a different
// fingerprint means the change altered battle results, which replays, the AI and the tests depend on).
import { DEFAULT_UNITS } from "../src/data/units";
import { autoPlace, defMap } from "../src/game/army";
import { equalCostCounts } from "../src/game/lab";
import { Battle } from "../src/sim/battle";
import { Rng } from "../src/sim/rng";
import type { PlacedSquad } from "../src/sim/types";

const defs = defMap(DEFAULT_UNITS);
const D = (id: string) => defs.get(id)!;
const at = process.argv.indexOf("--reps");
const reps = at >= 0 ? Number(process.argv[at + 1]) : 1;

// Every unit against every other at about 1000 supply, plus a few big mixed armies (late-game sizes).
const fights: [PlacedSquad[], PlacedSquad[]][] = [];
const ids = DEFAULT_UNITS.map((u) => u.id);
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++) {
    const [nA, nB] = equalCostCounts(D(ids[i]).cost, D(ids[j]).cost, 1000);
    const rng = new Rng(i * 97 + j);
    fights.push([autoPlace(Array(nA).fill(D(ids[i])), [], 0, defs, 1, rng), autoPlace(Array(nB).fill(D(ids[j])), [], 1, defs, 1, rng)]);
  }
const big = (spec: string) => spec.split(",").flatMap((p) => { const [id, n] = p.split("*"); return Array(Number(n ?? 1)).fill(D(id)); });
const armies = [
  "knights*3,crossbowmen*4,pikemen*2,ballista*2,cleric,griffon_riders*2",
  "grunts*6,skirmishers*3,wolf_riders*2,troll*2,ogre_brute,giant_bats*2",
  "stone_golem*2,fire_elemental*2,air_elemental*2,frost_elemental*2,cloudlings*3,water_elemental",
];
for (let i = 0; i < armies.length; i++)
  for (let j = 0; j < armies.length; j++) {
    const rng = new Rng(500 + i * 7 + j);
    fights.push([autoPlace(big(armies[i]), [], 0, defs, 1, rng, "spread"), autoPlace(big(armies[j]), [], 1, defs, 1, rng, "spread")]);
  }

let hash = 0;
const mix = (x: number) => { hash = (Math.imul(hash ^ x, 0x01000193) + 0x9e3779b9) >>> 0; };
let ticks = 0;
const t0 = performance.now();
for (let r = 0; r < reps; r++)
  fights.forEach(([a, b], k) => {
    const battle = new Battle(defs, [a, b], { seed: 1 + k, towers: true });
    while (!battle.over) { battle.step(); ticks++; }
    const res = battle.result();
    if (r === 0) {
      mix(res.winner ?? 2);
      mix(Math.round(res.time * 20));
      for (const side of res.survivors) for (const s of side) mix(s.alive * 131 + s.total);
      for (const s of Object.values(res.stats)) mix(Math.round(s.dealt));
    }
  });
const ms = performance.now() - t0;
const n = fights.length * reps;
console.log(`${n} battles in ${(ms / 1000).toFixed(1)}s: ${(ms / n).toFixed(1)} ms per battle, ${Math.round(ticks / (ms / 1000))} ticks/s`);
console.log(`fingerprint ${hash.toString(16).padStart(8, "0")}`);
