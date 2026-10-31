import { useEffect, useState, type ReactNode } from "react";
import { ELEMENTS, type Effect, type Selector } from "../sim/types";
import { STATUSES, SURFACES } from "../data/elements";

export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="row" title={hint}>
      <span className="row-label">{label}</span>
      <span className="row-input">{children}</span>
    </label>
  );
}

// Number input that lets you type freely (e.g. "0." or "") and commits valid numbers.
export function Num({ value, onChange, step = 1, min }: { value: number | undefined; onChange: (v: number) => void; step?: number; min?: number }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(value === undefined ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="number"
      step={step}
      min={min}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
    />
  );
}

export function Text({ value, onChange, placeholder, list }: { value: string | undefined; onChange: (v: string) => void; placeholder?: string; list?: string }) {
  return <input type="text" value={value ?? ""} placeholder={placeholder} list={list} onChange={(e) => onChange(e.target.value)} />;
}

export function Pick<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function Checks<T extends string>({ value, options, onChange }: { value: T[]; options: readonly T[]; onChange: (v: T[]) => void }) {
  return (
    <span className="checks">
      {options.map((o) => (
        <label key={o} className="check">
          <input
            type="checkbox"
            checked={value.includes(o)}
            onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((v) => v !== o))}
          />
          {o}
        </label>
      ))}
    </span>
  );
}

const STATUS_IDS = Object.keys(STATUSES) as (keyof typeof STATUSES)[];
const SURFACE_IDS = Object.keys(SURFACES) as (keyof typeof SURFACES)[];
const EFFECT_TYPES = ["damage", "status", "surface", "heal", "cleanse"] as const;

export function defaultEffect(type: Effect["type"]): Effect {
  switch (type) {
    case "damage":
      return { type, amount: 20, element: "fire", radius: 1 };
    case "status":
      return { type, status: "wet", radius: 1 };
    case "surface":
      return { type, surface: "puddle", radius: 1.5 };
    case "heal":
      return { type, amount: 30, radius: 2 };
    case "cleanse":
      return { type, radius: 3 };
  }
}

export function EffectEditor({ effect, onChange, onRemove }: { effect: Effect; onChange: (e: Effect) => void; onRemove: () => void }) {
  return (
    <div className="sub-item">
      <Pick value={effect.type} options={EFFECT_TYPES} onChange={(t) => onChange(defaultEffect(t))} />
      {effect.type === "damage" && (
        <>
          <Num value={effect.amount} onChange={(amount) => onChange({ ...effect, amount })} />
          <Pick value={effect.element} options={ELEMENTS} onChange={(element) => onChange({ ...effect, element })} />
        </>
      )}
      {effect.type === "status" && (
        <>
          <Pick value={effect.status} options={STATUS_IDS} onChange={(status) => onChange({ ...effect, status })} />
          <span className="mini">dur</span>
          <Num value={effect.duration} step={0.5} onChange={(duration) => onChange({ ...effect, duration: duration || undefined })} />
          <select
            value={effect.affects ?? ""}
            title="Who it applies to, relative to the source"
            onChange={(e) => onChange({ ...effect, affects: (e.target.value || undefined) as typeof effect.affects })}
          >
            <option value="">default (all)</option>
            <option value="enemies">enemies</option>
            <option value="allies">allies</option>
            <option value="all">all</option>
          </select>
          <label className="check" title="Applies to every unit on the field, ignoring radius">
            <input type="checkbox" checked={!!effect.global} onChange={(e) => onChange({ ...effect, global: e.target.checked || undefined })} />
            global
          </label>
        </>
      )}
      {effect.type === "surface" && (
        <>
          <Pick value={effect.surface} options={SURFACE_IDS} onChange={(surface) => onChange({ ...effect, surface })} />
          <span className="mini">dur</span>
          <Num value={effect.duration} step={0.5} onChange={(duration) => onChange({ ...effect, duration: duration || undefined })} />
        </>
      )}
      {effect.type === "heal" && <Num value={effect.amount} onChange={(amount) => onChange({ ...effect, amount })} />}
      <span className="mini">radius</span>
      <Num value={effect.radius} step={0.1} onChange={(radius) => onChange({ ...effect, radius } as Effect)} />
      <button className="icon" onClick={onRemove} title="Remove">
        ✕
      </button>
    </div>
  );
}

export function SelectorEditor({ sel, onChange }: { sel: Selector; onChange: (s: Selector) => void }) {
  return (
    <span className="selector">
      <Pick value={sel.side ?? "any"} options={["any", "ally", "enemy"] as const} onChange={(side) => onChange({ ...sel, side })} />
      <Text value={sel.hasTag} placeholder="has tag" list="all-tags" onChange={(hasTag) => onChange({ ...sel, hasTag: hasTag || undefined })} />
      <Text
        value={sel.hasAnyTag?.join(", ")}
        placeholder="or any of (a, b)"
        onChange={(v) => onChange({ ...sel, hasAnyTag: v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined })}
      />
    </span>
  );
}

// Two-step button for destructive actions (no browser confirm dialogs).
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled }: { label: string; confirmLabel: string; onConfirm: () => void; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={armed ? "danger" : ""}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h4>{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}
