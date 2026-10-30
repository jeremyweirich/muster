import { useEffect, useRef } from "react";
import { RULES } from "../data/rules";

export interface FieldPointer {
  type: "move" | "down" | "leave";
  x: number; // tile coords (fractional)
  y: number;
  button: number;
}

interface Props {
  tile?: number;
  draw: (ctx: CanvasRenderingContext2D, dt: number, time: number) => void;
  onPointer?: (p: FieldPointer) => void;
  className?: string;
}

// A canvas sized to the battlefield that redraws every animation frame.
export function FieldCanvas({ tile = 20, draw, onPointer, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = RULES.fieldW * tile * dpr;
    canvas.height = RULES.fieldH * tile * dpr;
    let raf = 0;
    let last = performance.now();
    const start = last;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(ctx, dt, (now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tile]);

  const toTile = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * RULES.fieldW,
      y: ((e.clientY - rect.top) / rect.height) * RULES.fieldH,
    };
  };

  return (
    <canvas
      ref={ref}
      className={className ?? "field"}
      style={{ aspectRatio: `${RULES.fieldW} / ${RULES.fieldH}` }}
      onPointerMove={(e) => onPointer?.({ type: "move", ...toTile(e), button: e.button })}
      onPointerDown={(e) => onPointer?.({ type: "down", ...toTile(e), button: e.button })}
      onPointerLeave={(e) => onPointer?.({ type: "leave", ...toTile(e), button: e.button })}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
