// Balance experiments behind docs/PLAYTEST-2026-10.md. Usage: npm run experiments -- <A|B|C|D|E|F>
//   A  promotion: two Lv2 squads vs four Lv1 squads of each unit, beside the same filler
//   B  towers: tower levels vs the same supply spent on Longbows
//   C  upgrades in one-unit mass armies (1000 supply) vs the four reference armies, and vs +200 supply
//   D  upgrades inside each faction's reference army, against the other three
//   E  one squad of each unit added to the reference armies vs the same supply of Longbows/Knights
//   F  role, range, element and anti-air coverage
//   G  faction triangle: the four reference armies against each other, towers on
// Level 1 except A, automatic placement, sides alternated, few seeds: treat small differences as noise.
import { DEFAULT_UNITS } from "../src/data/units";
import { Battle } from "../src/sim/battle";
import { upgradedDefs } from "../src/sim/upgrades";
import { Rng } from "../src/sim/rng";
import { autoPlace, defMap } from "../src/game/army";
import type { PlacedSquad, UnitDef } from "../src/sim/types";

const defs = defMap(DEFAULT_UNITS);
const D = (id: string) => defs.get(id)!;
type Army = { ids: string[]; levels?: number[]; ups?: Record<string, string[]>; towers?: number[] };

// Fight a vs b over `seeds` seeds, alternating sides. Returns a's win rate and mean value-left difference (supply).
function fight(a: Army, b: Army, seeds = 8, towers = false) {
  let wins = 0, diff = 0, time = 0, fallsA = 0;
  for (let s = 0; s < seeds; s++) {
    const swap = s % 2 === 1;
    const rng = new Rng(500 + s);
    // autoPlace sorts by depth, so attach levels by unit id rather than by index
    const placeL = (arm: Army, side: 0 | 1): PlacedSquad[] => {
      const placed = autoPlace(arm.ids.map(D), [], side, defs, 1, rng, "center");
      const pool = arm.ids.map((id, i) => ({ id, lv: arm.levels?.[i] ?? 1 }));
      return placed.map((q) => { const k = pool.findIndex((p) => p.id === q.defId); const lv = pool[k].lv; pool.splice(k, 1); return { ...q, level: lv }; });
    };
    const sa: 0 | 1 = swap ? 1 : 0, sb: 0 | 1 = swap ? 0 : 1;
    const armies: [PlacedSquad[], PlacedSquad[]] = [[], []];
    armies[sa] = placeL(a, sa); armies[sb] = placeL(b, sb);
    const dd: [Map<string, UnitDef>, Map<string, UnitDef>] = [defs, defs];
    dd[sa] = upgradedDefs(defs, a.ups ?? {}); dd[sb] = upgradedDefs(defs, b.ups ?? {});
    const tl: [number[], number[]] = [[0, 0], [0, 0]];
    tl[sa] = a.towers ?? [0, 0]; tl[sb] = b.towers ?? [0, 0];
    const r = new Battle(dd, armies, { seed: 900 + s, towers, towerLevels: tl }).run();
    if (r.winner === sa) wins++; else if (r.winner === null) wins += 0.5;
    const val = (side: 0 | 1) => r.survivors[side].reduce((t, q) => t + D(q.defId).cost * (q.alive / q.total), 0);
    diff += val(sa) - val(sb);
    time += r.time;
    if (towers) fallsA += Object.values(r.stats).filter((x) => x.structure && x.side === sa && x.alive === 0).length;
  }
  return { win: wins / seeds, diff: diff / seeds, time: time / seeds, fallsA: fallsA / seeds };
}

const REFS: Record<string, Army> = {
  wardens: { ids: ["knights", "knights", "longbowmen", "longbowmen", "longbowmen", "ballista", "halberdiers"] },
  greenskin: { ids: ["goblin_horde", "goblin_horde", "goblin_horde", "wolf_riders", "goblin_sappers", "goblin_sappers", "bat_riders", "goblin_alchemist"] },
  elemental: { ids: ["water_elemental", "air_elemental", "stone_golem", "wisps", "frost_elemental"] },
  independent: { ids: ["troll", "giant", "troll", "longbowmen", "longbowmen"] },
};
const cost = (a: Army) => a.ids.reduce((t, id) => t + D(id).cost, 0);
const mass = (id: string, budget: number): Army => ({ ids: Array(Math.max(1, Math.round(budget / D(id).cost))).fill(id) });

const mode = process.argv[2];
const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);

if (mode === "A") {
  // Promotion: one Lv2 squad (1.5x cost) vs two Lv1 squads (2x cost) of the same unit, inside a mixed army.
  console.log("Lv2 squad (cost x1.5) vs two Lv1 squads (cost x2), each beside 2 Knights + 2 Longbows filler:");
  for (const u of DEFAULT_UNITS) {
    const filler = ["knights", "longbowmen", "longbowmen"];
    const a: Army = { ids: [u.id, u.id, ...filler], levels: [2, 2, 1, 1, 1] };
    const b: Army = { ids: [u.id, u.id, u.id, u.id, ...filler] };
    const r = fight(a, b, 6);
    console.log(`${u.id.padEnd(17)} 2xLv2 (${2 * u.cost * 1.5}) vs 4xLv1 (${4 * u.cost}): Lv2 side wins ${pct(r.win)}  value diff ${Math.round(r.diff)}`);
  }
}

if (mode === "B") {
  // Towers: identical mixed armies, one side with towers at L0, other at L1/L2.
  for (const [name, ref] of Object.entries(REFS)) {
    const mirror0 = fight(ref, ref, 10, true);
    const l1 = fight({ ...ref, towers: [1, 1] }, ref, 10, true);
    const l2 = fight({ ...ref, towers: [2, 2] }, ref, 10, true);
    console.log(`${name.padEnd(12)} mirror: keeps lost per fight ${mirror0.fallsA.toFixed(2)}, time ${mirror0.time.toFixed(0)}s | towers L1 (+200 supply) win ${pct(l1.win)} | L2 (+600) win ${pct(l2.win)}`);
  }
  // Towers vs army: is 200 on towers better than 200 more army?
  for (const [name, ref] of Object.entries(REFS)) {
    const extra: Army = { ids: [...ref.ids, "longbowmen", "longbowmen"] };
    const r = fight({ ...ref, towers: [1, 1] }, extra, 10, true);
    console.log(`${name.padEnd(12)} towers L1 both (200) vs +2 Longbows (200): towers side wins ${pct(r.win)}`);
  }
}

if (mode === "C") {
  // Upgrade impact: mass army of U (1000) with each upgrade, vs the same mass at 1200 (= +200 supply) and at 1000 plain.
  // Opponents: the four reference armies. Score = mean win rate over opponents.
  const refs = Object.values(REFS);
  const score = (a: Army) => {
    let w = 0, d = 0;
    for (const ref of refs) { const r = fight(a, ref, 6); w += r.win; d += r.diff; }
    return { w: w / refs.length, d: d / refs.length };
  };
  console.log(`refs cost: ${Object.entries(REFS).map(([k, v]) => `${k} ${cost(v)}`).join(", ")}`);
  console.log("unit              base  +200sup  " + "upgrades (win% / value diff)");
  for (const u of DEFAULT_UNITS) {
    const base = score(mass(u.id, 1000));
    const more = score(mass(u.id, 1200));
    const ups = (u.upgrades ?? []).map((up) => {
      const s = score({ ...mass(u.id, 1000), ups: { [u.id]: [up.id] } });
      return `${up.id} ${pct(s.w)}/${String(Math.round(s.d)).padStart(5)}`;
    });
    console.log(`${u.id.padEnd(17)} ${pct(base.w)}/${String(Math.round(base.d)).padStart(5)}  ${pct(more.w)}/${String(Math.round(more.d)).padStart(5)} | ${ups.join(" | ")}`);
  }
}

if (mode === "D") {
  // Mixed-army upgrade test: upgrade inside its faction reference army (more realistic than mass armies).
  const factionOf: Record<string, string> = {};
  for (const [k, v] of Object.entries(REFS)) for (const id of v.ids) factionOf[id] ??= k;
  const refs = Object.entries(REFS);
  for (const [fname, ref] of refs) {
    const others = refs.filter(([k]) => k !== fname);
    const score = (a: Army) => others.reduce((t, [, o]) => t + fight(a, o, 6).diff, 0) / others.length;
    const base = score(ref);
    const plus = score({ ids: [...ref.ids, "longbowmen", "longbowmen"] });
    console.log(`\n${fname} army (${cost(ref)}): base value diff ${Math.round(base)}, +200 supply of Longbows ${Math.round(plus)}`);
    for (const id of [...new Set(ref.ids)]) {
      const ups = (D(id).upgrades ?? []).map((up) => `${up.id} ${String(Math.round(score({ ...ref, ups: { [id]: [up.id] } }) - base)).padStart(5)}`);
      console.log(`  ${id.padEnd(17)} ${ups.join(" | ")}`);
    }
  }
}

if (mode === "E") {
  // Unit value in context: add one squad of X to every reference army vs adding the same supply of Longbows/Knights.
  const refs = Object.entries(REFS);
  const filler = (budget: number) => { const ids: string[] = []; let left = budget; let i = 0; while (left >= 100) { const id = i++ % 3 === 2 && left >= 200 ? "knights" : "longbowmen"; ids.push(id); left -= D(id).cost; } return ids; };
  const rows: [string, number][] = [];
  for (const u of DEFAULT_UNITS) {
    let tot = 0, n = 0;
    for (const [fname, ref] of refs) {
      for (const [oname, opp] of refs) {
        if (oname === fname) continue;
        const withX = fight({ ids: [...ref.ids, u.id] }, opp, 4).diff;
        const withF = fight({ ids: [...ref.ids, ...filler(u.cost)] }, opp, 4).diff;
        tot += withX - withF; n++;
      }
    }
    rows.push([`${u.id} (${u.cost})`, tot / n]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  console.log("value diff of adding one squad vs the same supply of Longbows/Knights (positive = better than filler):");
  for (const [k, v] of rows) console.log(`  ${k.padEnd(24)} ${String(Math.round(v)).padStart(5)}`);
}

if (mode === "F") {
  const roles = new Map<string, Record<string, number>>();
  for (const u of DEFAULT_UNITS) {
    const f = u.tags.find((t) => t.startsWith("faction:"))!.slice(8);
    for (const t of u.tags.filter((t) => t.startsWith("role:"))) {
      const r = roles.get(t.slice(5)) ?? {}; r[f] = (r[f] ?? 0) + 1; roles.set(t.slice(5), r);
    }
  }
  for (const [r, c] of [...roles].sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y) - Object.values(a[1]).reduce((x, y) => x + y)))
    console.log(`${r.padEnd(12)} ${Object.values(c).reduce((x, y) => x + y)}  ${JSON.stringify(c)}`);
  console.log("\nhits air:", DEFAULT_UNITS.filter((u) => u.attack?.targets.includes("air")).map((u) => u.id).join(", "));
  const rng = (u: UnitDef) => u.attack?.range ?? 0;
  console.log("melee (<=1):", DEFAULT_UNITS.filter((u) => u.attack && rng(u) <= 1).map((u) => u.id).join(", "));
  console.log("short (1-3):", DEFAULT_UNITS.filter((u) => rng(u) > 1 && rng(u) <= 3).map((u) => u.id).join(", "));
  console.log("mid (3-6):", DEFAULT_UNITS.filter((u) => rng(u) > 3 && rng(u) <= 6).map((u) => u.id).join(", "));
  console.log("long (>6):", DEFAULT_UNITS.filter((u) => rng(u) > 6).map((u) => u.id).join(", "));
  console.log("elements:", JSON.stringify(DEFAULT_UNITS.reduce((m, u) => { const e = u.attack?.element ?? "none"; m[e] = (m[e] ?? 0) + 1; return m; }, {} as Record<string, number>)));
}

if (mode === "G") {
  // Faction triangle: each reference army against each other, towers on. Row's win rate / mean value left over the column.
  const refs = Object.entries(REFS);
  console.log("".padEnd(13) + refs.map(([k]) => k.padStart(13)).join(""));
  for (const [a, ra] of refs) {
    console.log(a.padEnd(13) + refs.map(([b, rb]) => {
      if (a === b) return "--".padStart(13);
      const r = fight(ra, rb, 12, true);
      return `${pct(r.win)} ${String(Math.round(r.diff)).padStart(5)}`.padStart(13);
    }).join(""));
  }
}
