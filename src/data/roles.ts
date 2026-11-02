// Role tags (role:*) say what a unit is *for*. Game screens show them as chips that link to the
// Codex, which shows `detail`; `description` is the one-line version. They're ordinary tags, so
// selectors can use them.
export const ROLES: Record<string, { name: string; description: string; detail: string }> = {
  sturdy: {
    name: "Sturdy",
    description: "Lots of HP or armor. Holds the front line.",
    detail:
      "Lots of HP or armor. Sturdy units stand in front so the damage dealers behind them live longer. Most hit softly for their cost, so they hold the line while something else wins the fight.",
  },
  swarm: {
    name: "Swarm",
    description: "Many cheap bodies. Soaks up big single-target hits.",
    detail:
      "Many cheap bodies in one squad. A huge single hit only kills one of them, so swarms soak up snipers and heavy hitters. Splash is their nightmare: one blast can clear a dozen.",
  },
  fast: {
    name: "Fast",
    description: "Gets there first. Good for flanks and tower raids.",
    detail:
      "Gets there first. Fast units reach the enemy's back line and Keeps before the main fight starts. In your own army, a fast unit can run ahead of its friends and fight alone.",
  },
  slow: {
    name: "Slow",
    description: "Arrives late. Protect it or give it time.",
    detail: "Arrives late. Slow units need a front line to stand behind, and fast raiders love to catch them alone.",
  },
  sniper: {
    name: "Sniper",
    description: "Very long range. Stays at the back.",
    detail:
      "Very long range, usually one target at a time. Snipers stay at the back and pick off the biggest targets. Anything that reaches them, or a swarm of small targets, beats them.",
  },
  ranged: {
    name: "Ranged",
    description: "Attacks from a distance.",
    detail:
      "Attacks from a distance, so it gets free hits while the enemy walks in. Keep ranged units behind a front line: if raiders or fliers reach them, they fold.",
  },
  melee: {
    name: "Melee",
    description: "Has to get up close.",
    detail:
      "Has to get up close. Melee units take hits on the way in, and anything that punishes attackers (like a pike line) hurts them most. Once they arrive, they hit hard.",
  },
  skirmisher: {
    name: "Skirmisher",
    description: "Short-range throws: hits from just outside melee, a step behind the front line.",
    detail:
      "Throws or shoots from just outside melee range, a step behind the front line. Skirmishers hit swords before swords can answer, but longer-ranged archers outshoot them.",
  },
  splash: {
    name: "Splash",
    description: "Hits groups. Punishes swarms and tight formations.",
    detail:
      "Each hit also damages everything close to the target. Splash punishes swarms and tight formations. Single big units and spread-out squads take it best.",
  },
  antiair: {
    name: "Anti-air",
    description: "Can shoot down fliers.",
    detail:
      "Can hit fliers. Most units can't, so every army needs some anti-air in case the enemy takes to the sky. A unit's card says what its attack can hit: ground, air, or both.",
  },
  antilarge: {
    name: "Anti-large",
    description: "Bonus damage against big targets.",
    detail:
      "Bonus damage against big targets: ogres, trolls, golems and cavalry. Big units that charge into anti-large troops regret it. Swarms of small units don't care.",
  },
  flier: {
    name: "Flier",
    description: "Ignores ground surfaces. Only anti-air can hit it.",
    detail:
      "Flies over the field. Fliers pass over ground units without bumping into them and ignore everything on the ground: burning ground, oil, puddles and ice. Only attacks that hit air can reach them, so an army without anti-air can't fight back at all.",
  },
  support: {
    name: "Support",
    description: "Makes nearby allies better. Weak on its own.",
    detail: "Makes nearby allies better instead of fighting. Weak on its own. In battle it walks with your nearest ground squad that fights up close, or your nearest armed squad if there is none.",
  },
  healer: {
    name: "Healer",
    description: "Restores allies' HP.",
    detail: "Restores allies' HP during the battle. Place healers just behind the line, within reach of the units taking the hits.",
  },
  combo: {
    name: "Combo",
    description: "Sets up elemental reactions for other units.",
    detail:
      "Sets up elemental reactions for other units, for example soaking targets so lightning hits twice as hard. A combo unit is modest alone and strong next to the right partner.",
  },
  regen: {
    name: "Regenerates",
    description: "Heals itself over time.",
    detail: "Heals itself over time, so slow damage barely scratches it. Fire is the usual answer: most regenerators can't heal while Burning.",
  },
  glass: {
    name: "Glass cannon",
    description: "Big damage, little HP.",
    detail: "Big damage, little HP. Protect it and it wins fights. Let anything reach it and it's gone.",
  },
  raider: {
    name: "Raider",
    description: "Built to reach what's behind the front line.",
    detail:
      "Built to reach what's behind the front line: archers, casters, siege and Keeps. A raider picks those out when they're close, so it doesn't cross the field for them: it gets there by speed, by flying, or by being placed on a flank. Guard your flanks, and keep something tough near your back line.",
  },
};

export function rolesOf(tags: string[]): { id: string; name: string; description: string }[] {
  return tags
    .filter((t) => t.startsWith("role:"))
    .map((t) => {
      const id = t.slice(5);
      return { id, ...(ROLES[id] ?? { name: id, description: "", detail: "" }) };
    });
}

export const FACTIONS: { id: string; name: string }[] = [
  // Listed in complexity order: Wardens are the plainest, Elementals the trickiest.
  { id: "warden", name: "Wardens" },
  { id: "goblin", name: "Goblins" },
  { id: "elemental", name: "Elementals" },
  { id: "independent", name: "Independents" },
];

export function factionOf(tags: string[]): string {
  return tags.find((t) => t.startsWith("faction:"))?.slice(8) ?? "independent";
}
