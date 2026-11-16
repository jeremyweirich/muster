import { Fragment } from "react";
import { OPENING_PACKS } from "../data/openings";
import { recruitSkipSupply, type RecruitChoice, type RecruitOffer as RecruitOfferState } from "../data/recruits";
import { CodexLink } from "./codexLinks";
import { RULES } from "../data/rules";
import { towerDaze, towerDef, TOWER_MAP } from "../data/towers";
import { towerUpgradePrice, upgradePrice, type DefMap } from "../game/army";
import { battleXp, promotePrice, type OpeningChoice } from "../game/match";
import { earnedLevel, xpForLevel } from "../sim/levels";
import type { BattleResult } from "../sim/battle";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import type { UpgradeState } from "../sim/upgrades";
import { Swatch } from "./UnitInfo";

// The Play screen's sidebar and HUD panels: the opening offer, the shop (upgrades, towers, promotions) and the
// health bars. PlayView owns the state; these only render it and report clicks.

// Promote every veteran of one unit at once, while supply lasts. Only offered when more than one of its squads has a level waiting.
export interface PromoteAll {
  count: number;
  price: number;
  cheapest: number;
  onClick: () => void;
}

// In the Promotions list, `def` shows which unit it promotes.
function PromoteAllButton({ all, supply, def }: { all: PromoteAll; supply: number; def?: UnitDef }) {
  return (
    <button
      className="small-btn promote-btn"
      disabled={all.cheapest > supply}
      title={all.price > supply ? "Promotes as many as you can afford" : undefined}
      onClick={all.onClick}
    >
      {def ? (
        <>
          <Swatch def={def} size={14} /> Promote all {def.name} ×{all.count}
        </>
      ) : (
        `Promote all ${all.count}`
      )}{" "}
      · {all.price}
    </button>
  );
}

// XP and level of a placed squad, with a Promote button when a level is waiting.
export function Veterancy({
  squad,
  canBuy,
  price,
  supply,
  onPromote,
  promoteAll,
}: {
  squad: PlacedSquad;
  canBuy: boolean;
  price: number;
  supply: number;
  onPromote: () => void;
  promoteAll?: PromoteAll;
}) {
  const level = squad.level ?? 1;
  const xp = squad.xp ?? 0;
  const earned = earnedLevel(xp, RULES);
  const next = xpForLevel(earned, RULES);
  return (
    <div className={`veterancy ${earned > level ? "ready" : ""}`}>
      <span>
        <b>Level {level}</b>{" "}
        <span className="muted small">
          {Math.round(xp).toLocaleString()} XP
          {earned > level ? " · full: promote to earn more" : next !== null ? ` / ${next.toLocaleString()} for level ${earned + 1}` : " (max)"}
        </span>
      </span>
      {earned > level &&
        (canBuy ? (
          <span className="promote-btns">
            <button className="small-btn promote-btn" disabled={price > supply} onClick={onPromote}>
              Promote to Lv {level + 1} · {price}
            </button>
            {promoteAll && <PromoteAllButton all={promoteAll} supply={supply} />}
          </span>
        ) : (
          <span className="muted small">can promote</span>
        ))}
    </div>
  );
}

// Squads ready for promotion, as buttons in the Upgrades tab.
export function PromotionPanel({
  squads,
  defs,
  supply,
  onPromote,
  onHover,
  promoteAll,
}: {
  squads: PlacedSquad[];
  defs: DefMap;
  supply: number;
  onPromote: (sq: PlacedSquad) => void;
  onHover: (sq: PlacedSquad | null) => void;
  promoteAll: (defId: string) => PromoteAll | undefined;
}) {
  if (!squads.length) return null;
  // grouped by unit, each group led by its Promote all
  const order = [...new Set(squads.map((sq) => sq.defId))];
  const grouped = [...squads].sort((a, b) => order.indexOf(a.defId) - order.indexOf(b.defId));
  return (
    <div className="promotions">
      <div className="promo-note small">
        Veterans who earned a level. A promotion costs <b>half a new squad</b> and adds as much HP and damage as a whole new one: the cheapest
        way to grow your army.
      </div>
      {grouped.map((sq, i) => {
        const def = defs.get(sq.defId)!;
        const price = promotePrice(def);
        const level = sq.level ?? 1;
        const all = grouped[i - 1]?.defId !== sq.defId ? promoteAll(sq.defId) : undefined;
        return (
          <Fragment key={sq.uid}>
          {all && <PromoteAllButton all={all} supply={supply} def={def} />}
          <button
            className={`up-btn ${price <= supply ? "can-buy" : ""}`}
            disabled={price > supply}
            onClick={() => onPromote(sq)}
            onMouseEnter={() => onHover(sq)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="up-btn-head">
              <span className="up-name">
                <Swatch def={def} size={14} /> {def.name} → Lv {level + 1}
              </span>
              <span className="up-price">Promote · {price}</span>
            </span>
            <span className="up-desc">
              ×{level + 1} HP and damage · a new squad costs {def.cost}
            </span>
          </button>
          </Fragment>
        );
      })}
    </div>
  );
}

// After a battle: which of your squads just earned a level.
export function PromotionsEarned({ result, army, defs }: { result: BattleResult; army: PlacedSquad[]; defs: DefMap }) {
  const fresh = army.filter((sq) => {
    const xp = sq.xp ?? 0;
    return earnedLevel(xp, RULES) > earnedLevel(xp - battleXp(result, sq.uid), RULES);
  });
  if (!fresh.length) return null;
  return (
    <p className="promotions-earned">
      ▲ Level earned: {fresh.map((sq) => defs.get(sq.defId)?.name).join(", ")}. Promote them next round.
    </p>
  );
}

// The round-1 choice: one of three packs (two units unlocked, their squads placed, plus supply), or flat supply.
// `rival`: who is offered the same packs (a story mission's enemy isn't offered any)
export function OpeningOffer({ packs, units, rival, onChoose }: { packs: number[]; units: UnitDef[]; rival?: string; onChoose: (c: OpeningChoice) => void }) {
  return (
    <div className="opening">
      <div className="muted small">
        Opening: pick one{rival && <> ({rival} is offered the same)</>}. A pack&apos;s units come unlocked and placed for you, with{" "}
        {RULES.openingPackSupply} supply to spend.
      </div>
      <div className="opening-buttons">
        {packs.map((i) => (
          <button key={i} className="up-btn can-buy" onClick={() => onChoose(i)}>
            <span className="up-btn-head">
              <span className="up-name pack-units">
                {OPENING_PACKS[i].units.map((u) => {
                  const d = units.find((x) => x.id === u.id)!;
                  return (
                    <span key={u.id} className="pack-unit">
                      <Swatch def={d} size={14} />
                      <span>
                        {u.count > 1 && <>{u.count}×&nbsp;</>}
                        {d.name}
                      </span>
                    </span>
                  );
                })}
              </span>
              <span className="up-price">+{RULES.openingPackSupply}</span>
            </span>
          </button>
        ))}
        <button className="up-btn can-buy" onClick={() => onChoose("flat")}>
          <span className="up-btn-head">
            <span className="up-name">War chest</span>
            <span className="up-price">+{RULES.openingFlat}</span>
          </span>
          <span className="up-desc">{RULES.openingFlat} supply and nothing unlocked: build exactly what you want.</span>
        </button>
      </div>
    </div>
  );
}

// A recruit round's offer (docs/RECRUITS.md): three units neither side has unlocked, each with squads placed for you,
// at a price; or supply instead. `rival`: who is offered the same.
export function RecruitOffer({
  offer,
  units,
  supply,
  unlocked,
  rival,
  onChoose,
}: {
  offer: RecruitOfferState;
  units: UnitDef[];
  supply: number;
  unlocked: string[];
  rival: string;
  onChoose: (c: RecruitChoice) => void;
}) {
  return (
    <div className="opening">
      <div className="muted small">
        <CodexLink topic="recruits">Recruits</CodexLink>: pick one ({rival} is offered the same). The unit comes unlocked, with its squads
        placed for you.
      </div>
      <div className="opening-buttons">
        {offer.options.map((o, i) => {
          const d = units.find((x) => x.id === o.unitId)!;
          const mine = unlocked.includes(o.unitId); // unlocked from the shop this round: undo that to take this
          const ok = o.price <= supply && !mine;
          return (
            <button key={i} className={`up-btn ${ok ? "can-buy" : ""}`} disabled={!ok} onClick={() => onChoose(i)}>
              <span className="up-btn-head">
                <span className="up-name pack-units">
                  <span className="pack-unit">
                    <Swatch def={d} size={14} />
                    <span>
                      {o.count > 1 && <>{o.count}×&nbsp;</>}
                      {d.name}
                      {o.level > 1 && <> Lv&nbsp;{o.level}</>}
                    </span>
                  </span>
                </span>
                <span className="up-price">{o.price === 0 ? "free" : `· ${o.price}`}</span>
              </span>
              <span className="up-desc">{mine ? `You unlocked ${d.name} this round: undo it to take this.` : `unlocks ${d.name}`}</span>
            </button>
          );
        })}
        <button className="up-btn can-buy" onClick={() => onChoose("skip")}>
          <span className="up-btn-head">
            <span className="up-name">Skip</span>
            <span className="up-price">+{recruitSkipSupply(offer.round)} supply</span>
          </span>
        </button>
      </div>
    </div>
  );
}

// Every unlocked unit with all of its upgrades as big buy buttons, so buying one is a single click.
export function UpgradePanel({
  units,
  owned,
  supply,
  onBuy,
}: {
  units: UnitDef[];
  owned: Record<string, string[]>;
  supply: number;
  onBuy: (unitId: string, upgradeId: string) => void;
}) {
  if (!units.length) return <p className="muted small">Unlock units to upgrade them.</p>;
  return (
    <div className="upgrade-panel">
      <p className="muted small">
        An upgrade changes every squad of that unit, including ones already placed. Each unit's upgrades cost {RULES.upgradeCosts.join(" / ")} in the
        order you buy them, so every step deeper into a specialist costs more.
      </p>
      {units.map((u) => {
        const bought = owned[u.id] ?? [];
        const price = upgradePrice(u, bought.length);
        return (
          <div key={u.id} className="up-unit">
            <div className="up-unit-head">
              <Swatch def={u} size={18} />
              <b>{u.name}</b>
              {bought.length > 0 && <span className="pips">{"★".repeat(bought.length)}</span>}
            </div>
            <div className="up-buttons">
              {u.upgrades!.map((up) => {
                const has = bought.includes(up.id);
                const canBuy = !has && price !== null && price <= supply;
                return (
                  <button
                    key={up.id}
                    className={`up-btn ${has ? "owned" : canBuy ? "can-buy" : ""}`}
                    disabled={has || !canBuy}
                    onClick={() => onBuy(u.id, up.id)}
                  >
                    <span className="up-btn-head">
                      <span className="up-name">{up.name}</span>
                      <span className="up-price">{has ? "★ Owned" : price === null ? "—" : `Buy · ${price}`}</span>
                    </span>
                    {up.description && <span className="up-desc">{up.description}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TowerPanel({ levels, supply, onBuy }: { levels: [number[], number[]]; supply: number; onBuy: (i: number) => void }) {
  return (
    <div className="towers">
      <div className="muted small">Your towers</div>
      {RULES.towers.map((t, i) => {
        const level = levels[0][i] ?? 0;
        const def = towerDef(t.defId, level, RULES, t.name);
        const price = towerUpgradePrice(level);
        return (
          <div key={i} className="tower-row">
            <span>
              <b>{def.name}</b> <span className="muted small">Lv {level}</span>
              <div className="muted small">
                {def.hp} HP · falls → your army Dazed {towerDaze(level)}s
              </div>
            </span>
            {price !== null ? (
              <button
                className="small-btn"
                disabled={price > supply}
                title={`+${RULES.towerHpPerLevel} HP, Daze ${towerDaze(level)}s → ${towerDaze(level + 1)}s`}
                onClick={() => onBuy(i)}
              >
                +{RULES.towerHpPerLevel} HP · {price}
              </button>
            ) : (
              <span className="muted small">max</span>
            )}
          </div>
        );
      })}
      <div className="muted small">
        Enemy: {RULES.towers.map((t, i) => `${t.name ?? TOWER_MAP.get(t.defId)?.name} Lv ${levels[1][i] ?? 0}`).join(" · ")}
      </div>
    </div>
  );
}

// A side's unlocked units beside its health bar. Hovering one shows its name and which upgrades it has.
export function UnlockStrip({ units, owned, side, note }: { units: UnitDef[]; owned: UpgradeState; side: Side; note?: string | null }) {
  return (
    <div className={`hud-unlocks hud-unlocks-${side}`} aria-label={side === 0 ? "Your unlocks" : "Enemy unlocks"}>
      {units.map((d) => {
        const bought = owned[d.id] ?? [];
        return (
          <span key={d.id} className="unlock-chip" tabIndex={0}>
            <Swatch def={d} size={20} />
            {bought.length > 0 && <span className="unlock-count">{bought.length}</span>}
            <span className="unlock-tip" role="tooltip">
              <b>{d.name}</b>
              {d.upgrades?.length ? (
                <span className="tip-ups">
                  {d.upgrades.map((up) => {
                    const has = bought.includes(up.id);
                    return (
                      <span key={up.id} className={has ? "tip-up owned" : "tip-up"}>
                        {has ? "★" : "·"} {up.name}
                      </span>
                    );
                  })}
                </span>
              ) : null}
            </span>
          </span>
        );
      })}
      {note && <span className="muted small hud-note">{note}</span>}
    </div>
  );
}

// `hits` counts the strikes that have landed on it this tally; each one restarts the flash. `max` is a full bar: the
// side's starting HP (a story mission sets its own).
export function HpBar({ label, hp, max = RULES.startHp, side, hits = 0 }: { label: string; hp: number; max?: number; side: Side; hits?: number }) {
  const frac = Math.max(0, hp / max);
  return (
    <div className={`hp hp-${side}`}>
      <span>{label}</span>
      <div className="hp-track">
        <div className="hp-fill" style={{ width: `${frac * 100}%` }} />
        {hits > 0 && <div key={hits} className="hp-hit" />}
      </div>
      <span key={hits} className={`hp-num ${hits > 0 ? "hp-num-hit" : ""}`}>
        {hp}
      </span>
    </div>
  );
}
