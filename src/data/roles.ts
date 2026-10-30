// Role tags (role:*) say what a unit is *for*. They're shown when hovering units
// in the recruit list and the editor, and they're ordinary tags, so selectors can use them.
export const ROLES: Record<string, { name: string; description: string }> = {
  sturdy: { name: "Sturdy", description: "Lots of HP or armor. Holds the front line." },
  swarm: { name: "Swarm", description: "Many cheap bodies. Soaks up big single-target hits." },
  fast: { name: "Fast", description: "Gets there first. Good for flanks and tower raids." },
  slow: { name: "Slow", description: "Arrives late. Protect it or give it time." },
  sniper: { name: "Sniper", description: "Very long range. Stays at the back." },
  ranged: { name: "Ranged", description: "Attacks from a distance." },
  melee: { name: "Melee", description: "Has to get up close." },
  splash: { name: "Splash", description: "Hits groups. Punishes swarms and tight formations." },
  antiair: { name: "Anti-air", description: "Can shoot down fliers and the Sky Spire." },
  antilarge: { name: "Anti-large", description: "Bonus damage against big targets." },
  flier: { name: "Flier", description: "Ignores ground surfaces. Only anti-air can hit it." },
  support: { name: "Support", description: "Makes nearby allies better. Weak on its own." },
  healer: { name: "Healer", description: "Restores allies' HP." },
  combo: { name: "Combo", description: "Sets up elemental reactions for other units." },
  regen: { name: "Regenerates", description: "Heals itself over time." },
  glass: { name: "Glass cannon", description: "Big damage, little HP." },
  raider: { name: "Raider", description: "Built to slip past armies and hit towers." },
};

export function rolesOf(tags: string[]): { id: string; name: string; description: string }[] {
  return tags
    .filter((t) => t.startsWith("role:"))
    .map((t) => {
      const id = t.slice(5);
      return { id, ...(ROLES[id] ?? { name: id, description: "" }) };
    });
}

export const FACTIONS: { id: string; name: string }[] = [
  { id: "greenskin", name: "Greenskins" },
  { id: "kingdom", name: "Kingdom" },
  { id: "elemental", name: "Elementals" },
  { id: "independent", name: "Independents" },
];

export function factionOf(tags: string[]): string {
  return tags.find((t) => t.startsWith("faction:"))?.slice(8) ?? "independent";
}
