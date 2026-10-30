import { useEffect, useMemo, useRef, useState } from "react";
import { RULES } from "../data/rules";
import { planAiRound, type AiPlan, type Difficulty } from "../game/ai";
import { canPlace, defMap, newUid } from "../game/army";
import { applyRound, newMatch, nextRound, type MatchState } from "../game/match";
import { drawBackground, drawSquad } from "../render/draw";
import { Battle, type BattleResult } from "../sim/battle";
import type { PlacedSquad, UnitDef } from "../sim/types";
import { useRoster } from "../store/roster";
import { useBattlePlayer } from "./battlePlayer";
import { FieldCanvas, type FieldPointer } from "./FieldCanvas";
import { Swatch, UnitInfo } from "./UnitInfo";

const TILE = 22;

export function PlayView() {
  const units = useRoster();
  const defs = useMemo(() => defMap(units), [units]);
  const [match, setMatch] = useState<MatchState>(newMatch);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [selected, setSelected] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [hoverDef, setHoverDef] = useState<UnitDef | null>(null);
  const [speed, setSpeed] = useState(1);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [lastResult, setLastResult] = useState<BattleResult | null>(null);
  const battleRef = useRef<Battle | null>(null);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const player = useBattlePlayer();

  // The AI plans at the start of each deployment, from what it saw last round.
  useEffect(() => {
    if (match.phase !== "deploy") return;
    setAiPlan(null);
    const id = setTimeout(() => {
      setAiPlan(
        planAiRound(units, defs, match.armies[1], match.armies[0], match.supply[1], match.round, difficulty, match.round * 7919 + 13),
      );
    }, 30);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.round, match.phase === "deploy"]);

  const myArmy = match.armies[0];
  const isNew = (sq: PlacedSquad) => !RULES.lockPlacedSquads || sq.round === match.round;
  const placingDef = held ? defs.get(myArmy.find((s) => s.uid === held)?.defId ?? "") : selected ? defs.get(selected) : undefined;

  const ghostPos = (def: UnitDef, p: { x: number; y: number }) => ({
    x: Math.round(p.x - def.footprint.w / 2),
    y: Math.round(p.y - def.footprint.h / 2),
  });

  const squadAt = (x: number, y: number) =>
    myArmy.find((s) => {
      const d = defs.get(s.defId);
      return d && x >= s.x && x < s.x + d.footprint.w && y >= s.y && y < s.y + d.footprint.h;
    });

  const onPointer = (p: FieldPointer) => {
    if (p.type === "leave") {
      hover.current = null;
      return;
    }
    hover.current = { x: p.x, y: p.y };
    if (match.phase !== "deploy") {
      if (p.type === "move") {
        const b = battleRef.current;
        const m = b?.models.find((m) => m.alive && Math.hypot(m.x - p.x, m.y - p.y) < Math.max(0.5, m.def.size));
        setHoverDef(m ? m.def : null);
      }
      return;
    }
    if (p.type === "move") {
      const sq = squadAt(p.x, p.y) ?? match.armies[1].find((s) => {
        const d = defs.get(s.defId);
        return d && p.x >= s.x && p.x < s.x + d.footprint.w && p.y >= s.y && p.y < s.y + d.footprint.h;
      });
      setHoverDef(sq ? defs.get(sq.defId) ?? null : null);
      return;
    }
    // pointer down
    const existing = squadAt(p.x, p.y);
    if (p.button === 2) {
      if (existing && isNew(existing)) sell(existing);
      setHeld(null);
      return;
    }
    if (placingDef) {
      const { x, y } = ghostPos(placingDef, p);
      if (held) {
        if (canPlace(placingDef, x, y, 0, myArmy, defs, held)) {
          updateArmy(myArmy.map((s) => (s.uid === held ? { ...s, x, y } : s)));
          setHeld(null);
        }
        return;
      }
      if (existing && isNew(existing)) {
        setHeld(existing.uid);
        return;
      }
      if (placingDef.cost <= match.supply[0] && canPlace(placingDef, x, y, 0, myArmy, defs)) {
        setMatch((m) => ({
          ...m,
          supply: [m.supply[0] - placingDef.cost, m.supply[1]],
          armies: [[...m.armies[0], { uid: newUid("p"), defId: placingDef.id, x, y, round: m.round }], m.armies[1]],
        }));
      }
      return;
    }
    if (existing && isNew(existing)) setHeld(existing.uid);
  };

  const updateArmy = (army: PlacedSquad[]) => setMatch((m) => ({ ...m, armies: [army, m.armies[1]] }));

  const sell = (sq: PlacedSquad) => {
    const cost = defs.get(sq.defId)?.cost ?? 0;
    setMatch((m) => ({
      ...m,
      supply: [m.supply[0] + cost, m.supply[1]],
      armies: [m.armies[0].filter((s) => s.uid !== sq.uid), m.armies[1]],
    }));
  };

  const fight = () => {
    if (!aiPlan) return;
    const armies: [PlacedSquad[], PlacedSquad[]] = [match.armies[0], [...match.armies[1], ...aiPlan.squads]];
    setMatch((m) => ({ ...m, armies, supply: [m.supply[0], m.supply[1] - aiPlan.spent], phase: "battle" }));
    battleRef.current = new Battle(defs, armies, { seed: match.round * 104729 + 7, recordFx: true });
    player.reset();
    setSelected(null);
    setHeld(null);
  };

  const onBattleEnd = (r: BattleResult) => {
    setLastResult(r);
    setMatch((m) => applyRound(m, r, defs));
  };

  const next = () => {
    battleRef.current = null;
    setLastResult(null);
    setMatch((m) => nextRound(m));
  };

  const restart = () => {
    battleRef.current = null;
    setLastResult(null);
    setSelected(null);
    setHeld(null);
    setMatch(newMatch());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setHeld(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const draw = (ctx: CanvasRenderingContext2D, dt: number, time: number) => {
    const b = battleRef.current;
    if (b && match.phase !== "deploy") {
      player.frame(ctx, b, TILE, dt, time, match.phase === "battle" ? speed : 0, match.phase === "battle" ? onBattleEnd : undefined);
      return;
    }
    drawBackground(ctx, TILE, { zones: true, grid: [0] });
    for (const sq of match.armies[1]) {
      const d = defs.get(sq.defId);
      if (d) drawSquad(ctx, sq, d, 1, TILE, { alpha: 0.75 });
    }
    for (const sq of myArmy) {
      const d = defs.get(sq.defId);
      if (!d) continue;
      if (sq.uid === held) {
        drawSquad(ctx, sq, d, 0, TILE, { alpha: 0.25, outline: "#ffffff", dashed: true });
        continue;
      }
      drawSquad(ctx, sq, d, 0, TILE, { outline: isNew(sq) ? "rgba(140,220,140,0.8)" : "rgba(255,255,255,0.15)" });
    }
    const h = hover.current;
    if (h && placingDef) {
      const { x, y } = ghostPos(placingDef, h);
      const ok = canPlace(placingDef, x, y, 0, myArmy, defs, held ?? undefined) && (held || placingDef.cost <= match.supply[0]);
      ctx.fillStyle = ok ? "rgba(120,230,120,0.18)" : "rgba(255,80,80,0.22)";
      ctx.fillRect(x * TILE, y * TILE, placingDef.footprint.w * TILE, placingDef.footprint.h * TILE);
      drawSquad(ctx, { uid: "ghost", defId: placingDef.id, x, y, round: 0 }, placingDef, 0, TILE, { alpha: 0.55 });
      if (placingDef.attack) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc((x + placingDef.footprint.w / 2) * TILE, (y + placingDef.footprint.h / 2) * TILE, placingDef.attack.range * TILE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  const report = match.history[match.history.length - 1];
  const infoDef = hoverDef ?? (selected ? defs.get(selected) : undefined);
  const spentThisRound = myArmy.filter((s) => s.round === match.round).length;

  return (
    <div className="play">
      <aside className="panel shop">
        <h3>Recruit</h3>
        <div className="supply">
          <span className="supply-num">{match.supply[0]}</span> supply
        </div>
        <div className="shop-list">
          {units.map((u) => (
            <button
              key={u.id}
              className={`shop-item ${selected === u.id ? "active" : ""}`}
              disabled={match.phase !== "deploy" || u.cost > match.supply[0]}
              onClick={() => {
                setHeld(null);
                setSelected(selected === u.id ? null : u.id);
              }}
              onMouseEnter={() => setHoverDef(u)}
              onMouseLeave={() => setHoverDef(null)}
            >
              <Swatch def={u} />
              <span className="shop-name">{u.name}</span>
              <span className="shop-cost">{u.cost}</span>
            </button>
          ))}
        </div>
        <p className="hint">
          Click a unit, then click your (blue) zone to place it. Click a green-outlined squad to move it, right-click to sell. Squads
          from earlier rounds are locked. Esc cancels.
        </p>
      </aside>

      <main className="board">
        <div className="hud">
          <HpBar label="You" hp={match.hp[0]} side={0} />
          <div className="round">Round {match.round}</div>
          <HpBar label="Enemy" hp={match.hp[1]} side={1} />
        </div>
        <FieldCanvas tile={TILE} draw={draw} onPointer={onPointer} />
      </main>

      <aside className="panel side">
        {match.phase === "deploy" && (
          <>
            <button className="primary big" disabled={!aiPlan} onClick={fight}>
              {aiPlan ? "Fight!" : "Enemy is planning…"}
            </button>
            <p className="muted small">
              {spentThisRound
                ? `${spentThisRound} new squad${spentThisRound > 1 ? "s" : ""} this round.`
                : "You see the enemy as they stood last round. Their new recruits are hidden until the battle."}
            </p>
          </>
        )}
        {match.phase === "battle" && (
          <div className="speed">
            {[0, 0.5, 1, 2, 4].map((s) => (
              <button key={s} className={speed === s ? "active" : ""} onClick={() => setSpeed(s)}>
                {s === 0 ? "❚❚" : `${s}×`}
              </button>
            ))}
            <button onClick={() => battleRef.current && player.skip(battleRef.current)}>Skip</button>
          </div>
        )}
        {(match.phase === "result" || match.phase === "over") && report && (
          <div className="result">
            <h2 className={report.winner === 0 ? "win" : report.winner === 1 ? "lose" : ""}>
              {report.winner === 0 ? "Victory" : report.winner === 1 ? "Defeat" : report.timedOut ? "Time out" : "Draw"}
            </h2>
            <p>
              You took <b>{report.damage[0]}</b> · Enemy took <b>{report.damage[1]}</b>
            </p>
            {lastResult && <Mvp result={lastResult} squads={myArmy} defs={defs} />}
            {match.phase === "over" ? (
              <>
                <h2>{match.hp[0] > 0 ? "You win the war!" : match.hp[1] > 0 ? "You have been defeated." : "Mutual ruin."}</h2>
                <button className="primary big" onClick={restart}>
                  New game
                </button>
              </>
            ) : (
              <button className="primary big" onClick={next}>
                Next round (+{RULES.income(match.round + 1)})
              </button>
            )}
          </div>
        )}
        {infoDef && <UnitInfo def={infoDef} />}
        <div className="spacer" />
        <div className="game-opts">
          <label>
            AI{" "}
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <button onClick={restart}>Restart</button>
        </div>
        {aiPlan && match.phase === "deploy" && (
          <p className="muted small">AI tested {aiPlan.candidatesTried} plans against your last army.</p>
        )}
      </aside>
    </div>
  );
}

function HpBar({ label, hp, side }: { label: string; hp: number; side: 0 | 1 }) {
  const frac = Math.max(0, hp / RULES.startHp);
  return (
    <div className={`hp hp-${side}`}>
      <span>{label}</span>
      <div className="hp-track">
        <div className="hp-fill" style={{ width: `${frac * 100}%` }} />
      </div>
      <span className="hp-num">{hp}</span>
    </div>
  );
}

function Mvp({ result, squads, defs }: { result: BattleResult; squads: PlacedSquad[]; defs: Map<string, UnitDef> }) {
  const rows = squads
    .map((s) => ({ s, dmg: result.damageBySquad[s.uid] ?? 0 }))
    .sort((a, b) => b.dmg - a.dmg)
    .slice(0, 5);
  if (!rows.length) return null;
  return (
    <div className="mvp">
      <div className="muted small">Your top damage dealers</div>
      {rows.map(({ s, dmg }) => {
        const d = defs.get(s.defId);
        return d ? (
          <div key={s.uid} className="mvp-row">
            <Swatch def={d} size={16} /> {d.name} <span className="muted">{Math.round(dmg)}</span>
          </div>
        ) : null;
      })}
    </div>
  );
}
