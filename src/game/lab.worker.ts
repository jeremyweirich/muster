import type { UnitDef } from "../sim/types";
import { runMatchup, type MatchupResult } from "./lab";

export interface LabRequest {
  units: UnitDef[];
  ids: string[];
  budget: number;
  seeds: number;
}

export type LabMessage =
  | { type: "result"; result: MatchupResult; done: number; total: number }
  | { type: "done" };

self.onmessage = (e: MessageEvent<LabRequest>) => {
  const { units, ids, budget, seeds } = e.data;
  const total = (ids.length * (ids.length - 1)) / 2;
  let done = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const result = runMatchup(units, ids[i], ids[j], budget, seeds);
      done++;
      (self as unknown as Worker).postMessage({ type: "result", result, done, total } satisfies LabMessage);
    }
  }
  (self as unknown as Worker).postMessage({ type: "done" } satisfies LabMessage);
};
