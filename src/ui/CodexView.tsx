import { ELEMENT_COLORS, STATUSES, SURFACES, SURFACE_REACTIONS, UNIT_REACTIONS } from "../data/elements";
import { RULES } from "../data/rules";
import type { Element } from "../sim/types";
import { describeEffect } from "./describe";

function El({ e }: { e: Element | null }) {
  if (!e) return <span className="muted">—</span>;
  return <span style={{ color: ELEMENT_COLORS[e] }}>{e}</span>;
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <span className="chip">
      <span className="chip-dot" style={{ background: color }} />
      {label}
    </span>
  );
}

// Read-only reference for the elemental rules (edit src/data/elements.ts for now).
export function CodexView() {
  return (
    <div className="codex">
      <h2>Codex</h2>
      <p className="muted">
        Elements meet statuses on units and surfaces on the ground. Main attack damage only hits enemies, but statuses, surfaces and
        reactions are neutral: they affect {RULES.elementalFriendlyFire ? "both sides" : "only enemies"}. Fliers ignore surfaces. These
        tables live in <code>src/data/elements.ts</code>.
      </p>

      <div className="codex-grid">
        <section>
          <h3>Unit reactions</h3>
          <table className="ref">
            <thead>
              <tr>
                <th>Element</th>
                <th>hits a unit that is</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {UNIT_REACTIONS.filter((r) => r.name).map((r, i) => (
                <tr key={i}>
                  <td>
                    <El e={r.element} />
                  </td>
                  <td>
                    <Chip color={STATUSES[r.status].color} label={STATUSES[r.status].name} />
                  </td>
                  <td>
                    <b>{r.name}</b>{" "}
                    <span className="muted">
                      {[
                        r.damageMult && `×${r.damageMult} damage`,
                        r.bonusDamage && `+${r.bonusDamage.amount} ${r.bonusDamage.element}`,
                        r.addStatus && `→ ${STATUSES[r.addStatus.status].name}`,
                        r.removeStatus && `removes ${STATUSES[r.status].name}`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3>Surface reactions</h3>
          <table className="ref">
            <thead>
              <tr>
                <th>Element</th>
                <th>hits</th>
                <th>Becomes</th>
              </tr>
            </thead>
            <tbody>
              {SURFACE_REACTIONS.map((r, i) => (
                <tr key={i}>
                  <td>
                    <El e={r.element} />
                  </td>
                  <td>
                    <Chip color={SURFACES[r.surface].color} label={SURFACES[r.surface].name} />
                  </td>
                  <td>
                    {r.becomes ? <Chip color={SURFACES[r.becomes].color} label={SURFACES[r.becomes].name} /> : <span className="muted">nothing</span>}{" "}
                    {r.spread && <span className="muted">(spreads through connected cells)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Placing a surface onto another counts as its element hitting it: a puddle poured onto fire makes steam.
          </p>
        </section>

        <section>
          <h3>Statuses</h3>
          <table className="ref">
            <tbody>
              {Object.values(STATUSES).map((s) => (
                <tr key={s.id}>
                  <td>
                    <Chip color={s.color} label={s.name} />
                  </td>
                  <td>
                    <El e={s.element} />
                  </td>
                  <td className="muted">
                    {[
                      `${s.duration}s`,
                      s.stun && "stunned",
                      s.moveMult && `move ×${s.moveMult}`,
                      s.attackMult && `attack rate ×${s.attackMult}`,
                      s.dps && `${s.dps.amount} ${s.dps.element}/s`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3>Surfaces</h3>
          <table className="ref">
            <tbody>
              {Object.values(SURFACES).map((s) => (
                <tr key={s.id}>
                  <td>
                    <Chip color={s.color} label={s.name} />
                  </td>
                  <td>
                    <El e={s.element} />
                  </td>
                  <td className="muted">
                    {[
                      `${s.duration}s${s.revertTo ? ` → ${SURFACES[s.revertTo].name}` : ""}`,
                      ...(s.onTick ?? []).map(describeEffect),
                      s.moveMult && `move ×${s.moveMult}`,
                      s.blocksRanged && "blocks ranged targeting",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
