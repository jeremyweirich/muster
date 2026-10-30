// Prints the unit-vs-unit win-rate matrix (row unit win % vs column unit, equal supply).
// Usage: npm run matrix
import { DEFAULT_UNITS } from "../src/data/units";
import { runMatchup } from "../src/game/lab";
const ids = DEFAULT_UNITS.map(u => u.id);
const t = performance.now();
const rows: string[] = [];
const score: Record<string, number> = {};
for (const a of ids) {
  let line = a.padEnd(18);
  for (const b of ids) {
    if (a === b) { line += "  -- "; continue; }
    const r = runMatchup(DEFAULT_UNITS, a, b, 1000, 2);
    score[a] = (score[a] ?? 0) + r.winRate;
    line += (Math.round(r.winRate * 100) + "").padStart(4) + " ";
  }
  rows.push(line);
}
console.log(" ".repeat(18) + ids.map(i => i.slice(0, 4).padStart(4)).join(" "));
console.log(rows.join("\n"));
console.log("ms", Math.round(performance.now() - t));
console.log(Object.entries(score).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v.toFixed(1)}`).join("  "));
