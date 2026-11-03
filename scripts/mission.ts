// Story missions from the command line: play plans against a mission's script, round by round, to design and tune
// it (docs/CAMPAIGN.md §6, "Making a mission"). The match is the game's own (src/game/missionRun.ts, which the tests
// use too): newMissionMatch, missionPlan, the real battle seed and map.
// Usage:
//   npm run mission                         list the missions
//   npm run mission -- <id>                 play the mission's reference plans (wins, loses, commended)
//   npm run mission -- <id> '<plan json>'   play one plan: a JSON array with one entry per round, each a list of
//                                           squads [unitId, x, y, rot?] or an object
//                                           {"squads": [...], "keeps": [0, 1], "upgrades": [["knights", "veterans"]],
//                                            "promote": true, "opening": 0}
// Each line: WON/LOST, ★ if the commendation was earned, then every round: W/L/T, battle length, damage taken by
// me/the enemy, Keeps of mine that fell, and both sides' HP after it. PROBLEMS lists what a real player couldn't do
// (overspending, misplacing; the test rejects them). Your side deploys in rows 20–26, the enemy in rows 0–6.
import { MISSIONS, type MissionDef, type Plan } from "../src/data/campaign";
import { runMission } from "../src/game/missionRun";

function play(m: MissionDef, plan: Plan, label: string) {
  const run = runMission(m, plan);
  const log = run.rounds.map(
    (r) => `r${r.round} ${r.winner === 0 ? "W" : r.winner === 1 ? "L" : "T"} ${r.time.toFixed(0)}s dmg ${r.damage[0]}/${r.damage[1]}${r.keepsLost ? ` keeps-lost ${r.keepsLost}` : ""} hp ${r.hp[0]}/${r.hp[1]}`,
  );
  console.log(`${label.padEnd(12)} ${run.won ? "WON " : "LOST"}${run.commended ? "★" : " "} | ${log.join(" | ")}`);
  if (run.problems.length) console.log(`${"".padEnd(12)} PROBLEMS: ${run.problems.join("; ")}`);
  if (!run.won && run.hint) console.log(`${"".padEnd(12)} hint: ${run.hint.text}`);
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
