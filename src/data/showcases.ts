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
  giant_bats: { vs: ["ballista", "ballista"], caption: "They fly straight over the Field and land on the Ballistae." },

  // Elementals
  fire_elemental: { vs: ["grunts", "grunts"], caption: "Fireballs splash a crowd and leave it burning." },
  // Wet + lightning conducts for double damage; against Knights alone the line is too sturdy to show it winning
  water_elemental: { allies: ["air_elemental"], vs: ["knights", "grunts"], caption: "A tidal tank that soaks the enemy Wet, so its partner's lightning conducts for double damage." },
  air_elemental: { vs: ["skirmishers", "skirmishers"], caption: "Chain lightning jumps from goblin to goblin." },
  // the balance table has Cloudlings beating Crossbowmen at equal supply, but narrowly; in this short arena it takes 3 to 2
  cloudlings: { squads: 3, vs: ["crossbowmen", "crossbowmen"], caption: "A flock the bolts can't thin: each heavy bolt only ever pops one cloud." },
  frost_elemental: { squads: 2, vs: ["stone_golem"], caption: "The cold sinks in: each bolt in a row on the Golem hits harder than the last." },
  stone_golem: { vs: ["knights"], caption: "Too big to cut down: the Knights' swords barely scratch it." },

  // Independents
  dragon: { vs: ["pikemen", "pikemen", "pikemen"], caption: "Fire splashes the ranks from the air, where pikes can't reach." },
  giant: { vs: ["grunts", "grunts", "grunts", "grunts"], caption: "Boulders land on the mob and flatten goblins by the handful." },
  toad_riders: { vs: ["griffon_riders"], caption: "Sticky tongues snatch fliers out of the air, and medium units taste best: the Griffons never land a spear." },
};
