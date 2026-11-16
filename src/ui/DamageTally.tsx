import { useEffect, useLayoutEffect, useRef } from "react";
import { RULES } from "../data/rules";
import type { DefMap } from "../game/army";
import { survivorDamage } from "../game/match";
import type { Battle, BattleResult } from "../sim/battle";
import type { Side } from "../sim/types";

// After a battle, each squad still standing flies its round damage to the other side's HP bar, smallest first, so the
// player sees where the HP went without being told. Keeps never fly: they don't count.

export interface Strike {
  x: number; // tiles, in the local view of the field
  y: number;
  from: Side; // the surviving squad's side; it hits the other side's HP
  amount: number;
  color: string;
}

const FLIGHT = 650; // ms from squad to bar
const HOLD = 500; // ms after the last lands, before the report

export function tallyTimes(n: number) {
  const gap = Math.max(90, Math.min(260, 2400 / Math.max(1, n)));
  return { gap, total: (n - 1) * gap + FLIGHT + HOLD };
}

export function DamageTally({
  strikes,
  field,
  onLand,
  onDone,
}: {
  strikes: Strike[];
  field: () => HTMLElement | null;
  onLand: (count: number) => void; // how many have landed so far
  onDone: () => void;
}) {
  const orbs = useRef<(HTMLDivElement | null)[]>([]);
  const done = useRef(onDone);
  done.current = onDone;
  const land = useRef(onLand);
  land.current = onLand;

  useLayoutEffect(() => {
    const canvas = field();
    if (!canvas) return done.current();
    const rect = canvas.getBoundingClientRect();
    const { gap, total } = tallyTimes(strikes.length);
    const anims: Animation[] = [];
    let landed = 0;
    strikes.forEach((s, i) => {
      const el = orbs.current[i];
      const bar = document.querySelector(`.hud .hp-${s.from === 0 ? 1 : 0} .hp-track`);
      if (!el || !bar) return;
      const b = bar.getBoundingClientRect();
      const sx = rect.left + (s.x / RULES.fieldW) * rect.width;
      const sy = rect.top + (s.y / RULES.fieldH) * rect.height;
      const dx = b.left + b.width / 2 - sx;
      const dy = b.top + b.height / 2 - sy;
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
      const a = el.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.4)", opacity: 0 },
          { transform: "translate(-50%, -50%) scale(1.15)", opacity: 1, offset: 0.18 },
          { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - 30}px)) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)`, opacity: 0.9 },
        ],
        { duration: FLIGHT, delay: i * gap, easing: "ease-in", fill: "backwards" },
      );
      a.onfinish = () => {
        el.style.visibility = "hidden";
        land.current(++landed);
      };
      anims.push(a);
    });
    const t = setTimeout(() => done.current(), total);
    return () => {
      clearTimeout(t);
      for (const a of anims) a.cancel();
    };
  }, [strikes]);

  // any key, click or tap skips it
  useEffect(() => {
    const onKey = () => done.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="tally" onPointerDown={() => done.current()}>
      {strikes.map((s, i) => (
        <div
          key={i}
          ref={(el) => {
            orbs.current[i] = el;
          }}
          className={`tally-orb tally-orb-${s.from}`}
          style={{ "--orb": s.color } as React.CSSProperties}
        >
          −{Math.round(s.amount)}
        </div>
      ))}
    </div>
  );
}

// Where each surviving squad stands when the battle ends and the damage it does to the other side, smallest first,
// in the local view (a PvP guest's battle runs in the host's view).
export function survivorStrikes(b: Battle, result: BattleResult, defs: DefMap, flip: boolean): Strike[] {
  const sums = new Map<number, { x: number; y: number; n: number }>();
  for (const m of b.models) {
    if (!m.alive || m.summoned) continue;
    const p = sums.get(m.squad) ?? { x: 0, y: 0, n: 0 };
    p.x += m.x;
    p.y += m.y;
    p.n++;
    sums.set(m.squad, p);
  }
  const index = new Map(b.squads.map((sq, i) => [sq.uid, i]));
  const strikes: Strike[] = [];
  for (const side of [0, 1] as Side[]) {
    for (const sv of result.survivors[side]) {
      const p = sums.get(index.get(sv.uid) ?? -1);
      if (!p) continue;
      const x = p.x / p.n;
      const y = p.y / p.n;
      strikes.push({
        x: flip ? RULES.fieldW - x : x,
        y: flip ? RULES.fieldH - y : y,
        from: flip ? (side === 0 ? 1 : 0) : side,
        amount: survivorDamage(sv, defs),
        color: defs.get(sv.defId)?.look.color ?? "#ffffff",
      });
    }
  }
  return strikes.sort((a, b) => a.amount - b.amount);
}
