import type { UnitDef } from "../sim/types";
import { planAiRound, type AiPlan, type AiSide, type Difficulty, type PlanOptions, type PlayerView } from "./ai";
import { defMap } from "./army";

// The AI plans in a worker so the page stays responsive while the player deploys.

export interface AiRequest {
  id: number;
  units: UnitDef[];
  me: AiSide;
  player: PlayerView;
  round: number;
  difficulty: Difficulty;
  seed: number;
  opts: PlanOptions;
}

export interface AiResponse {
  id: number;
  plan: AiPlan;
}

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, units, me, player, round, difficulty, seed, opts } = e.data;
  const plan = planAiRound(units, defMap(units), me, player, round, difficulty, seed, opts);
  (self as unknown as Worker).postMessage({ id, plan } satisfies AiResponse);
};
