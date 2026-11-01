import { describe, expect, it } from "vitest";
import { OPENING_PACKS } from "../src/data/openings";
import { RULES } from "../src/data/rules";
import { towerPlacements } from "../src/data/towers";
import { DEFAULT_UNITS } from "../src/data/units";
import { autoPlace, defMap, towerUpgradePrice, unlockPrice, upgradePrice } from "../src/game/army";
import { applyTurn, canPromote, chooseOpening, nextRound, outcomeOf, promotePrice, type MatchState } from "../src/game/match";
import {
  checkTurn,
  outcomeSig,
  restore,
  swapOutcome,
  swapResult,
  turnArmy,
  turnFrom,
  turnSquad,
  type Entry,
  type PvpBody,
} from "../src/game/pvp";
import { Battle } from "../src/sim/battle";
import { Rng } from "../src/sim/rng";
import type { Side } from "../src/sim/types";
import { seatFor } from "../relay/src/core";

const units = DEFAULT_UNITS;
const defs = defMap(units);

// A stand-in player: deploys on side 0 of its own view, spending the way the deploy screen does.
function deploy(state: MatchState, rng: Rng): MatchState {
  let m = state;
  const spend = (cost: number) => (m = { ...m, supply: [m.supply[0] - cost, m.supply[1]] });
  if (m.round === 1) {
    const offered = m.openings[0].packs;
    m = chooseOpening(m, 0, rng.next() < 0.25 ? "flat" : rng.pick(offered), units, 99);
  }
  for (const sq of m.armies[0]) {
    if (canPromote(sq) && promotePrice(defs.get(sq.defId)!) <= m.supply[0]) {
      spend(promotePrice(defs.get(sq.defId)!));
      m = { ...m, armies: [m.armies[0].map((s) => (s.uid === sq.uid ? { ...s, level: (s.level ?? 1) + 1 } : s)), m.armies[1]] };
    }
  }
  const locked = units.filter((u) => !m.unlocked[0].includes(u.id) && unlockPrice(u) <= m.supply[0]);
  if (locked.length && rng.next() < 0.6) {
    const u = rng.pick(locked);
    spend(unlockPrice(u));
    m = { ...m, unlocked: [[...m.unlocked[0], u.id], m.unlocked[1]] };
  }
  const owned = m.unlocked[0].map((id) => defs.get(id)!);
  if (owned.length && rng.next() < 0.4) {
    const u = rng.pick(owned);
    const bought = m.upgrades[0][u.id] ?? [];
    const price = upgradePrice(u, bought.length);
    const next = u.upgrades?.find((up) => !bought.includes(up.id));
    if (price !== null && next && price <= m.supply[0]) {
      spend(price);
      m = { ...m, upgrades: [{ ...m.upgrades[0], [u.id]: [...bought, next.id] }, m.upgrades[1]] };
    }
  }
  const tower = rng.int(m.towerLevels[0].length);
  const tp = towerUpgradePrice(m.towerLevels[0][tower]);
  if (tp !== null && tp <= m.supply[0] && rng.next() < 0.3) {
    spend(tp);
    m = { ...m, towerLevels: [m.towerLevels[0].map((l, i) => (i === tower ? l + 1 : l)), m.towerLevels[1]] };
  }
  const list = [];
  let left = m.supply[0];
  for (let k = 0; k < 4 && owned.length; k++) {
    const u = rng.pick(owned);
    if (u.cost <= left) {
      list.push(u);
      left -= u.cost;
    }
  }
  const placed = autoPlace(list, m.armies[0], 0, defs, m.round, rng);
  spend(placed.reduce((t, q) => t + defs.get(q.defId)!.cost, 0));
  return { ...m, armies: [[...m.armies[0], ...placed], m.armies[1]] };
}

function post(log: Entry[], from: Side, body: PvpBody) {
  log.push({ seq: log.length, from, body });
}

describe("pvp", () => {
  it("turning the field round twice gives back the same squad, and keeps each Keep's index", () => {
    const sq = { uid: "a", defId: "knights", x: 5, y: 22, rot: true, round: 1 };
    const def = defs.get("knights")!;
    expect(turnSquad(turnSquad(sq, def), def)).toEqual(sq);
    const keeps0 = towerPlacements(0);
    const keeps1 = towerPlacements(1);
    keeps0.forEach((t, i) => {
      expect(t.x + keeps1[i].x).toBe(RULES.fieldW - 2);
      expect(t.y + keeps1[i].y).toBe(RULES.fieldH - 2);
    });
  });

  it("a deployment becomes a turn that rebuilds it exactly, at the same price", () => {
    const rng = new Rng(3);
    let start = restoreFresh(11);
    for (let r = 0; r < 3; r++) {
      const now = deploy(start, rng);
      const turn = turnFrom(start, now);
      const rebuilt = applyTurn(start, 0, turn, defs);
      expect(rebuilt.supply[0]).toBe(now.supply[0]);
      expect(rebuilt.armies[0]).toEqual(now.armies[0]);
      expect(new Set(rebuilt.unlocked[0])).toEqual(new Set(now.unlocked[0]));
      expect(rebuilt.upgrades[0]).toEqual(now.upgrades[0]);
      expect(rebuilt.towerLevels[0]).toEqual(now.towerLevels[0]);
      expect(rebuilt.openings[0]).toEqual(now.openings[0]);
      expect(checkTurn(start, 0, turn, defs)).toEqual([]);
      start = nextRound({ ...now, phase: "result" });
    }
  });

  it("flags a turn that spends more than it had", () => {
    const start = restoreFresh(5);
    const turn = { army: [], unlocks: units.map((u) => u.id), upgrades: [], towerUpgrades: [] };
    expect(checkTurn(start, 1, turn, defs).length).toBeGreaterThan(0);
  });

  it("swapping a result's sides twice changes nothing", () => {
    const a = autoPlace([defs.get("knights")!, defs.get("crossbowmen")!], [], 0, defs, 1, new Rng(1));
    const b = autoPlace([defs.get("grunts")!, defs.get("troll")!], [], 1, defs, 1, new Rng(2));
    const r = new Battle(defs, [a, b], { seed: 4 }).run();
    expect(swapResult(swapResult(r))).toEqual(r);
    const o = outcomeOf(r, defs);
    expect(outcomeOf(swapResult(r), defs)).toEqual(swapOutcome(o));
  });

  it("host and guest rebuild the same match from the log, each from their own side", { timeout: 60_000 }, () => {
    const log: Entry[] = [];
    post(log, 0, { type: "start", id: "s", game: 1, seed: 1234 });
    const rngs = [new Rng(7), new Rng(8)];
    for (let round = 1; round <= 4; round++) {
      for (const seat of [0, 1] as Side[]) {
        const r = restore(units, log, seat)!;
        expect(r.committed).toBe(false);
        if (r.match.phase === "over") return;
        const start = r.match.phase === "deploy" ? r.match : nextRound(r.match);
        expect(start.round).toBe(round);
        post(log, seat, { type: "turn", id: `t${round}${seat}`, game: 1, round, turn: turnFrom(start, deploy(start, rngs[seat])) });
      }
      const host = restore(units, log, 0)!;
      const guest = restore(units, log, 1)!;
      expect(host.fought && guest.fought).toBeTruthy();
      // both browsers ran exactly the same battle
      expect(guest.fought!.canon.armies).toEqual(host.fought!.canon.armies);
      expect(guest.fought!.canon.towerLevels).toEqual(host.fought!.canon.towerLevels);
      expect(guest.fought!.canon.seed).toBe(host.fought!.canon.seed);
      // ... and see it from opposite sides
      expect(guest.match.hp).toEqual([host.match.hp[1], host.match.hp[0]]);
      expect(guest.match.armies[0]).toEqual(turnArmy(host.match.armies[1], defs));
      expect(guest.match.supply).toEqual([host.match.supply[1], host.match.supply[0]]);
      const hostOutcome = outcomeOf(host.fought!.result!, defs);
      const guestOutcome = swapOutcome(outcomeOf(guest.fought!.result!, defs));
      expect(outcomeSig(guestOutcome)).toBe(outcomeSig(hostOutcome));
      post(log, 0, { type: "outcome", id: `o${round}`, game: 1, round, sig: outcomeSig(hostOutcome), outcome: hostOutcome });
    }
  });

  it("the guest adopts the host's outcome when their battles disagree", () => {
    const log: Entry[] = [];
    post(log, 0, { type: "start", id: "s", game: 1, seed: 77 });
    for (const seat of [0, 1] as Side[]) {
      const start = restore(units, log, seat)!.match;
      post(log, seat, { type: "turn", id: `t${seat}`, game: 1, round: 1, turn: turnFrom(start, deploy(start, new Rng(seat + 1))) });
    }
    const fake = { winner: 0 as Side, timedOut: false, damage: [0, 123] as [number, number], xp: {} };
    post(log, 0, { type: "outcome", id: "o", game: 1, round: 1, sig: "nope", outcome: fake });
    const guest = restore(units, log, 1)!;
    expect(guest.resynced).toEqual([1]);
    expect(guest.match.hp[0]).toBe(RULES.startHp - 123);
    expect(guest.match.history[0].damage).toEqual([123, 0]);
  });

  it("a rematch starts a fresh match, and duplicate turns are ignored", () => {
    const log: Entry[] = [];
    post(log, 0, { type: "start", id: "s1", game: 1, seed: 5 });
    const start = restore(units, log, 0)!.match;
    const turn = turnFrom(start, deploy(start, new Rng(1)));
    post(log, 0, { type: "turn", id: "a", game: 1, round: 1, turn });
    post(log, 0, { type: "turn", id: "b", game: 1, round: 1, turn: { ...turn, army: [] } });
    expect(restore(units, log, 0)!.match.armies[0]).toEqual(turn.army);
    expect(restore(units, log, 0)!.committed).toBe(true);
    post(log, 1, { type: "start", id: "s2", game: 2, seed: 6 });
    const r = restore(units, log, 0)!;
    expect(r.game).toBe(2);
    expect(r.committed).toBe(false);
    expect(r.match.armies[0]).toEqual([]);
  });

  it("every opening pack can be rebuilt from a turn", () => {
    OPENING_PACKS.forEach((_, i) => {
      const start = restoreFresh(1);
      const now = chooseOpening({ ...start, openings: [{ ...start.openings[0], packs: [i] }, start.openings[1]] }, 0, i, units, 3);
      const fixed = { ...start, openings: [{ ...start.openings[0], packs: [i] }, start.openings[1]] } as MatchState;
      const rebuilt = applyTurn(fixed, 0, turnFrom(fixed, now), defs);
      expect(rebuilt.supply[0]).toBe(now.supply[0]);
      expect(new Set(rebuilt.unlocked[0])).toEqual(new Set(now.unlocked[0]));
    });
  });
});

describe("relay seats", () => {
  it("the first player hosts, an invite claims the second seat, and a third is turned away", () => {
    const tokens: [string | null, string | null] = [null, null];
    expect(seatFor(tokens, "aaaaaaaa", undefined)).toEqual({ seat: 0, claimed: true });
    tokens[0] = "aaaaaaaa";
    expect(seatFor(tokens, "aaaaaaaa", undefined)).toEqual({ seat: 0, claimed: false });
    expect(seatFor(tokens, "bbbbbbbb", undefined)).toEqual({ error: "taken" });
    expect(seatFor(tokens, "bbbbbbbb", "guest")).toEqual({ seat: 1, claimed: true });
    tokens[1] = "bbbbbbbb";
    expect(seatFor(tokens, "bbbbbbbb", "guest")).toEqual({ seat: 1, claimed: false });
    expect(seatFor(tokens, "cccccccc", "guest")).toEqual({ error: "full" });
    expect(seatFor([null, null], "cccccccc", "guest")).toEqual({ error: "notfound" });
  });
});

function restoreFresh(seed: number): MatchState {
  return restore(units, [{ seq: 0, from: 0, body: { type: "start", id: "s", game: 1, seed } }], 0)!.match;
}
