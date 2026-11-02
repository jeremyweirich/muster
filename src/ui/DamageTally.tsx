import { useEffect, useLayoutEffect, useRef } from "react";
import { RULES } from "../data/rules";
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
