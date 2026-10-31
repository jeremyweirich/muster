import { useEffect, useState, type ReactNode } from "react";
import { RULES } from "../data/rules";
import { TOWER_MAP } from "../data/towers";
import { DEFAULT_UNITS } from "../data/units";
import type { UnitDef } from "../sim/types";
import { Swatch } from "./UnitInfo";

// A short walkthrough for players who have never played a deploy-then-autobattle game.
// Shown when the app opens on the Play tab, and from the header's "How to play" button.
// The site stores nothing, so it can't remember that someone has seen it; Skip is always one click away.

interface Step {
  title: string;
  art: ReactNode;
  body: ReactNode;
}

export function Intro({ onClose }: { onClose: () => void }) {
  const units = DEFAULT_UNITS;
  const u = (id: string) => units.find((x) => x.id === id);
  const [i, setI] = useState(0);

  const steps: Step[] = [
    {
      title: "Welcome to Common Ground",
      art: <Icons defs={[u("knights"), u("goblin_horde"), u("fire_elemental"), u("bat_riders")]} />,
      body: (
        <>
          <p>
            You command an army, but you don&apos;t control it in battle. You <b>choose</b> units and <b>place</b> them, then press
            Fight and watch both armies clash on their own.
          </p>
          <p>Winning is about picking the right units and putting them in the right places.</p>
        </>
      ),
    },
    {
      title: "1. Recruit and place",
      art: <Icons defs={[u("knights"), u("longbowmen"), u("goblin_horde")]} />,
      body: (
        <>
          <p>
            Each round you get <b>supply</b> ({RULES.income(1)} to start). Pick a unit in the sidebar, then click inside your{" "}
            <b className="blue">blue zone</b> to place a squad.
          </p>
          <p>
            Put tough units in front and shooters behind. <b>R</b> or right-click rotates a squad; <b>Ctrl+Z</b> undoes a purchase.
          </p>
        </>
      ),
    },
    {
      title: "2. Your army keeps growing",
      art: <Icons defs={[u("knights"), u("knights"), u("longbowmen"), u("ogre_brute")]} />,
      body: (
        <>
          <p>
            Squads stay with you for the whole match and are <b>locked in place</b> once a round is fought. Every round you add
            more on top.
          </p>
          <p>
            Lose a battle and you lose HP based on what the enemy has left standing. The first player at <b>0 HP</b> loses the
            war.
          </p>
        </>
      ),
    },
    {
      title: "3. Counter what you see",
      art: <Triangle a={u("goblin_horde")} b={u("knights")} c={u("longbowmen")} />,
      body: (
        <>
          <p>
            Before you build, you can see the enemy&apos;s army from last round. Every unit beats some units and loses to others:
          </p>
          <p className="intro-small">
            Goblins swarm Knights · Knights shrug off arrows · Longbowmen pick off Goblins. Fire melts armor, Bat Riders hunt
            archers, and Air Elementals swat fliers.
          </p>
          <p>
            Hover any unit to see what it does. The <b>Counters</b> tab shows what beats any unit, and the <b>Codex</b> explains every
            rule; underlined words link straight to it.
          </p>
        </>
      ),
    },
    {
      title: "4. Upgrades and Keeps",
      art: <Icons defs={[u("goblin_sappers"), u("wolf_riders")]} keep />,
      body: (
        <>
          <p>
            The <b>Upgrades</b> tab improves <b>every</b> squad of a unit, including ones already on the field. Each unit has
            four, and each one you buy for it costs more, so pick a specialty.
          </p>
          <p>
            Squads earn <b>XP</b> for the damage they deal. When one earns a level, a gold <b>▲</b> appears over it: click it
            and pay its price to double its HP and damage (then triple, and so on).
          </p>
          <p>
            Each side has two <b>Keeps</b>. If one falls, its owner&apos;s whole army is <b>Dazed</b> for a few seconds and fights
            badly, so guard your flanks, or sneak raiders around theirs.
          </p>
          <p className="intro-small">You&apos;re playing the AI on Easy. You can change that at the bottom of the sidebar.</p>
        </>
      ),
    },
  ];
  const last = i === steps.length - 1;
  const step = steps[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") last ? onClose() : setI((n) => n + 1);
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, onClose]);

  return (
    <div className="intro-backdrop" onClick={onClose}>
      <div className="intro" role="dialog" aria-modal="true" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <div className="intro-art">{step.art}</div>
        <h2>{step.title}</h2>
        <div className="intro-body">{step.body}</div>
        <div className="intro-nav">
          <button className="ghost" onClick={onClose}>
            Skip
          </button>
          <div className="intro-dots">
            {steps.map((_, k) => (
              <button key={k} className={`dot-btn ${k === i ? "on" : ""}`} aria-label={`Step ${k + 1}`} onClick={() => setI(k)} />
            ))}
          </div>
          <div className="intro-buttons">
            {i > 0 && <button onClick={() => setI(i - 1)}>Back</button>}
            <button className="primary" onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? "Start playing" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Icons({ defs, keep }: { defs: (UnitDef | undefined)[]; keep?: boolean }) {
  return (
    <div className="intro-icons">
      {defs.map((d, k) => d && <Swatch key={k} def={d} size={44} />)}
      {keep && TOWER_MAP.get("tower_keep") && <Swatch def={TOWER_MAP.get("tower_keep")!} size={44} />}
    </div>
  );
}

// Who beats whom among the starter units: a → b → c → a.
function Triangle({ a, b, c }: { a?: UnitDef; b?: UnitDef; c?: UnitDef }) {
  if (!a || !b || !c) return null;
  const node = (d: UnitDef) => (
    <span className="tri-node">
      <Swatch def={d} size={38} />
      <span>{d.name}</span>
    </span>
  );
  return (
    <div className="tri">
      {node(a)}
      <span className="tri-arrow">beats →</span>
      {node(b)}
      <span className="tri-arrow">beats →</span>
      {node(c)}
      <span className="tri-arrow">beats ↺</span>
    </div>
  );
}
