// Story missions from the command line: play plans against a mission's script, round by round, to design and tune
// it (docs/CAMPAIGN.md §6, "Making a mission"). The match is the game's own (src/game/missionRun.ts, which the tests
// use too): newMissionMatch, missionPlan, the real battle seed and map.
// Usage:
//   npm run mission                         list the missions
//   npm run mission -- all                  every mission's reference plans, one line each: the campaign as a balance
//                                           dashboard (run it before and after changing units; see docs/BALANCE-PLAN.md)
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

// One line per reference plan: the result it's meant to have, the result it got, and by how much (the player's HP
// left on a win, the enemy's on a loss). A plan that no longer does what it's meant to is flagged.
function dashboard() {
  let broken = 0;
  for (const e of MISSIONS) {
    const m = e.def;
    const plans: [string, Plan, boolean][] = [
      ...m.reference.wins.map((p, i): [string, Plan, boolean] => [`wins[${i}]`, p, true]),
      ...m.reference.loses.map((p, i): [string, Plan, boolean] => [`loses[${i}]`, p, false]),
      ...(m.reference.commended ? [["commended", m.reference.commended, true] as [string, Plan, boolean]] : []),
    ];
    for (const [label, plan, shouldWin] of plans) {
      const run = runMission(m, plan);
      const ok = run.won === shouldWin && (label !== "commended" || run.commended) && !run.problems.length;
      if (!ok) broken++;
      const margin = run.won ? `${run.state.hp[0]} HP left` : `enemy on ${run.state.hp[1]}`;
      console.log(`${ok ? "  " : "!!"} ${m.id.padEnd(10)} ${label.padEnd(10)} ${run.won ? "WON " : "LOST"}${run.commended ? "★" : " "} ${margin.padEnd(15)} ${run.rounds.length} rounds`);
    }
  }
  console.log(broken ? `${broken} reference plan(s) no longer do what they're meant to` : "every reference plan does what it's meant to");
}

const [id, planJson] = process.argv.slice(2);
if (id === "all") dashboard();
else if (!id) {
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
