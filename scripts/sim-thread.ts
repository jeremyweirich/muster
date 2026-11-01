// One simulation thread for SimPool: runs matchups sent from the main thread. Deterministic, so the results are
// the same as running them one by one.
import { parentPort } from "node:worker_threads";
import { runMatchup, type MatchupOptions } from "../src/game/lab";
import type { UnitDef } from "../src/sim/types";

export interface SimJob {
  id: number;
  units: UnitDef[];
  a: string;
  b: string;
  budget: number;
  seeds: number;
  opts: MatchupOptions;
}

parentPort!.on("message", (job: SimJob) => {
  parentPort!.postMessage({ id: job.id, result: runMatchup(job.units, job.a, job.b, job.budget, job.seeds, job.opts) });
});
