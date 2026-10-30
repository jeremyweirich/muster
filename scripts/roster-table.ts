// Prints the default roster as Markdown tables by faction (used for docs/DESIGN.md).
// Usage: npm run roster-table
import { FACTIONS, factionOf, rolesOf } from "../src/data/roles";
import { DEFAULT_UNITS } from "../src/data/units";

for (const f of FACTIONS) {
  const units = DEFAULT_UNITS.filter((u) => factionOf(u.tags) === f.id);
  if (!units.length) continue;
  console.log(`\n#### ${f.name}\n`);
  console.log("| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const u of units) {
    const a = u.attack;
    const atk = a
      ? `${a.damage} ${a.element} / ${a.cooldown}s, range ${a.range}${a.splash ? `, splash ${a.splash}` : ""}${a.chain ? `, chain ×${a.chain.count}` : ""}`
      : "none";
    const roles = rolesOf(u.tags).map((r) => r.name).join(", ");
    const ups = (u.upgrades ?? []).map((up) => `**${up.name}**: ${up.description ?? ""}`).join("<br>");
    console.log(`| ${u.name} | ${u.cost} | ${u.unlockCost ?? 0} | ${u.squadSize} (${u.footprint.w}×${u.footprint.h}${u.layer === "air" ? ", air" : ""}) | ${u.speed} | ${u.hp} | ${atk} | ${roles} | ${ups} |`);
  }
}
