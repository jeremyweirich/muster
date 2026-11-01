// The balance harness from docs/BALANCE.md. Usage: npm run balance -- <mode> [args] [flags]
//   stats                  self-TTK, HP and DPS per 100 supply, Lanchester value vs the baseline (no fights)
//   coverage               role counts, anti-air per role, and static checks on the target table
//   mirror                 side-bias test: each unit against its own reflection (should be 50%)
//   density [armies]       fight shape: time to contact, fight length, share of each army fighting at once
//   matrix                 equal-cost matrix: win rate, value margin, fight time, Nash mix
//                          (--scale 1,2,4 reruns it at bigger budgets; --csv <file> saves every matchup)
//   targets <unit...>      quick check: only the relations and upgrade intents that involve these units
//   check                  grade the matrix against src/data/balance.ts: mirrors, targets, hard counters, health
//   distance <a> <b>       closing-distance test: a starts d tiles from b, for d from --from to --to by --step
//   fight <armyA> <armyB>  composition test, e.g. "knights*2,cleric" "frost_elemental*3,cleric"
//                          (--upsA / --upsB knights:shield_wall,cleric:blessing)
//   sensitivity <unit>     nudge each stat by ±--pct (10) percent and list matchups that flip
//   upgrades <unit>        the unit's row with each upgrade, all four, and promoted to each level
// Flags: --seeds N (8), --mirrorSeeds N (32), --budget B (1000), --units a,b,c (limit the roster).
// Level 1, no towers, sides alternated, formations randomized. Win rates move in steps of 1/seeds.
import { writeFileSync } from "node:fs";
import { ANCHOR_UNIT, BALANCE_TARGETS, BASELINE_UNIT, RELATIONS, ROLE_INFO, TOLERANCE, beatsOf, losesToOf, type BalanceRole } from "../src/data/balance";
import { DEFAULT_UNITS } from "../src/data/units";
import { RULES } from "../src/data/rules";
import { bandTtk, lanchesterValue, modelDps, nashMix, perSupply, selfTtk, sizeClass, ttkBand } from "../src/game/balance";
import { autoPlace, defMap } from "../src/game/army";
import { massArmy, pickStyle, runArmies, runMatchup, equalCostCounts, type MatchupOptions, type MatchupResult } from "../src/game/lab";
import { Battle, footprintOf } from "../src/sim/battle";
import { Rng } from "../src/sim/rng";
import { upgradedDefs } from "../src/sim/upgrades";
import type { PlacedSquad, UnitDef } from "../src/sim/types";

// ------------------------------------------------------------------ arguments
const argv = process.argv.slice(2);
const flags: Record<string, string> = {};
const pos: string[] = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i] ?? "";
  else pos.push(argv[i]);
}
const num = (k: string, d: number) => (flags[k] !== undefined ? Number(flags[k]) : d);
const mode = pos.shift();
const SEEDS = num("seeds", 8);
const BUDGET = num("budget", 1000);
const MIRROR_SEEDS = num("mirrorSeeds", 32); // the side-bias test needs more seeds than the matrix to be readable

const units = DEFAULT_UNITS;
const defs = defMap(units);
const D = (id: string) => {
  const d = defs.get(id);
  if (!d) throw new Error(`unknown unit: ${id}`);
  return d;
};
const roster = flags.units ? flags.units.split(",").map((id) => D(id).id) : units.map((u) => u.id);

// ------------------------------------------------------------------ formatting
const pct = (x: number) => `${Math.round(x * 100)}%`;
const fixed = (x: number | null, d = 1) => (x === null ? "-" : x === Infinity ? "inf" : x.toFixed(d));
const pad = (s: string | number, n: number) => String(s).padStart(n);
const abbr = (id: string) => {
  const w = id.split("_");
  return w.length === 1 ? id.slice(0, 4) : w[0].slice(0, 2) + w[1].slice(0, 2);
};
const margin = (r: MatchupResult) => r.avgRemainA - r.avgRemainB;
function table(ids: string[], cell: (a: string, b: string) => string) {
  console.log("".padEnd(16) + ids.map((id) => pad(abbr(id), 5)).join(""));
  for (const a of ids) console.log(a.padEnd(16) + ids.map((b) => pad(cell(a, b), 5)).join(""));
}

// ------------------------------------------------------------------ the matrix
const run = (a: string, b: string, budget = BUDGET, opts: MatchupOptions = {}, list: UnitDef[] = units) =>
  runMatchup(list, a, b, budget, SEEDS, { formations: "random", ...opts });

const flip = (r: MatchupResult): MatchupResult => ({
  a: r.b, b: r.a, winRate: 1 - r.winRate, avgRemainA: r.avgRemainB, avgRemainB: r.avgRemainA, avgTime: r.avgTime, supply: [r.supply[1], r.supply[0]],
});

// Every pair once (the reverse is the same fight seen from the other side), plus mirrors.
function matrix(ids: string[], budget = BUDGET): Map<string, MatchupResult> {
  const m = new Map<string, MatchupResult>();
  for (let i = 0; i < ids.length; i++)
    for (let j = i; j < ids.length; j++) {
      const r = run(ids[i], ids[j], budget);
      m.set(`${ids[i]}|${ids[j]}`, r);
      if (i !== j) m.set(`${ids[j]}|${ids[i]}`, flip(r));
    }
  return m;
}
const get = (m: Map<string, MatchupResult>, a: string, b: string) => m.get(`${a}|${b}`)!;

function printMatrix(m: Map<string, MatchupResult>, ids: string[], label: string) {
  console.log(`\n${label}: row's win rate vs column (equal supply)`);
  table(ids, (a, b) => pct(get(m, a, b).winRate));
  console.log(`\n${label}: value margin, row's surviving supply minus column's, in % of starting supply`);
  table(ids, (a, b) => (a === b ? "." : String(Math.round(margin(get(m, a, b)) * 100))));
  const others = (a: string) => ids.filter((b) => b !== a);
  const rank = ids
    .map((a) => ({ a, m: others(a).reduce((t, b) => t + margin(get(m, a, b)), 0) / Math.max(1, others(a).length) }))
    .sort((x, y) => y.m - x.m);
  console.log(`\nmean value margin: ${rank.map((r) => `${r.a} ${Math.round(r.m * 100)}`).join("  ")}`);
  const time = [...m.values()].reduce((t, r) => t + r.avgTime, 0) / m.size;
  console.log(`mean fight time ${time.toFixed(1)}s (limit ${RULES.battleTimeLimit}s)`);
  const mix = nashMix(ids.map((a) => ids.map((b) => margin(get(m, a, b)))));
  const weighted = ids.map((id, i) => ({ id, w: mix[i] })).filter((x) => x.w >= 0.01).sort((x, y) => y.w - x.w);
  console.log(`Nash mix (${weighted.length} of ${ids.length} units get weight): ${weighted.map((x) => `${x.id} ${pct(x.w)}`).join("  ")}`);
}

// A true mirror: one placement reflected onto the other side, so the only difference is which side each army
// is on. Returns the bottom side's win rate, which should be about 50%.
function sideBias(id: string): number {
  const u = D(id);
  let wins = 0;
  for (let s = 0; s < MIRROR_SEEDS; s++) {
    const rng = new Rng(3000 + s);
    const bottom = massArmy(u, equalCostCounts(u.cost, u.cost, BUDGET)[0], 0, defs, rng, pickStyle(rng, "random"));
    const top = bottom.map((q) => ({ ...q, uid: `m${q.uid}`, y: RULES.fieldH - q.y - footprintOf(u, q.rot).h }));
    const r = new Battle(defs, [bottom, top], { seed: 500 + s, towers: false }).run();
    wins += r.winner === 0 ? 1 : r.winner === null ? 0.5 : 0;
  }
  return wins / MIRROR_SEEDS;
}

function printMirrors(ids: string[], all = false) {
  console.log(`Mirrors: the bottom side's win rate against its own reflection (${pct(TOLERANCE.mirror[0])}-${pct(TOLERANCE.mirror[1])}, or the sim is biased):`);
  const rows = ids.map((id) => [id, sideBias(id)] as const);
  const bad = rows.filter(([, w]) => w < TOLERANCE.mirror[0] || w > TOLERANCE.mirror[1]);
  const shown = all ? rows : bad;
  console.log(shown.length ? `  ${shown.map(([id, w]) => `${id} ${pct(w)}`).join(", ")}` : "  all fine");
  if (all) console.log(`  ${bad.length} of ${ids.length} outside the band`);
}

// ------------------------------------------------------------------ modes
if (mode === "mirror") printMirrors(roster, true);

if (mode === "targets") {
  // The quick loop while tuning: only the relations and upgrade intents that involve the named units.
  const named = pos.map((id) => D(id).id);
  let held = 0, total = 0;
  for (const [a, b, why] of RELATIONS) {
    if (!named.includes(a) && !named.includes(b)) continue;
    const r = run(a, b);
    total++;
    const ok = r.winRate >= TOLERANCE.soft;
    if (ok) held++;
    console.log(`${ok ? "  ok  " : "  MISS"} ${`${a} > ${b}`.padEnd(36)} win ${pad(pct(r.winRate), 4)}  margin ${pad(Math.round(margin(r) * 100), 4)}  (${why})`);
  }
  for (const a of named)
    for (const [up, intent] of Object.entries(BALANCE_TARGETS[a]?.upgrades ?? {}))
      for (const b of intent.beats ?? []) {
        const r = run(a, b, BUDGET, { defsA: upgradedDefs(defs, { [a]: [up] }) });
        total++;
        const ok = r.winRate >= TOLERANCE.soft;
        if (ok) held++;
        console.log(`${ok ? "  ok  " : "  MISS"} ${`${a} + ${up} > ${b}`.padEnd(36)} win ${pad(pct(r.winRate), 4)}  margin ${pad(Math.round(margin(r) * 100), 4)}  (${intent.intent})`);
      }
  console.log(`${held} of ${total} hold`);
}

if (mode === "density") {
  // Fight shape, not balance: how long until first contact, how long the fight lasts, and how much of each army
  // fights at once. Mechabellum's fights run about 40–60 s and are spread out; ours shouldn't be one blob.
  // The probes are just mixed armies of about 1000 supply, mirrored so the fight is even.
  const probes = pos.length ? pos : [
    "knights*2,crossbowmen*3,ballista,pikemen",
    "grunts*3,skirmishers,wolf_riders,troll,giant_bats",
    "stone_golem,fire_elemental,air_elemental,frost_elemental,cloudlings",
    "knights*2,crossbowmen*2,fire_elemental,troll,wolf_riders",
  ];
  const parse = (spec: string) => spec.split(",").flatMap((p) => { const [id, n] = p.trim().split("*"); return Array(Number(n ?? 1)).fill(D(id)); });
  console.log(`speed ${RULES.speedScale} tiles/s per point, deploy depth ${RULES.deployDepth}, no-man's-land ${RULES.fieldH - 2 * RULES.deployDepth} rows, time limit ${RULES.battleTimeLimit}s`);
  console.log("probe (mirrored)                                              contact   fight  engaged  timeouts");
  let all = 0;
  for (const spec of probes) {
    let contact = 0, time = 0, engaged = 0, timeouts = 0;
    for (let s = 0; s < SEEDS; s++) {
      const rng = new Rng(4000 + s);
      const army = parse(spec);
      const b = new Battle(defs, [autoPlace(army, [], 0, defs, 1, rng, pickStyle(rng, "random")), autoPlace(army, [], 1, defs, 1, rng, pickStyle(rng, "random"))], { seed: 600 + s, towers: false });
      let first = -1, samples = 0, share = 0;
      while (!b.over) {
        b.step();
        const armed = b.models.filter((m) => m.alive && m.def.attack && !m.def.structure);
        const fighting = armed.filter((m) => m.engaged).length;
        if (first < 0 && fighting) first = b.time;
        if (first >= 0 && armed.length) { samples++; share += fighting / armed.length; }
      }
      contact += Math.max(0, first);
      time += b.time;
      engaged += samples ? share / samples : 0;
      if (b.timedOut) timeouts++;
    }
    all += time / SEEDS;
    console.log(`${spec.padEnd(62)}${pad(fixed(contact / SEEDS), 6)}s${pad(fixed(time / SEEDS), 7)}s${pad(pct(engaged / SEEDS), 9)}${pad(timeouts, 10)}`);
  }
  console.log(`mean fight ${fixed(all / probes.length)}s; "engaged" is the mean share of armed models in range of a target after first contact`);
}

if (mode === "stats") {
  const base = D(BASELINE_UNIT);
  console.log(`Self-TTK = HP / own DPS per model (armor: counting its resistance to its own element). Value = Lanchester`);
  console.log(`strength per supply (HP x DPS) relative to ${base.name} = 1.0. Raw stats only: no splash, chain, status or range.\n`);
  console.log("unit            role             analogue      size    cost squad    HP   DPS  TTK  armor band     HP/100 DPS/100 value");
  const order = Object.keys(ROLE_INFO) as BalanceRole[];
  const rows = roster.map(D).sort((x, y) => order.indexOf(BALANCE_TARGETS[x.id]?.role) - order.indexOf(BALANCE_TARGETS[y.id]?.role));
  for (const u of rows) {
    const t = BALANCE_TARGETS[u.id];
    const band = ttkBand(u);
    const ttk = bandTtk(u);
    const inBand = band && ttk !== null ? (ttk >= band[0] && ttk <= band[1] ? "ok" : ttk < band[0] ? "low" : "high") : "";
    const s = perSupply(u);
    console.log(
      `${u.id.padEnd(16)}${(t ? ROLE_INFO[t.role].name : "?").padEnd(17)}${(t?.analogue || "-").padEnd(14)}${(sizeClass(u) ?? "?").padEnd(7)}` +
        `${pad(u.cost, 5)}${pad(u.squadSize, 6)}${pad(u.hp, 6)}${pad(fixed(modelDps(u)), 6)}${pad(fixed(selfTtk(u)), 5)}${pad(fixed(selfTtk(u, true)), 7)}` +
        ` ${(band ? `${band[0]}-${band[1]}` : "").padEnd(6)}${inBand.padEnd(5)}${pad(Math.round(s.hp), 6)}${pad(fixed(s.dps), 8)}${pad(fixed(lanchesterValue(u, base), 2), 6)}`,
    );
  }
  console.log(`\nAnchors: ${base.name} (baseline, 1.0) and ${D(ANCHOR_UNIT).name}.`);
}

if (mode === "coverage") {
  const ids = roster;
  const byRole = new Map<BalanceRole, string[]>();
  for (const id of ids) {
    const t = BALANCE_TARGETS[id];
    if (!t) { console.log(`no balance target: ${id}`); continue; }
    byRole.set(t.role, [...(byRole.get(t.role) ?? []), id]);
  }
  // docs/REFERENCE_2.md §2: Mechabellum's early-access roster and the suggested first-pass counts.
  const template: Record<BalanceRole, string> = {
    chaff: "2-3", chaffClear: "4", antiMedium: "1-2", antiGiant: "3-4", tank: "3", diver: "(in tanks)", utility: "1", lateGame: "1",
  };
  console.log("role              count  suggested  air  hits air  units");
  for (const role of Object.keys(ROLE_INFO) as BalanceRole[]) {
    const list = byRole.get(role) ?? [];
    const air = list.filter((id) => D(id).layer === "air").length;
    const aa = list.filter((id) => D(id).attack?.targets.includes("air")).length;
    console.log(`${ROLE_INFO[role].name.padEnd(18)}${pad(list.length, 5)}${pad(template[role], 11)}${pad(air, 5)}${pad(aa, 10)}  ${list.join(", ")}`);
  }
  // Roles reachable by upgrade: the holes a unit can fill if you pay for the path.
  console.log("\nrole shifts by upgrade:");
  for (const id of ids)
    for (const [up, intent] of Object.entries(BALANCE_TARGETS[id]?.upgrades ?? {}))
      if (intent.role) console.log(`  ${id} ${up} -> ${ROLE_INFO[intent.role].name}`);

  const issues: string[] = [];
  for (const id of ids) {
    const t = BALANCE_TARGETS[id];
    if (!t || t.role === "utility") continue;
    if (!beatsOf(id).length) issues.push(`${id} has no listed win`);
    if (!losesToOf(id).length) issues.push(`${id} has no listed loss (every unit needs a counter)`);
  }
  for (const [a, b] of RELATIONS) {
    if (!defs.has(a) || !defs.has(b)) issues.push(`${a} > ${b} names an unknown unit`);
    if (RELATIONS.some(([x, y]) => x === b && y === a)) issues.push(`${a} and ${b} both beat each other`);
    if (RELATIONS.filter(([x, y]) => x === a && y === b).length > 1) issues.push(`${a} > ${b} is listed twice`);
  }
  for (const a of ids)
    for (const b of ids) {
      if (a === b || !beatsOf(a).length || D(a).cost !== D(b).cost) continue;
      const wa = beatsOf(a), wb = beatsOf(b);
      if (wa.every((x) => wb.includes(x)) && wb.length > wa.length) issues.push(`${b}'s listed wins are a superset of ${a}'s (same cost)`);
    }
  for (const id of ids) {
    const ups = (D(id).upgrades ?? []).map((u) => u.id), intents = Object.keys(BALANCE_TARGETS[id]?.upgrades ?? {});
    for (const u of ups) if (!intents.includes(u)) issues.push(`${id} ${u} has no intent`);
    for (const u of intents) if (!ups.includes(u)) issues.push(`${id} has an intent for unknown upgrade ${u}`);
  }
  const chaff = byRole.get("chaff")?.length ?? 0, clear = byRole.get("chaffClear")?.length ?? 0;
  if (clear < chaff + 1) issues.push(`chaff clear (${clear}) should outnumber chaff (${chaff}) by at least one`);
  console.log(issues.length ? `\n${issues.length} issues:\n  ${issues.join("\n  ")}` : "\nNo issues.");
}

if (mode === "matrix") {
  const scales = (flags.scale ?? "1").split(",").map(Number);
  const csv: string[] = ["scale,a,b,supply_a,supply_b,win_a,remain_a,remain_b,time"];
  const results: Map<string, MatchupResult>[] = [];
  const t0 = performance.now();
  for (const k of scales) {
    const m = matrix(roster, BUDGET * k);
    results.push(m);
    printMatrix(m, roster, `${k}x (about ${BUDGET * k} supply)`);
    for (const r of m.values())
      csv.push([k, r.a, r.b, Math.round(r.supply[0]), Math.round(r.supply[1]), r.winRate, r.avgRemainA.toFixed(3), r.avgRemainB.toFixed(3), r.avgTime.toFixed(1)].join(","));
  }
  if (scales.length > 1) {
    // Swarms and splash scale differently: list matchups whose winner changes with the budget.
    console.log("\nmatchups whose winner changes with scale (row's win rate at each scale):");
    for (let i = 0; i < roster.length; i++)
      for (let j = i + 1; j < roster.length; j++) {
        const w = results.map((m) => get(m, roster[i], roster[j]).winRate);
        if (w.some((x) => x >= TOLERANCE.soft) && w.some((x) => x <= 1 - TOLERANCE.soft))
          console.log(`  ${roster[i]} vs ${roster[j]}: ${w.map(pct).join(" / ")}`);
      }
  }
  if (flags.csv) {
    writeFileSync(flags.csv, csv.join("\n") + "\n");
    console.log(`\nwrote ${csv.length - 1} matchups to ${flags.csv}`);
  }
  console.log(`(${SEEDS} seeds, ${Math.round((performance.now() - t0) / 1000)}s)`);
}

if (mode === "check") {
  const ids = roster;
  const m = matrix(ids);
  const beats = (a: string, b: string) => get(m, a, b).winRate >= TOLERANCE.soft;
  // Hard counter: wins against hardRatio times its own supply of the target.
  const hard = new Map<string, MatchupResult>();
  for (const a of ids)
    for (const b of ids)
      if (a !== b && beats(a, b)) hard.set(`${a}|${b}`, run(a, b, BUDGET, { costA: D(a).cost * TOLERANCE.hardRatio }));
  const isHard = (a: string, b: string) => (hard.get(`${a}|${b}`)?.winRate ?? 0) > 0.5;
  const verdict = (a: string, b: string) => (isHard(a, b) ? "hard" : beats(a, b) ? "soft" : beats(b, a) ? "loses" : "even");
  const fmt = (a: string, b: string) => `win ${pct(get(m, a, b).winRate)}, margin ${Math.round(margin(get(m, a, b)) * 100)}`;

  printMirrors(ids);

  let held = 0, total = 0;
  const misses: string[] = [];
  for (const [a, b, why] of RELATIONS) {
    if (!ids.includes(a) || !ids.includes(b)) continue;
    total++;
    if (beats(a, b)) held++;
    else misses.push(`${a} should beat ${b} (${why}): ${verdict(a, b)} (${fmt(a, b)})`);
  }
  console.log(`\nTargets (src/data/balance.ts): ${held} of ${total} hold`);
  for (const s of misses) console.log(`  MISS ${s}`);

  // Upgrade intents: with the upgrade bought, the unit should win the matchups its intent lists.
  let upHeld = 0, upTotal = 0;
  const upMisses: string[] = [];
  for (const a of ids)
    for (const [up, intent] of Object.entries(BALANCE_TARGETS[a]?.upgrades ?? {}))
      for (const b of intent.beats ?? []) {
        if (!ids.includes(b)) continue;
        upTotal++;
        const r = run(a, b, BUDGET, { defsA: upgradedDefs(defs, { [a]: [up] }) });
        if (r.winRate >= TOLERANCE.soft) upHeld++;
        else upMisses.push(`${a} + ${up} should beat ${b}: win ${pct(r.winRate)} (${pct(get(m, a, b).winRate)} without)`);
      }
  console.log(`\nUpgrade intents: ${upHeld} of ${upTotal} hold`);
  for (const s of upMisses) console.log(`  MISS ${s}`);

  const unplanned: string[] = [];
  for (const a of ids)
    for (const b of ids)
      if (a !== b && isHard(a, b) && !beatsOf(a).includes(b)) unplanned.push(`${a} > ${b}`);
  console.log(`\nUnplanned hard counters (not in the table; fine if intended): ${unplanned.length ? unplanned.join(", ") : "none"}`);

  console.log("\nRoster health:");
  const armed = ids.filter((id) => D(id).attack);
  for (const id of armed) {
    const counters = ids.filter((x) => x !== id && isHard(x, id));
    const victims = ids.filter((x) => x !== id && isHard(id, x));
    const notes: string[] = [];
    if (!counters.length) notes.push("NO HARD COUNTER");
    if (victims.length > (ids.length - 1) * TOLERANCE.maxHardShare) notes.push(`hard-counters ${victims.length} of ${ids.length - 1}`);
    if (!ids.some((x) => x !== id && beats(id, x))) notes.push("beats nothing");
    const band = ttkBand(D(id)), ttk = bandTtk(D(id));
    if (band && ttk !== null && (ttk < band[0] || ttk > band[1])) notes.push(`self-TTK ${fixed(ttk)}s outside ${band[0]}-${band[1]}`);
    console.log(`  ${id.padEnd(16)} hard counters: ${(counters.join(", ") || "-").padEnd(40)} ${notes.join("; ")}`);
  }
  const mix = nashMix(ids.map((a) => ids.map((b) => margin(get(m, a, b)))));
  const weighted = ids.filter((_, i) => mix[i] >= 0.01);
  console.log(`\nNash mix puts weight on ${weighted.length} of ${ids.length}: ${weighted.map((id) => `${id} ${pct(mix[ids.indexOf(id)])}`).join("  ")}`);
}

if (mode === "distance") {
  // A starts d tiles in front of B's front edge (A usually melee, B ranged). Shows where the closing tax decides it.
  const [aId, bId] = pos;
  const a = D(aId), b = D(bId);
  const [nA, nB] = equalCostCounts(a.cost, b.cost, BUDGET);
  const rect = (q: PlacedSquad) => footprintOf(D(q.defId), q.rot);
  console.log(`${a.name} x${nA} starting d tiles from ${b.name} x${nB} (${nA * a.cost} vs ${nB * b.cost} supply)`);
  console.log("   d   A win  A left  B left   time");
  let last: boolean | null = null;
  for (let d = num("from", 1); d <= num("to", 20); d += num("step", 1)) {
    let feasible = true;
    const r = runArmies(defs, (sideA, rng) => {
      const sideB: 0 | 1 = sideA === 0 ? 1 : 0;
      const A = massArmy(a, nA, sideA, defs, rng, pickStyle(rng, "random"));
      const B = massArmy(b, nB, sideB, defs, rng, pickStyle(rng, "random"));
      // side 0 sits at the bottom and advances up (toward smaller y)
      const frontA = sideA === 0 ? Math.min(...A.map((q) => q.y)) : Math.max(...A.map((q) => q.y + rect(q).h));
      const frontB = sideA === 0 ? Math.max(...B.map((q) => q.y + rect(q).h)) : Math.min(...B.map((q) => q.y));
      const shift = d - Math.abs(frontA - frontB);
      const moved = A.map((q) => ({ ...q, y: q.y + (sideA === 0 ? shift : -shift) }));
      if (moved.some((q) => q.y < 0 || q.y + rect(q).h > RULES.fieldH)) feasible = false;
      return [moved, B];
    }, SEEDS);
    if (!feasible) { console.log(`${pad(d, 4)}   (doesn't fit on the field)`); continue; }
    const won = r.winRate > 0.5;
    const mark = last !== null && won !== last ? "  <- crossover" : "";
    last = won;
    console.log(`${pad(d, 4)}${pad(pct(r.winRate), 8)}${pad(pct(r.remain[0]), 8)}${pad(pct(r.remain[1]), 8)}${pad(r.time.toFixed(1), 7)}s${mark}`);
  }
}

if (mode === "fight") {
  // Army spec: comma-separated unit ids, each optionally *count. Frontliners are judged by what they enable.
  const parse = (spec: string) => spec.split(",").flatMap((p) => { const [id, n] = p.trim().split("*"); return Array(Number(n ?? 1)).fill(D(id)); });
  const ups = (spec?: string) => {
    const state: Record<string, string[]> = {};
    for (const p of spec ? spec.split(",") : []) { const [id, up] = p.split(":"); (state[id] ??= []).push(up); }
    return upgradedDefs(defs, state);
  };
  const A = parse(pos[0]), B = parse(pos[1]);
  const defsA = ups(flags.upsA), defsB = ups(flags.upsB);
  const r = runArmies([defsA, defsB], (sideA, rng) => [
    autoPlace(A, [], sideA, defsA, 1, rng, pickStyle(rng, "random")),
    autoPlace(B, [], sideA === 0 ? 1 : 0, defsB, 1, rng, pickStyle(rng, "random")),
  ], SEEDS);
  console.log(`A: ${pos[0]} (${Math.round(r.supply[0])} supply)  vs  B: ${pos[1]} (${Math.round(r.supply[1])} supply)`);
  console.log(`A wins ${pct(r.winRate)}; value left A ${pct(r.remain[0])}, B ${pct(r.remain[1])}; mean time ${r.time.toFixed(1)}s (${SEEDS} seeds)`);
}

if (mode === "sensitivity") {
  // Nudge one stat at a time. A matchup that flips from a clear win to a clear loss on a 10% change is brittle.
  const id = pos[0];
  const u = D(id);
  const k = num("pct", 10) / 100;
  const opponents = roster.filter((x) => x !== id);
  const row = (list: UnitDef[]) => new Map(opponents.map((b) => [b, run(id, b, BUDGET, {}, list)]));
  const base = row(units);
  const nudges: [string, (d: UnitDef, f: number) => UnitDef][] = [
    ["hp", (d, f) => ({ ...d, hp: d.hp * f })],
    ["damage", (d, f) => (d.attack ? { ...d, attack: { ...d.attack, damage: d.attack.damage * f } } : d)],
    ["attack rate", (d, f) => (d.attack ? { ...d, attack: { ...d.attack, cooldown: d.attack.cooldown / f } } : d)],
    ["range", (d, f) => (d.attack ? { ...d, attack: { ...d.attack, range: d.attack.range * f } } : d)],
    ["speed", (d, f) => ({ ...d, speed: d.speed * f })],
  ];
  const mean = (r: Map<string, MatchupResult>) => [...r.values()].reduce((t, x) => t + margin(x), 0) / r.size;
  console.log(`${u.name}: mean value margin ${Math.round(mean(base) * 100)} at base. Change per nudge, and matchups that flip:`);
  for (const [name, f] of nudges)
    for (const sign of [1, -1]) {
      const list = units.map((d) => (d.id === id ? f(d, 1 + sign * k) : d));
      const r = row(list);
      const flips = opponents.filter((b) => {
        const w0 = base.get(b)!.winRate, w1 = r.get(b)!.winRate;
        return Math.abs(w1 - w0) >= 0.5 && w0 > 0.5 !== w1 > 0.5;
      });
      const label = `${name} ${sign > 0 ? "+" : "-"}${Math.round(k * 100)}%`;
      console.log(`  ${label.padEnd(18)} ${pad(Math.round((mean(r) - mean(base)) * 100), 4)}  ${flips.map((b) => `${b} ${pct(base.get(b)!.winRate)}->${pct(r.get(b)!.winRate)}`).join(", ")}`);
    }
}

if (mode === "upgrades") {
  // Upgrades are free here (they're bought once for every squad); promoted squads pay half the unit's cost per level.
  const id = pos[0];
  const u = D(id);
  const opponents = roster.filter((x) => x !== id);
  const variants: [string, MatchupOptions][] = [["base", {}]];
  for (const up of u.upgrades ?? []) variants.push([up.id, { defsA: upgradedDefs(defs, { [id]: [up.id] }) }]);
  variants.push(["all four", { defsA: upgradedDefs(defs, { [id]: (u.upgrades ?? []).map((x) => x.id) }) }]);
  for (let lv = 2; lv <= RULES.levelXp.length + 1; lv++) variants.push([`level ${lv}`, { levelA: lv, costA: u.cost * (1 + 0.5 * (lv - 1)) }]);
  console.log(`${u.name}'s win rate vs each unit (equal supply; levels pay for their promotions)`);
  console.log("".padEnd(20) + opponents.map((b) => pad(abbr(b), 5)).join("") + "  margin");
  for (const [name, opts] of variants) {
    const rs = opponents.map((b) => run(id, b, BUDGET, opts));
    const mm = rs.reduce((t, r) => t + margin(r), 0) / rs.length;
    console.log(name.padEnd(20) + rs.map((r) => pad(pct(r.winRate), 5)).join("") + pad(Math.round(mm * 100), 8));
  }
  console.log("\nIntents (src/data/balance.ts):");
  for (const [up, i] of Object.entries(BALANCE_TARGETS[id]?.upgrades ?? {}))
    console.log(`  ${up.padEnd(18)} ${i.intent}${i.role ? ` [-> ${ROLE_INFO[i.role].name}]` : ""}${i.beats?.length ? ` (should beat ${i.beats.join(", ")})` : ""}`);
}

if (!mode || !["stats", "coverage", "mirror", "density", "targets", "matrix", "check", "distance", "fight", "sensitivity", "upgrades"].includes(mode)) {
  console.log("Usage: npm run balance -- <stats|coverage|mirror|matrix|check|distance|fight|sensitivity|upgrades> [args]. See the top of scripts/balance.ts.");
}
