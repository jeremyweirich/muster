import { OPENING_PACKS } from "../data/openings";
import { deployZone, RULES } from "../data/rules";
import { Battle, footprintOf, type BattleResult, type SquadStats } from "../sim/battle";
import type { PlacedSquad, Side, UnitDef } from "../sim/types";
import { upgradedDefs } from "../sim/upgrades";
import { defMap, type DefMap } from "./army";
import { applyOutcome, applyTurn, newMatch, nextRound, outcomeOf, roundSeed, type MatchState, type RoundOutcome, type Turn } from "./match";

// PvP between two browsers (docs/MULTIPLAYER.md). Each browser keeps its own match state with "me = side 0", so the
// deploy screen works as it does against the AI. The battle itself always runs in the host's view of the field (host
// = side 0), because the simulator isn't symmetric under a side swap and both browsers must run the same battle.

// What the players post to the relay. Every message has an id, so a resend after a dropped connection is recognised.
export type PvpBody =
  | { type: "hello"; id: string; build: string }
  | { type: "start"; id: string; game: number; seed: number }
  | { type: "turn"; id: string; game: number; round: number; turn: Turn } // the turn is in the sender's view
  | { type: "outcome"; id: string; game: number; round: number; sig: string; outcome: RoundOutcome }; // host's view

export interface Entry {
  seq: number; // -1 while it's still on its way to the relay
  from: Side;
  body: PvpBody;
}

// ------------------------------------------------------------------- the other player's view of the field

// The two players face each other, so one's view of the field is the other's turned 180°. The Keeps sit 180° apart
// (towerPlacements), so each Keep keeps its index.
export function turnSquad(sq: PlacedSquad, def: UnitDef): PlacedSquad {
  const { w, h } = footprintOf(def, sq.rot);
  return { ...sq, x: RULES.fieldW - sq.x - w, y: RULES.fieldH - sq.y - h };
}

export function turnArmy(army: PlacedSquad[], defs: DefMap): PlacedSquad[] {
  return army.map((sq) => {
    const def = defs.get(sq.defId);
    return def ? turnSquad(sq, def) : sq;
  });
}

export function turnAround(turn: Turn, defs: DefMap): Turn {
  return { ...turn, army: turnArmy(turn.army, defs) };
}

// ------------------------------------------------------------------- turns

// The local player's turn: what changed on side 0 since the round started.
export function turnFrom(start: MatchState, now: MatchState): Turn {
  const opening = start.openings[0].choice === null && now.openings[0].choice !== null ? now.openings[0].choice : undefined;
  const fromPack = new Set(opening !== undefined && opening !== "flat" ? packUnits(opening) : []);
  const had = new Set(start.unlocked[0]);
  const upgrades: Turn["upgrades"] = [];
  for (const [unitId, ids] of Object.entries(now.upgrades[0])) {
    for (const upgradeId of ids.slice((start.upgrades[0][unitId] ?? []).length)) upgrades.push({ unitId, upgradeId });
  }
  const towerUpgrades: number[] = [];
  now.towerLevels[0].forEach((level, i) => {
    for (let l = start.towerLevels[0][i] ?? 0; l < level; l++) towerUpgrades.push(i);
  });
  return {
    ...(opening !== undefined ? { opening } : {}),
    army: now.armies[0],
    unlocks: now.unlocked[0].filter((id) => !had.has(id) && !fromPack.has(id)),
    upgrades,
    towerUpgrades,
  };
}

function packUnits(pack: number): string[] {
  return OPENING_PACKS[pack]?.units.map((u) => u.id) ?? [];
}

// What's wrong with the other side's turn, if anything: more spent than they had, or squads outside their zone.
// Between friends this is a warning, not a block.
export function checkTurn(state: MatchState, side: Side, turn: Turn, defs: DefMap): string[] {
  const problems: string[] = [];
  const after = applyTurn(state, side, turn, defs);
  if (after.supply[side] < 0) problems.push(`spent ${-after.supply[side]} more supply than they had`);
  const { y0, y1 } = deployZone(side);
  for (const sq of turn.army) {
    const def = defs.get(sq.defId);
    if (!def) {
      problems.push(`fielded an unknown unit (${sq.defId})`);
      continue;
    }
    const { w, h } = footprintOf(def, sq.rot);
    if (sq.x < 0 || sq.x + w > RULES.fieldW || sq.y < y0 || sq.y + h > y1) problems.push(`placed ${def.name} outside their zone`);
  }
  return problems;
}

// ------------------------------------------------------------------- results in either view

const swapSide = (s: Side): Side => (s === 0 ? 1 : 0);
// Keep uids name their side ("tower-0-1"); squad uids don't.
const swapUid = (uid: string) => (uid.startsWith("tower-0-") ? `tower-1-${uid.slice(8)}` : uid.startsWith("tower-1-") ? `tower-0-${uid.slice(8)}` : uid);
const swapKeys = (rec: Record<string, number>) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [swapUid(k), v]));

// A battle result as the other side sees it.
export function swapResult(r: BattleResult): BattleResult {
  const stats: Record<string, SquadStats> = {};
  for (const [uid, s] of Object.entries(r.stats)) {
    stats[swapUid(uid)] = { ...s, uid: swapUid(s.uid), side: swapSide(s.side), dealtTo: swapKeys(s.dealtTo), takenFrom: swapKeys(s.takenFrom) };
  }
  return { ...r, winner: r.winner === null ? null : swapSide(r.winner), survivors: [r.survivors[1], r.survivors[0]], stats };
}

export function swapOutcome(o: RoundOutcome): RoundOutcome {
  return { ...o, winner: o.winner === null ? null : swapSide(o.winner), damage: [o.damage[1], o.damage[0]] };
}

// A short fingerprint of an outcome (in the host's view), so the two browsers can check they saw the same battle.
export function outcomeSig(o: RoundOutcome): string {
  let h = 0x811c9dc5;
  const text = `${o.winner}|${o.timedOut}|${o.damage.join(",")}|${Object.keys(o.xp).sort().map((k) => `${k}:${o.xp[k]}`).join(",")}`;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

// ------------------------------------------------------------------- battles

export interface BattleSetup {
  armies: [PlacedSquad[], PlacedSquad[]];
  defs: [DefMap, DefMap];
  towerLevels: [number[], number[]];
  seed: number;
}

// The last battle: `armies`, `defs`, `towerLevels` and `result` in the local player's view (for the report), `canon`
// in the host's view (what the simulator ran, for replays).
export interface Fought extends BattleSetup {
  result: BattleResult | null;
  canon: BattleSetup;
}

// The round's battle once both sides have deployed. `seat` 0 is the host (or a game against the AI).
export function prepareBattle(state: MatchState, defs: DefMap, seat: Side): Fought {
  const local: BattleSetup = {
    armies: state.armies,
    defs: [upgradedDefs(defs, state.upgrades[0]), upgradedDefs(defs, state.upgrades[1])],
    towerLevels: state.towerLevels,
    seed: roundSeed(state.round),
  };
  const canon: BattleSetup =
    seat === 0
      ? local
      : {
          armies: [turnArmy(state.armies[1], defs), turnArmy(state.armies[0], defs)],
          defs: [local.defs[1], local.defs[0]],
          towerLevels: [state.towerLevels[1], state.towerLevels[0]],
          seed: local.seed,
        };
  return { ...local, canon, result: null };
}

// ------------------------------------------------------------------- reading the log

// The current match: the latest `start` (a rematch starts a new one).
export function currentStart(log: Entry[]): Extract<PvpBody, { type: "start" }> | null {
  let best: Extract<PvpBody, { type: "start" }> | null = null;
  for (const e of log) if (e.body.type === "start" && (!best || e.body.game > best.game)) best = e.body;
  return best;
}

// A seat's turn for a round. The first one counts; a duplicate (a resend) is ignored.
export function findTurn(log: Entry[], game: number, round: number, seat: Side): Turn | null {
  for (const e of log) if (e.from === seat && e.body.type === "turn" && e.body.game === game && e.body.round === round) return e.body.turn;
  return null;
}

export function findOutcome(log: Entry[], game: number, round: number, seat: Side): Extract<PvpBody, { type: "outcome" }> | null {
  for (const e of log) if (e.from === seat && e.body.type === "outcome" && e.body.game === game && e.body.round === round) return e.body;
  return null;
}

export function latestHello(log: Entry[], seat: Side): string | null {
  let build: string | null = null;
  for (const e of log) if (e.from === seat && e.body.type === "hello") build = e.body.build;
  return build;
}

export interface Restored {
  game: number;
  match: MatchState;
  committed: boolean; // the local player's turn for the current round is in
  fought: Fought | null; // the last battle, while its result is on screen
  resynced: number[]; // rounds where this browser's battle differed from the host's, and the host's result was used
}

// Rebuild the current match from the log, from `seat`'s point of view: replay every round both players deployed,
// running each battle again. The host's outcome wins when the two browsers disagree.
export function restore(units: UnitDef[], log: Entry[], seat: Side): Restored | null {
  const start = currentStart(log);
  if (!start) return null;
  const defs = defMap(units);
  const other = swapSide(seat);
  const resynced: number[] = [];
  let match = newMatch(units, start.seed, { aiOpening: false });
  let fought: Fought | null = null;
  const done = (committed: boolean): Restored => ({ game: start.game, match, committed, fought: committed ? null : fought, resynced });
  for (let round = 1; ; round++) {
    const mine = findTurn(log, start.game, round, seat);
    const theirs = findTurn(log, start.game, round, other);
    if (round > 1) {
      if (!mine) return done(false); // still looking at the last battle's result
      match = nextRound(match);
      fought = null;
    }
    if (!mine) return done(false);
    match = applyTurn(match, 0, mine, defs);
    if (!theirs) return done(true);
    match = applyTurn(match, 1, turnAround(theirs, defs), defs);
    const f = prepareBattle(match, defs, seat);
    const canonResult = new Battle(f.canon.defs, f.canon.armies, { seed: f.canon.seed, towerLevels: f.canon.towerLevels }).run();
    let outcome = outcomeOf(canonResult, defs);
    const host = findOutcome(log, start.game, round, 0);
    if (seat === 1 && host && host.sig !== outcomeSig(outcome)) {
      outcome = host.outcome;
      resynced.push(round);
    }
    match = applyOutcome(match, seat === 0 ? outcome : swapOutcome(outcome));
    fought = { ...f, result: seat === 0 ? canonResult : swapResult(canonResult) };
    if (match.phase === "over") return done(false);
  }
}

// Ids for messages, rooms and seat tokens.
export function randomId(length: number): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
