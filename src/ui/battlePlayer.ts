import { useRef } from "react";
import { drawBattle, FxLayer, type Interp } from "../render/draw";
import type { Battle, BattleResult } from "../sim/battle";

// Plays a Battle at a chosen speed. The sim always advances in fixed ticks, so playback speed never changes the outcome.
// "1×" runs the sim at half real time, which reads better; the speed buttons are relative to that.
// Models are drawn interpolated between the last two ticks, so motion stays smooth even when a tick spans several frames.
export const PLAYBACK_SCALE = 0.5;
export function useBattlePlayer() {
  const fx = useRef(new FxLayer());
  const acc = useRef(0);
  const ended = useRef<Battle | null>(null);
  const interp = useRef<Interp>({ alpha: 0, prev: new Map() });

  return {
    reset() {
      fx.current.clear();
      acc.current = 0;
      ended.current = null;
      interp.current = { alpha: 0, prev: new Map() };
    },
    frame(
      ctx: CanvasRenderingContext2D,
      battle: Battle,
      tile: number,
      dt: number,
      time: number,
      speed: number,
      onEnd?: (r: BattleResult) => void,
    ) {
      const tick = battle.rules.tick;
      if (speed > 0 && !battle.over) {
        acc.current += dt * speed * PLAYBACK_SCALE;
        const steps = Math.min(400, Math.floor(acc.current / tick));
        for (let s = 0; s < steps && !battle.over; s++) {
          // only the state just before the last step matters for interpolation
          if (s === steps - 1) {
            const prev = interp.current.prev;
            prev.clear();
            for (const m of battle.models) if (m.alive) prev.set(m, { x: m.x, y: m.y, facing: m.facing });
          }
          battle.step();
        }
        acc.current = steps === 400 ? 0 : acc.current - steps * tick;
        fx.current.take(battle);
      }
      interp.current.alpha = battle.over ? 1 : Math.min(1, acc.current / tick);
      fx.current.update(dt * Math.max(1, Math.min(speed, 2)));
      drawBattle(ctx, battle, tile, fx.current, time, interp.current);
      if (battle.over && ended.current !== battle) {
        ended.current = battle;
        onEnd?.(battle.result());
      }
    },
    skip(battle: Battle) {
      battle.run();
      fx.current.clear();
      battle.fx.length = 0;
      interp.current = { alpha: 1, prev: new Map() };
    },
  };
}
