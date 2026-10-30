import { useRef } from "react";
import { drawBattle, FxLayer } from "../render/draw";
import type { Battle, BattleResult } from "../sim/battle";

// Plays a Battle in real time at a chosen speed. The sim always advances in
// fixed ticks, so playback speed never changes the outcome.
export function useBattlePlayer() {
  const fx = useRef(new FxLayer());
  const acc = useRef(0);
  const ended = useRef<Battle | null>(null);

  return {
    reset() {
      fx.current.clear();
      acc.current = 0;
      ended.current = null;
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
      if (speed > 0 && !battle.over) {
        acc.current += dt * speed;
        let steps = 0;
        while (acc.current >= battle.rules.tick && steps < 400 && !battle.over) {
          battle.step();
          acc.current -= battle.rules.tick;
          steps++;
        }
        fx.current.take(battle);
      }
      fx.current.update(dt * Math.max(1, Math.min(speed, 2)));
      drawBattle(ctx, battle, tile, fx.current, time);
      if (battle.over && ended.current !== battle) {
        ended.current = battle;
        onEnd?.(battle.result());
      }
    },
    skip(battle: Battle) {
      battle.run();
      fx.current.clear();
      battle.fx.length = 0;
    },
  };
}
