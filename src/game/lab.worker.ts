import type { UnitDef } from "../sim/types";
import { runMatchup, type MatchupResult } from "./lab";

export interface LabRequest {
  units: UnitDef[];
  pairs: [string, string][];
  budget: number;
  seeds: number;
}

export type LabMessage =
  | { type: "result"; result: MatchupResult; done: number; total: number }
  | { type: "done" };

self.onmessage = (e: MessageEvent<LabRequest>) => {
  const { units, pairs, budget, seeds } = e.data;
  pairs.forEach(([a, b], i) => {
    const result = runMatchup(units, a, b, budget, seeds);
    (self as unknown as Worker).postMessage({ type: "result", result, done: i + 1, total: pairs.length } satisfies LabMessage);
  });
  (self as unknown as Worker).postMessage({ type: "done" } satisfies LabMessage);
};
