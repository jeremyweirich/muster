import { useEffect, useState, type ReactNode } from "react";
import { RULES } from "../data/rules";
import { TOWER_MAP } from "../data/towers";
import { DEFAULT_UNITS } from "../data/units";
import type { UnitDef } from "../sim/types";
import { Swatch } from "./UnitInfo";

// A short walkthrough for players who have never played a deploy-then-autobattle game.
// Shown the first time the app opens on the Play tab (the browser remembers it, progress.ts), and from the header's
// "How to play" button.
// `graduate`: the version for players arriving from the Wardens campaign's finale, about what the campaign didn't
// cover (the other factions, the round-1 offer and unlocks, elements).

interface Step {
  title: string;
  art: ReactNode;
  body: ReactNode;
}

export function Intro({ onClose, graduate = false }: { onClose: () => void; graduate?: boolean }) {
  const units = DEFAULT_UNITS;
  const u = (id: string) => units.find((x) => x.id === id);
  const [i, setI] = useState(0);
  const unlock = units.find((x) => x.tags.includes("faction:warden"))?.unlockCost;
  const hire = units.find((x) => x.tags.includes("faction:independent"))?.unlockCost;

  const graduateSteps: Step[] = [
    {
      title: "Every unit, every faction",
      art: <Icons defs={[u("knights"), u("grunts"), u("fire_elemental"), u("dragon")]} />,
      body: (
        <p>
          The campaign was Wardens against goblins. Here the shop has every unit: Wardens, Goblins, <b>Elementals</b>, and
          three independents for hire. The AI can field any of them too.
        </p>
      ),
    },
    {
      title: "Round 1: pick a pack",
      art: <Icons defs={[u("crossbowmen"), u("wolf_riders")]} />,
      body: (
        <p>
          Units start locked. In round 1, take one of three <b>packs</b> (two units unlocked, with squads already placed) or the{" "}
          <b>war chest</b> ({RULES.openingFlat} supply, nothing unlocked). Later, unlocking a unit costs {unlock}, or {hire} for an
          independent.
        </p>
      ),
    },
    {
      title: "Elements combine",
      art: <Icons defs={[u("water_elemental"), u("air_elemental"), u("frost_elemental"), u("fire_elemental")]} />,
      body: (
        <>
          <p>
            Elementals leave statuses behind, like Wet or Burning, and a second element on top sets off a reaction: lightning
            hits a Wet unit twice as hard, and frost freezes it solid. Statuses hit whoever is there, your own units too.
          </p>
          <p className="intro-small">The AI starts on Easy. Normal and Hard are at the bottom of the sidebar.</p>
        </>
      ),
    },
  ];

  // Kept short on purpose: three screens, a line or two each, then play. The Codex has the rest.
  const steps: Step[] = graduate ? graduateSteps : [
    {
      title: "Build, then watch",
      art: <Icons defs={[u("knights"), u("crossbowmen"), u("grunts"), u("fire_elemental")]} />,
      body: (
        <p>
          Pick units and place them in your <b className="blue">blue zone</b>. Press <b>Fight!</b> and the battle plays out on
          its own.
        </p>
      ),
    },
    {
      title: "Survivors hit HP",
      art: <Icons defs={[u("knights"), u("knights"), u("ogre_brute")]} />,
      body: (
        <p>
          Squads still standing after a fight damage the other side&apos;s HP. First to <b>0</b> loses. Your army stays, and
          each round you add more.
        </p>
      ),
    },
    {
      title: "Counter what you see",
      art: <Triangle a={u("grunts")} b={u("crossbowmen")} c={u("knights")} />,
      body: (
        <>
          <p>You can see the enemy&apos;s army from last round. Hover any unit to see what it beats.</p>
          <p className="intro-small">You&apos;re playing the AI on Easy. Change it at the bottom of the sidebar.</p>
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
