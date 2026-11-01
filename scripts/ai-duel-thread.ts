// One full AI-vs-AI match for scripts/ai-duel.ts: the current planner against the saved baseline.
// Planners always plan as side 1, so side 0's view is mirrored top to bottom and back.
import { parentPort, workerData } from "node:worker_threads";
import { OPENING_PACKS } from "../src/data/openings";
import { RULES } from "../src/data/rules";
import { DEFAULT_UNITS } from "../src/data/units";
import { planAiRound, promoted, type AiPlan, type Difficulty } from "../src/game/ai";
import { defMap } from "../src/game/army";
import { applyRound, chooseOpening, newMatch, nextRound, type MatchState } from "../src/game/match";
import { Battle, footprintOf } from "../src/sim/battle";
import type { PlacedSquad } from "../src/sim/types";
import { upgradedDefs } from "../src/sim/upgrades";

const { m, budget, difficulty } = workerData as { m: number; budget: number; difficulty: Difficulty };
const { planAiRound: planBaseline } = (await import(new URL("./.ai-baseline.ts", import.meta.url).href)) as { planAiRound: typeof planAiRound };
const units = DEFAULT_UNITS;
const defs = defMap(units);
const mirror = (sqs: PlacedSquad[]) => sqs.map((q) => ({ ...q, y: RULES.fieldH - q.y - footprintOf(defs.get(q.defId)!, q.rot).h }));
type Who = "current" | "baseline";

function plan(who: Who, st: MatchState, side: 0 | 1, seed: number): AiPlan {
  const other = side === 0 ? 1 : 0;
  const flip = side === 0 ? mirror : (x: PlacedSquad[]) => x;
  const me = { army: flip(st.armies[side]), unlocked: st.unlocked[side], upgrades: st.upgrades[side], towerLevels: st.towerLevels[side], supply: st.supply[side] };
  const player = { army: flip(st.armies[other]), upgrades: st.upgrades[other], towerLevels: st.towerLevels[other], unlocked: st.round > 1 ? st.unlocked[other] : [] };
  const opts = { openingPacks: st.openings[side].packs.map((i) => OPENING_PACKS[i]), budgetMs: budget };
  const p = (who === "current" ? planAiRound : planBaseline)(units, defs, me, player, st.round, difficulty, seed, opts);
  return side === 0 ? { ...p, squads: mirror(p.squads) } : p;
}

// Matches come in pairs: the same game (seed, offer, openings) with the planners' sides swapped, so luck and any
// side advantage cancel within each pair.
const g = Math.floor(m / 2);
const sides: [Who, Who] = m % 2 === 0 ? ["current", "baseline"] : ["baseline", "current"];
let st = newMatch(units, 100 + g);
st = chooseOpening(st, 0, st.openings[0].packs[g % 3], units, 100 + g);
while (st.phase !== "over" && st.round <= 20) {
  const plans = [plan(sides[0], st, 0, st.round * 31 + g), plan(sides[1], st, 1, st.round * 37 + g)];
  const ups = [0, 1].map((s) => {
    const u = { ...st.upgrades[s] };
    for (const x of plans[s].upgrades) u[x.unitId] = [...(u[x.unitId] ?? []), x.upgradeId];
    return u;
  });
  const levels = [0, 1].map((s) => {
    const l = [...st.towerLevels[s]];
    for (const i of plans[s].towerUpgrades) l[i]++;
    return l;
  });
  const armies: [PlacedSquad[], PlacedSquad[]] = [
    [...promoted(st.armies[0], plans[0].promotions), ...plans[0].squads],
    [...promoted(st.armies[1], plans[1].promotions), ...plans[1].squads],
  ];
  st = {
    ...st,
    armies,
    supply: [st.supply[0] - plans[0].spent, st.supply[1] - plans[1].spent],
    unlocked: [[...new Set([...st.unlocked[0], ...plans[0].unlocks])], [...new Set([...st.unlocked[1], ...plans[1].unlocks])]],
    upgrades: [ups[0], ups[1]],
    towerLevels: [levels[0], levels[1]],
  };
  const r = new Battle([upgradedDefs(defs, ups[0]), upgradedDefs(defs, ups[1])], armies, { seed: st.round * 104729 + g, towerLevels: [levels[0], levels[1]] }).run();
  st = applyRound(st, r, defs);
  if (st.phase !== "over") st = nextRound(st);
}
const newSide = sides[0] === "current" ? 0 : 1;
parentPort!.postMessage({ m, newSide, rounds: st.round, hpNew: st.hp[newSide], hpOld: st.hp[1 - newSide] });
