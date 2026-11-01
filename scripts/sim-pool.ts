// A pool of simulation threads, one per spare core, for scripts that run many independent matchups.
// Usage: const pool = new SimPool(); const r = await pool.matchup(...); ... pool.close();
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import type { MatchupOptions, MatchupResult } from "../src/game/lab";
import type { UnitDef } from "../src/sim/types";
import type { SimJob } from "./sim-thread";

export class SimPool {
  private idle: Worker[] = [];
  private all: Worker[] = [];
  private queue: SimJob[] = [];
  private waiting = new Map<number, (r: MatchupResult) => void>();
  private nextId = 0;

  constructor(size = Math.max(1, cpus().length - 2)) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL("./sim-thread.ts", import.meta.url), { execArgv: ["--import", "tsx"] });
      w.on("message", (msg: { id: number; result: MatchupResult }) => {
        this.waiting.get(msg.id)?.(msg.result);
        this.waiting.delete(msg.id);
        this.idle.push(w);
        this.pump();
      });
      w.on("error", (e: Error) => {
        throw e;
      });
      this.all.push(w);
      this.idle.push(w);
    }
  }

  get size() {
    return this.all.length;
  }

  matchup(units: UnitDef[], a: string, b: string, budget: number, seeds: number, opts: MatchupOptions = {}): Promise<MatchupResult> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.queue.push({ id, units, a, b, budget, seeds, opts });
      this.pump();
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) this.idle.pop()!.postMessage(this.queue.shift()!);
  }

  close() {
    for (const w of this.all) void w.terminate();
  }
}
