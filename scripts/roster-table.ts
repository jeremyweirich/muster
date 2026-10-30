// Prints the default roster as a Markdown table (used for docs/DESIGN.md).
// Usage: npm run roster-table
import { DEFAULT_UNITS } from "../src/data/units";

const rows = DEFAULT_UNITS.map((u) => {
  const a = u.attack;
  const atk = a ? `${a.damage} ${a.element} / ${a.cooldown}s, range ${a.range}${a.splash ? `, splash ${a.splash}` : ""}${a.chain ? `, chain ×${a.chain.count}` : ""}` : "none";
  const fp = `${u.footprint.w}×${u.footprint.h}`;
  return `| ${u.name} | ${u.cost} | ${u.unlockCost ?? 0} | ${u.squadSize} | ${fp} | ${u.layer} | ${u.hp} | ${atk} | ${u.description ?? ""} |`;
});
console.log("| Unit | Cost | Unlock | Squad | Footprint | Layer | HP | Attack | Role |");
console.log("|---|---|---|---|---|---|---|---|---|");
console.log(rows.join("\n"));
