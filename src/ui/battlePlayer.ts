import { useRef } from "react";
import { drawBattle, FxLayer, type Interp } from "../render/draw";
import type { Battle, BattleResult } from "../sim/battle";
import type { Side } from "../sim/types";

// Plays a Battle at a chosen speed. The sim always advances in fixed ticks, so playback speed never changes the outcome.
// "1×" runs the sim in real time (it used to be half speed, back when fights were faster); the speed buttons are relative to that.
// Models are drawn interpolated between the last two ticks, so motion stays smooth even when a tick spans several frames.
export const PLAYBACK_SCALE = 1;

// Once one side can't hurt anything the other has left (a golem under bats), the rest is a wait for the last kill or
// the timer. It still has to be simulated, because the survivors decide the round damage, so playback runs it this
// many times faster instead.
export const DECIDED_SPEEDUP = 10;
const QUIET = 3; // seconds the enemy army must go unhurt before a side counts as harmless

// Damage taken so far by each side's army (Keeps excluded).
export function armyTaken(battle: Battle): [number, number] {
  const out: [number, number] = [0, 0];
  for (const sq of battle.squads) if (!sq.def.structure) out[sq.side] += sq.stats.taken;
  return out;
}

// True when `side` can't hurt the enemy army: none of its attacks can target a layer the enemy army still has, and
// nothing has hurt that army for QUIET seconds (so pike walls, burning ground and other indirect damage still count).
export function harmless(battle: Battle, side: Side, enemyHurtAt: number): boolean {
  if (battle.time - enemyHurtAt < QUIET) return false;
  const layers = new Set<string>();
  for (const m of battle.models) if (m.alive && m.side !== side && !m.def.structure) layers.add(m.def.layer);
  if (!layers.size) return false;
  for (const m of battle.models) {
    if (m.alive && m.side === side && m.def.attack?.targets.some((l) => layers.has(l))) return false;
  }
  return true;
}

export function useBattlePlayer() {
  const fx = useRef(new FxLayer());
  const acc = useRef(0);
  const ended = useRef<Battle | null>(null);
  const interp = useRef<Interp>({ alpha: 0, prev: new Map() });
  const taken = useRef<[number, number]>([0, 0]);
  const hurtAt = useRef<[number, number]>([0, 0]);

  return {
    reset() {
      fx.current.clear();
      acc.current = 0;
      ended.current = null;
      interp.current = { alpha: 0, prev: new Map() };
      taken.current = [0, 0];
      hurtAt.current = [0, 0];
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
      const now = armyTaken(battle);
      for (const s of [0, 1] as Side[]) {
        if (now[s] !== taken.current[s]) hurtAt.current[s] = battle.time;
      }
      taken.current = now;
      const decided = !battle.over && (harmless(battle, 0, hurtAt.current[1]) || harmless(battle, 1, hurtAt.current[0]));
      if (speed > 0 && !battle.over) {
        acc.current += dt * speed * PLAYBACK_SCALE * (decided ? DECIDED_SPEEDUP : 1);
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
      if (decided && speed > 0) drawBanner(ctx, (battle.rules.fieldW * tile) / 2, "One side can't fight back · fast-forwarding");
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

function drawBanner(ctx: CanvasRenderingContext2D, cx: number, text: string) {
  ctx.save();
  ctx.font = "bold 12px system-ui, sans-serif";
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = "rgba(10,14,18,0.85)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, 8, w, 20, 5);
  ctx.fill();
  ctx.fillStyle = "#e8d48a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, 18.5);
  ctx.restore();
}
