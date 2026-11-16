import { RULES } from "../data/rules";
import { squadRect } from "../game/army";
import type { BattleResult, SquadStats } from "../sim/battle";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { drawBackground, drawSquad, type BackgroundOpts } from "./draw";

export const MEDAL_COLORS = ["#f5c542", "#c9d1d9", "#cd7f32"] as const;

// The top squads on one side by damage dealt (towers excluded), best first.
export function topSquads(result: BattleResult, side: Side, n = 3): SquadStats[] {
  return Object.values(result.stats)
    .filter((s) => s.side === side && !s.structure && s.dealt >= 1)
    .sort((a, b) => b.dealt - a.dealt)
    .slice(0, n);
}

// The battle report board: every squad where it was deployed, the fallen crossed out, MVP medals with what they
// dealt, and, with a squad focused (hovered or pinned), the damage it exchanged with each other squad.
export interface ReportDrawOpts {
  terrain: BackgroundOpts["terrain"];
  result: BattleResult;
  squads: PlacedSquad[]; // both armies, towers included
  defOf: (sq: PlacedSquad, side: Side) => UnitDef | undefined;
  focus: string | null; // a squad uid
}

export function drawReport(ctx: CanvasRenderingContext2D, tile: number, { terrain, result, squads, defOf, focus }: ReportDrawOpts) {
  const stats = result.stats;
  drawBackground(ctx, tile, { zones: true, terrain });
  const focusStats = focus ? stats[focus] : undefined;
  const medals = new Map<string, number>();
  for (const side of [0, 1] as Side[]) topSquads(result, side).forEach((s, i) => medals.set(s.uid, i));
  for (const sq of squads) {
    const st = stats[sq.uid];
    const def = st && defOf(sq, st.side);
    if (!def || !st) continue;
    const isFocus = sq.uid === focus;
    const involved = focusStats && (focusStats.dealtTo[sq.uid] || focusStats.takenFrom[sq.uid]);
    const medal = medals.get(sq.uid);
    drawSquad(ctx, sq, def, st.side, tile, {
      alive: st.alive,
      alpha: focusStats && !isFocus && !involved ? 0.45 : undefined,
      outline: isFocus
        ? "#ffffff"
        : medal !== undefined && !focusStats
          ? MEDAL_COLORS[medal]
          : st.alive === 0
            ? "rgba(255,255,255,0.08)"
            : undefined,
      fill: isFocus ? "rgba(255,255,255,0.08)" : medal !== undefined && !focusStats ? "rgba(245,197,66,0.06)" : undefined,
    });
    if (st.alive === 0) {
      const r = squadRect(sq, def);
      ctx.strokeStyle = "rgba(255,84,104,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.x * tile + 4, r.y * tile + 4);
      ctx.lineTo((r.x + r.w) * tile - 4, (r.y + r.h) * tile - 4);
      ctx.stroke();
    }
  }
  // damage exchanged with the focused squad, labelled above each other squad
  if (focusStats) {
    for (const sq of squads) {
      if (sq.uid === focus) continue;
      const st = stats[sq.uid];
      const def = st && defOf(sq, st.side);
      if (!def) continue;
      const dealt = focusStats.dealtTo[sq.uid] ?? 0;
      const taken = focusStats.takenFrom[sq.uid] ?? 0;
      if (dealt < 1 && taken < 1) continue;
      const r = squadRect(sq, def);
      const ally = st.side === focusStats.side;
      const labels: [string, string][] = [];
      if (dealt >= 1) labels.push([`${ally ? "hit ally" : "dealt"} ${Math.round(dealt)}`, ally ? "#ff9f43" : "#e2b45a"]);
      if (taken >= 1) labels.push([`took ${Math.round(taken)}`, "#ff5468"]);
      // stack above the squad, or below it when there's no room at the top edge
      const above = r.y * tile - 4 - (labels.length - 1) * 15;
      let ly = above >= 14 ? above : (r.y + r.h) * tile + 16;
      for (const [text, color] of labels) {
        pill(ctx, text, (r.x + r.w / 2) * tile, ly, color);
        ly += 15;
      }
    }
  }
  // MVP medals: the top three damage dealers on each side, with what they dealt
  const tags: { x0: number; x1: number; y: number }[] = []; // damage tags drawn so far, so neighbours don't overlap
  for (const sq of squads) {
    const medal = medals.get(sq.uid);
    const st = stats[sq.uid];
    const def = st && defOf(sq, st.side);
    if (medal === undefined || !def) continue;
    const r = squadRect(sq, def);
    // kept inside the field, so a squad on the back row or the edge still shows its whole medal
    const mx = Math.min((r.x + r.w) * tile - 2, RULES.fieldW * tile - 11);
    const my = Math.max(r.y * tile + 2, 11);
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.fillStyle = MEDAL_COLORS[medal];
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(10,14,18,0.9)";
    ctx.stroke();
    ctx.fillStyle = "#14110a";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(medal + 1), mx, my + 0.5);
    if (!focusStats) {
      const text = `${Math.round(st.dealt).toLocaleString()} dmg`;
      const cx = (r.x + r.w / 2) * tile;
      const below = (r.y + r.h) * tile + 16;
      const up = below > RULES.fieldH * tile - 2;
      let y = up ? r.y * tile - 4 : below;
      ctx.font = "bold 11px system-ui, sans-serif";
      const half = ctx.measureText(text).width / 2 + 5;
      // step away from the squad until clear of the tags already drawn
      while (tags.some((t) => Math.abs(t.y - y) < 16 && t.x0 < cx + half && cx - half < t.x1)) y += up ? -16 : 16;
      tags.push({ x0: cx - half, x1: cx + half, y });
      pill(ctx, text, cx, y, MEDAL_COLORS[medal]);
    }
  }
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string) {
  ctx.font = "bold 11px system-ui, sans-serif";
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = "rgba(10,14,18,0.85)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y - 12, w, 15, 4);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y - 4.5);
}
