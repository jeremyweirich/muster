import type { ReactNode } from "react";
import { ELEMENT_COLORS } from "../data/elements";
import { RULES } from "../data/rules";
import { rolesOf } from "../data/roles";
import { ICONS, type IconDef, type IconId } from "../render/icons";
import { describeSelector } from "../sim/selectors";
import type { Element, UnitDef } from "../sim/types";
import { derived, describeEffect, describeTrait, describeUpgrade } from "./describe";

export function Swatch({ def, size = 22 }: { def: UnitDef; size?: number }) {
  const icon = def.look.icon && def.look.icon in ICONS ? ICONS[def.look.icon as IconId] : null;
  const fit = def.look.shape === "diamond" || def.look.shape === "triangle" ? 0.55 : 0.72;
  return (
    <span
      className={`swatch shape-${def.look.shape}`}
      style={{ width: size, height: size, background: def.look.color, fontSize: size * 0.55 }}
    >
      {icon ? <IconSvg icon={icon} size={size * fit} nudge={def.look.shape === "triangle" ? size * 0.12 : 0} /> : def.look.glyph}
    </span>
  );
}

function IconSvg({ icon, size, nudge }: { icon: IconDef; size: number; nudge: number }) {
  const color = "rgba(14,17,21,0.82)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ marginTop: nudge }} aria-hidden="true">
      {icon.fill?.map((d, i) => <path key={`f${i}`} d={d} fill={color} fillRule="evenodd" />)}
      {icon.stroke?.map((s, i) => (
        <path key={`s${i}`} d={s.d} fill="none" stroke={color} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export function RoleChips({ tags, detailed }: { tags: string[]; detailed?: boolean }) {
  const roles = rolesOf(tags);
  if (!roles.length) return null;
  if (detailed) {
    return (
      <ul className="roles-detailed">
        {roles.map((r) => (
          <li key={r.id}>
            <span className="role">{r.name}</span> <span className="muted small">{r.description}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="roles">
      {roles.map((r) => (
        <span key={r.id} className="role" title={r.description}>
          {r.name}
        </span>
      ))}
    </div>
  );
}

export function UnitInfo({
  def,
  owned,
  detailedRoles,
  upgradeAction,
}: {
  def: UnitDef;
  owned?: string[];
  detailedRoles?: boolean;
  upgradeAction?: (upgradeId: string) => ReactNode;
}) {
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
            {(def.level ?? 1) > 1 && <span className="vet-level"> · level {def.level}</span>}
          </div>
        </div>
      </div>
      <RoleChips tags={def.tags} detailed={detailedRoles} />
      {def.description && <p className="muted small">{def.description}</p>}
      <dl className="stats">
        <dt>HP</dt>
        <dd>
          {Math.round(def.hp)} <span className="muted">({Math.round(d.squadHp)} squad)</span>
        </dd>
        <dt>Speed</dt>
        <dd>
          {Math.round(def.speed)} <span className="muted">({(def.speed * RULES.speedScale).toFixed(1)} tiles/s)</span>
        </dd>
        {atk ? (
          <>
            <dt>Attack</dt>
            <dd>
              <span style={{ color: ELEMENT_COLORS[atk.element] }}>
                {Math.round(atk.damage)} {atk.element}
              </span>{" "}
              / {+atk.cooldown.toFixed(2)}s
            </dd>
            <dt>DPS</dt>
            <dd>
              {d.modelDps.toFixed(0)} <span className="muted">({d.squadDps.toFixed(0)} squad)</span>
            </dd>
            <dt>Range</dt>
            <dd>
              {+atk.range.toFixed(1)} · hits {atk.targets.join(" + ")}
            </dd>
            {atk.splash ? (
              <>
                <dt>Splash</dt>
                <dd>{+atk.splash.toFixed(1)}</dd>
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
      {(atk?.onHit?.length || atk?.bonusVs?.length || atk?.rangeVs?.length || atk?.prefers || atk?.selfDestruct || atk?.targeting === "towers" || def.traits?.length || def.immuneStatuses?.length) && (
        <ul className="effects">
          {atk?.onHit?.map((e, i) => <li key={`h${i}`}>On hit: {describeEffect(e)}</li>)}
          {atk?.bonusVs?.map((b, i) => (
            <li key={`b${i}`}>
              ×{b.mult} damage vs {describeSelector(b.selector)}
            </li>
          ))}
          {atk?.rangeVs?.map((r, i) => (
            <li key={`r${i}`}>
              +{r.add} range vs {describeSelector(r.selector)}
            </li>
          ))}
          {atk?.targeting === "towers" && <li>Hunts towers first</li>}
          {atk?.prefers && <li>Hunts {describeSelector(atk.prefers)} first</li>}
          {atk?.selfDestruct && <li>Blows itself up on its first attack</li>}
          {def.traits?.map((t, i) => <li key={`t${i}`}>{describeTrait(t)}</li>)}
          {def.immuneStatuses?.length ? <li>Immune to {def.immuneStatuses.join(", ")}</li> : null}
        </ul>
      )}
      {def.upgrades?.length ? (
        <div className="upgrade-list">
          <div className="muted small">Upgrades</div>
          {def.upgrades.map((u) => (
            <div key={u.id} className={`upgrade-preview ${owned?.includes(u.id) ? "owned" : ""}`}>
              <div className="upgrade-head">
                <b>
                  {owned?.includes(u.id) ? "✓ " : ""}
                  {u.name}
                </b>
                {upgradeAction?.(u.id)}
              </div>
              <span className="small">{u.description}</span>
              <div className="muted small">{describeUpgrade(u).join(" · ")}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="tags">
        {def.tags
          .filter((t) => !t.startsWith("role:"))
          .map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
      </div>
    </div>
  );
}
