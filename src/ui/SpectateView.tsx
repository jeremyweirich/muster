import { useEffect, useMemo, useRef, useState } from "react";
import { OPENING_PACKS } from "../data/openings";
import { RULES } from "../data/rules";
import { TOWER_MAP } from "../data/towers";
import { DEFAULT_UNITS } from "../data/units";
import type { AiPlan, Difficulty } from "../game/ai";
import { defMap } from "../game/army";
import { nextRound, packLabel, type MatchState } from "../game/match";
import { playSpectatedRound, spectateMatch, spectateRequest, type SpectatedRound } from "../game/spectate";
import { drawBackground, drawTowers } from "../render/draw";
import { Battle } from "../sim/battle";
import type { Side, UnitDef } from "../sim/types";
import { drawBanner, useBattlePlayer } from "./battlePlayer";
import { MvpBoard, SquadDetail, SquadList, type SideNames } from "./BattleReport";
import { FieldCanvas, type FieldPointer } from "./FieldCanvas";
import { planInWorkers } from "./planInWorkers";
import { HpBar, UnlockStrip } from "./PlayView";
import { Swatch, UnitInfo } from "./UnitInfo";

// The AI playing itself (the Spectate tab): a full match, round by round, for watching unit interactions. Each
// round's battle is fought headless as soon as both sides have planned, and the next round is planned while this one
// plays, so there is no waiting between rounds. Any earlier round can be watched again. "Copy round" puts the battle's
// exact setup on the clipboard, to reproduce it in a script.

const TILE = 24; // as in PlayView
const units = DEFAULT_UNITS;
const defs = defMap(units);
const allDefs = new Map([...defs, ...TOWER_MAP]);
const NAMES: SideNames = ["Blue", "Red"];
const HOLD = 1.5; // seconds the armies stand before each battle, to take in the deployment
const LINGER = 3; // seconds a result shows before the next round starts, with auto-advance on: a 3, 2, 1 countdown
const MAX_ROUNDS = 30; // a safety stop for a match that never ends
const matchSeed = () => Math.floor(Math.random() * 2 ** 31);

// Hard searches on several cores; the two sides share them.
const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
const SEARCHES_PER_SIDE = Math.max(1, Math.floor((cores - 1) / 2));

export function SpectateView() {
  const [seed, setSeed] = useState(matchSeed);
  const [difficulty, setDifficulty] = useState<[Difficulty, Difficulty]>(["hard", "hard"]);
  const [rounds, setRounds] = useState<SpectatedRound[]>([]);
  const [watching, setWatching] = useState(0); // index into rounds
  const [furthest, setFurthest] = useState(0); // the latest round watched: planning stays one round ahead of it
  const [ended, setEnded] = useState(false); // the watched battle has finished playing
  const [speed, setSpeed] = useState(1);
  const [auto, setAuto] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{ def: UnitDef; side: Side } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null); // seconds until auto-advance starts the next round
  const battleRef = useRef<Battle | null>(null);
  const clock = useRef({ now: 0, startAt: 0, countFrom: null as number | null, shown: null as number | null });
  const player = useBattlePlayer();

  const last = rounds[rounds.length - 1];
  const over = !!last && (last.after.phase === "over" || last.after.round >= MAX_ROUNDS);
  const round = rounds[watching];

  // Plan the next round (both sides at once) while at most one round is waiting to be watched.
  useEffect(() => {
    if (over || rounds.length > furthest + 1) return;
    const start: MatchState = last ? nextRound(last.after) : spectateMatch(units, seed);
    const plans: (AiPlan | null)[] = [null, null];
    const cancels = ([0, 1] as Side[]).map((side) =>
      planInWorkers(
        spectateRequest(start, side, units, defs, difficulty[side], seed),
        (plan) => {
          plans[side] = plan;
          if (plans[0] && plans[1]) setRounds((r) => [...r, playSpectatedRound(start, [plans[0]!, plans[1]!], defs)]);
        },
        SEARCHES_PER_SIDE,
      ),
    );
    return () => cancels.forEach((c) => c());
  }, [seed, rounds.length, furthest, difficulty[0], difficulty[1]]);

  // a new round to watch: set its battle up, to start after a moment
  const watch = (i: number) => {
    const r = rounds[i];
    if (!r) return;
    const f = r.fought;
    battleRef.current = new Battle(f.defs, f.armies, { seed: f.seed, recordFx: true, towerLevels: f.towerLevels });
    player.reset();
    clock.current.startAt = clock.current.now + HOLD;
    clock.current.countFrom = null;
    setSpeed(1); // every round starts at normal speed, as in Play
    setWatching(i);
    setFurthest((n) => Math.max(n, i));
    setEnded(false);
    setPinned(null);
    setHoverInfo(null);
    setCopied(false);
  };
  // the first round arrives
  useEffect(() => {
    if (rounds.length === 1 && !battleRef.current) watch(0);
  }, [rounds.length]);

  const next = rounds[watching + 1];
  const draw = (ctx: CanvasRenderingContext2D, dt: number, time: number) => {
    const c = clock.current;
    c.now = time;
    const b = battleRef.current;
    if (!b) {
      drawBackground(ctx, TILE, { zones: true });
      drawTowers(ctx, TILE);
      drawBanner(ctx, (RULES.fieldW * TILE) / 2, "Both sides are planning round 1…");
      return;
    }
    const holding = time < c.startAt;
    player.frame(ctx, b, TILE, dt, time, holding ? 0 : speed, () => setEnded(true));
    if (holding) drawBanner(ctx, (RULES.fieldW * TILE) / 2, `Round ${round?.start.round}`);
    // Auto-advance counts down on the field's clock, so it waits while this tab is hidden. It starts over if paused,
    // switched off, or when the next round is still being planned as the battle ends.
    let left: number | null = null;
    if (b.over && auto && speed > 0 && next) {
      c.countFrom ??= time;
      left = Math.ceil(LINGER - (time - c.countFrom));
      if (left > 0) {
        drawBanner(ctx, (RULES.fieldW * TILE) / 2, `Round ${next.start.round} starts in ${left}`);
        drawCountdown(ctx, left, (time - c.countFrom) % 1);
      }
    } else c.countFrom = null;
    if (left !== c.shown) {
      c.shown = left;
      setCountdown(left);
    }
    if (left !== null && left <= 0) watch(watching + 1);
  };

  const onPointer = (p: FieldPointer) => {
    if (p.type === "leave") return setHoverInfo(null);
    const m = battleRef.current?.models.find((m) => m.alive && Math.hypot(m.x - p.x, m.y - p.y) < Math.max(0.5, m.def.size));
    if (m) setHoverInfo({ def: m.def, side: m.side });
    else if (p.type === "down") setHoverInfo(null);
  };

  const newMatch = () => {
    battleRef.current = null;
    clock.current.countFrom = null;
    setRounds([]);
    setWatching(0);
    setFurthest(0);
    setEnded(false);
    setSeed(matchSeed());
  };

  const copyRound = () => {
    if (!round) return;
    const f = round.fought;
    const setup = { round: round.start.round, seed: f.seed, armies: f.armies, upgrades: round.after.upgrades, towerLevels: f.towerLevels };
    navigator.clipboard?.writeText(JSON.stringify(setup)).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  // HP before the battle while it plays, after it once it's over
  const hp = round ? (ended ? round.after.hp : round.start.hp) : [RULES.startHp, RULES.startHp];
  const shown = round?.after ?? null;
  const unlocks = (side: Side) => (shown?.unlocked[side] ?? []).map((id) => defs.get(id)).filter((d): d is UnitDef => !!d);
  const report = round && ended ? round.after.history[round.after.history.length - 1] : null;
  const result = round?.fought.result ?? null;
  const pinnedStats = pinned && result ? result.stats[pinned] : undefined;
  const card = hoverInfo && round && (
    <UnitInfo def={hoverInfo.def} owned={hoverInfo.def.structure ? undefined : round.after.upgrades[hoverInfo.side][hoverInfo.def.id] ?? []} link />
  );

  return (
    <div className="play spectate" style={{ "--field-ratio": RULES.fieldW / RULES.fieldH } as React.CSSProperties}>
      <main className="board">
        <div className="hud">
          <UnlockStrip units={unlocks(0)} owned={shown?.upgrades[0] ?? {}} side={0} />
          <HpBar label={NAMES[0]} hp={hp[0]} side={0} />
          <div className="round">Round {round?.start.round ?? 1}</div>
          <HpBar label={NAMES[1]} hp={hp[1]} side={1} />
          <UnlockStrip units={unlocks(1)} owned={shown?.upgrades[1] ?? {}} side={1} />
        </div>
        <div className="field-wrap">
          <div className="field-box">
            <FieldCanvas tile={TILE} draw={draw} onPointer={onPointer} />
          </div>
        </div>
      </main>
      <aside className="panel side spectate-side">
        <h3>Spectate</h3>
        <div className="speed">
          {[0, 0.5, 1, 2, 4, 8].map((s) => (
            <button key={s} className={speed === s ? "active" : ""} onClick={() => setSpeed(s)}>
              {s === 0 ? "❚❚" : `${s}×`}
            </button>
          ))}
          <button disabled={!round || ended} onClick={() => battleRef.current && player.skip(battleRef.current)}>
            Skip
          </button>
        </div>
        <label className="small">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-advance
        </label>
        <div className="spectate-row">
          <button disabled={!round} onClick={() => watch(watching)}>
            ↺ Replay
          </button>
          <button className="primary" disabled={!next} onClick={() => watch(watching + 1)}>
            {next ? `Next round${countdown ? ` (${countdown})` : ""}` : over && watching === rounds.length - 1 ? "Match over" : "Planning…"}
          </button>
          <button onClick={newMatch}>New match</button>
        </div>

        {report && (
          <div className="result">
            <h2 className={report.winner === 0 ? "blue" : report.winner === 1 ? "red" : ""}>
              {report.winner === null ? (report.timedOut ? "Time out" : "Draw") : `${NAMES[report.winner]} wins round ${report.round}`}
            </h2>
            <p className="small">
              {NAMES[0]} took <b>{report.damage[0]}</b> · {NAMES[1]} took <b>{report.damage[1]}</b>
            </p>
            {over && watching === rounds.length - 1 && (
              <p>
                <b>
                  {round.after.phase !== "over"
                    ? `Stopped after ${MAX_ROUNDS} rounds.`
                    : round.after.hp[0] > 0
                      ? `${NAMES[0]} wins the match.`
                      : round.after.hp[1] > 0
                        ? `${NAMES[1]} wins the match.`
                        : "Mutual ruin."}
                </b>
              </p>
            )}
            {result && <MvpBoard result={result} defs={allDefs} selected={pinned} onSelect={setPinned} onHover={() => {}} names={NAMES} />}
          </div>
        )}

        {card ?? (pinnedStats && <SquadDetail stats={pinnedStats} def={allDefs.get(pinnedStats.defId)} names={NAMES} />)}
        {!card && !pinnedStats && round && <p className="muted small">Hover over or tap a unit on the field to see its stats.</p>}
        {ended && result && !card && <SquadList result={result} defs={allDefs} selected={pinned} onSelect={setPinned} onHover={() => {}} names={NAMES} />}

        {round && (
          <div className="spectate-turns">
            {([0, 1] as Side[]).map((side) => (
              <TurnLog key={side} side={side} round={round} />
            ))}
          </div>
        )}

        {rounds.length > 0 && (
          <div className="spectate-rounds">
            {rounds.map((r, i) => {
              const w = r.after.history[r.after.history.length - 1]?.winner;
              return (
                <button key={i} className={`small-btn ${i === watching ? "active" : ""} ${w === 0 ? "blue" : w === 1 ? "red" : ""}`} onClick={() => watch(i)}>
                  {r.start.round}
                </button>
              );
            })}
          </div>
        )}

        <div className="spacer" />
        <div className="spectate-row">
          {([0, 1] as Side[]).map((side) => (
            <label key={side} className="small">
              {NAMES[side]}{" "}
              <select value={difficulty[side]} onChange={(e) => setDifficulty((d) => (side === 0 ? [e.target.value as Difficulty, d[1]] : [d[0], e.target.value as Difficulty]))}>
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          ))}
        </div>
        <div className="spectate-row">
          <button disabled={!round} onClick={copyRound} title="The battle's exact setup as JSON, to reproduce it in a script">
            {copied ? "Copied" : "Copy round"}
          </button>
        </div>
        <p className="muted small">A difficulty change applies from the next round that hasn't been planned yet.</p>
      </aside>
    </div>
  );
}

// The auto-advance countdown, big in the middle of the field; each number fades as its second runs out.
function drawCountdown(ctx: CanvasRenderingContext2D, n: number, elapsed: number) {
  const cx = (RULES.fieldW * TILE) / 2;
  const cy = (RULES.fieldH * TILE) / 2;
  ctx.save();
  ctx.globalAlpha = 1 - 0.6 * elapsed;
  ctx.fillStyle = "rgba(10,14,18,0.7)";
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8d48a";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), cx, cy + 3);
  ctx.restore();
}

// What one side did this round: its opening, what it bought, and how hard it looked.
function TurnLog({ side, round }: { side: Side; round: SpectatedRound }) {
  const plan = round.plans[side];
  const start = round.start;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const sq of plan.squads) m.set(sq.defId, (m.get(sq.defId) ?? 0) + 1);
    return [...m];
  }, [plan]);
  const name = (id: string) => defs.get(id)?.name ?? id;
  const choice = start.round === 1 ? start.openings[side].choice : null;
  const promoted = start.armies[side].filter((sq) => plan.promotions.includes(sq.uid));
  const lines: [string, string][] = [];
  if (choice !== null) lines.push(["Opening", choice === "flat" ? "war chest" : packLabel(OPENING_PACKS[choice], units)]);
  if (counts.length) lines.push(["New squads", counts.map(([id, n]) => `${n > 1 ? `${n}× ` : ""}${name(id)}`).join(", ")]);
  if (plan.unlocks.length) lines.push(["Unlocked", plan.unlocks.map(name).join(", ")]);
  for (const u of plan.upgrades) {
    const up = defs.get(u.unitId)?.upgrades?.find((x) => x.id === u.upgradeId);
    lines.push(["Upgrade", `${name(u.unitId)}: ${up?.name ?? u.upgradeId}`]);
  }
  if (promoted.length) lines.push(["Promoted", promoted.map((sq) => `${name(sq.defId)} → Lv ${(sq.level ?? 1) + 1}`).join(", ")]);
  for (const i of plan.towerUpgrades) lines.push(["Keep", `${RULES.towers[i]?.name ?? "Keep"} +1 level`]);
  return (
    <div className={`turn-log turn-log-${side}`}>
      <div className="turn-log-head">
        <b>{NAMES[side]}</b>
        <span className="muted small">
          {start.supply[side]} supply, spent {plan.spent} · {plan.candidatesTried} plans tried
        </span>
      </div>
      {lines.length ? (
        lines.map(([k, v], i) => (
          <div key={i} className="small">
            <span className="muted">{k}:</span> {v}
          </div>
        ))
      ) : (
        <div className="muted small">Bought nothing.</div>
      )}
      <div className="turn-log-army">
        {[...new Set(round.fought.armies[side].map((sq) => sq.defId))].map((id) => {
          const d = defs.get(id);
          const n = round.fought.armies[side].filter((sq) => sq.defId === id).length;
          return d ? (
            <span key={id} className="small" title={d.name}>
              <Swatch def={d} size={14} />×{n}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}
