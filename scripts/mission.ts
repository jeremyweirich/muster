// Story missions from the command line: play plans against a mission's script, round by round, to design and tune
// it (docs/CAMPAIGN.md §6, "Making a mission"). The match is the game's own: newMissionMatch, missionPlan, the real
// battle seed and map, and the same rules as tests/campaign.test.tsx.
// Usage:
//   npm run mission                         list the missions
//   npm run mission -- <id>                 play the mission's reference plans (wins, loses, commended)
//   npm run mission -- <id> '<plan json>'   play one plan: a JSON array with one entry per round, each a list of
//                                           squads [unitId, x, y, rot?] or {"squads": [...], "keeps": [0, 1]}
// Each line: WON/LOST, ★ if the commendation was earned, then every round: W/L/T, battle length, damage taken by
// me/the enemy, Keeps of mine that fell, and both sides' HP after it. OVERSPEND means a plan bought more than a
// player could afford that round (the test rejects it). Your side deploys in rows 20–26, the enemy in rows 0–6.
import { MISSIONS, planKeeps, planSquads, type MissionDef, type Plan, type SquadSpec } from "../src/data/campaign";
import { DEFAULT_UNITS } from "../src/data/units";
import { canPlace, defMap, towerUpgradePrice } from "../src/game/army";
import { applyRound, applyTurn, nextRound } from "../src/game/match";
import { missionOutcome, missionPlan, missionSquads, newMissionMatch } from "../src/game/mission";
import { prepareBattle } from "../src/game/pvp";
import { Battle, type BattleResult } from "../src/sim/battle";
import type { PlacedSquad, Side } from "../src/sim/types";

const defs = defMap(DEFAULT_UNITS);
const cost = (s: SquadSpec[]) => s.reduce((n, [id]) => n + (defs.get(id)?.cost ?? 0), 0);

function misplaced(squads: PlacedSquad[], side: Side, existing: PlacedSquad[], towers: boolean): string[] {
  const out: string[] = [];
  const placed = [...existing];
  for (const sq of squads) {
    const d = defs.get(sq.defId);
    if (!d || !canPlace(d, sq.x, sq.y, side, placed, defs, undefined, sq.rot, towers)) out.push(`${sq.defId}@${sq.x},${sq.y}`);
    placed.push(sq);
  }
  return out;
}

function play(m: MissionDef, plan: Plan, label: string) {
  let st = newMissionMatch(m);
  const results: BattleResult[] = [];
  const log: string[] = [];
  for (let guard = 0; guard < 15; guard++) {
    const enemy = missionPlan(m, st);
    const round = plan[st.round - 1];
    const mine = missionSquads(planSquads(round), st.round, "p");
    const levels = [...st.towerLevels[0]];
    let spent = cost(planSquads(round));
    for (const k of planKeeps(round)) {
      spent += towerUpgradePrice(levels[k]) ?? Infinity;
      levels[k]++;
    }
    if (spent > st.supply[0]) log.push(`OVERSPEND ${spent}>${st.supply[0]}`);
    const bad = [...misplaced(mine, 0, st.armies[0], m.towers), ...misplaced(enemy.squads, 1, st.armies[1], m.towers).map((s) => `enemy ${s}`)];
    if (bad.length) log.push(`MISPLACED ${bad.join(" ")}`);
    st = { ...st, armies: [[...st.armies[0], ...mine], st.armies[1]], supply: [st.supply[0] - spent, st.supply[1]], towerLevels: [levels, st.towerLevels[1]] };
    st = applyTurn(st, 1, { army: [...st.armies[1], ...enemy.squads], unlocks: [], upgrades: [], towerUpgrades: [] }, defs, 0);
    const f = prepareBattle(st, defs, 0);
    const r = new Battle(f.canon.defs, f.canon.armies, { seed: f.canon.seed, towerLevels: f.canon.towerLevels, towers: f.canon.towers, terrain: f.canon.terrain }).run();
    results.push(r);
    st = applyRound(st, r, defs);
    const h = st.history[st.history.length - 1];
    const keeps = Object.values(r.stats).filter((s) => s.structure && s.side === 0 && s.alive === 0).length;
    log.push(`r${h.round} ${h.winner === 0 ? "W" : h.winner === 1 ? "L" : "T"} ${r.time.toFixed(0)}s dmg ${h.damage[0]}/${h.damage[1]}${keeps ? ` keeps-lost ${keeps}` : ""} hp ${st.hp[0]}/${st.hp[1]}`);
    if (st.phase === "over") break;
    st = nextRound(st);
  }
  const o = missionOutcome(m, st, results);
  console.log(`${label.padEnd(12)} ${o.won ? "WON " : "LOST"}${o.commended ? "★" : " "} | ${log.join(" | ")}`);
  if (!o.won && o.hint) console.log(`${"".padEnd(12)} hint: ${o.hint.text}`);
}

const [id, planJson] = process.argv.slice(2);
if (!id) {
  for (const e of MISSIONS) console.log(`${e.def.id.padEnd(12)} ${e.campaign.title} ${e.number}: ${e.title}`);
} else {
  const entry = MISSIONS.find((e) => e.def.id === id);
  if (!entry) throw new Error(`no mission ${id}; run without arguments for the list`);
  const m = entry.def;
  if (planJson) play(m, JSON.parse(planJson) as Plan, "plan");
  else {
    m.reference.wins.forEach((p, i) => play(m, p, `wins[${i}]`));
    m.reference.loses.forEach((p, i) => play(m, p, `loses[${i}]`));
    if (m.reference.commended) play(m, m.reference.commended, "commended");
  }
}
