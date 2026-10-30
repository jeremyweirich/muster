import { ELEMENT_COLORS } from "../data/elements";
import type { Element, UnitDef } from "../sim/types";
import { derived, describeEffect, describeTrait } from "./describe";

export function Swatch({ def, size = 22 }: { def: UnitDef; size?: number }) {
  return (
    <span
      className={`swatch shape-${def.look.shape}`}
      style={{ width: size, height: size, background: def.look.color, fontSize: size * 0.55 }}
    >
      {def.look.glyph}
    </span>
  );
}

export function UnitInfo({ def }: { def: UnitDef }) {
  const d = derived(def);
  const entries = Object.entries(def.resist ?? {}) as [Element, number][];
  const resists = entries.filter(([, v]) => v > 0);
  const weaknesses = entries.filter(([, v]) => v < 0);
  const atk = def.attack;
  return (
    <div className="unit-info">
      <div className="unit-info-head">
        <Swatch def={def} size={30} />
        <div>
          <div className="unit-name">{def.name}</div>
          <div className="muted">
            {def.structure ? "tower" : `${def.cost} supply`} · {def.squadSize} × {def.layer}
            {def.unlockCost ? ` · unlock ${def.unlockCost}` : ""}
          </div>
        </div>
      </div>
      {def.description && <p className="muted small">{def.description}</p>}
      <dl className="stats">
        <dt>HP</dt>
        <dd>
          {def.hp} <span className="muted">({d.squadHp} squad)</span>
        </dd>
        <dt>Speed</dt>
        <dd>{def.speed}</dd>
        {atk ? (
          <>
            <dt>Attack</dt>
            <dd>
              <span style={{ color: ELEMENT_COLORS[atk.element] }}>
                {atk.damage} {atk.element}
              </span>{" "}
              / {atk.cooldown}s
            </dd>
            <dt>DPS</dt>
            <dd>
              {d.modelDps.toFixed(0)} <span className="muted">({d.squadDps.toFixed(0)} squad)</span>
            </dd>
            <dt>Range</dt>
            <dd>
              {atk.range} · hits {atk.targets.join(" + ")}
            </dd>
            {atk.splash ? (
              <>
                <dt>Splash</dt>
                <dd>{atk.splash}</dd>
              </>
            ) : null}
            {atk.chain ? (
              <>
                <dt>Chain</dt>
                <dd>
                  {atk.chain.count} jumps, ×{atk.chain.falloff}
                </dd>
              </>
            ) : null}
          </>
        ) : (
          <>
            <dt>Attack</dt>
            <dd className="muted">none</dd>
          </>
        )}
        {resists.length > 0 && (
          <>
            <dt>Resists</dt>
            <dd>
              {resists.map(([el, v]) => (
                <span key={el} style={{ color: ELEMENT_COLORS[el], marginRight: 6 }}>
                  {el} {v >= 1 ? "(immune)" : `${Math.round(v * 100)}%`}
                </span>
              ))}
            </dd>
          </>
        )}
        {weaknesses.length > 0 && (
          <>
            <dt>Weak to</dt>
            <dd>
              {weaknesses.map(([el, v]) => (
                <span key={el} style={{ color: ELEMENT_COLORS[el], marginRight: 6 }}>
                  {el} (+{Math.round(-v * 100)}% taken)
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>
      {(atk?.onHit?.length || atk?.bonusVs?.length || def.traits?.length || def.immuneStatuses?.length) && (
        <ul className="effects">
          {atk?.onHit?.map((e, i) => <li key={`h${i}`}>On hit: {describeEffect(e)}</li>)}
          {atk?.bonusVs?.map((b, i) => (
            <li key={`b${i}`}>
              ×{b.mult} damage vs {[b.selector.hasTag, ...(b.selector.hasAnyTag ?? [])].filter(Boolean).join(" / ")}
            </li>
          ))}
          {def.traits?.map((t, i) => <li key={`t${i}`}>{describeTrait(t)}</li>)}
          {def.immuneStatuses?.length ? <li>Immune to {def.immuneStatuses.join(", ")}</li> : null}
        </ul>
      )}
      <div className="tags">
        {def.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
