import { useEffect, useRef } from "react";
import { RULES } from "../data/rules";
import { repaintBackground } from "../render/draw";

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

// Widest pixel buffer the field gets, however big the screen.
const MAX_PIXELS_W = 4096;

// A canvas sized to the battlefield that redraws every animation frame. Drawing is in field pixels (`tile` per tile);
// the pixel buffer matches the canvas's size on screen, so a phone doesn't paint pixels it can't show.
export function FieldCanvas({ tile = 20, draw, onPointer, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const fieldW = RULES.fieldW * tile;
    let scale = 0;
    const resize = () => {
      const shown = canvas.getBoundingClientRect().width || fieldW;
      const next = Math.min(MAX_PIXELS_W, Math.round(shown * (window.devicePixelRatio || 1))) / fieldW;
      if (next === scale) return;
      scale = next;
      canvas.width = Math.round(fieldW * scale);
      canvas.height = Math.round(RULES.fieldH * tile * scale);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    repaintBackground();
    const onVisible = () => document.visibilityState === "visible" && repaintBackground();
    document.addEventListener("visibilitychange", onVisible);
    let raf = 0;
    let last = performance.now();
    const start = last;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawRef.current(ctx, dt, (now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
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
