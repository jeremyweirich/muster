import { useEffect, useState, type ReactNode } from "react";
import { FACTIONS, factionOf } from "../data/roles";
import { RULES } from "../data/rules";
import { unlockPrice } from "../game/army";
import { shownLevel } from "../sim/levels";
import type { UnitDef } from "../sim/types";
import { Linked } from "./codexLinks";
import { Swatch, UnitInfo } from "./UnitInfo";

// Phones held sideways (DESIGN.md, "Screen layout"): deployment uses a short rail of the units you own, and sheets
// drawn over the field. No-man's land is always empty while deploying, so most sheets sit there and leave both
// deploy zones in view.
export const COMPACT_QUERY = "(max-height: 560px) and (orientation: landscape)";

export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia !== "undefined" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

// A sheet over the field: "band" covers exactly no-man's land, so both deploy zones stay in view; "full" covers the
// whole field.
export function Sheet({ kind, title, onClose, children }: { kind: "band" | "full"; title?: ReactNode; onClose?: () => void; children: ReactNode }) {
  const zone = RULES.deployDepth / RULES.fieldH;
  const style = kind === "band" ? { top: `calc(${zone * 100}% + 3px)`, bottom: `calc(${zone * 100}% + 3px)` } : undefined;
  return (
    <div className={`sheet sheet-${kind}`} style={style} onPointerDown={(e) => e.stopPropagation()}>
      {(title || onClose) && (
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          {onClose && (
            <button className="sheet-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
      )}
      <div className="sheet-body">{children}</div>
    </div>
  );
}

// One of your units in the rail. Tapping it starts placing it and opens its upgrades.
export function UnitTile({
  def,
  active,
  ups,
  canUpgrade,
  onClick,
}: {
  def: UnitDef;
  active: boolean;
  ups: number;
  canUpgrade: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`rail-tile ${active ? "active" : ""}`} onClick={onClick}>
      <Swatch def={def} size={18} />
      <span className="rail-name">
        {def.name}
        {ups > 0 && <span className="pips">{"★".repeat(ups)}</span>}
      </span>
      <span className="shop-cost">{def.cost}</span>
      {canUpgrade && <span className="rail-up" title="An upgrade is affordable" />}
    </button>
  );
}

// The numbers a player checks most, on one line.
function statLine(def: UnitDef): string {
  const atk = def.attack;
  const parts = [def.structure ? "tower" : `${def.cost} supply`, `${def.squadSize} × ${Math.round(def.hp)} HP`];
  if (shownLevel(def)) parts.unshift(`level ${def.level}`);
  if (atk) parts.push(`${Math.round(atk.damage)} ${atk.element} / ${+atk.cooldown.toFixed(2)}s`, `range ${+atk.range.toFixed(1)}`);
  parts.push(`speed ${Math.round(def.speed)}`);
  return parts.join(" · ");
}

// A unit's sheet: what it is, then its four upgrades as buy buttons. `rival` labels the other side's units, and
// `buy` is null when they can't be bought here.
export function UnitSheet({
  def,
  owned,
  rival,
  extra,
  buy,
  onDetails,
  onClose,
}: {
  def: UnitDef;
  owned: string[];
  rival?: string;
  extra?: ReactNode;
  buy: { price: number | null; supply: number; locked: boolean; onBuy: (upgradeId: string) => void } | null;
  onDetails: () => void;
  onClose?: () => void;
}) {
  return (
    <Sheet
      kind="band"
      onClose={onClose}
      title={
        <>
          <Swatch def={def} size={20} />
          <span className="sheet-unit">
            {rival && <span className="rival-tag">{rival}</span>}
            <b>{def.name}</b>
            <span className="muted small">{statLine(def)}</span>
          </span>
          <button className="small-btn" onClick={onDetails}>
            Details
          </button>
        </>
      }
    >
      {extra}
      {def.upgrades?.length ? (
        <div className="sheet-ups">
          {def.upgrades.map((up) => {
            const has = owned.includes(up.id);
            const canBuy = !!buy && !has && !buy.locked && buy.price !== null && buy.price <= buy.supply;
            return (
              <div key={up.id} className={`sheet-up ${has ? "owned" : canBuy ? "can-buy" : ""}`}>
                <span className="up-name">
                  {has ? "★ " : ""}
                  {up.name}
                </span>
                {up.description && (
                  <span className="up-desc">
                    <Linked text={up.description} />
                  </span>
                )}
                {buy && !has && !buy.locked && buy.price !== null && (
                  <button className="small-btn buy-btn" disabled={!canBuy} onClick={() => buy.onBuy(up.id)}>
                    Buy · {buy.price}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </Sheet>
  );
}

// The whole rulebook card for one unit, over the full field.
export function DetailsSheet({ def, owned, onClose }: { def: UnitDef; owned: string[]; onClose: () => void }) {
  return (
    <Sheet kind="full" title={<b>{def.name}</b>} onClose={onClose}>
      <UnitInfo def={def} owned={owned} />
    </Sheet>
  );
}

// Every unit you haven't unlocked, by faction; tap one to read about it, then unlock it.
export function UnlockSheet({ units, supply, onUnlock, onClose }: { units: UnitDef[]; supply: number; onUnlock: (u: UnitDef) => void; onClose: () => void }) {
  const [preview, setPreview] = useState<UnitDef | null>(null);
  return (
    <Sheet kind="full" title={<b>Unlock a unit</b>} onClose={onClose}>
      <div className="unlock-sheet">
        <div className="unlock-list">
          {units.length === 0 && <p className="muted small">You&apos;ve unlocked every unit.</p>}
          {FACTIONS.map((f) => {
            const list = units.filter((u) => factionOf(u.tags) === f.id);
            if (!list.length) return null;
            return (
              <div key={f.id} className="shop-group">
                <div className="shop-faction">{f.name}</div>
                <div className="unlock-grid">
                  {list.map((u) => (
                    <button key={u.id} className={`shop-item ${preview?.id === u.id ? "active" : ""}`} onClick={() => setPreview(u)}>
                      <Swatch def={u} size={16} />
                      <span className="shop-name">{u.name}</span>
                      <span className={`shop-cost lock ${unlockPrice(u) <= supply ? "" : "dim"}`}>🔒 {unlockPrice(u)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="unlock-preview">
          {preview ? (
            <>
              <button className="primary" disabled={unlockPrice(preview) > supply} onClick={() => onUnlock(preview)}>
                Unlock {preview.name} · {unlockPrice(preview)}
              </button>
              <p className="muted small">Then {preview.cost} supply per squad. Unlocks last the whole match.</p>
              <UnitInfo def={preview} />
            </>
          ) : (
            <p className="muted small">Tap a unit to see what it does. Unlocking costs supply once per match; then you can place as many squads as you can afford.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
