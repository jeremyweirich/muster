// Balance targets, following docs/BALANCE.md. Not player-facing: the harness (`npm run balance`) grades the
// simulator against these. docs/BALANCE-PLAN.md explains the roles, the analogues and where the draft came from.
//
// DRAFT: `beats` and `losesTo` were translated from Mechabellum's matchup lists (docs/REFERENCE_2.md) through
// `analogue`. The owner hasn't signed them off. Edit them in words first (docs/BALANCE.md step 1), then tune
// numbers until `npm run balance -- check` agrees.

// The Mechabellum role cycle: chaff soaks carries' big hits, chaff clear kills chaff, carries kill chaff clear and
// everything bigger. Tanks, divers, utility and late-game units sit around it.
export type BalanceRole = "chaff" | "chaffClear" | "antiMedium" | "antiGiant" | "tank" | "diver" | "utility" | "lateGame";

// Self-TTK = HP ÷ own DPS, per model: how long a unit takes to kill a copy of itself. Bands from docs/REFERENCE_2.md §5.
export const ROLE_INFO: Record<BalanceRole, { name: string; ttk: [number, number] | null }> = {
  chaff: { name: "Chaff", ttk: [3, 10] },
  chaffClear: { name: "Chaff clear", ttk: [8, 18] },
  antiMedium: { name: "Anti-medium", ttk: [5, 10] },
  antiGiant: { name: "Anti-giant carry", ttk: [2, 6] },
  tank: { name: "Tank", ttk: [12, 26] },
  diver: { name: "Diver", ttk: [4, 13] },
  utility: { name: "Utility", ttk: null },
  lateGame: { name: "Late-game power", ttk: [13, 25] },
};

// The target-size axis. Splash and many small hits are efficient against light, big single hits against
// medium, ramping or %HP damage against giants and titans. Read from each unit's size:* tag.
export type SizeClass = "light" | "medium" | "giant" | "titan";
export const SIZE_CLASS: Record<string, SizeClass> = {
  "size:small": "light",
  "size:medium": "medium",
  "size:large": "giant",
  "size:huge": "titan",
};

export interface BalanceTarget {
  role: BalanceRole;
  analogue: string; // the Mechabellum unit it plays like ("" = none)
  ttk?: [number, number]; // overrides the role's self-TTK band
  beats: string[];
  losesTo: string[];
}

// Step 1 of docs/BALANCE.md: the neutral baseline is value 1.0, and the Knights are the second anchor.
export const BASELINE_UNIT = "elven_archers";
export const ANCHOR_UNIT = "knights";

// docs/BALANCE.md §4.
export const TOLERANCE = {
  mirror: [0.4, 0.6] as [number, number], // win rate a unit should get against itself
  soft: 0.6, // win rate at equal supply that counts as beating it
  hardRatio: 2, // a hard counter beats this many times its own supply of the target
  maxHardShare: 0.5, // nothing should hard-counter more than this share of the roster
};

export const BALANCE_TARGETS: Record<string, BalanceTarget> = {
  // Wardens
  knights: {
    role: "tank",
    analogue: "Sledgehammer",
    ttk: [15, 25], // docs/BALANCE.md's frontline band
    beats: ["elven_archers", "fire_elemental"],
    losesTo: ["frost_elemental", "griffon_riders", "stone_golem", "wolf_riders", "dragon"],
  },
  elven_archers: {
    role: "chaffClear",
    analogue: "Mustang",
    beats: ["grunts", "skirmishers", "cloudlings", "frost_elemental"],
    losesTo: ["pikemen", "knights", "wolf_riders", "air_elemental"],
  },
  ballista: {
    role: "antiGiant",
    analogue: "Marksman",
    beats: ["frost_elemental", "griffon_riders", "air_elemental", "dragon"],
    losesTo: ["grunts", "skirmishers", "cloudlings", "stone_golem", "wolf_riders", "giant_bats"],
  },
  griffon_riders: {
    role: "antiMedium",
    analogue: "Phantom Ray",
    beats: ["pikemen", "troll", "ogre_brute", "knights"],
    losesTo: ["ballista", "dragon"],
  },
  cleric: { role: "utility", analogue: "", beats: [], losesTo: [] },
  pikemen: {
    role: "chaffClear",
    analogue: "Tarantula",
    beats: ["grunts", "skirmishers", "elven_archers"],
    losesTo: ["frost_elemental", "troll", "fire_elemental", "stone_golem", "dragon", "griffon_riders", "wolf_riders"],
  },

  // Goblins
  grunts: {
    role: "chaff",
    analogue: "Crawler",
    beats: ["ballista"],
    losesTo: ["pikemen", "giant", "ogre_brute", "air_elemental", "elven_archers"],
  },
  skirmishers: {
    role: "chaff",
    analogue: "Fang",
    beats: ["ballista"],
    losesTo: ["pikemen", "fire_elemental", "air_elemental", "elven_archers"],
  },
  wolf_riders: {
    role: "diver",
    analogue: "Rhino",
    beats: ["air_elemental", "ballista", "knights", "pikemen", "ogre_brute", "elven_archers", "giant"],
    losesTo: ["troll", "stone_golem"],
  },
  troll: {
    role: "tank",
    analogue: "Sabertooth",
    beats: ["pikemen", "wolf_riders"],
    losesTo: ["frost_elemental", "griffon_riders", "stone_golem"],
  },
  ogre_brute: {
    role: "chaffClear",
    analogue: "Fire Badger",
    beats: ["grunts"],
    losesTo: ["griffon_riders", "wolf_riders", "stone_golem"],
  },
  giant_bats: {
    role: "diver",
    analogue: "", // an air diver; nearest are Wasp (air chaff) and Rhino (backline hunter)
    beats: ["ballista", "fire_elemental"],
    losesTo: ["skirmishers", "air_elemental", "griffon_riders"],
  },

  // Elementals
  fire_elemental: {
    role: "chaffClear",
    analogue: "Stormcaller",
    beats: ["pikemen", "skirmishers"],
    losesTo: ["knights", "giant_bats"],
  },
  water_elemental: { role: "utility", analogue: "", beats: [], losesTo: [] },
  air_elemental: {
    role: "chaffClear",
    analogue: "Arclight", // Raiden once it takes flight
    beats: ["grunts", "skirmishers", "elven_archers", "giant_bats"],
    losesTo: ["wolf_riders", "stone_golem", "ballista"],
  },
  cloudlings: {
    role: "chaff",
    analogue: "Wasp",
    beats: ["ballista"],
    losesTo: ["elven_archers"],
  },
  frost_elemental: {
    role: "antiMedium",
    analogue: "Void Eye",
    beats: ["troll", "pikemen", "knights"],
    losesTo: ["ballista", "elven_archers"],
  },
  stone_golem: {
    role: "tank",
    analogue: "Fortress",
    beats: ["pikemen", "air_elemental", "troll", "ogre_brute", "knights", "giant", "ballista", "wolf_riders"],
    losesTo: [], // Mechabellum's answers to the Fortress (Melting Point, the titans) have no analogue here yet
  },

  // Independents
  dragon: {
    role: "lateGame",
    analogue: "Overlord",
    beats: ["pikemen", "griffon_riders", "knights"],
    losesTo: ["ballista"],
  },
  giant: {
    role: "chaffClear",
    analogue: "Vulcan",
    beats: ["grunts"],
    losesTo: ["wolf_riders", "stone_golem"],
  },
};
