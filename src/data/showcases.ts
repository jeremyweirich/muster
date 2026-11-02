// The little fights on the Units tab: each unit doing the thing it's for. The featured unit fights on the left,
// in a small arena (src/game/showcase.ts). A test checks the featured side wins every one at level 1 with no
// upgrades, so if a balance change breaks a showcase, pick a fight that still shows the unit off.
export interface Showcase {
  squads?: number; // squads of the featured unit (default 1)
  allies?: string[]; // other squads on its side, one entry per squad (a Cleric needs someone to heal)
  vs: string[]; // enemy squads, one entry per squad
  caption: string; // what to watch for
}

export const SHOWCASES: Record<string, Showcase> = {
  // Wardens
  knights: { squads: 2, vs: ["grunts", "grunts", "grunts"], caption: "A wall the goblin mob runs onto." },
  crossbowmen: { squads: 2, vs: ["knights"], caption: "Heavy bolts punch through the Knights' armor before they arrive." },
  ballista: { squads: 2, vs: ["ogre_brute"], caption: "Double damage against big targets, from across the field." },
  griffon_riders: { vs: ["knights"], caption: "Knights can't hit fliers, so the spears rain down unanswered." },
  cleric: { allies: ["knights"], vs: ["knights"], caption: "Two equal lines of Knights. The one with a Cleric behind it wins." },
  pikemen: { squads: 3, vs: ["ogre_brute", "ogre_brute"], caption: "Pikes deal ×3.5 against large units. The Ogres walk onto them." },

  // Goblins
  grunts: { squads: 2, vs: ["crossbowmen", "crossbowmen"], caption: "Too many goblins for a few bolts: the swarm soaks them and reaches the shooters." },
  skirmishers: { squads: 2, vs: ["giant_bats"], caption: "Short bows that hit fliers: the bats dive into a cloud of arrows." },
  wolf_riders: { vs: ["crossbowmen", "crossbowmen"], caption: "The fastest unit on the Field reaches the shooters before they can thin it." },
  troll: { squads: 2, vs: ["stone_golem"], caption: "Each hit on the same target hits harder. The rage builds on one big Golem." },
  ogre_brute: { vs: ["grunts", "grunts", "grunts"], caption: "A cleaving club: every swing splashes through the mob." },
  giant_bats: { vs: ["ballista", "ballista"], caption: "They fly straight over the Field and land on the siege engines." },

  // Elementals
  fire_elemental: { vs: ["grunts", "grunts"], caption: "Fireballs splash a crowd and leave it burning." },
  water_elemental: { allies: ["frost_elemental"], vs: ["knights", "knights"], caption: "A tidal tank that soaks the enemy Wet, so its partner's frost freezes them solid." },
  air_elemental: { vs: ["skirmishers", "skirmishers"], caption: "Chain lightning jumps from goblin to goblin." },
  cloudlings: { squads: 2, vs: ["ballista", "ballista"], caption: "A flock of tiny fliers: each heavy bolt only ever pops one cloud." },
  frost_elemental: { squads: 2, vs: ["stone_golem"], caption: "The cold sinks in: each bolt in a row on the Golem hits harder than the last." },
  stone_golem: { vs: ["knights"], caption: "Too big to cut down: the Knights' swords barely scratch it." },

  // Independents
  dragon: { vs: ["pikemen", "pikemen", "pikemen"], caption: "Fire splashes the ranks from the air, where pikes can't reach." },
  giant: { vs: ["grunts", "grunts", "grunts", "grunts"], caption: "Boulders land on the mob and flatten goblins by the handful." },
};
