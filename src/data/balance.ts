// Balance targets, following docs/BALANCE.md. Not player-facing: the harness (`npm run balance`) grades the
// simulator against these. docs/BALANCE-PLAN.md explains the roles, the analogues and where the table came from.
//
// Intent first, numbers second (docs/BALANCE.md step 1). Each unit has a role and a Mechabellum analogue, each
// upgrade says what it is for, and RELATIONS says who beats whom, in words. Tune the numbers in units.ts until
// `npm run balance -- check` agrees; when the intent itself is wrong, change it here.

// The Mechabellum role cycle: chaff soaks carries' big hits, chaff clear kills chaff, carries kill chaff clear and
// everything bigger. Tanks, divers, utility and late-game units sit around it.
export type BalanceRole = "chaff" | "chaffClear" | "antiMedium" | "antiGiant" | "tank" | "diver" | "utility" | "lateGame";

// Every band below, and every `ttk` override, is in Mechabellum's numbers; the harness multiplies by this. It stays
// 1 while fights are made as long as Mechabellum's (about 40–60 s) through space and movement, not through HP.
export const FIGHT_SCALE = 1;

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

// What an upgrade is for. `role` when it moves the unit into another role; `beats` lists matchups it should
// win once bought (on top of the unit's own). Upgrades are specialist paths, so most only deepen one.
export interface UpgradeIntent {
  intent: string;
  role?: BalanceRole;
  beats?: string[];
}

export interface BalanceTarget {
  role: BalanceRole;
  analogue: string; // the Mechabellum unit it plays like ("" = none)
  ttk?: [number, number]; // overrides the role's self-TTK band
  upgrades: Record<string, UpgradeIntent>;
}

// Step 1 of docs/BALANCE.md: the neutral baseline is value 1.0, and the Knights are the second anchor.
export const BASELINE_UNIT = "crossbowmen";
export const ANCHOR_UNIT = "knights";

// docs/BALANCE.md §4.
export const TOLERANCE = {
  mirror: [0.4, 0.6] as [number, number], // win rate a unit should get against itself
  soft: 0.6, // win rate at equal supply that counts as beating it
  hardRatio: 2, // a hard counter beats this many times its own supply of the target
  maxHardShare: 0.5, // nothing should hard-counter more than this share of the roster
};

// Ramping units start slow and finish fast, so their opening self-TTK sits above the carry band.
const RAMPING: [number, number] = [5, 16];

export const BALANCE_TARGETS: Record<string, BalanceTarget> = {
  // ------------------------------------------------------------------ Wardens
  knights: {
    role: "tank",
    analogue: "Sledgehammer",
    ttk: [15, 25], // docs/BALANCE.md's frontline band
    upgrades: {
      shield_wall: { intent: "A deeper wall: armor that javelins and claws can't get through", beats: ["wolf_riders"] },
      lance_charge: { intent: "Reach the shooters: a fast charge whose first strike kills", beats: ["crossbowmen"] },
      warded_plate: { intent: "The counterpunch to elementals: resist fire, frost, lightning and water", beats: ["fire_elemental"] },
      veterans: { intent: "Plain power: more damage, and a shield against the first hit", beats: ["troll"] },
    },
  },
  crossbowmen: {
    role: "antiMedium",
    analogue: "Void Eye",
    upgrades: {
      longshot: { intent: "Outrange other shooters and artillery", beats: ["fire_elemental"] },
      fire_bolts: { intent: "Fire: stops a troll regenerating and ignites oil", beats: ["troll"] },
      repeaters: { intent: "Many small bolts instead of a few big ones: the Wardens' chaff clear", role: "chaffClear", beats: ["grunts", "skirmishers", "cloudlings"] },
      skyhunters: { intent: "Anti-air: shoot fliers down before they reach the line (range and focus, not more bolts)" },
    },
  },
  ballista: {
    role: "antiGiant",
    analogue: "Marksman",
    upgrades: {
      heavy_bolts: { intent: "Deeper sniper: fewer shots to drop a giant" },
      repeater: { intent: "Faster, smaller bolts: wastes less on mediums", role: "antiMedium" },
      harpoons: { intent: "Control: chill, freeze and, with Repeater, shatter its target" },
      reinforced_frame: { intent: "Survive the raiders that reach it", beats: ["giant_bats"] },
    },
  },
  griffon_riders: {
    role: "antiMedium",
    analogue: "Phantom Ray",
    upgrades: {
      dive: { intent: "Deeper anti-medium: a huge first strike" },
      armored_saddles: { intent: "Survive anti-air: armor against bolts" },
      sky_patrol: { intent: "Air superiority: pick fliers out of the sky (single targets; flocks still need chain or splash)" },
      giant_slayers: { intent: "Phoenix: an air carry that hunts the biggest units", role: "antiGiant", beats: ["stone_golem", "ogre_brute", "giant"] },
    },
  },
  cleric: {
    role: "utility",
    analogue: "",
    upgrades: {
      sanctuary: { intent: "More healing, over a wider circle" },
      blessing: { intent: "A damage aura for the line" },
      purify: { intent: "The counterpunch to elemental combos: cleanse statuses" },
      battle_hymn: { intent: "Attack and move speed for the line; with Blessing, a hard-hitting line" },
    },
  },
  pikemen: {
    role: "antiGiant",
    analogue: "", // an anti-large line: plenty of sturdy bodies soak big blows, and the pikes punish large units and cavalry
    ttk: [8, 16], // slow against small units on purpose: the ×3 against large is where their damage is
    upgrades: {
      pike_wall: { intent: "Punish melee: every stab costs a goblin", beats: ["grunts"] },
      long_pikes: { intent: "Out-reach javelin cavalry: the pikes become the answer to Wolf Riders", beats: ["wolf_riders"] },
      heavy_halberds: { intent: "Sweeping halberds: the pikes become chaff clear", role: "chaffClear", beats: ["grunts", "skirmishers"] },
      drilled_ranks: { intent: "More bodies to soak big hits" },
    },
  },

  // ------------------------------------------------------------------ Goblins
  grunts: {
    role: "chaff",
    analogue: "Crawler",
    upgrades: {
      scrap_armor: { intent: "Chaff that survives a hit: big hitters waste twice as many blows", beats: ["knights"] },
      feral_frenzy: { intent: "Speed and stabs: a mob that kills before it's cleared" },
      party_time: { intent: "More bodies" },
      oil_bombs: { intent: "Combo: fallen goblins leave oil for fire" },
    },
  },
  skirmishers: {
    role: "chaff",
    analogue: "Fang",
    upgrades: {
      ambush: { intent: "Hidden until they shoot: beat single-target shooters that outrange them (splash still finds them)", beats: ["crossbowmen"] },
      barbed_arrows: { intent: "More damage" },
      improvised_bombs: { intent: "One fire grenade each: a burst of chaff clear on contact", beats: ["grunts"] },
      skyshot: { intent: "Placeholder (owner deferred): anti-air", beats: ["griffon_riders"] },
    },
  },
  wolf_riders: {
    role: "diver",
    analogue: "Rhino",
    upgrades: {
      dire_wolves: { intent: "A tougher, harder-hitting diver" },
      tower_raiders: { intent: "Pressure the Keeps from a flank" },
      flankers: { intent: "Deeper dive: punish the back line" },
      bloodthirst: { intent: "Snowball through soft targets: every kill re-arms the charge" },
    },
  },
  troll: {
    role: "antiGiant",
    analogue: "Steel Ball",
    ttk: RAMPING,
    upgrades: {
      thick_blood: { intent: "The counterpunch to fire: regenerate while burning, so burning ground and fire arrows stop working on it" },
      gorge: { intent: "Outlast giants: ramping hits heal it more" },
      rock_skin: { intent: "Tougher" },
      boulder_toss: { intent: "Placeholder (owner deferred): range, so it never touches a pike wall" },
    },
  },
  ogre_brute: {
    role: "chaffClear",
    analogue: "Fire Badger",
    ttk: [8, 20],
    upgrades: {
      thick_skull: { intent: "The counterpunch to fire, and goblin escorts take its hits", beats: ["fire_elemental"] },
      rampage: { intent: "Clear faster, and arrive sooner" },
      wrecking_swing: { intent: "Deeper chaff clear: a wider swing" },
      warboss: { intent: "Goblin support: buffs nearby goblins and adds grunts", role: "utility" },
    },
  },
  giant_bats: {
    role: "diver",
    analogue: "", // an air diver; nearest are Wasp (air, beats ground-only units) and Rhino (hunts the back line)
    upgrades: {
      leather_wings: { intent: "Survive arrows on the way in", beats: ["skirmishers"] },
      shriek: { intent: "Disrupt: Daze the back line it lands on" },
      bloodsuckers: { intent: "Sustain: heal while feeding" },
      savage_claws: { intent: "More damage" },
    },
  },

  // ------------------------------------------------------------------ Elementals
  fire_elemental: {
    role: "chaffClear",
    analogue: "Stormcaller",
    upgrades: {
      controlled_burn: { intent: "Safe to stand beside your own army" },
      meteor: { intent: "Artillery: outrange the shooters", beats: ["crossbowmen"] },
      wildfire: { intent: "Area denial: burning ground" },
      living_inferno: { intent: "Punish melee that reaches it", beats: ["wolf_riders", "knights"] },
    },
  },
  water_elemental: {
    role: "utility",
    analogue: "",
    upgrades: {
      glacial_heart: { intent: "A tank that chills whoever hits it" },
      tidal_surge: { intent: "Damage and puddles" },
      wellspring: { intent: "The elementals' healer" },
      tsunami: { intent: "Soak whole formations for lightning" },
    },
  },
  air_elemental: {
    role: "chaffClear",
    analogue: "Arclight",
    upgrades: {
      thunderhead: { intent: "Deeper chaff clear: more chain jumps" },
      tempest: { intent: "Tougher, and faster attacks" },
      eye_of_the_storm: { intent: "The anti-air specialist", beats: ["griffon_riders"] },
      take_flight: { intent: "Raiden: chain lightning from out of melee's reach", beats: ["knights", "wolf_riders", "stone_golem"] },
    },
  },
  cloudlings: {
    role: "chaff",
    analogue: "Wasp",
    upgrades: {
      downpour: { intent: "Combo: soak targets Wet" },
      thunderstorm: { intent: "Lightning that Conducts through Wet" },
      overcast: { intent: "More bodies" },
      freezing_rain: { intent: "Frost hail: through armor, and Wet targets freeze" },
    },
  },
  frost_elemental: {
    role: "antiGiant",
    analogue: "Melting Point",
    ttk: RAMPING,
    upgrades: {
      chilling_bolts: { intent: "Control: chill, then freeze" },
      cold_snap: { intent: "Deeper anti-giant: faster bolts ramp sooner" },
      hoarfrost: { intent: "Protection from the divers that reach it", beats: ["giant_bats"] },
      glacial_reach: { intent: "Outrange the shooters and hunt them", beats: ["fire_elemental"] },
    },
  },
  stone_golem: {
    role: "tank",
    analogue: "Fortress",
    ttk: [15, 40], // a slow melee titan pays a long closing tax, so it needs more staying power than Mechabellum's (ranged) Fortress
    upgrades: {
      granite: { intent: "A deeper wall" },
      quake: { intent: "Splash and stun: the golem clears swarms", role: "chaffClear", beats: ["grunts"] },
      magma_core: { intent: "Fire fists: stop trolls healing", beats: ["troll"] },
      landslide: { intent: "Reach the line fast" },
    },
  },

  // ------------------------------------------------------------------ Independents
  // Anyone can field them, and they cover a faction's holes, but they cost more to unlock and are less
  // cost-efficient than a faction's own answer. Not rebalanced yet.
  dragon: {
    role: "lateGame",
    analogue: "Overlord",
    upgrades: {
      inferno: { intent: "More damage and burning ground" },
      ancient_scales: { intent: "Tougher" },
      elder_blood: { intent: "Sustain, unless chilled" },
      dread: { intent: "Disrupt: Daze everything it breathes on" },
    },
  },
  giant: {
    role: "chaffClear",
    analogue: "Vulcan",
    upgrades: {
      earthshaker: { intent: "Control: stun where the boulders land" },
      thick_hide: { intent: "Tougher" },
      rockslide: { intent: "Artillery: more range, a wider blast" },
      frost_giant: { intent: "Combo: chill and freeze where the boulders land" },
    },
  },
};

// Who beats whom at equal supply, in words: [winner, loser, why]. The table is read in both directions, so
// write each pair once. Pairs not listed are free to land anywhere; the harness reports strong ones.
export const RELATIONS: [string, string, string][] = [
  // Chaff soaks carries: big single hits are wasted on swarms.
  ["grunts", "crossbowmen", "a swarm soaks the bolts and reaches them"],
  ["grunts", "ballista", "one bolt, one goblin"],
  ["grunts", "frost_elemental", "the cold never gets to sink in"],
  ["grunts", "troll", "the rage resets on every goblin"],
  ["skirmishers", "crossbowmen", "too many bodies for a few bolts"],
  ["skirmishers", "ballista", "too many bodies for one bolt"],
  ["skirmishers", "frost_elemental", "the cold never gets to sink in"],
  ["skirmishers", "giant_bats", "short bows that hit fliers"],
  ["cloudlings", "crossbowmen", "a flock the bolts can't thin"],
  ["cloudlings", "ballista", "one bolt, one cloud"],
  ["cloudlings", "knights", "they can't hit fliers"],
  ["cloudlings", "pikemen", "they can't hit fliers"],
  ["cloudlings", "troll", "it can't hit fliers"],
  ["cloudlings", "stone_golem", "it can't hit fliers"],
  ["cloudlings", "giant_bats", "bats can't hit fliers"],

  // Chaff clear clears chaff.
  ["air_elemental", "grunts", "chain lightning through the mob"],
  ["air_elemental", "skirmishers", "chain lightning through the mob"],
  ["air_elemental", "cloudlings", "chain lightning, extra against fliers"],
  ["air_elemental", "giant_bats", "it hits fliers, they can't dodge chains"],
  ["fire_elemental", "grunts", "splash"],
  ["fire_elemental", "skirmishers", "splash, and it outranges them"],
  ["fire_elemental", "pikemen", "splash through the ranks, from range"],
  ["fire_elemental", "troll", "burning stops it regenerating"],
  ["fire_elemental", "knights", "fire burns through armor, from range"],
  ["ogre_brute", "grunts", "a cleaving club"],
  ["giant", "grunts", "boulders on the mob"],
  ["giant", "skirmishers", "boulders on the mob"],

  // Anti-medium: big single hits on medium units.
  ["crossbowmen", "knights", "bolts punch through armor"],
  ["crossbowmen", "air_elemental", "bolts outrange and punch through"],
  ["crossbowmen", "griffon_riders", "heavy bolts that hit fliers"],
  ["griffon_riders", "knights", "they can't hit fliers"],
  ["griffon_riders", "pikemen", "they can't hit fliers"],
  ["griffon_riders", "troll", "it can't hit fliers"],
  ["griffon_riders", "ogre_brute", "it can't hit fliers"],
  ["griffon_riders", "fire_elemental", "it can't hit fliers"],

  // Anti-giant: snipers, ramping damage and pikes on big units.
  ["ballista", "griffon_riders", "a sniper that hits fliers"],
  ["ballista", "frost_elemental", "it outranges them"],
  ["ballista", "air_elemental", "it outranges them"],
  ["ballista", "stone_golem", "×2 against huge, from far away"],
  ["ballista", "ogre_brute", "×2 against large, from far away"],
  ["ballista", "giant", "×2 against huge"],
  ["ballista", "dragon", "×2 against huge, and it hits fliers"],
  ["troll", "stone_golem", "the rage builds on one big target"],
  ["troll", "ogre_brute", "the rage builds on one big target"],
  ["troll", "giant", "the rage builds on one big target"],
  ["troll", "knights", "the rage builds through the armor"],
  ["frost_elemental", "stone_golem", "the cold sinks in"],
  ["frost_elemental", "ogre_brute", "the cold sinks in"],
  ["frost_elemental", "giant", "the cold sinks in"],
  ["frost_elemental", "dragon", "the cold sinks in, and it hits fliers"],
  ["pikemen", "stone_golem", "×3.5 against huge"],
  ["pikemen", "ogre_brute", "×3.5 against large"],
  ["pikemen", "giant", "×3.5 against huge"],
  ["pikemen", "troll", "×3.5 against large, and many bodies to waste its rage"],

  // Tanks hold the line and kill what reaches them.
  ["knights", "grunts", "a wall the mob runs onto"],
  ["knights", "pikemen", "armor, and no bonus against it"],
  ["knights", "ballista", "they reach it"],
  ["knights", "frost_elemental", "they reach it"],
  ["knights", "air_elemental", "they reach it and outlast it"],
  ["stone_golem", "knights", "too big to cut down"],
  ["stone_golem", "crossbowmen", "bolts bounce off a titan"],

  // Divers reach the back line.
  ["wolf_riders", "crossbowmen", "they get there first"],
  ["wolf_riders", "ballista", "they get there first"],
  ["wolf_riders", "fire_elemental", "they get there first"],
  ["wolf_riders", "air_elemental", "they get there first"],
  ["wolf_riders", "knights", "fast javelins, too quick to pin down"],
  ["wolf_riders", "ogre_brute", "too fast for its swing"],
  ["wolf_riders", "giant", "too fast for its boulders"],
  ["crossbowmen", "giant_bats", "heavy bolts that hit fliers"],
  ["giant_bats", "ballista", "they land on it"],
  ["giant_bats", "fire_elemental", "it can't hit fliers"],
  ["giant_bats", "frost_elemental", "they land on the back line"],
  ["giant_bats", "knights", "they can't hit fliers"],
  ["giant_bats", "pikemen", "they can't hit fliers"],
  ["giant_bats", "troll", "it can't hit fliers"],
  ["giant_bats", "ogre_brute", "it can't hit fliers"],
  ["giant_bats", "stone_golem", "it can't hit fliers"],
  ["griffon_riders", "giant_bats", "bats can't hit fliers"],
  ["griffon_riders", "wolf_riders", "javelins can't reach fliers"],

  // Late game.
  ["dragon", "knights", "they can't hit fliers"],
  ["dragon", "pikemen", "splash, from the air"],
  ["dragon", "griffon_riders", "too big for their spears"],
  ["dragon", "grunts", "splash"],
  ["dragon", "cloudlings", "splash, in the air"],
  ["dragon", "troll", "it can't hit fliers"],
  ["dragon", "stone_golem", "it can't hit fliers"],
];

export const beatsOf = (id: string) => RELATIONS.filter(([a]) => a === id).map(([, b]) => b);
export const losesToOf = (id: string) => RELATIONS.filter(([, b]) => b === id).map(([a]) => a);
export const reasonFor = (a: string, b: string) => RELATIONS.find(([x, y]) => x === a && y === b)?.[2];
