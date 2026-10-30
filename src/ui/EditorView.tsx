import { useMemo, useRef, useState } from "react";
import { STATUSES } from "../data/elements";
import { defMap } from "../game/army";
import { massArmy, runArmies } from "../game/lab";
import { drawBackground } from "../render/draw";
import { Battle } from "../sim/battle";
import { Rng } from "../sim/rng";
import { ELEMENTS, type AttackDef, type Element, type Layer, type ModStat, type Shape, type StatusId, type Targeting, type TraitDef, type UnitDef, type UpgradeDef } from "../sim/types";
import { applyUpgrades } from "../sim/upgrades";
import { roster, useRoster, validateRoster } from "../store/roster";
import { useBattlePlayer } from "./battlePlayer";
import { FieldCanvas } from "./FieldCanvas";
import { Checks, ConfirmButton, defaultEffect, EffectEditor, Num, Pick, Row, Section, SelectorEditor, Text } from "./fields";
import { Swatch, UnitInfo } from "./UnitInfo";
import { derived } from "./describe";

const SHAPES: Shape[] = ["circle", "square", "triangle", "diamond", "hex"];
const STATUS_IDS = Object.keys(STATUSES) as StatusId[];
const TRAIT_TYPES = ["aura", "onDeath", "regen", "periodic", "retaliate", "charge"] as const;
const MOD_STATS: ModStat[] = ["hp", "speed", "size", "spacing", "squadSize", "damage", "cooldown", "range", "splash", "chainCount"];
const TARGETINGS = ["nearest", "highestHp", "lowestHp", "towers"] as const;

const DEFAULT_ATTACK: AttackDef = {
  damage: 20, element: "physical", cooldown: 1, range: 0.5,
  targets: ["ground"], targeting: "nearest", delivery: "instant",
};

function blankUnit(units: UnitDef[]): UnitDef {
  let n = 1;
  while (units.some((u) => u.id === `new_unit_${n}`)) n++;
  return {
    id: `new_unit_${n}`,
    name: `New Unit ${n}`,
    cost: 100,
    squadSize: 4,
    footprint: { w: 2, h: 2 },
    layer: "ground",
    hp: 200,
    speed: 10,
    size: 0.3,
    attack: { ...DEFAULT_ATTACK },
    tags: [],
    look: { shape: "circle", color: "#d4a5ff" },
  };
}

function defaultTrait(type: TraitDef["type"]): TraitDef {
  switch (type) {
    case "aura":
      return { type, radius: 3, selector: { side: "ally" }, attackSpeed: 1.2 };
    case "onDeath":
      return { type, effects: [defaultEffect("damage")] };
    case "regen":
      return { type, perSecond: 5 };
    case "periodic":
      return { type, interval: 3, effects: [defaultEffect("surface")] };
    case "retaliate":
      return { type, effects: [{ type: "status", status: "chilled" }] };
    case "charge":
      return { type, mult: 3 };
  }
}

export function EditorView() {
  const units = useRoster();
  const [selectedId, setSelectedId] = useState<string>(units[0]?.id ?? "");
  const [idDraft, setIdDraft] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showRoster, setShowRoster] = useState(false);
  const unit = units.find((u) => u.id === selectedId) ?? units[0];
  const allTags = useMemo(() => [...new Set(units.flatMap((u) => u.tags))].sort(), [units]);

  const update = (patch: Partial<UnitDef>) => unit && roster.upsert({ ...unit, ...patch }, unit.id);
  const updateAttack = (patch: Partial<AttackDef>) => unit?.attack && update({ attack: { ...unit.attack, ...patch } });
  const setTraits = (traits: TraitDef[]) => update({ traits: traits.length ? traits : undefined });

  const commitId = () => {
    if (idDraft === null || !unit) return;
    const id = idDraft.trim().replace(/\s+/g, "_");
    if (id && id !== unit.id && !units.some((u) => u.id === id)) {
      roster.upsert({ ...unit, id }, unit.id);
      setSelectedId(id);
    }
    setIdDraft(null);
  };

  const create = (def: UnitDef) => {
    roster.set([...units, def]);
    setSelectedId(def.id);
  };

  const duplicate = () => {
    if (!unit) return;
    let n = 2;
    while (units.some((u) => u.id === `${unit.id}_${n}`)) n++;
    create({ ...structuredClone(unit), id: `${unit.id}_${n}`, name: `${unit.name} ${n}` });
  };

  const remove = () => {
    if (!unit || units.length <= 1) return;
    const i = units.indexOf(unit);
    roster.remove(unit.id);
    setSelectedId(units[i === 0 ? 1 : i - 1].id);
  };

  if (!unit) return null;
  const atk = unit.attack;
  const d = derived(unit);

  return (
    <div className="editor">
      <datalist id="all-tags">
        {allTags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <aside className="panel unit-list">
        <div className="list-actions">
          <button className="primary" onClick={() => create(blankUnit(units))}>
            + New
          </button>
          <button onClick={duplicate}>Duplicate</button>
          <ConfirmButton label="Delete" confirmLabel="Really delete?" onConfirm={remove} disabled={units.length <= 1} />
        </div>
        <div className="list">
          {units.map((u) => (
            <button key={u.id} className={`list-item ${u.id === unit.id ? "active" : ""}`} onClick={() => setSelectedId(u.id)}>
              <Swatch def={u} size={18} />
              <span>{u.name}</span>
              <span className="muted">{u.cost}</span>
            </button>
          ))}
        </div>
        <div className="list-actions">
          <button className={showRoster ? "active" : ""} onClick={() => setShowRoster(!showRoster)}>
            Export / Import
          </button>
          <ConfirmButton
            label="Reset"
            confirmLabel="Reset all units?"
            onConfirm={() => {
              roster.reset();
              setSelectedId(roster.get()[0].id);
            }}
          />
        </div>
        <p className="hint">
          Edits are experiments: they apply to Play, the sandbox and the lab right away, and reset when you reload the page.
        </p>
      </aside>

      {showRoster ? (
        <RosterPanel units={units} onLoaded={(first) => setSelectedId(first)} onClose={() => setShowRoster(false)} />
      ) : (
      <div className="form">
        <div className="form-head">
          <Swatch def={unit} size={36} />
          <h2>{unit.name}</h2>
          <button className="ghost" onClick={() => setShowJson(!showJson)}>
            {showJson ? "Form" : "JSON"}
          </button>
        </div>

        {showJson ? (
          <div>
            <textarea
              className="json"
              key={unit.id}
              defaultValue={JSON.stringify(unit, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value) as UnitDef;
                  validateRoster([parsed]);
                  if (parsed.id !== unit.id && units.some((u) => u.id === parsed.id)) throw new Error("id already in use");
                  roster.upsert(parsed, unit.id);
                  if (parsed.id !== unit.id) setSelectedId(parsed.id);
                  setJsonError(null);
                } catch (err) {
                  setJsonError((err as Error).message);
                }
              }}
            />
            {jsonError && <p className="error">{jsonError}</p>}
          </div>
        ) : (
          <>
            <Section title="Identity">
              <Row label="Name">
                <Text value={unit.name} onChange={(name) => update({ name })} />
              </Row>
              <Row label="Id" hint="Unique key. Saved armies and the roster refer to units by id.">
                <input
                  type="text"
                  value={idDraft ?? unit.id}
                  onChange={(e) => setIdDraft(e.target.value)}
                  onBlur={commitId}
                  onKeyDown={(e) => e.key === "Enter" && commitId()}
                />
              </Row>
              <Row label="Description">
                <Text value={unit.description} onChange={(description) => update({ description })} />
              </Row>
              <Row label="Look">
                <input type="color" value={unit.look.color} onChange={(e) => update({ look: { ...unit.look, color: e.target.value } })} />
                <Pick value={unit.look.shape} options={SHAPES} onChange={(shape) => update({ look: { ...unit.look, shape } })} />
                <input
                  type="text"
                  className="glyph"
                  value={unit.look.glyph ?? ""}
                  placeholder="glyph"
                  onChange={(e) => update({ look: { ...unit.look, glyph: e.target.value || undefined } })}
                />
              </Row>
            </Section>

            <Section title="Squad">
              <Row label="Cost">
                <Num value={unit.cost} step={25} onChange={(cost) => update({ cost })} />
              </Row>
              <Row label="Unlock cost" hint="Paid once per match before the first purchase. 0 = available from the start">
                <Num value={unit.unlockCost ?? 0} step={25} onChange={(unlockCost) => update({ unlockCost: unlockCost || undefined })} />
              </Row>
              <Row label="Upgrade cost" hint="Price of the first upgrade bought; the second costs double. Blank = unit cost">
                <Num value={unit.upgradeCost} step={25} onChange={(upgradeCost) => update({ upgradeCost: upgradeCost || undefined })} />
              </Row>
              <Row label="Squad size" hint="Models per purchase">
                <Num value={unit.squadSize} min={1} onChange={(squadSize) => update({ squadSize: Math.max(1, Math.round(squadSize)) })} />
              </Row>
              <Row label="Footprint" hint="Deployment tiles (w × h). Players can rotate it when placing">
                <Num value={unit.footprint.w} min={1} onChange={(w) => update({ footprint: { ...unit.footprint, w: Math.max(1, Math.round(w)) } })} />
                ×
                <Num value={unit.footprint.h} min={1} onChange={(h) => update({ footprint: { ...unit.footprint, h: Math.max(1, Math.round(h)) } })} />
              </Row>
              <Row label="Layer" hint="Air units ignore ground surfaces and can only be hit by attacks that target air">
                <Pick value={unit.layer} options={["ground", "air"] as const} onChange={(layer) => update({ layer })} />
              </Row>
            </Section>

            <Section title="Body">
              <Row label="HP (per model)">
                <Num value={unit.hp} step={10} onChange={(hp) => update({ hp })} />
              </Row>
              <Row label="Speed" hint="Speed points: 10 ≈ 1.5 tiles per second">
                <Num value={unit.speed} step={1} onChange={(speed) => update({ speed })} />
              </Row>
              <Row label="Spacing" hint="Extra distance kept from allies while moving (tiles). Spreads the squad out against splash">
                <Num value={unit.spacing ?? 0} step={0.1} onChange={(spacing) => update({ spacing: spacing || undefined })} />
              </Row>
              <Row label="Size" hint="Model radius in tiles">
                <Num value={unit.size} step={0.05} onChange={(size) => update({ size })} />
              </Row>
              <Row label="Resist %" hint="Positive = takes less damage, negative = weakness. 100 = immune.">
                <span className="resists">
                  {ELEMENTS.map((el) => (
                    <span key={el} className="resist">
                      <span className={`el el-${el}`}>{el}</span>
                      <Num
                        value={Math.round((unit.resist?.[el] ?? 0) * 100)}
                        step={10}
                        onChange={(v) => {
                          const resist = { ...unit.resist, [el]: v / 100 };
                          if (!v) delete resist[el];
                          update({ resist: Object.keys(resist).length ? resist : undefined });
                        }}
                      />
                    </span>
                  ))}
                </span>
              </Row>
              <Row label="Immune to">
                <Checks
                  value={unit.immuneStatuses ?? []}
                  options={STATUS_IDS}
                  onChange={(v) => update({ immuneStatuses: v.length ? v : undefined })}
                />
              </Row>
            </Section>

            <Section
              title="Attack"
              right={
                <label className="check">
                  <input type="checkbox" checked={!!atk} onChange={(e) => update({ attack: e.target.checked ? { ...DEFAULT_ATTACK } : undefined })} />
                  has attack
                </label>
              }
            >
              {atk && (
                <>
                  <Row label="Damage">
                    <Num value={atk.damage} step={5} onChange={(damage) => updateAttack({ damage })} />
                    <Pick value={atk.element} options={ELEMENTS} onChange={(element) => updateAttack({ element })} />
                  </Row>
                  <Row label="Cooldown (s)">
                    <Num value={atk.cooldown} step={0.1} onChange={(cooldown) => updateAttack({ cooldown })} />
                  </Row>
                  <Row label="Range" hint="Gap between model edges, in tiles. Melee is ~0.5">
                    <Num value={atk.range} step={0.5} onChange={(range) => updateAttack({ range })} />
                  </Row>
                  <Row label="Can hit">
                    <Checks value={atk.targets} options={["ground", "air"] as const} onChange={(targets) => updateAttack({ targets })} />
                  </Row>
                  <Row label="Targeting">
                    <Pick value={atk.targeting} options={TARGETINGS} onChange={(targeting) => updateAttack({ targeting })} />
                  </Row>
                  <Row label="Delivery">
                    <Pick value={atk.delivery} options={["instant", "projectile", "beam"] as const} onChange={(delivery) => updateAttack({ delivery })} />
                    {atk.delivery === "projectile" && (
                      <>
                        <span className="mini">speed</span>
                        <Num value={atk.projectileSpeed ?? 10} onChange={(projectileSpeed) => updateAttack({ projectileSpeed })} />
                      </>
                    )}
                  </Row>
                  <Row label="Splash radius" hint="Main damage hits all enemies in this radius. 0 = single target">
                    <Num value={atk.splash ?? 0} step={0.1} onChange={(splash) => updateAttack({ splash: splash || undefined })} />
                  </Row>
                  <Row label="Chain">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={!!atk.chain}
                        onChange={(e) => updateAttack({ chain: e.target.checked ? { count: 2, range: 2.5, falloff: 0.8 } : undefined })}
                      />
                    </label>
                    {atk.chain && (
                      <>
                        <span className="mini">jumps</span>
                        <Num value={atk.chain.count} onChange={(count) => updateAttack({ chain: { ...atk.chain!, count } })} />
                        <span className="mini">range</span>
                        <Num value={atk.chain.range} step={0.5} onChange={(range) => updateAttack({ chain: { ...atk.chain!, range } })} />
                        <span className="mini">falloff</span>
                        <Num value={atk.chain.falloff} step={0.05} onChange={(falloff) => updateAttack({ chain: { ...atk.chain!, falloff } })} />
                      </>
                    )}
                  </Row>
                  <div className="sub">
                    <div className="sub-head">
                      <span>Bonus damage vs</span>
                      <button
                        className="small-btn"
                        onClick={() => updateAttack({ bonusVs: [...(atk.bonusVs ?? []), { selector: { hasTag: "size:large" }, mult: 1.5 }] })}
                      >
                        + add
                      </button>
                    </div>
                    {atk.bonusVs?.map((b, i) => (
                      <div key={i} className="sub-item">
                        <SelectorEditor
                          sel={b.selector}
                          onChange={(selector) => updateAttack({ bonusVs: atk.bonusVs!.map((x, j) => (j === i ? { ...x, selector } : x)) })}
                        />
                        <span className="mini">×</span>
                        <Num value={b.mult} step={0.1} onChange={(mult) => updateAttack({ bonusVs: atk.bonusVs!.map((x, j) => (j === i ? { ...x, mult } : x)) })} />
                        <button className="icon" onClick={() => updateAttack({ bonusVs: atk.bonusVs!.filter((_, j) => j !== i) })}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="sub">
                    <div className="sub-head">
                      <span>On-hit effects</span>
                      <span className="muted small">statuses & surfaces affect both sides</span>
                      <button className="small-btn" onClick={() => updateAttack({ onHit: [...(atk.onHit ?? []), defaultEffect("status")] })}>
                        + add
                      </button>
                    </div>
                    {atk.onHit?.map((e, i) => (
                      <EffectEditor
                        key={i}
                        effect={e}
                        onChange={(ne) => updateAttack({ onHit: atk.onHit!.map((x, j) => (j === i ? ne : x)) })}
                        onRemove={() => updateAttack({ onHit: atk.onHit!.filter((_, j) => j !== i) || undefined })}
                      />
                    ))}
                  </div>
                </>
              )}
            </Section>

            <Section
              title="Traits"
              right={
                <select value="" onChange={(e) => e.target.value && setTraits([...(unit.traits ?? []), defaultTrait(e.target.value as TraitDef["type"])])}>
                  <option value="">+ add trait…</option>
                  {TRAIT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              }
            >
              {(unit.traits ?? []).map((t, i) => (
                <TraitEditor
                  key={i}
                  trait={t}
                  onChange={(nt) => setTraits(unit.traits!.map((x, j) => (j === i ? nt : x)))}
                  onRemove={() => setTraits(unit.traits!.filter((_, j) => j !== i))}
                />
              ))}
              {!unit.traits?.length && <p className="muted small">No traits.</p>}
            </Section>

            <Section
              title="Upgrades"
              right={
                <button
                  className="small-btn"
                  onClick={() => update({ upgrades: [...(unit.upgrades ?? []), { id: `upgrade_${(unit.upgrades?.length ?? 0) + 1}`, name: "New Upgrade", mods: [{ stat: "hp", mult: 1.25 }] }] })}
                >
                  + add
                </button>
              }
            >
              <p className="muted small">
                One-time purchases per match that change every squad of this unit. The first one bought costs the upgrade cost, the second
                double. Aim for two with different personalities.
              </p>
              {(unit.upgrades ?? []).map((u, i) => (
                <UpgradeEditor
                  key={i}
                  up={u}
                  onChange={(nu) => update({ upgrades: unit.upgrades!.map((x, j) => (j === i ? nu : x)) })}
                  onRemove={() => update({ upgrades: unit.upgrades!.filter((_, j) => j !== i) })}
                />
              ))}
            </Section>

            <Section title="Tags">
              <TagEditor tags={unit.tags} onChange={(tags) => update({ tags })} />
              <p className="muted small">
                Use <code>category:value</code>: <code>faction:greenskin</code>, <code>race:goblin</code>, <code>size:large</code>. Role tags like{" "}
                <code>role:sturdy</code> describe what the unit is for and show up on hover in the recruit list (see the Codex for the list).
                Auras, bonus damage and (later) faction bonuses select units by tag.
              </p>
            </Section>
          </>
        )}
      </div>
      )}

      <aside className="panel preview">
        <UnitInfo def={unit} />
        <div className="derived">
          <div>
            <b>{d.hpPerCost.toFixed(1)}</b>
            <span>hp / supply</span>
          </div>
          <div>
            <b>{d.dpsPerCost.toFixed(1)}</b>
            <span>dps / 100 supply</span>
          </div>
        </div>
        <Sandbox unit={unit} units={units} />
      </aside>
    </div>
  );
}

// The whole roster as JSON: copy it out to keep it, or paste/load one in.
function RosterPanel({ units, onLoaded, onClose }: { units: UnitDef[]; onLoaded: (firstId: string) => void; onClose: () => void }) {
  const [text, setText] = useState(() => JSON.stringify(units, null, 2));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const canDownload = window.top === window;

  const load = (raw: string) => {
    try {
      const data = validateRoster(JSON.parse(raw));
      roster.set(data);
      onLoaded(data[0].id);
      setText(JSON.stringify(data, null, 2));
      setMsg({ ok: true, text: `Loaded ${data.length} units.` });
    } catch (e) {
      setMsg({ ok: false, text: `Could not load: ${(e as Error).message}. Check that it is a JSON array of units.` });
    }
  };

  return (
    <div className="form roster-panel">
      <div className="form-head">
        <h2>Roster JSON</h2>
        <button className="ghost" onClick={onClose}>
          Back to editor
        </button>
      </div>
      <p className="muted small">
        Copy this to share or keep an experiment, or paste a roster and press Load. Nothing here is saved; the built-in roster
        comes back on reload.
      </p>
      <div className="list-actions">
        <button
          className="primary"
          onClick={() => {
            navigator.clipboard.writeText(text).then(
              () => setMsg({ ok: true, text: "Copied to clipboard." }),
              () => {
                area.current?.select();
                setMsg({ ok: true, text: "Text selected. Press Ctrl/Cmd+C to copy." });
              },
            );
          }}
        >
          Copy
        </button>
        {canDownload && (
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
              a.download = "muster-roster.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Download
          </button>
        )}
        <button onClick={() => load(text)}>Load pasted JSON</button>
        <button onClick={() => fileInput.current?.click()}>Load file…</button>
        <button onClick={() => setText(JSON.stringify(roster.get(), null, 2))}>Refresh</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={async (e) => e.target.files?.[0] && load(await e.target.files[0].text())} />
      </div>
      {msg && <p className={msg.ok ? "small" : "error"}>{msg.text}</p>}
      <textarea ref={area} id="roster-json" className="json" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
    </div>
  );
}

function TraitEditor({ trait, onChange, onRemove }: { trait: TraitDef; onChange: (t: TraitDef) => void; onRemove: () => void }) {
  return (
    <div className="sub">
      <div className="sub-head">
        <b>{trait.type}</b>
        <button className="icon" onClick={onRemove}>
          ✕
        </button>
      </div>
      {trait.type === "aura" && (
        <>
          <Row label="Radius">
            <Num value={trait.radius} step={0.5} onChange={(radius) => onChange({ ...trait, radius })} />
          </Row>
          <Row label="Affects">
            <SelectorEditor sel={trait.selector} onChange={(selector) => onChange({ ...trait, selector })} />
          </Row>
          <Row label="Attack speed ×">
            <Num value={trait.attackSpeed ?? 1} step={0.05} onChange={(attackSpeed) => onChange({ ...trait, attackSpeed })} />
          </Row>
          <Row label="Move speed ×">
            <Num value={trait.moveSpeed ?? 1} step={0.05} onChange={(moveSpeed) => onChange({ ...trait, moveSpeed })} />
          </Row>
          <Row label="Damage ×">
            <Num value={trait.damage ?? 1} step={0.05} onChange={(damage) => onChange({ ...trait, damage })} />
          </Row>
        </>
      )}
      {trait.type === "regen" && (
        <Row label="HP / second">
          <Num value={trait.perSecond} onChange={(perSecond) => onChange({ ...trait, perSecond })} />
        </Row>
      )}
      {trait.type === "charge" && (
        <Row label="First hit ×">
          <Num value={trait.mult} step={0.5} onChange={(mult) => onChange({ ...trait, mult })} />
        </Row>
      )}
      {trait.type === "retaliate" && (
        <Row label="Max range" hint="Only attackers within this distance are affected. Blank = any">
          <Num value={trait.maxRange} step={0.5} onChange={(maxRange) => onChange({ ...trait, maxRange: maxRange || undefined })} />
        </Row>
      )}
      {(trait.type === "onDeath" || trait.type === "periodic" || trait.type === "retaliate") && (
        <>
          {trait.type === "periodic" && (
            <Row label="Interval (s)">
              <Num value={trait.interval} step={0.5} onChange={(interval) => onChange({ ...trait, interval })} />
            </Row>
          )}
          {trait.effects.map((e, i) => (
            <EffectEditor
              key={i}
              effect={e}
              onChange={(ne) => onChange({ ...trait, effects: trait.effects.map((x, j) => (j === i ? ne : x)) })}
              onRemove={() => onChange({ ...trait, effects: trait.effects.filter((_, j) => j !== i) })}
            />
          ))}
          <button className="small-btn" onClick={() => onChange({ ...trait, effects: [...trait.effects, defaultEffect("damage")] })}>
            + effect
          </button>
        </>
      )}
    </div>
  );
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft("");
  };
  return (
    <div className="tag-editor">
      {tags.map((t) => (
        <span key={t} className="tag">
          {t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))}>✕</button>
        </span>
      ))}
      <input
        type="text"
        list="all-tags"
        placeholder="add tag…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
        }}
        onBlur={add}
      />
    </div>
  );
}

// Watch the unit fight, or run a quick batch of headless sims.
function Sandbox({ unit: base, units }: { unit: UnitDef; units: UnitDef[] }) {
  const [opponent, setOpponent] = useState(units.find((u) => u.id !== base.id)?.id ?? base.id);
  const [budget, setBudget] = useState(800);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState<string | null>(null);
  const [ups, setUps] = useState<string[]>([]);
  const battle = useRef<Battle | null>(null);
  const player = useBattlePlayer();
  const opp = units.find((u) => u.id === opponent) ?? units[0];
  const unit = applyUpgrades(base, ups.filter((id) => base.upgrades?.some((u) => u.id === id)));

  const run = () => {
    const defs = defMap(units);
    const rng = new Rng(Date.now() & 0xffff);
    battle.current = new Battle(defs, [massArmy(unit, budget, 0, defs, rng), massArmy(opp, budget, 1, defs, rng)], {
      seed: rng.int(1e6),
      recordFx: true,
      towers: false,
    });
    player.reset();
    setStats(null);
  };

  const batch = () => {
    const defs = defMap(units);
    const r = runArmies(defs, (sideA, rng) => [massArmy(unit, budget, sideA, defs, rng), massArmy(opp, budget, sideA === 0 ? 1 : 0, defs, rng)], 10);
    setStats(
      `${unit.name} wins ${Math.round(r.winRate * 100)}% · keeps ${Math.round(r.remain[0] * 100)}% of its value vs ${Math.round(r.remain[1] * 100)}% · ~${r.time.toFixed(0)}s`,
    );
  };

  return (
    <div className="sandbox">
      <h4>Sandbox</h4>
      <div className="sandbox-controls">
        <Pick value={opponent} options={units.map((u) => u.id)} onChange={setOpponent} />
        <span className="mini">supply</span>
        <Num value={budget} step={100} onChange={setBudget} />
      </div>
      {base.upgrades?.length ? (
        <div className="sandbox-controls">
          <span className="mini">with</span>
          <Checks
            value={ups}
            options={base.upgrades.map((u) => u.id)}
            onChange={setUps}
          />
        </div>
      ) : null}
      <div className="sandbox-controls">
        <button className="primary" onClick={run}>
          Watch
        </button>
        <button onClick={batch}>Sim ×10</button>
        {[0.5, 1, 2, 4].map((s) => (
          <button key={s} className={`small-btn ${speed === s ? "active" : ""}`} onClick={() => setSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
      {stats && <p className="small">{stats}</p>}
      <FieldCanvas
        tile={12}
        className="field small-field"
        draw={(ctx, dt, t) => {
          if (battle.current) player.frame(ctx, battle.current, 12, dt, t, speed);
          else drawBackground(ctx, 12, { zones: true });
        }}
      />
      <p className="muted small">
        Your unit (blue, bottom) vs {opp.name} (red), equal supply. Edits apply to the next run.
      </p>
    </div>
  );
}

function UpgradeEditor({ up, onChange, onRemove }: { up: UpgradeDef; onChange: (u: UpgradeDef) => void; onRemove: () => void }) {
  const setMods = (mods: UpgradeDef["mods"]) => onChange({ ...up, mods: mods?.length ? mods : undefined });
  return (
    <div className="sub upgrade-editor">
      <div className="sub-head">
        <b>{up.name}</b>
        <button className="icon" onClick={onRemove} title="Remove upgrade">
          ✕
        </button>
      </div>
      <Row label="Name">
        <Text value={up.name} onChange={(name) => onChange({ ...up, name })} />
      </Row>
      <Row label="Id">
        <Text value={up.id} onChange={(id) => onChange({ ...up, id: id.replace(/\s+/g, "_") })} />
      </Row>
      <Row label="Description">
        <Text value={up.description} onChange={(description) => onChange({ ...up, description: description || undefined })} />
      </Row>
      <div className="sub-head">
        <span>Stat changes</span>
        <span className="muted small">value × mult + add</span>
        <button className="small-btn" onClick={() => setMods([...(up.mods ?? []), { stat: "damage", mult: 1.25 }])}>
          + add
        </button>
      </div>
      {(up.mods ?? []).map((m, i) => (
        <div key={i} className="sub-item">
          <Pick value={m.stat} options={MOD_STATS} onChange={(stat) => setMods(up.mods!.map((x, j) => (j === i ? { ...x, stat } : x)))} />
          <span className="mini">×</span>
          <Num value={m.mult ?? 1} step={0.05} onChange={(mult) => setMods(up.mods!.map((x, j) => (j === i ? { ...x, mult: mult === 1 ? undefined : mult } : x)))} />
          <span className="mini">+</span>
          <Num value={m.add ?? 0} step={0.1} onChange={(add) => setMods(up.mods!.map((x, j) => (j === i ? { ...x, add: add || undefined } : x)))} />
          <button className="icon" onClick={() => setMods(up.mods!.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <Row label="Attack element">
        <select value={up.element ?? ""} onChange={(e) => onChange({ ...up, element: (e.target.value || undefined) as Element | undefined })}>
          <option value="">unchanged</option>
          {ELEMENTS.map((el) => (
            <option key={el} value={el}>
              {el}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Targeting">
        <select value={up.targeting ?? ""} onChange={(e) => onChange({ ...up, targeting: (e.target.value || undefined) as Targeting | undefined })}>
          <option value="">unchanged</option>
          {TARGETINGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Can hit">
        <label className="check">
          <input type="checkbox" checked={!!up.targets} onChange={(e) => onChange({ ...up, targets: e.target.checked ? ["ground", "air"] : undefined })} />
          override
        </label>
        {up.targets && <Checks value={up.targets} options={["ground", "air"] as Layer[]} onChange={(targets) => onChange({ ...up, targets })} />}
      </Row>
      <Row label="Resist % added">
        <span className="resists">
          {ELEMENTS.map((el) => (
            <span key={el} className="resist">
              <span className={`el el-${el}`}>{el}</span>
              <Num
                value={Math.round((up.resist?.[el] ?? 0) * 100)}
                step={10}
                onChange={(v) => {
                  const resist = { ...up.resist, [el]: v / 100 };
                  if (!v) delete resist[el];
                  onChange({ ...up, resist: Object.keys(resist).length ? resist : undefined });
                }}
              />
            </span>
          ))}
        </span>
      </Row>
      <div className="sub-head">
        <span>Extra on-hit effects</span>
        <button className="small-btn" onClick={() => onChange({ ...up, onHit: [...(up.onHit ?? []), defaultEffect("surface")] })}>
          + add
        </button>
      </div>
      {(up.onHit ?? []).map((e, i) => (
        <EffectEditor
          key={i}
          effect={e}
          onChange={(ne) => onChange({ ...up, onHit: up.onHit!.map((x, j) => (j === i ? ne : x)) })}
          onRemove={() => onChange({ ...up, onHit: up.onHit!.filter((_, j) => j !== i) })}
        />
      ))}
      <div className="sub-head">
        <span>Traits</span>
        <label className="check" title="Replace the unit's traits instead of adding to them">
          <input type="checkbox" checked={!!up.replaceTraits} onChange={(e) => onChange({ ...up, replaceTraits: e.target.checked || undefined })} />
          replace existing
        </label>
        <select value="" onChange={(e) => e.target.value && onChange({ ...up, traits: [...(up.traits ?? []), defaultTrait(e.target.value as TraitDef["type"])] })}>
          <option value="">+ add trait…</option>
          {TRAIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {(up.traits ?? []).map((t, i) => (
        <TraitEditor
          key={i}
          trait={t}
          onChange={(nt) => onChange({ ...up, traits: up.traits!.map((x, j) => (j === i ? nt : x)) })}
          onRemove={() => onChange({ ...up, traits: up.traits!.filter((_, j) => j !== i) })}
        />
      ))}
    </div>
  );
}
