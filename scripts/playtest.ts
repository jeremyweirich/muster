// Headless Muster: play a full match against the real AI from the command line, one round per call.
// The AI plans with the same call PlayView uses, so this is the real game minus the canvas.
// Usage:
//   npm run playtest -- new <name> [seed] [easy|normal|hard] [discount|bonus]
//   npm run playtest -- show <name>
//   npm run playtest -- play <name> '<plan json>'
// Plan (every key optional):
//   opening: "discount" | "bonus"                    round 1 only (default bonus)
//   promote: ["all" | uid suffix]                    paid first
//   up: [[unitId, upgradeId]], tower: [index]        then upgrades and tower levels
//   buy: [{u, x, y, rot?} | {u, auto: "center" | "spread" | "left" | "right"}]
//   fill: [unitId, ...], style                       then keep buying these in turn, auto-placed, until broke
// Your side is the bottom (rows 18-26). `show` prints the field with a legend. State is saved in the OS temp folder.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { DEFAULT_UNITS } from "../src/data/units";
import { RULES } from "../src/data/rules";
import { towerPlacements } from "../src/data/towers";
import { Battle, footprintOf } from "../src/sim/battle";
import { upgradedDefs } from "../src/sim/upgrades";
import { Rng } from "../src/sim/rng";
import { planAiRound, promoted, type Difficulty } from "../src/game/ai";
import {
  applyRound, canPromote, chooseOpening, newMatch, nextRound, promotePrice, unlockDiscounts, type MatchState,
} from "../src/game/match";
import {
  autoPlace, canPlace, defMap, priceOf, towerUpgradePrice, unlockPrice, upgradePrice, type PlacementStyle,
} from "../src/game/army";
import type { PlacedSquad } from "../src/sim/types";

const DIR = `${tmpdir()}/muster-playtest`;
mkdirSync(DIR, { recursive: true });
const units = DEFAULT_UNITS;
const defs = defMap(units);

interface Saved { state: MatchState; seed: number; difficulty: Difficulty; log: string[] }
const file = (n: string) => `${DIR}/${n}.json`;
const load = (n: string): Saved => JSON.parse(readFileSync(file(n), "utf8"));
const save = (n: string, s: Saved) => writeFileSync(file(n), JSON.stringify(s));

const short = (uid: string) => uid.slice(-3);
const nm = (id: string) => defs.get(id)?.name ?? id;

function grid(state: MatchState): string {
  const g: string[][] = Array.from({ length: RULES.fieldH }, () => Array(RULES.fieldW).fill("."));
  const legend: string[] = [];
  let ch = 0;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const side of [1, 0] as const) {
    for (const t of towerPlacements(side)) for (let y = t.y; y < t.y + 2; y++) for (let x = t.x; x < t.x + 2; x++) g[y][x] = "#";
    for (const sq of state.armies[side]) {
      const d = defs.get(sq.defId)!;
      const { w, h } = footprintOf(d, sq.rot);
      const c = side === 0 ? letters[ch % 26] : letters[ch % 26].toLowerCase();
      ch++;
      for (let y = sq.y; y < sq.y + h; y++) for (let x = sq.x; x < sq.x + w; x++) g[y][x] = c;
      legend.push(`${c}=${d.name}${(sq.level ?? 1) > 1 ? ` Lv${sq.level}` : ""}@${sq.x},${sq.y}${sq.rot ? "r" : ""} [${short(sq.uid)}] xp${sq.xp ?? 0}${canPromote(sq) ? " PROMOTABLE" : ""}`);
    }
  }
  const head = "   " + Array.from({ length: RULES.fieldW }, (_, i) => (i % 10 === 0 ? String(i / 10) : " ")).join("");
  const rows = g.map((r, y) => String(y).padStart(2) + " " + r.join(""));
  return [head, ...rows, legend.join("\n")].join("\n");
}

function show(s: Saved) {
  const st = s.state;
  const lines: string[] = [];
  lines.push(`ROUND ${st.round}  HP me ${st.hp[0]} / ai ${st.hp[1]}   supply me ${st.supply[0]}  (ai ${st.supply[1]})   phase ${st.phase}`);
  lines.push(`opening: unit ${st.openings[0].unitId} me=${st.openings[0].choice} ai=${st.round > 1 ? st.openings[1].choice : "?"}`);
  for (const side of [0, 1] as const) {
    const who = side === 0 ? "ME" : "AI";
    const ups = Object.entries(st.upgrades[side]).map(([u, l]) => `${u}:${l.join("+")}`).join(" ");
    lines.push(`${who} unlocked: ${st.unlocked[side].join(", ")}`);
    lines.push(`${who} upgrades: ${ups || "-"}   towers: ${st.towerLevels[side].join("/")}`);
  }
  lines.push(grid(st));
  console.log(lines.join("\n"));
}

function cmdNew(name: string, seed = 1, difficulty: Difficulty = "hard", opening?: "discount" | "bonus") {
  let state = newMatch(units, seed);
  if (opening) state = chooseOpening(state, 0, opening);
  const s: Saved = { state, seed, difficulty, log: [] };
  save(name, s);
  show(s);
}

interface Plan {
  buy?: { u: string; x?: number; y?: number; rot?: boolean; auto?: PlacementStyle }[];
  up?: [string, string][];
  tower?: number[];
  promote?: string[];
  opening?: "discount" | "bonus";
  fill?: string[];
  style?: PlacementStyle;
}

function cmdPlay(name: string, plan: Plan) {
  const s = load(name);
  let st = s.state;
  if (st.phase !== "deploy") throw new Error("not in deploy");
  if (st.round === 1 && !st.openings[0].choice) st = chooseOpening(st, 0, plan.opening ?? "bonus");

  // The AI plans from the state at the start of deployment, like PlayView.
  const aiPlan = planAiRound(
    units, defs,
    { army: st.armies[1], unlocked: st.unlocked[1], upgrades: st.upgrades[1], towerLevels: st.towerLevels[1], supply: st.supply[1], discounts: unlockDiscounts(st, 1) },
    { army: st.armies[0], upgrades: st.upgrades[0], towerLevels: st.towerLevels[0] },
    st.round, s.difficulty, st.round * 7919 + 13 + s.seed * 31,
  );

  // My purchases, in order: promotions, upgrades, towers, squads.
  let supply = st.supply[0];
  const pay = (p: number, what: string) => {
    if (p > supply) throw new Error(`can't afford ${what} (${p} > ${supply})`);
    supply -= p;
  };
  let army = [...st.armies[0]];
  const unlocked = new Set(st.unlocked[0]);
  const upgrades = { ...st.upgrades[0] };
  const towers = [...st.towerLevels[0]];
  const spentLog: string[] = [];
  for (const p of plan.promote ?? []) {
    const targets = p === "all" ? army.filter(canPromote) : army.filter((q) => q.uid.endsWith(p));
    for (const sq of targets) {
      if (!canPromote(sq)) throw new Error(`${p} not promotable`);
      const price = promotePrice(defs.get(sq.defId)!);
      pay(price, `promote ${sq.defId}`);
      army = army.map((q) => (q.uid === sq.uid ? { ...q, level: (q.level ?? 1) + 1 } : q));
      spentLog.push(`promote ${nm(sq.defId)} -> Lv${(sq.level ?? 1) + 1} (${price})`);
    }
  }
  for (const [u, id] of plan.up ?? []) {
    const d = defs.get(u)!;
    if (!unlocked.has(u)) throw new Error(`${u} not unlocked`);
    if (!d.upgrades?.some((x) => x.id === id)) throw new Error(`no upgrade ${u}.${id}`);
    const price = upgradePrice(d, (upgrades[u] ?? []).length)!;
    pay(price, `upgrade ${id}`);
    upgrades[u] = [...(upgrades[u] ?? []), id];
    spentLog.push(`upgrade ${d.name}: ${id} (${price})`);
  }
  for (const i of plan.tower ?? []) {
    const price = towerUpgradePrice(towers[i])!;
    pay(price, `tower ${i}`);
    towers[i]++;
    spentLog.push(`tower ${i} -> L${towers[i]} (${price})`);
  }
  const rng = new Rng(s.seed * 97 + st.round);
  // fill: cycle through these units, auto-placed, until nothing more is affordable
  const buys = [...(plan.buy ?? [])];
  if (plan.fill?.length) {
    let left = supply - buys.reduce((t, b) => t + priceOf(defs.get(b.u)!, unlocked, unlockDiscounts(st, 0)), 0);
    const un = new Set(unlocked);
    for (let i = 0; i < 40; i++) {
      const u = plan.fill[i % plan.fill.length];
      const p = priceOf(defs.get(u)!, un, unlockDiscounts(st, 0));
      if (p > left) { if (plan.fill.every((f) => priceOf(defs.get(f)!, un, unlockDiscounts(st, 0)) > left)) break; continue; }
      left -= p; un.add(u);
      buys.push({ u, auto: plan.style ?? "spread" });
    }
  }
  for (const b of buys) {
    const d = defs.get(b.u);
    if (!d) throw new Error(`no unit ${b.u}`);
    const price = priceOf(d, unlocked, unlockDiscounts(st, 0));
    pay(price, `buy ${b.u}`);
    if (!unlocked.has(b.u)) { unlocked.add(b.u); spentLog.push(`unlock ${d.name} (${unlockPrice(d, unlockDiscounts(st, 0))})`); }
    let sq: PlacedSquad;
    if (b.x === undefined) {
      const placed = autoPlace([d], army, 0, defs, st.round, rng, b.auto ?? "center");
      if (!placed.length) throw new Error(`no room for ${b.u}`);
      sq = placed[0];
    } else {
      if (!canPlace(d, b.x, b.y!, 0, army, defs, undefined, b.rot)) throw new Error(`can't place ${b.u} at ${b.x},${b.y}${b.rot ? "r" : ""}`);
      sq = { uid: `p${st.round}${army.length}${Math.floor(rng.next() * 1e6)}`, defId: b.u, x: b.x, y: b.y!, rot: b.rot || undefined, round: st.round };
    }
    army.push(sq);
    spentLog.push(`buy ${d.name} (${d.cost}) @${sq.x},${sq.y}${sq.rot ? "r" : ""}`);
  }

  // Commit both sides and fight, exactly like PlayView.fight().
  const aiUpgrades = { ...st.upgrades[1] };
  for (const u of aiPlan.upgrades) aiUpgrades[u.unitId] = [...(aiUpgrades[u.unitId] ?? []), u.upgradeId];
  const aiLevels = [...st.towerLevels[1]];
  for (const i of aiPlan.towerUpgrades) aiLevels[i]++;
  const armies: [PlacedSquad[], PlacedSquad[]] = [army, [...promoted(st.armies[1], aiPlan.promotions), ...aiPlan.squads]];
  const towerLevels: [number[], number[]] = [towers, aiLevels];
  const sideDefs = [upgradedDefs(defs, upgrades), upgradedDefs(defs, aiUpgrades)] as const;
  st = {
    ...st,
    armies,
    supply: [supply, st.supply[1] - aiPlan.spent],
    unlocked: [[...unlocked], [...new Set([...st.unlocked[1], ...aiPlan.unlocks])]],
    upgrades: [upgrades, aiUpgrades],
    towerLevels,
  };
  const battle = new Battle([sideDefs[0], sideDefs[1]], armies, { seed: st.round * 104729 + 7 + s.seed, towerLevels });
  const r = battle.run();
  const round = st.round;
  st = applyRound(st, r, defs);

  const out: string[] = [];
  out.push(`=== ROUND ${round} — I spent: ${spentLog.join("; ") || "nothing"}  (left ${supply})`);
  const aiBits = [
    ...aiPlan.promotions.map((u) => `promote ${nm(armies[1].find((q) => q.uid === u)?.defId ?? u)}`),
    ...aiPlan.upgrades.map((u) => `upgrade ${nm(u.unitId)}: ${u.upgradeId}`),
    ...aiPlan.towerUpgrades.map((i) => `tower ${i}`),
    ...aiPlan.unlocks.map((u) => `unlock ${nm(u)}`),
    ...aiPlan.squads.map((q) => `buy ${nm(q.defId)}`),
  ];
  out.push(`AI spent ${aiPlan.spent}: ${aiBits.join("; ")}`);
  const winner = r.winner === 0 ? "ME" : r.winner === 1 ? "AI" : "DRAW";
  const rep = st.history[st.history.length - 1];
  out.push(`RESULT: ${winner}${r.timedOut ? " (timeout)" : ""} in ${r.time.toFixed(1)}s. damage taken me ${rep.damage[0]} / ai ${rep.damage[1]} -> HP me ${st.hp[0]} / ai ${st.hp[1]}`);
  const rows = Object.values(r.stats).sort((a, b) => a.side - b.side || b.dealt - a.dealt);
  for (const x of rows) {
    if (x.structure) { out.push(`  ${x.side === 0 ? "me" : "ai"} ${x.name}: ${x.alive ? "standing" : "FELL"} (took ${Math.round(x.taken)})`); continue; }
    const sq = armies[x.side].find((q) => q.uid === x.uid);
    const lvl = sq?.level && sq.level > 1 ? ` Lv${sq.level}` : "";
    const how = Object.entries(x.dealtBy).filter(([, v]) => v > 20).map(([k, v]) => `${k} ${Math.round(v)}`).join(", ");
    const ff = x.friendly > 20 ? ` FF ${Math.round(x.friendly)}` : "";
    const heal = x.healed > 0 ? ` healed ${Math.round(x.healed)}` : "";
    out.push(`  ${x.side === 0 ? "me" : "ai"} ${x.name}${lvl} [${short(x.uid)}] ${x.alive}/${x.total} dealt ${Math.round(x.dealt)} taken ${Math.round(x.taken)} kills ${x.kills}${heal}${ff}  (${how})`);
  }
  s.log.push(out.join("\n"));
  if (st.phase === "over") {
    out.push(`MATCH OVER: ${st.hp[0] <= 0 && st.hp[1] <= 0 ? "both dead" : st.hp[0] <= 0 ? "AI WINS" : "I WIN"} after ${round} rounds`);
    s.state = st;
  } else {
    s.state = nextRound(st);
  }
  save(name, s);
  console.log(out.join("\n"));
  if (s.state.phase === "deploy") { console.log(""); show(s); }
}

const [cmd, name, ...rest] = process.argv.slice(2);
if (cmd === "new") cmdNew(name, Number(rest[0] ?? 1), (rest[1] as Difficulty) ?? "hard", rest[2] as "discount" | "bonus" | undefined);
else if (cmd === "show") show(load(name));
else if (cmd === "play") cmdPlay(name, JSON.parse(rest[0] ?? "{}"));
else console.log("usage: new <name> [seed] [difficulty] [discount|bonus] | show <name> | play <name> '<plan json>'");
