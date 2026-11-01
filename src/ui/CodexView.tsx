import { useEffect, type ReactNode } from "react";
import { ELEMENT_COLORS, STATUSES, SURFACES, SURFACE_REACTIONS, UNIT_REACTIONS } from "../data/elements";
import { ROLES } from "../data/roles";
import { RULES } from "../data/rules";
import { TOWER_DEFS, towerDaze } from "../data/towers";
import { DEFAULT_UNITS } from "../data/units";
import { ELEMENTS, type Element, type StatusDef, type SurfaceDef, type UnitDef, type UnitReaction } from "../sim/types";
import { CodexLink, Linked } from "./codexLinks";
import { describeEffect } from "./describe";
import { Swatch } from "./UnitInfo";

// The rulebook, written for a brand-new player. Game screens don't explain rules: their keywords link
// here (#codex/<topic>, see codexLinks.tsx). Numbers come from the data files, so they stay current.

const ELEMENT_INFO: Record<Element, string> = {
  physical:
    "Swords, arrows, claws and boulders. Most attacks are physical, and armor (physical resistance) is common, so tough units shrug a lot of it off. A physical hit shatters a Frozen target.",
  fire: "Fire goes straight through armor, and many big creatures take extra fire damage. It lights oil and stops most regeneration while a unit is Burning. Fire doesn't melt ice or dry anything off: it just burns, until water puts it out.",
  water: "Water soaks its targets. Wet on its own does nothing, but it sets up lightning and frost. Water also puts out fires.",
  frost: "Frost chills its targets, slowing them down. Hit a Chilled or Wet target with frost and it freezes solid, ready to shatter.",
  lightning: "Lightning can jump from target to target. It hits Wet targets twice as hard, electrifies puddles, lights oil and shatters Frozen targets.",
};

const STATUS_INFO: Record<string, string> = {
  wet: "Soaked by water. It sets up lightning and frost.",
  burning: "On fire. A Burning unit also can't regenerate, unless it has learned to.",
  chilled: "Slowed by the cold. Another frost hit freezes it.",
  frozen: "Frozen solid. The next physical or lightning hit shatters it for double damage.",
  shocked: "A flicker of stun from lightning.",
  oiled: "Covered in oil. Fire or lightning ignites it for a burst of extra fire damage.",
  dazed: "Shaken. When a Keep falls its whole army is Dazed, and a few attacks daze whatever they hit.",
};

const SURFACE_INFO: Record<string, string> = {
  puddle: "Standing water. It soaks anyone who stands in it.",
  shockwater: "A puddle struck by lightning. The charge spreads through the whole connected puddle.",
  ice: "Frozen water. It chills anyone on it, and melts back into a puddle when it runs out.",
  fire: "Burning ground. It spreads through oil and burns whoever stands in it, on either side.",
  steam: "Water poured onto burning ground. Units inside can't be targeted from range, and the steam scalds them.",
  oil: "Slick oil. It slows units down, and fire or lightning turns all of it into burning ground.",
};

const pct = (m: number) => `${Math.round(m * 100)}%`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function statusSummary(s: StatusDef): string {
  const bits: string[] = [];
  if (s.stun) bits.push("can't move or attack");
  if (s.moveMult) bits.push(`moves at ${pct(s.moveMult)} speed`);
  if (s.attackMult) bits.push(`attacks at ${pct(s.attackMult)} speed`);
  if (s.dps) bits.push(`takes ${s.dps.amount} ${s.dps.element} damage a second`);
  if (s.damageDealtMult !== undefined) bits.push(`deals only ${pct(s.damageDealtMult)} damage`);
  if (s.damageTakenMult !== undefined) bits.push(`takes ×${s.damageTakenMult} damage`);
  return bits.length ? `${cap(bits.join(", "))}, for ${s.duration}s.` : `Lasts ${s.duration}s.`;
}

function surfaceSummary(s: SurfaceDef): string {
  const bits = [`Lasts ${s.duration}s${s.revertTo ? `, then turns back into ${SURFACES[s.revertTo].name.toLowerCase()}` : ""}.`];
  const tick = [...(s.onTick ?? []).map(describeEffect), s.moveMult && `moves at ${pct(s.moveMult)} speed`].filter(Boolean);
  if (tick.length) bits.push(`Every half second, anyone standing in it: ${tick.join(", ")}.`);
  if (s.blocksRanged) bits.push("Units inside can't be targeted from range.");
  return bits.join(" ");
}

function reactionResult(r: UnitReaction): string {
  return [
    r.damageMult && `×${r.damageMult} damage`,
    r.bonusDamage && `+${r.bonusDamage.amount} ${r.bonusDamage.element} damage`,
    r.addStatus && `becomes ${STATUSES[r.addStatus.status].name}`,
    r.removeStatus && !r.addStatus && `removes ${STATUSES[r.status].name}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function El({ e }: { e: Element | null }) {
  if (!e) return <span className="muted">—</span>;
  return (
    <CodexLink topic={`element-${e}`} className="kw el-link">
      <span style={{ color: ELEMENT_COLORS[e] }}>{e}</span>
    </CodexLink>
  );
}

function Chip({ color, label, topic }: { color: string; label: string; topic: string }) {
  return (
    <CodexLink topic={topic} className="chip">
      <span className="chip-dot" style={{ background: color }} />
      {label}
    </CodexLink>
  );
}

function UnitChips({ units, label }: { units: UnitDef[]; label: string }) {
  if (!units.length) return null;
  return (
    <div className="unit-chips">
      <span className="muted small">{label}</span>
      {units.map((u) => (
        <span key={u.id} className="unit-chip">
          <Swatch def={u} size={16} /> {u.name}
        </span>
      ))}
    </div>
  );
}

function Entry({ id, title, focus, children }: { id: string; title: ReactNode; focus?: string; children: ReactNode }) {
  return (
    <section id={`codex-${id}`} className={`codex-entry ${focus === id ? "focus" : ""}`}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}

const hasRole = (id: string) => DEFAULT_UNITS.filter((u) => u.tags.includes(`role:${id}`));
const hitsAir = DEFAULT_UNITS.filter((u) => u.attack?.targets.includes("air"));

const CONTENTS: { title: string; items: [string, string][] }[] = [
  {
    title: "The Compact",
    items: [
      ["compact", "How a match works"],
      ["rounds", "Rounds and HP"],
      ["layers", "Ground and air"],
      ["keeps", "Keeps"],
      ["friendly-fire", "Who gets hurt"],
    ],
  },
  {
    title: "Your army",
    items: [
      ["unlocks", "Unlocks"],
      ["upgrades", "Upgrades"],
      ["veterancy", "Veterans"],
      ["opening", "The opening offer"],
    ],
  },
  { title: "Roles", items: Object.entries(ROLES).map(([id, r]) => [`role-${id}`, r.name]) },
  { title: "Elements", items: [["resistance", "Resistance"], ...ELEMENTS.map((e): [string, string] => [`element-${e}`, cap(e)])] },
  { title: "Statuses", items: Object.values(STATUSES).map((s): [string, string] => [`status-${s.id}`, s.name]) },
  { title: "Surfaces", items: [...Object.values(SURFACES).map((s): [string, string] => [`surface-${s.id}`, s.name]), ["reactions", "Reactions"]] },
];

export function CodexView({ topic }: { topic?: string }) {
  useEffect(() => {
    if (topic) document.getElementById(`codex-${topic}`)?.scrollIntoView({ block: "start" });
  }, [topic]);

  const keep = TOWER_DEFS[0];
  const loss = (supply: number) => Math.round(supply * RULES.damagePerSupply);

  return (
    <div className="page codex">
      <h2>Codex</h2>
      <p className="lede">
        Everything a new Warden needs to know about the Field. Underlined words elsewhere in the game link to their entry here.
      </p>

      <nav className="codex-toc" aria-label="Contents">
        {CONTENTS.map((g) => (
          <div key={g.title} className="toc-group">
            <span className="toc-title">{g.title}</span>
            {g.items.map(([id, label]) => (
              <CodexLink key={id} topic={id} className={`toc-link ${topic === id ? "active" : ""}`}>
                {label}
              </CodexLink>
            ))}
          </div>
        ))}
      </nav>

      <h3>The Compact</h3>
      <Entry id="compact" title="How a match works" focus={topic}>
        <p>
          Generations ago, the three peoples fought a war that nearly wrecked the world. It ended in a treaty, the Compact. Now every dispute
          is settled on the Field, under the same rules for everyone.
        </p>
        <ol>
          <li>
            <b>Recruit.</b> Spend supply on squads from the sidebar.
          </li>
          <li>
            <b>Place.</b> Put them in your blue zone, the back {RULES.deployDepth} rows of the Field. <kbd>R</kbd> rotates a squad,{" "}
            <kbd>Ctrl+Z</kbd> undoes a purchase.
          </li>
          <li>
            <b>Hands off.</b> When the horn sounds, the battle plays itself, for up to {RULES.battleTimeLimit} seconds. A side loses the
            battle when its whole army is gone. You never control units in a fight: the skill is in what you pick and where you put it.
          </li>
        </ol>
      </Entry>
      <Entry id="rounds" title="Rounds and HP" focus={topic}>
        <ul>
          <li>
            Your army stays for the whole match. Squads from earlier rounds are <b>locked</b> where you put them, and each round you add more.
            Every unit is fully restored after each battle.
          </li>
          <li>
            While you build, you see the enemy&apos;s army <b>as it stood last round</b>, plus their unlocks and upgrades. You never see
            what they&apos;re adding right now, and they never see yours. Guess their answer to your army, and answer that.
          </li>
          <li>
            Supply: round 1&apos;s comes from your <CodexLink topic="opening">opening</CodexLink>, then {RULES.income(2)} in round 2,{" "}
            {RULES.income(3)} in round 3, and 100 more each round after.
            Anything you don&apos;t spend carries over.
          </li>
          <li>
            The loser of a battle loses HP: {RULES.damagePerSquad} for every enemy squad still standing, plus {loss(100)} for every 100
            supply of them still alive. If time runs out, both sides lose HP for the other&apos;s survivors. Each side starts with{" "}
            {RULES.startHp} HP, and the first to reach 0 loses the match.
          </li>
        </ul>
      </Entry>
      <Entry id="layers" title="Ground and air" focus={topic}>
        <p>
          The Field has two layers. Most units walk on the ground. <CodexLink topic="role-flier">Fliers</CodexLink> move above it: they
          pass over ground units and ignore everything on the ground.
        </p>
        <p>
          Every attack hits the ground, the air, or both, and each unit&apos;s card says which. If the enemy flies and your army can only
          hit the ground, you can&apos;t win that fight.
        </p>
        <UnitChips units={hitsAir} label="Can hit air:" />
      </Entry>
      <Entry id="keeps" title="Keeps" focus={topic}>
        <p>
          Each side has two Keeps near the back of its zone ({keep.hp} HP, no weapons). Keeps don&apos;t count toward winning a battle, but
          when one falls, its owner&apos;s <b>whole army</b> is <CodexLink topic="status-dazed">Dazed</CodexLink> for {towerDaze(0)}s. A
          single raider that slips around the flank and topples a Keep can swing the main fight.
        </p>
        <p>
          Guard your flanks, or buy insurance in the Upgrades tab: each tower level costs {RULES.towerUpgradeCosts.join(" / ")}, adds{" "}
          {RULES.towerHpPerLevel.toLocaleString("en-US")} HP and shortens the Daze by {RULES.towerDazePerLevel}s (to at least {RULES.towerDazeMin}s).
        </p>
      </Entry>
      <Entry id="friendly-fire" title="Who gets hurt" focus={topic}>
        <p>
          Attacks, and the splash around them, only hurt enemies. Everything elemental is <b>neutral</b>: statuses, surfaces and reactions
          hit whoever is there, your own troops included. Your fire can burn your own knights, and the enemy&apos;s lightning can
          electrify a puddle you made. The battle report counts this as friendly fire.
        </p>
      </Entry>

      <h3>Your army</h3>
      <Entry id="unlocks" title="Unlocks" focus={topic}>
        <p>
          Every unit has a one-time <b>unlock</b> price per match (🔒 in the recruit list), and then its normal price per squad. Your
          opening pack unlocks two for free. Switching to a perfect counter costs more than adding to what you already have. You can
          see which units the enemy has unlocked.
        </p>
      </Entry>
      <Entry id="upgrades" title="Upgrades" focus={topic}>
        <p>
          Every unit has four upgrades. An upgrade changes <b>every</b> squad of that unit, including the ones already on the Field. They
          cost {RULES.upgradeCosts.join(" / ")} in the order you buy them, whatever the unit, so each one turns the unit into a more
          expensive specialist. The enemy&apos;s upgrades show beside their health bar.
        </p>
      </Entry>
      <Entry id="veterancy" title="Veterans" focus={topic}>
        <p>
          Squads earn XP for the damage they deal and the healing they do. At {RULES.levelXp.map((x) => x.toLocaleString("en-US")).join(" / ")}{" "}
          total XP a squad earns level 2 / 3 / 4 / 5, and a gold ▲ appears over it. Each level takes many more good fights than the last. Click it and pay half the unit&apos;s price to promote it: a level-N squad has N× the HP
          and damage. A squad can only hold one unpaid level, so XP beyond it is lost until you promote.
        </p>
      </Entry>
      <Entry id="opening" title="The opening offer" focus={topic}>
        <p>
          Nothing is unlocked when a match starts. In round 1 you pick one of {RULES.openingChoices} <b>packs</b>, or the war chest.
          A pack is two units, both unlocked, with {RULES.openingPackValue} supply&apos;s worth of their squads already placed for you
          (move them as you like, but they can&apos;t be sold), plus {RULES.openingPackSupply} supply to spend. The war chest is{" "}
          {RULES.openingFlat} supply and nothing unlocked: a little less once you pay for two unlocks, but you build exactly what
          you want. Both sides are offered the same packs, so you can guess what the enemy might start with.
        </p>
      </Entry>

      <h3>Roles</h3>
      <p className="muted">Roles say what a unit is for. Each unit has two to four.</p>
      <div className="codex-cards">
        {Object.entries(ROLES).map(([id, r]) => (
          <Entry key={id} id={`role-${id}`} title={<span className="role">{r.name}</span>} focus={topic}>
            <p>
              <Linked text={r.detail} except={`role-${id}`} />
            </p>
            <UnitChips units={hasRole(id)} label="Units:" />
          </Entry>
        ))}
      </div>

      <h3>Elements</h3>
      <Entry id="resistance" title="Resistance" focus={topic}>
        <p>
          Every hit has an element. A unit&apos;s card lists its <b>resistances</b> (it takes less of that element) and{" "}
          <b>weaknesses</b> (it takes more). Armor is physical resistance: arrows bounce off Knights, but fire goes straight through.
        </p>
      </Entry>
      <div className="codex-cards">
        {ELEMENTS.map((e) => {
          const reactions = UNIT_REACTIONS.filter((r) => r.name && r.element === e);
          return (
            <Entry key={e} id={`element-${e}`} title={<span style={{ color: ELEMENT_COLORS[e] }}>{cap(e)}</span>} focus={topic}>
              <p>
                <Linked text={ELEMENT_INFO[e]} except={`element-${e}`} />
              </p>
              {reactions.length > 0 && (
                <ul className="reaction-list">
                  {reactions.map((r, i) => (
                    <li key={i}>
                      On <Chip color={STATUSES[r.status].color} label={STATUSES[r.status].name} topic={`status-${r.status}`} />:{" "}
                      <b>{r.name}</b> <span className="muted">{reactionResult(r)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <UnitChips units={DEFAULT_UNITS.filter((u) => u.attack?.element === e)} label="Attacks with it:" />
            </Entry>
          );
        })}
      </div>

      <h3>Statuses</h3>
      <p className="muted">
        Statuses stick to a unit for a few seconds. Applying one counts as its element hitting the unit, so statuses trigger{" "}
        <CodexLink topic="reactions">reactions</CodexLink>. Like everything elemental, they land on <CodexLink topic="friendly-fire">both
        sides</CodexLink>.
      </p>
      <div className="codex-cards">
        {Object.values(STATUSES).map((s) => {
          const reactions = UNIT_REACTIONS.filter((r) => r.name && r.status === s.id);
          return (
            <Entry key={s.id} id={`status-${s.id}`} title={<span style={{ color: s.color }}>{s.name}</span>} focus={topic}>
              <p>
                <Linked text={STATUS_INFO[s.id] ?? ""} except={`status-${s.id}`} /> {statusSummary(s)}
              </p>
              {reactions.length > 0 && (
                <ul className="reaction-list">
                  {reactions.map((r, i) => (
                    <li key={i}>
                      <El e={r.element} /> → <b>{r.name}</b> <span className="muted">{reactionResult(r)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Entry>
          );
        })}
      </div>

      <h3>Surfaces</h3>
      <p className="muted">
        Surfaces lie on the ground and affect ground units standing in them, on both sides. Fliers ignore them. Only some upgrades create
        surfaces, so the ground fills up only when someone chooses it.
      </p>
      <div className="codex-cards">
        {Object.values(SURFACES).map((s) => {
          const reactions = SURFACE_REACTIONS.filter((r) => r.surface === s.id);
          return (
            <Entry key={s.id} id={`surface-${s.id}`} title={<span style={{ color: s.color }}>{s.name}</span>} focus={topic}>
              <p>
                <Linked text={SURFACE_INFO[s.id] ?? ""} except={`surface-${s.id}`} /> <Linked text={surfaceSummary(s)} except={`surface-${s.id}`} />
              </p>
              {reactions.length > 0 && (
                <ul className="reaction-list">
                  {reactions.map((r, i) => (
                    <li key={i}>
                      <El e={r.element} /> →{" "}
                      {r.becomes ? <Chip color={SURFACES[r.becomes].color} label={SURFACES[r.becomes].name} topic={`surface-${r.becomes}`} /> : "nothing"}
                      {r.spread && <span className="muted"> (spreads through the connected area)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Entry>
          );
        })}
      </div>

      <Entry id="reactions" title="Reactions" focus={topic}>
        <p>
          When an element hits a unit that already has a status, or ground that already has a surface, they react. Putting one surface onto
          another counts as its element hitting it: a puddle poured onto fire becomes steam.
        </p>
        <div className="codex-tables">
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
                    <Chip color={STATUSES[r.status].color} label={STATUSES[r.status].name} topic={`status-${r.status}`} />
                  </td>
                  <td>
                    <b>{r.name}</b> <span className="muted">{reactionResult(r)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="ref">
            <thead>
              <tr>
                <th>Element</th>
                <th>hits the ground</th>
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
                    <Chip color={SURFACES[r.surface].color} label={SURFACES[r.surface].name} topic={`surface-${r.surface}`} />
                  </td>
                  <td>
                    {r.becomes ? (
                      <Chip color={SURFACES[r.becomes].color} label={SURFACES[r.becomes].name} topic={`surface-${r.becomes}`} />
                    ) : (
                      <span className="muted">nothing</span>
                    )}
                    {r.spread && <span className="muted"> (spreads)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Entry>
    </div>
  );
}
