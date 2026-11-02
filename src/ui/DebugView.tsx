import { useRef, useState } from "react";
import { RULES } from "../data/rules";
import { DEFAULT_UNITS } from "../data/units";
import { autoPlace, defMap } from "../game/army";
import { drawBackground, drawSquad, drawTowers, spriteStats } from "../render/draw";
import { Battle } from "../sim/battle";
import { Rng } from "../sim/rng";
import type { PlacedSquad, UnitDef } from "../sim/types";
import { useBattlePlayer } from "./battlePlayer";
import { FieldCanvas } from "./FieldCanvas";

// A hidden panel for development, opened by clicking the version in the corner. Its tool is a performance test:
// it plays fixed armies on this device's field, the same way Play does, and reports the frame times as text to copy or
// share. That's how numbers get off a phone: the site itself never sends anything anywhere. It also links to the repo
// and its CHANGELOG.md (plain links: nothing is fetched). Spectate (SpectateView.tsx) watches the AI play itself.

const REPO = "https://github.com/jeremyweirich/muster";
const TILE = 24; // as in PlayView
const defs = defMap(DEFAULT_UNITS);

const WARDENS = "knights*3,crossbowmen*4,pikemen*2,ballista*2,cleric,griffon_riders*2";
const GOBLINS = "grunts*6,skirmishers*3,wolf_riders*2,troll*2,ogre_brute,giant_bats*2";
const ELEMENTALS = "stone_golem*2,fire_elemental*2,air_elemental*2,frost_elemental*2,cloudlings*3,water_elemental";
// twice the squads: a late-game army
const twice = (spec: string) =>
  spec
    .split(",")
    .map((p) => {
      const [id, n = "1"] = p.split("*");
      return `${id}*${Number(n) * 2}`;
    })
    .join(",");

interface Scenario {
  name: string;
  kind: "deploy" | "battle";
  a: string;
  b: string;
  secs: number; // how long to watch it
}

// The same armies as scripts/bench.ts, plus a late-game battle and the deploy screen (the slowest screen before the
// November 2026 rendering pass).
const SCENARIOS: Scenario[] = [
  { name: "deploy, late-game armies", kind: "deploy", a: twice(GOBLINS), b: twice(ELEMENTALS), secs: 5 },
  { name: "wardens v goblins", kind: "battle", a: WARDENS, b: GOBLINS, secs: 15 },
  { name: "elementals v wardens", kind: "battle", a: ELEMENTALS, b: WARDENS, secs: 15 },
  { name: "late: 2x goblins v 2x elementals", kind: "battle", a: twice(GOBLINS), b: twice(ELEMENTALS), secs: 20 },
];
const BATTLES = SCENARIOS.filter((s) => s.kind === "battle");
const SIM_TICKS = 600; // the first 30 s of each battle: the approach and the thick of it

// An army spec ("id*count,…") placed for each side. Ids no longer in the roster are skipped, so renames don't break it.
function place(s: Scenario): [PlacedSquad[], PlacedSquad[]] {
  const rng = new Rng(7);
  const list = (spec: string) =>
    spec.split(",").flatMap((p) => {
      const [id, n = "1"] = p.split("*");
      const d = defs.get(id);
      return d ? Array<UnitDef>(Number(n)).fill(d) : [];
    });
  return [autoPlace(list(s.a), [], 0, defs, 1, rng, "spread"), autoPlace(list(s.b), [], 1, defs, 1, rng, "spread")];
}

const newBattle = (s: Scenario) => new Battle(defs, place(s), { seed: 3, recordFx: true, towers: true });

const quantile = (values: number[], p: number) => {
  const s = [...values].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};
const ms = (x: number) => x.toFixed(1);

// The simulator alone: milliseconds per tick.
async function simLines(onProgress: (text: string) => void): Promise<string[]> {
  const lines: string[] = [];
  for (const s of BATTLES) {
    onProgress(`Simulator: ${s.name}`);
    await new Promise((r) => setTimeout(r, 30)); // let the progress paint
    const battle = newBattle(s);
    const models = battle.models.length;
    const times: number[] = [];
    while (!battle.over && times.length < SIM_TICKS) {
      const t0 = performance.now();
      battle.step();
      battle.fx.length = 0;
      times.push(performance.now() - t0);
      if (times.length % 100 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const mean = times.reduce((x, y) => x + y, 0) / times.length;
    lines.push(`  ${s.name.padEnd(34)} ${ms(mean)} / ${ms(quantile(times, 0.95))} / ${ms(Math.max(...times))}  (${models} models)`);
  }
  return lines;
}

interface Run {
  index: number;
  started: number;
  stamps: number[]; // when each frame began
  js: number[]; // its JavaScript time
  peak: number; // most models alive
  battle: Battle | null;
  squads: [PlacedSquad[], PlacedSquad[]];
  lines: string[];
}

export function DebugView() {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState("");
  const [copied, setCopied] = useState(false);
  const run = useRef<Run | null>(null);
  const sim = useRef<string[]>([]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const player = useBattlePlayer();

  const begin = (index: number, lines: string[]) => {
    const s = SCENARIOS[index];
    player.reset();
    run.current = { index, started: 0, stamps: [], js: [], peak: 0, battle: s.kind === "battle" ? newBattle(s) : null, squads: place(s), lines };
    setProgress(`Frames ${index + 1}/${SCENARIOS.length}: ${s.name}`);
  };

  const start = async () => {
    setStatus("running");
    setReport("");
    setCopied(false);
    sim.current = await simLines(setProgress);
    begin(0, []);
  };

  const finish = (r: Run) => {
    const s = SCENARIOS[r.index];
    const iv = r.stamps.slice(1).map((t, i) => t - r.stamps[i]);
    const secs = (r.stamps[r.stamps.length - 1] - r.stamps[0]) / 1000;
    const slow = iv.filter((x) => x > 25).length / Math.max(1, iv.length);
    const lines = [
      ...r.lines,
      `  ${s.name.padEnd(34)} ${secs.toFixed(1)} s  ${(iv.length / secs).toFixed(1)} fps  frame p50 ${ms(quantile(iv, 0.5))} p95 ${ms(quantile(iv, 0.95))} ms  slow ${(slow * 100).toFixed(1)}%  js p50 ${ms(quantile(r.js, 0.5))} p95 ${ms(quantile(r.js, 0.95))} ms${r.battle ? `  peak ${r.peak} models` : ""}`,
    ];
    if (r.index + 1 < SCENARIOS.length) return begin(r.index + 1, lines);
    run.current = null;
    // the field's size, before it unmounts
    const canvas = fieldRef.current?.querySelector("canvas");
    const box = canvas?.getBoundingClientRect();
    const device = [
      `Common Ground performance test, ${new Date().toLocaleString()}`,
      `version ${__APP_VERSION__}, built ${new Date(__BUILD_TIME__).toLocaleString()}`,
      `device ${navigator.userAgent}`,
      `screen ${screen.width}x${screen.height} @${+devicePixelRatio.toFixed(2)}x, window ${innerWidth}x${innerHeight}, ${navigator.hardwareConcurrency ?? "?"} cores`,
      `field ${box ? `${Math.round(box.width)}x${Math.round(box.height)} css` : "?"}, buffer ${canvas ? `${canvas.width}x${canvas.height}` : "?"}`,
    ];
    const atlas = spriteStats();
    lines.push(`  sprite atlas: ${atlas.sprites} sprites, ${Math.round(atlas.used * 100)}% used, ${atlas.fills} times full`);
    setReport(
      [
        ...device,
        "",
        `simulator, ms per tick (mean / p95 / max, first ${SIM_TICKS / 20} s):`,
        ...sim.current,
        "",
        "frames (slow = over 25 ms):",
        ...lines,
      ].join("\n"),
    );
    setStatus("done");
  };

  const draw = (ctx: CanvasRenderingContext2D, dt: number, time: number) => {
    const r = run.current;
    if (!r) return;
    const t0 = performance.now();
    if (!r.started) r.started = t0;
    const s = SCENARIOS[r.index];
    if (r.battle) {
      player.frame(ctx, r.battle, TILE, dt, time, 1);
      if (r.stamps.length % 10 === 0) r.peak = Math.max(r.peak, r.battle.models.reduce((n, m) => n + (m.alive ? 1 : 0), 0));
    } else {
      // as PlayView draws the deploy screen
      drawBackground(ctx, TILE, { zones: true, grid: [0] });
      drawTowers(ctx, TILE);
      for (const sq of r.squads[1]) drawSquad(ctx, sq, defs.get(sq.defId)!, 1, TILE, { alpha: 0.75, time });
      for (const sq of r.squads[0]) drawSquad(ctx, sq, defs.get(sq.defId)!, 0, TILE, { outline: "rgba(255,255,255,0.15)", time });
    }
    r.stamps.push(t0);
    r.js.push(performance.now() - t0);
    if (t0 - r.started > s.secs * 1000 || r.battle?.over) finish(r);
  };

  const copy = () => {
    navigator.clipboard?.writeText(report).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  const share = () => navigator.share?.({ title: "Common Ground performance test", text: report }).catch(() => {});

  return (
    <div className="play debug" style={{ "--field-ratio": RULES.fieldW / RULES.fieldH } as React.CSSProperties}>
      <main className="board">
        <div className="field-wrap" ref={fieldRef}>
          {status === "running" && (
            <div className="field-box">
              <FieldCanvas tile={TILE} draw={draw} />
            </div>
          )}
          {status === "done" && <pre className="debug-report">{report}</pre>}
        </div>
      </main>
      <aside className="panel side debug-side">
        <h3>Debug</h3>
        {status === "idle" && <p className="muted small">Tools for development. Back to the game with the tabs above.</p>}
        <button className="primary" disabled={status === "running"} onClick={start}>
          Performance test
        </button>
        <button disabled={status === "running"} onClick={() => (location.hash = "debug/spectate")}>
          Spectate: AI vs AI
        </button>
        {status === "running" && (
          <p className="small">
            {progress}
            <br />
            <span className="muted">About a minute. Keep this screen open.</span>
          </p>
        )}
        {status === "done" && (
          <>
            <p className="muted small">Send these numbers to whoever is tuning the game.</p>
            {"share" in navigator && <button onClick={share}>Share…</button>}
            <button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </>
        )}
        <p className="small debug-links">
          <a href={REPO} target="_blank" rel="noreferrer">
            Source code
          </a>
          {" · "}
          <a href={`${REPO}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer">
            Changelog
          </a>
        </p>
      </aside>
    </div>
  );
}
