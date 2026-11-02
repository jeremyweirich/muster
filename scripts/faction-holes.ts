// Faction holes: for every unit, each faction's best answer to it at equal supply, from a saved matrix.
// Usage:
//   npm run balance -- matrix --csv <file>      (minutes; saves every matchup)
//   npx tsx scripts/faction-holes.ts <file>
// A cell is "the best win rate any of that faction's own units gets against the row's unit, and which unit".
// Cells under 60% (marked !) are holes: the faction has no answer of its own, so an independent should cover it.
// One-unit fights exaggerate some things (fliers against ground-only units), so read it next to real matches.
import { readFileSync } from "node:fs";
import { DEFAULT_UNITS } from "../src/data/units";
import { FACTIONS } from "../src/data/roles";

const file = process.argv[2];
if (!file) throw new Error("usage: npx tsx scripts/faction-holes.ts <matrix csv>");
const rows = readFileSync(file, "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
const win = new Map<string, number>();
for (const [scale, a, b, , , w] of rows) if (scale === "1") win.set(`${a}>${b}`, Number(w));

const factionOf = (id: string) => DEFAULT_UNITS.find((u) => u.id === id)!.tags.find((t) => t.startsWith("faction:"))!.slice(8);
const ids = DEFAULT_UNITS.filter((u) => u.attack).map((u) => u.id); // the Cleric has no attack to answer anything with
const width = 24;
console.log("unit".padEnd(17) + FACTIONS.map((f) => f.name.padEnd(width + 1)).join(""));
for (const x of ids) {
  const cells = FACTIONS.map((f) => {
    let best = -1;
    let who = "-";
    for (const y of ids) {
      if (y === x || factionOf(y) !== f.id) continue;
      const w = win.get(`${y}>${x}`);
      if (w !== undefined && w > best) [best, who] = [w, y];
    }
    const cell = best < 0 ? "-" : `${Math.round(best * 100)}% ${who}`;
    return (best >= 0 && best < 0.6 ? "!" : " ") + cell.padEnd(width);
  });
  console.log(x.padEnd(17) + cells.join(""));
}
