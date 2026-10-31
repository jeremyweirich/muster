// Unit icons: simple silhouettes on a 24×24 grid, drawn dark on top of the unit's colored token.
// The same path data feeds canvas (Path2D) and the shop swatches (inline SVG), so they always match.
// `fill` paths use the even-odd rule, so an inner subpath cuts a hole. `stroke` paths are drawn with round caps.

export interface IconDef {
  fill?: string[];
  stroke?: { d: string; w: number }[];
}

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;

export const ICONS = {
  dagger: {
    fill: [
      "M12 1.5 L14.6 6 L14 15 L10 15 L9.4 6 Z",
      "M6.5 15 H17.5 V17.3 H6.5 Z",
      "M10.8 17.3 H13.2 V20.3 H10.8 Z",
      ellipse(12, 21.2, 1.9, 1.5),
    ],
  },
  paw: {
    fill: [
      "M12 12.5 C8.5 12.5 6 15.5 6 17.8 C6 19.8 7.8 20.6 9.4 20.1 C10.5 19.8 11.2 19.3 12 19.3 S13.5 19.8 14.6 20.1 C16.2 20.6 18 19.8 18 17.8 C18 15.5 15.5 12.5 12 12.5 Z",
      ellipse(5.3, 10.2, 1.9, 2.4),
      ellipse(9.2, 6, 2, 2.6),
      ellipse(14.8, 6, 2, 2.6),
      ellipse(18.7, 10.2, 1.9, 2.4),
    ],
  },
  flask: {
    fill: [
      "M9.3 2 H14.7 V4 H13.9 V8.3 L18.9 16.8 C20 18.7 18.7 21.5 16.4 21.5 H7.6 C5.3 21.5 4 18.7 5.1 16.8 L10.1 8.3 V4 H9.3 Z M8.2 15 L6.6 17.8 C6.2 18.6 6.8 19.6 7.7 19.6 H16.3 C17.2 19.6 17.8 18.6 17.4 17.8 L15.8 15 Z",
      ellipse(11, 17.3, 1, 1),
      ellipse(14, 16.6, 0.7, 0.7),
    ],
  },
  bomb: {
    fill: [ellipse(10.5, 14.5, 7, 7), "M13.6 6.6 L16.6 9.6 L14.7 11.5 L11.7 8.5 Z", "M19 1.2 L19.8 3.4 L22 4.2 L19.8 5 L19 7.2 L18.2 5 L16 4.2 L18.2 3.4 Z"],
    stroke: [{ d: "M15.6 7.6 Q16.3 5.6 17.6 5.1", w: 1.3 }],
  },
  bat: {
    fill: [
      "M12 7.5 L10.8 5.3 L10.4 7.8 C8.4 8.2 6.3 7.3 4.3 5.6 C3.2 7.8 2 9.4 0.8 10.2 C2.5 10.5 3.5 11.4 4 12.8 C5.2 12.1 6.6 12.3 7.4 13.2 C8.4 12.3 9.9 12.4 10.8 13.6 L12 16.2 L13.2 13.6 C14.1 12.4 15.6 12.3 16.6 13.2 C17.4 12.3 18.8 12.1 20 12.8 C20.5 11.4 21.5 10.5 23.2 10.2 C22 9.4 20.8 7.8 19.7 5.6 C17.7 7.3 15.6 8.2 13.6 7.8 L13.2 5.3 Z",
    ],
  },
  club: {
    fill: [
      "M3.2 21.8 L1.9 20.5 L10.6 11.2 C9.4 8.4 11 4.6 14.3 3 C17.6 1.4 21.4 2.8 22 5.6 C22.6 8.6 19.4 11.8 15.6 12.5 Z",
    ],
    stroke: [
      { d: "M14.6 2.4 L13.6 0.9", w: 1.4 },
      { d: "M19.5 2.6 L20.4 1", w: 1.4 },
      { d: "M22.4 8.3 L23.6 9", w: 1.4 },
    ],
  },
  shield: {
    fill: ["M12 1.5 L20.5 4.6 V11 C20.5 16.6 16.8 20.4 12 22.5 C7.2 20.4 3.5 16.6 3.5 11 V4.6 Z M10.9 6.5 V10.6 H7.3 V12.8 H10.9 V18.5 H13.1 V12.8 H16.7 V10.6 H13.1 V6.5 Z"],
  },
  bow: {
    fill: ["M22.6 12 L18.6 9.6 V14.4 Z", "M1.6 9.8 L3.2 12 L1.6 14.2 H3.9 L5.5 12 L3.9 9.8 Z"],
    stroke: [
      { d: "M7 2.5 C15.5 5.5 15.5 18.5 7 21.5", w: 2.4 },
      { d: "M7 2.5 V21.5", w: 0.9 },
      { d: "M3.5 12 H19.5", w: 1.5 },
    ],
  },
  crossbow: {
    fill: ["M12 1 L14.6 5.4 H9.4 Z"],
    stroke: [
      { d: "M12 5 V22", w: 2.4 },
      { d: "M2.5 10 Q12 3.5 21.5 10", w: 2.4 },
      { d: "M2.5 10 L12 13.5 L21.5 10", w: 0.9 },
    ],
  },
  wing: {
    fill: [
      "M2.5 20 C3.5 11.5 9 5 21 2.5 C20 5.7 18.4 7.8 16.2 9.2 C18.3 9.4 19.6 9.1 20.8 8.6 C19.5 11.6 17.2 13.3 14.1 13.9 C15.7 14.4 17 14.4 18.4 14.1 C16.1 17.6 11.9 19.6 6.6 19 Z",
    ],
  },
  cross: {
    fill: ["M9.8 2 H14.2 V8.2 H20.5 V12.6 H14.2 V22 H9.8 V12.6 H3.5 V8.2 H9.8 Z"],
  },
  flame: {
    fill: [
      "M12 1.5 C13.2 6 18.5 8.2 18.5 14.3 C18.5 18.4 15.6 22 12 22 C8.4 22 5.5 19.1 5.5 15.2 C5.5 12.1 7.2 10.4 8.4 9 C8.6 11 9.4 12.3 10.6 12.8 C9.9 8.6 10.9 4.9 12 1.5 Z M12 14 C12.9 16 14.8 16.8 14.8 18.6 C14.8 20 13.5 20.8 12 20.8 C10.5 20.8 9.2 19.9 9.2 18.4 C9.2 17 10.4 16.2 11 15.4 Z",
    ],
  },
  drop: {
    fill: [
      "M12 2 C12 2 4.8 10.4 4.8 15 C4.8 19.1 8 22 12 22 S19.2 19.1 19.2 15 C19.2 10.4 12 2 12 2 Z M8.6 14.6 C8.2 16.6 9 18.4 10.8 19.2 L10.2 20 C7.9 19.1 6.8 16.8 7.4 14.4 Z",
    ],
  },
  wind: {
    stroke: [
      { d: "M2.5 8 H14 C16.8 8 17.8 4.6 15.4 3.8", w: 2.2 },
      { d: "M2.5 12.5 H18.3 C21.4 12.5 22 16.6 18.9 17.2", w: 2.2 },
      { d: "M4.5 17 H10.5 C12.8 17 13.4 20.2 11.2 20.8", w: 2.2 },
    ],
  },
  sparkle: {
    fill: [
      "M12 1.5 C12.6 7.8 16.2 11.4 22.5 12 C16.2 12.6 12.6 16.2 12 22.5 C11.4 16.2 7.8 12.6 1.5 12 C7.8 11.4 11.4 7.8 12 1.5 Z",
    ],
  },
  claws: {
    stroke: [
      { d: "M5.5 3 Q8.8 12 4.8 21", w: 2.6 },
      { d: "M12 2 Q15.3 12 11.3 22", w: 2.6 },
      { d: "M18.5 3 Q21.8 12 17.8 21", w: 2.6 },
    ],
  },
  fangs: {
    fill: [
      "M3 5 H21 V8.6 C19.6 8.6 18.4 9 17.6 9.8 L15.8 18.5 L14 10.4 H10 L8.2 18.5 L6.4 9.8 C5.6 9 4.4 8.6 3 8.6 Z",
    ],
  },
  boulder: {
    fill: ["M4.5 9 L9 4 L15.8 3.5 L20.5 8.3 L21.5 14.6 L17.2 20.4 L8.8 21 L3 16.2 Z M10 8.5 L12.8 11.8 L11.2 15.8 L12.2 16.2 L14 11.7 L11.1 8 Z"],
  },
  keep: {
    fill: [
      "M4.5 2.5 H7.8 V4.8 H10.3 V2.5 H13.7 V4.8 H16.2 V2.5 H19.5 V8 L17.8 9.6 V19.8 H19.5 V21.8 H4.5 V19.8 H6.2 V9.6 L4.5 8 Z M10 19.8 V16 A2 2 0 0 1 14 16 V19.8 Z",
    ],
  },
  crystal: {
    fill: ["M12 1.5 L18.5 9 L12 22.5 L5.5 9 Z M12 4.6 L8.2 9 L12 18.2 Z"],
  },
  snowflake: {
    stroke: [
      { d: "M12 2 V22", w: 2 },
      { d: "M3.3 7 L20.7 17", w: 2 },
      { d: "M3.3 17 L20.7 7", w: 2 },
      { d: "M9.4 3.6 L12 6.2 L14.6 3.6", w: 1.5 },
      { d: "M9.4 20.4 L12 17.8 L14.6 20.4", w: 1.5 },
      { d: "M3.6 10.6 L7 9.4 L6.3 5.8", w: 1.5 },
      { d: "M20.4 13.4 L17 14.6 L17.7 18.2", w: 1.5 },
      { d: "M3.6 13.4 L7 14.6 L6.3 18.2", w: 1.5 },
      { d: "M20.4 10.6 L17 9.4 L17.7 5.8", w: 1.5 },
    ],
  },
  golem: {
    fill: [
      "M8 2.5 H16 V7.5 H20.5 L21.5 15 H18 V12 H17 V21.5 H13.2 V16.5 H10.8 V21.5 H7 V12 H6 V15 H2.5 L3.5 7.5 H8 Z M9.6 4.4 H11.2 V6 H9.6 Z M12.8 4.4 H14.4 V6 H12.8 Z",
    ],
  },
} satisfies Record<string, IconDef>;

export type IconId = keyof typeof ICONS;
export const ICON_IDS = Object.keys(ICONS) as IconId[];

const pathCache = new Map<string, { fill: Path2D[]; stroke: { p: Path2D; w: number }[] }>();
function paths(id: IconId) {
  let c = pathCache.get(id);
  if (!c) {
    const def: IconDef = ICONS[id];
    c = { fill: (def.fill ?? []).map((d) => new Path2D(d)), stroke: (def.stroke ?? []).map((s) => ({ p: new Path2D(s.d), w: s.w })) };
    pathCache.set(id, c);
  }
  return c;
}

// Draw an icon centered at (x, y), `size` pixels across.
export function drawIcon(ctx: CanvasRenderingContext2D, id: IconId, x: number, y: number, size: number, color: string) {
  const p = paths(id);
  const k = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const f of p.fill) ctx.fill(f, "evenodd");
  for (const s of p.stroke) {
    ctx.lineWidth = s.w;
    ctx.stroke(s.p);
  }
  ctx.restore();
}
