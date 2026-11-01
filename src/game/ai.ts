import type { OpeningPack } from "../data/openings";
import { RULES } from "../data/rules";
import { Battle } from "../sim/battle";
import { Rng } from "../sim/rng";
import type { PlacedSquad, UnitDef } from "../sim/types";
import { upgradedDefs, type UpgradeState } from "../sim/upgrades";
import { canPromote, packSquads, promotePrice, roundDamage } from "./match";
import { armyValue, autoPlace, priceOf, towerUpgradePrice, unlockPrice, upgradePrice, type DefMap, type PlacementStyle } from "./army";

export type Difficulty = "easy" | "normal" | "hard";

// Easy and Normal try a fixed number of random plans; Hard keeps searching until its time is up. Planning runs in
// a worker while the player deploys, so Hard can afford to think for a while.
const CANDIDATES: Record<Difficulty, number> = { easy: 3, normal: 12, hard: Infinity };
const TIME_BUDGET_MS: Record<Difficulty, number> = { easy: 400, normal: 2000, hard: 6000 };
// Hard splits its time into phases, as fractions of its budget: screening unit types, random plans, local search,
// then re-scoring its best few plans over more battle seeds (one simulation is noisy) before it picks.
const HARD_PHASES = { screen: 0.3, random: 0.55, search: 0.85 };
const FINALISTS = 5;
const EXTRA_SEEDS = 2;
const STYLES: PlacementStyle[] = ["center", "spread", "left", "right"];
// How much one-time purchases (unlocks, upgrades, tower levels) are worth beyond
// this round, as a fraction of their price (counted in HP at RULES.damagePerSupply).
const FUTURE_VALUE = 0.5;
const MAX_SQUADS = 10;

export interface AiSide {
  army: PlacedSquad[];
  unlocked: string[];
  upgrades: UpgradeState;
  towerLevels: number[];
  supply: number;
}

export interface AiPlan {
  squads: PlacedSquad[];
  unlocks: string[];
  upgrades: { unitId: string; upgradeId: string }[];
  towerUpgrades: number[]; // tower indexes, one entry per level bought
  promotions: string[]; // uids of its own squads it pays to level up
  spent: number;
  candidatesTried: number;
  bestScore: number | null;
}

export interface PlayerView {
  army: PlacedSquad[];
  upgrades: UpgradeState;
  towerLevels: number[];
  unlocked?: string[]; // what the player could buy more of this round
}

export interface PlanOptions {
  openingPacks?: OpeningPack[]; // round 1: the packs the player was offered, as stand-ins for an army it hasn't shown
  budgetMs?: number; // overrides the difficulty's thinking time (scripts and tests)
  searchSeed?: number; // parallel searches use different search seeds against the same scenarios
}

// Everything a plan buys except the squads: tower levels, promotions and an upgrade.
interface Extras {
  upgrades: { unitId: string; upgradeId: string }[];
  towerUpgrades: number[];
  promotions: string[];
  cost: number;
}

interface Candidate {
  extras: Extras;
  units: UnitDef[];
  squads: PlacedSquad[];
  score: number; // mean over `runs` simulated battles
  runs: number;
}

function randomExtras(units: UnitDef[], me: AiSide, rng: Rng): Extras {
  const out: Extras = { upgrades: [], towerUpgrades: [], promotions: [], cost: 0 };
  let left = me.supply;
  const levels = [...me.towerLevels];
  // sometimes reinforce a tower first
  if (rng.next() < 0.2) {
    const i = rng.int(levels.length);
    const p = towerUpgradePrice(levels[i]);
    if (p !== null && p <= left * 0.5) {
      out.towerUpgrades.push(i);
      levels[i]++;
      left -= p;
      out.cost += p;
    }
  }
  // often promote veterans that have earned a level
  for (const sq of me.army) {
    const def = units.find((u) => u.id === sq.defId);
    if (!def || !canPromote(sq) || rng.next() < 0.4) continue;
    const p = promotePrice(def);
    if (p > left * 0.7) continue;
    out.promotions.push(sq.uid);
    left -= p;
    out.cost += p;
  }
  // sometimes upgrade something already in the army
  if (rng.next() < 0.35) {
    const owned = [...new Set(me.army.map((s) => s.defId))].map((id) => units.find((u) => u.id === id)).filter((u): u is UnitDef => !!u);
    const def = owned.length ? rng.pick(owned) : undefined;
    const bought = def ? me.upgrades[def.id] ?? [] : [];
    const options = def?.upgrades?.filter((u) => !bought.includes(u.id)) ?? [];
    const price = def ? upgradePrice(def, bought.length) : null;
    if (def && options.length && price !== null && price <= left * 0.6) {
      out.upgrades.push({ unitId: def.id, upgradeId: rng.pick(options).id });
      out.cost += price;
    }
  }
  return out;
}

const NO_EXTRAS: Extras = { upgrades: [], towerUpgrades: [], promotions: [], cost: 0 };

// What a list of squads costs, unlocks included, on top of what's already unlocked.
function unitsCost(list: UnitDef[], unlocked: string[]): number {
  const have = new Set(unlocked);
  let total = 0;
  for (const u of list) {
    total += priceOf(u, have);
    have.add(u.id);
  }
  return total;
}

// Buy squads with what's left after the extras. `focus` units are picked most of the time when affordable.
function fillUnits(units: UnitDef[], me: AiSide, left: number, rng: Rng, start: UnitDef[] = [], focus: UnitDef[] = []): UnitDef[] {
  const list = [...start];
  const unlocked = new Set([...me.unlocked, ...list.map((u) => u.id)]);
  left -= unitsCost(list, me.unlocked);
  // usually stick with what's already unlocked; sometimes reach for something new (always, with nothing unlocked)
  const allowNew = unlocked.size === 0 || rng.next() < 0.45;
  for (let guard = 0; guard < 16 && list.length < MAX_SQUADS; guard++) {
    const ok = (u: UnitDef) => priceOf(u, unlocked) <= left;
    const affordable = units.filter((u) => ok(u) && (allowNew || unlocked.has(u.id)));
    if (!affordable.length) break;
    const focused = focus.filter(ok);
    const pick = focused.length && rng.next() < 0.7 ? rng.pick(focused) : rng.pick(affordable);
    left -= priceOf(pick, unlocked);
    unlocked.add(pick.id);
    list.push(pick);
  }
  return list;
}

// The armies the player might field this round, to test plans against.
function opponentScenarios(units: UnitDef[], defs: DefMap, me: AiSide, player: PlayerView, round: number, difficulty: Difficulty, opts: PlanOptions, rng: Rng): PlacedSquad[][] {
  if (player.army.length === 0) {
    // round 1: nothing shown yet, so try the openings the player was offered
    const packs = opts.openingPacks ?? [];
    if (packs.length) {
      return packs.map((pack) => {
        const squads = packSquads(pack, units);
        const pool = [...new Set(squads)];
        let left = RULES.openingPackSupply;
        for (let guard = 0; guard < 6; guard++) {
          const affordable = pool.filter((u) => u.cost <= left);
          if (!affordable.length) break;
          const pick = rng.pick(affordable);
          squads.push(pick);
          left -= pick.cost;
        }
        return autoPlace(squads, [], 0, defs, round, rng, "center");
      });
    }
    return [autoPlace(fillUnits(units, { ...me, unlocked: [] }, me.supply, rng), [], 0, defs, round, rng, "center")];
  }
  const out = [player.army];
  if (difficulty !== "easy") {
    // and the same army after a round's income spent on what the player already uses: plan for their answer too
    const known = [...new Set([...(player.unlocked ?? []), ...player.army.map((s) => s.defId)])];
    const pool = units.filter((u) => known.includes(u.id));
    const extra = fillUnits(pool, { ...me, unlocked: known, army: player.army }, RULES.income(round), rng);
    if (extra.length) out.push([...player.army, ...autoPlace(extra, player.army, 0, defs, round, rng, rng.pick(STYLES))]);
  }
  return out;
}

// The AI plans by simulation: generate candidate purchases and placements, play each against the armies the player
// might field (its last army, and that army plus a round of purchases), and keep the best. Hard also screens each
// unit type against the player first, then improves its best plans until its time is up. Since it only uses the
// simulator, it automatically understands any unit you design.
export function planAiRound(
  units: UnitDef[],
  defs: DefMap,
  me: AiSide,
  player: PlayerView,
  round: number,
  difficulty: Difficulty,
  seed: number,
  opts: PlanOptions = {},
): AiPlan {
  // scenarios come from the round's seed; the search has its own stream, so parallel searches face the same armies
  const rng = new Rng(seed * 31 + 7 + (opts.searchSeed ?? 0) * 7919);
  const start = performance.now();
  const budget = opts.budgetMs ?? TIME_BUDGET_MS[difficulty];
  const outOfTime = (phase = 1) => performance.now() - start > budget * phase;
  const playerDefs = upgradedDefs(defs, player.upgrades);
  const scenarios = opponentScenarios(units, defs, me, player, round, difficulty, opts, new Rng(seed));
  let tried = 0;

  const place = (list: UnitDef[]) => autoPlace(list, me.army, 1, defs, round, rng, rng.pick(STYLES));
  // Plays a plan against every scenario, once per battle seed; returns the summed score and how many battles that was.
  const evaluate = (extras: Extras, list: UnitDef[], squads: PlacedSquad[], seeds = 1, seedBase = 0): { sum: number; runs: number } => {
    tried++;
    const myUpgrades: UpgradeState = { ...me.upgrades };
    for (const u of extras.upgrades) myUpgrades[u.unitId] = [...(myUpgrades[u.unitId] ?? []), u.upgradeId];
    const myLevels = [...me.towerLevels];
    for (const i of extras.towerUpgrades) myLevels[i]++;
    const mine = [...promoted(me.army, extras.promotions), ...squads];
    const myDefs = upgradedDefs(defs, myUpgrades);
    // Score in what a round really costs: the HP each side would lose (armies are restored after every battle).
    let total = 0;
    let runs = 0;
    scenarios.forEach((opponent, k) => {
      for (let s = 0; s < seeds; s++) {
        // a fresh seed per evaluation: a fixed seed lets the search tune plans to one roll of the dice
        const battleSeed = seed + tried * 7 + k * 101 + (s + seedBase) * 7919 + (opts.searchSeed ?? 0) * 104729;
        const r = new Battle([playerDefs, myDefs], [opponent, mine], { seed: battleSeed, towerLevels: [player.towerLevels, myLevels] }).run();
        const [toPlayer, toMe] = roundDamage(r, defs);
        total += toPlayer - toMe;
        runs++;
      }
    });
    const unlockSpend = list.reduce((t, u, i) => t + (me.unlocked.includes(u.id) || list.slice(0, i).includes(u) ? 0 : unlockPrice(u)), 0);
    let score = total / runs + (extras.cost + unlockSpend) * FUTURE_VALUE * RULES.damagePerSupply;
    // a little personality on easier settings
    if (difficulty === "easy") score += rng.range(-60, 60);
    return { sum: score * runs, runs };
  };
  const candidate = (extras: Extras, list: UnitDef[]): Candidate => {
    const squads = place(list);
    const e = evaluate(extras, list, squads);
    return { extras, units: list, squads, score: e.sum / e.runs, runs: e.runs };
  };

  const pool: Candidate[] = [];
  let focus: UnitDef[] = [];
  if (difficulty === "hard") {
    // Screening: each affordable unit type alone, as many squads as the supply buys. The best few become the
    // focus of the plans that follow: a counter found by simulation, not looked up.
    const types = units.filter((u) => priceOf(u, new Set(me.unlocked)) <= me.supply);
    for (let i = types.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [types[i], types[j]] = [types[j], types[i]];
    }
    const screened: { u: UnitDef; score: number }[] = [];
    for (const u of types) {
      if (screened.length && outOfTime(HARD_PHASES.screen)) break;
      const c = candidate(NO_EXTRAS, massOf(u));
      screened.push({ u, score: c.score });
      pool.push(c);
    }
    focus = screened.sort((a, b) => b.score - a.score).slice(0, 3).map((s) => s.u);
  }
  const randoms = Math.min(CANDIDATES[difficulty], difficulty === "hard" ? 16 : CANDIDATES[difficulty]);
  for (let i = 0; i < randoms; i++) {
    if (pool.length && outOfTime(difficulty === "hard" ? HARD_PHASES.random : 1)) break;
    const extras = randomExtras(units, me, rng);
    const unitFocus = focus.length ? focus : i % 2 === 0 ? [rng.pick(units)] : [];
    pool.push(candidate(extras, fillUnits(units, me, me.supply - extras.cost, rng, [], unitFocus)));
  }
  if (difficulty === "hard") {
    // Local search: tweak one of the best plans (swap, add or drop a squad, or place it again); keep improvements.
    while (!outOfTime(HARD_PHASES.search)) {
      pool.sort((a, b) => b.score - a.score);
      const base = pool[rng.int(Math.min(3, pool.length))];
      const list = [...base.units];
      const move = rng.int(4);
      if (move === 0 && list.length) list.splice(rng.int(list.length), 1); // drop one, then refill
      if (move === 1 && list.length) list[rng.int(list.length)] = rng.next() < 0.6 && focus.length ? rng.pick(focus) : rng.pick(units);
      const refilled = move === 3 ? list : fillUnits(units, me, me.supply - base.extras.cost, rng, list, focus);
      if (unitsCost(refilled, me.unlocked) + base.extras.cost > me.supply) continue;
      pool.push(candidate(base.extras, refilled));
    }
    // Finalists: re-score the best few over more battle seeds, so a lucky simulation doesn't decide the round.
    pool.sort((a, b) => b.score - a.score);
    for (const c of pool.slice(0, FINALISTS)) {
      if (outOfTime()) break;
      const e = evaluate(c.extras, c.units, c.squads, EXTRA_SEEDS, 1);
      c.score = (c.score * c.runs + e.sum) / (c.runs + e.runs);
      c.runs += e.runs;
    }
  }

  pool.sort((a, b) => b.score - a.score);
  const best = pool[0];
  if (!best) return { squads: [], unlocks: [], upgrades: [], towerUpgrades: [], promotions: [], spent: 0, candidatesTried: tried, bestScore: null };
  // a squad that didn't fit on the field isn't paid for, and neither is the unlock of a unit that didn't fit
  const placed = best.squads.map((q) => q.defId);
  const unlocks = [...new Set(placed)].filter((id) => !me.unlocked.includes(id));
  const spent = armyValue(best.squads, defs) + unlocks.reduce((t, id) => t + unlockPrice(defs.get(id)!), 0) + best.extras.cost;
  return {
    squads: best.squads,
    unlocks,
    upgrades: best.extras.upgrades,
    towerUpgrades: best.extras.towerUpgrades,
    promotions: best.extras.promotions,
    spent,
    candidatesTried: tried,
    bestScore: best.score,
  };

  // as many squads of one unit as the supply buys, up to the cap
  function massOf(u: UnitDef): UnitDef[] {
    const list: UnitDef[] = [];
    while (list.length < MAX_SQUADS && unitsCost([...list, u], me.unlocked) <= me.supply) list.push(u);
    return list;
  }
}

// An army with the listed squads promoted one level.
export function promoted(army: PlacedSquad[], uids: string[]): PlacedSquad[] {
  return army.map((sq) => (uids.includes(sq.uid) ? { ...sq, level: (sq.level ?? 1) + 1 } : sq));
}
