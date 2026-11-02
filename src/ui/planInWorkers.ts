import { planAiRound, type AiPlan } from "../game/ai";
import type { AiRequest, AiResponse } from "../game/ai.worker";
import { defMap } from "../game/army";

// Plans an AI round in workers, so the page stays responsive. Hard searches on several cores at once: each worker uses
// its own search seed against the same armies, and the best plan wins. Easier settings use one. Without workers (old
// browsers, tests) it plans on the page instead. Returns a cancel.
export function planInWorkers(request: AiRequest, onPlan: (plan: AiPlan) => void, maxSearches = 4): () => void {
  const onMainThread = () => planAiRound(request.units, defMap(request.units), request.me, request.player, request.round, request.difficulty, request.seed, request.opts);
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  const searches = request.difficulty === "hard" ? Math.max(1, Math.min(maxSearches, cores - 1)) : 1;
  const workers: Worker[] = [];
  const plans: AiPlan[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    plans.sort((a, b) => (b.bestScore ?? -Infinity) - (a.bestScore ?? -Infinity));
    onPlan({ ...plans[0], candidatesTried: plans.reduce((t, p) => t + p.candidatesTried, 0) });
  };
  try {
    for (let i = 0; i < searches; i++) {
      const worker = new Worker(new URL("../game/ai.worker.ts", import.meta.url), { type: "module" });
      workers.push(worker);
      worker.onmessage = (e: MessageEvent<AiResponse>) => {
        worker.terminate();
        plans.push(e.data.plan);
        if (plans.length === searches) finish();
      };
      worker.onerror = () => {
        worker.terminate();
        plans.push(onMainThread());
        if (plans.length === searches) finish();
      };
      worker.postMessage({ ...request, opts: { ...request.opts, searchSeed: i } } satisfies AiRequest);
    }
  } catch {
    for (const w of workers) w.terminate();
    timer = setTimeout(() => onPlan(onMainThread()), 30);
  }
  return () => {
    for (const w of workers) w.terminate();
    clearTimeout(timer);
  };
}
