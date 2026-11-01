// AI vs AI: full matches between the current planner (src/game/ai.ts) and a saved baseline, in parallel.
// Usage:
//   npm run ai-duel -- snapshot                          save the current planner as the baseline (gitignored)
//   npm run ai-duel -- run [matches] [budgetMs] [threads] [difficulty]   defaults: 40 4000 20 hard
// Workflow: snapshot, change the AI, run. Judge with 40+ matches: 8-20 can't tell a 70% planner from a 50% one.
// Matches are paired: each game is played twice with the sides swapped (so use an even count). Both planners in a
// match share one thread, so CPU contention hits both equally.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Worker } from "node:worker_threads";

const BASELINE = new URL("./.ai-baseline.ts", import.meta.url);
const [cmd = "run", ...rest] = process.argv.slice(2);

if (cmd === "snapshot") {
  const src = readFileSync(new URL("../src/game/ai.ts", import.meta.url), "utf8")
    .replace(/from "\.\.\/(sim|data)\//g, 'from "../src/$1/')
    .replace(/from "\.\/(match|army)"/g, 'from "../src/game/$1"');
  writeFileSync(BASELINE, src);
  console.log("saved the current planner as scripts/.ai-baseline.ts");
} else if (cmd === "run") {
  if (!existsSync(BASELINE)) throw new Error("no baseline: run `npm run ai-duel -- snapshot` before changing the AI");
  const matches = Number(rest[0] ?? 40);
  const budget = Number(rest[1] ?? 4000);
  const threads = Number(rest[2] ?? 20);
  const difficulty = rest[3] ?? "hard";
  type Res = { m: number; newSide: number; rounds: number; hpNew: number; hpOld: number };
  const results: Res[] = [];
  let next = 0;
  await new Promise<void>((done) => {
    const launch = () => {
      if (next >= matches) {
        if (results.length === matches) done();
        return;
      }
      const m = next++;
      const w = new Worker(new URL("./ai-duel-thread.ts", import.meta.url), { workerData: { m, budget, difficulty }, execArgv: ["--import", "tsx"] });
      w.on("message", (r: Res) => {
        results.push(r);
        const verdict = r.hpNew > r.hpOld ? "current" : r.hpNew < r.hpOld ? "baseline" : "draw";
        console.log(`match ${r.m + 1}: current on side ${r.newSide}, ${r.rounds} rounds, HP current ${r.hpNew} / baseline ${r.hpOld} -> ${verdict}`);
        void w.terminate();
        launch();
      });
      w.on("error", (e: Error) => {
        console.error(e);
        process.exit(1);
      });
    };
    for (let i = 0; i < Math.min(threads, matches); i++) launch();
  });
  const wins = results.reduce((t, r) => t + (r.hpNew > r.hpOld ? 1 : r.hpNew === r.hpOld ? 0.5 : 0), 0);
  const margin = results.reduce((t, r) => t + r.hpNew - r.hpOld, 0) / results.length;
  console.log(`current wins ${wins} of ${results.length}; mean HP margin ${Math.round(margin)}`);
} else console.log("usage: npm run ai-duel -- snapshot | run [matches] [budgetMs] [threads] [difficulty]");
