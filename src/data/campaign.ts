// The story campaigns, as planned in docs/CAMPAIGN.md. A mission with a `play` setup is playable from the Story tab;
// the rest are listed as coming soon. Teasers are player-facing, so keep them spoiler-light. The framework is
// described in docs/CAMPAIGN.md §6; src/game/mission.ts turns a MissionDef into a match.

import type { BattleResult } from "../sim/battle";
import type { PlacedSquad } from "../sim/types";
import { DEFAULT_UNITS } from "./units";

// The cast. Voices are in docs/VISION.md: the Wardens are proud of being boring, the Boss SHOUTS.
export const CAST = {
  sergeant: { name: "Sergeant Dunmor", side: "warden" },
  archivist: { name: "Archivist Ithiel", side: "warden" },
  boss: { name: "The Boss", side: "goblin" },
} as const;
export type Speaker = keyof typeof CAST;

export interface Line {
  who: Speaker;
  text: string;
}

// A squad in field tiles: the unit, its footprint's top-left corner, and whether it's rotated. The player deploys
// in rows 20–26 at the bottom, the enemy in rows 0–6 at the top.
export type SquadSpec = [defId: string, x: number, y: number, rot?: boolean];

// What a debrief reads: the player's army as it fought the last battle, that battle, and every battle of the match.
export interface MissionContext {
  army: PlacedSquad[];
  result: BattleResult;
  results: BattleResult[];
  towerLevels: number[]; // the player's Keep levels at the end
}

// What a scripted round can look at: the player's army as the enemy saw it (squads placed in earlier rounds).
export interface ScriptContext {
  round: number;
  seen: PlacedSquad[];
}
// A round of the enemy's script: fixed squads, or squads chosen from what it saw (the Boss hits your thin flank).
export type EnemyRound = SquadSpec[] | ((c: ScriptContext) => SquadSpec[]);
// A reference army, round by round: the squads the player adds, or squads and Keep levels to buy (Keep indexes,
// 0 = West, 1 = East, one entry per level).
export type PlanRound = SquadSpec[] | { squads: SquadSpec[]; keeps: number[] };
export type Plan = PlanRound[];
export const planSquads = (r: PlanRound | undefined): SquadSpec[] => (!r ? [] : Array.isArray(r) ? r : r.squads);
export const planKeeps = (r: PlanRound | undefined): number[] => (!r || Array.isArray(r) ? [] : r.keeps);

export interface MissionDef {
  id: string; // `#story/<id>`
  supply: number; // the player's supply in round 1; later rounds get the standard income
  units: string[]; // the player's units, unlocked and free
  shop?: string[]; // more units the player may unlock, at the usual price
  hp?: [number, number]; // each side's HP; absent: one battle decides the mission
  towers: boolean; // the Keeps stand
  map?: string; // a MAPS id (src/data/terrain.ts); absent: the open field
  upgrades: boolean; // the Upgrades tab exists (with the Keeps on, it holds only the Keeps)
  veterancy: boolean; // squads earn XP and levels
  enemy: {
    name: string; // on its HP bar and in the sidebar
    units: string[]; // its unlocks, shown as the AI's are
    upgrades?: Record<string, string[]>; // bought before the match, shown as the AI's are (★)
    revealed?: boolean; // round 1's squads are placed and visible before the player deploys
    rounds: EnemyRound[]; // squads it adds each round; after the last, nothing
  };
  briefing: Line[];
  page: {
    title: string;
    text: string;
    drill?: string; // the formation, in a line
    diagram?: string[][]; // unit ids by rank, front rank first
  };
  objective: string; // the sidebar's one line while deploying
  win: Line[];
  hints: { when?: (c: MissionContext) => boolean; line: Line }[]; // after a loss, the first that matches
  commendation?: { name: string; text: string; earned: (c: MissionContext) => boolean };
  // Armies that must win and must lose against the script (tests/campaign.test.tsx), so the punch and the
  // counterpunch stay true when units are rebalanced. `commended` must also earn the commendation.
  reference: { wins: Plan[]; loses: Plan[]; commended?: Plan };
}

export interface MissionInfo {
  title: string;
  teaser: string;
  play?: MissionDef;
}

export interface CampaignInfo {
  id: string;
  faction: string; // a FACTIONS id
  title: string;
  tagline: string;
  missions: MissionInfo[]; // empty until the campaign is outlined for players
}

const fielded = (c: MissionContext, defId: string) => c.army.some((sq) => sq.defId === defId);
const COST = new Map(DEFAULT_UNITS.map((u) => [u.id, u.cost]));

// Which flank the player's army leaves thin, as the enemy saw it: the side away from its weight (each squad's
// center, weighted by cost). An empty or perfectly central army counts as thin on the West (left).
function thinFlank(seen: PlacedSquad[]): "west" | "east" {
  let weight = 0;
  let sum = 0;
  for (const sq of seen) {
    const cost = COST.get(sq.defId) ?? 0;
    const w = DEFAULT_UNITS.find((u) => u.id === sq.defId)?.footprint;
    weight += cost;
    sum += cost * (sq.x + (w ? (sq.rot ? w.h : w.w) / 2 : 0));
  }
  return weight > 0 && sum / weight < 24 ? "east" : "west";
}

// Squads laid out for the West flank, or turned to the East one (mirrored across the field's middle).
function onFlank(flank: "west" | "east", specs: SquadSpec[]): SquadSpec[] {
  if (flank === "west") return specs;
  return specs.map(([id, x, y, rot]) => {
    const f = DEFAULT_UNITS.find((u) => u.id === id)!.footprint;
    return [id, 48 - x - (rot ? f.h : f.w), y, rot];
  });
}

const allRoundsWon = (c: MissionContext) => c.results.every((r) => r.winner === 0);
// a Keep of the player's (side 0) that fell in any battle
const keepFell = (c: MissionContext) => c.results.some((r) => Object.values(r.stats).some((s) => s.structure && s.side === 0 && s.alive === 0));

const HANDS_OFF: MissionDef = {
  id: "wardens-1",
  supply: 400,
  units: ["knights", "crossbowmen"],
  towers: false,
  upgrades: false,
  veterancy: false,
  enemy: {
    name: "The Boss",
    units: ["grunts"],
    revealed: true,
    rounds: [
      [
        ["grunts", 10, 4],
        ["grunts", 22, 4],
        ["grunts", 34, 4],
      ],
    ],
  },
  briefing: [
    { who: "archivist", text: "Marshal. Welcome to your first Field. Today's dispute concerns a goat." },
    { who: "sergeant", text: "Wandered over at Millbrook on Tuesday. The goblins say it's theirs. The goat hasn't said." },
    { who: "boss", text: "IT'S OUR GOAT." },
    {
      who: "archivist",
      text: "The challenger deploys first, and they have: you may study their army as long as you like. The book has a page for this. It has been the same page for four hundred years.",
    },
  ],
  page: {
    title: "Page 1: The Compact",
    text: "Choose your champions. Place them. When the horn sounds, no hand may touch the Field.",
    drill: "Steel in front. Arrows behind.",
    diagram: [["knights"], ["crossbowmen", "crossbowmen"]],
  },
  objective: "Win the battle. Three mobs of Grunts are waiting, and you have 400 supply of Knights and Crossbowmen.",
  win: [
    { who: "sergeant", text: "Boring wins. Write that down." },
    { who: "archivist", text: "Written. The goat goes home to Millbrook." },
    { who: "boss", text: "THAT WASN'T FAIR. WE'RE APPEALING." },
  ],
  hints: [
    {
      when: (c) => !fielded(c, "knights"),
      line: { who: "sergeant", text: "Bolts hit hard, but there were more goblins than bolts. A mob needs something to run onto. Steel in front." },
    },
    { line: { who: "sergeant", text: "They got round the steel. Put the Knights where the goblins will run: between them and the bows." } },
  ],
  commendation: {
    name: "Steel in Front",
    text: "Win with Crossbowmen on the Field, and lose none of them.",
    earned: (c) => {
      const bows = c.army.filter((sq) => sq.defId === "crossbowmen");
      return bows.length > 0 && bows.every((sq) => c.result.stats[sq.uid]?.alive === c.result.stats[sq.uid]?.total);
    },
  },
  reference: {
    wins: [
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]]],
      [[["knights", 6, 20], ["crossbowmen", 3, 22], ["crossbowmen", 9, 22]]],
      [[["crossbowmen", 20, 20], ["crossbowmen", 25, 20], ["knights", 22, 26]]],
      [[["knights", 44, 26], ["crossbowmen", 3, 20], ["crossbowmen", 7, 20]]],
      [[["knights", 20, 20], ["knights", 24, 20]]],
    ],
    loses: [
      [[["crossbowmen", 18, 20], ["crossbowmen", 21, 20], ["crossbowmen", 24, 20], ["crossbowmen", 27, 20]]],
      [[["crossbowmen", 20, 21], ["crossbowmen", 24, 21], ["crossbowmen", 20, 23], ["crossbowmen", 24, 23]]],
      [[["crossbowmen", 18, 22], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22]]],
    ],
    commended: [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]]],
  },
};

// Mission 2: rounds, locked squads, HP. Round 1 is blind; in round 2 the Boss puts archers behind a goblin screen on
// the flank the player's line left thin. Tuned by simulation (docs/CAMPAIGN.md): a player who loses round 2, reads
// it and covers that flank wins in four rounds; one who guesses and covers both flanks wins every round.
const THE_APPEAL: MissionDef = {
  id: "wardens-2",
  supply: 400,
  units: ["knights", "crossbowmen"],
  hp: [70, 90],
  towers: false,
  upgrades: false,
  veterancy: false,
  map: "millbrook-ford",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers"],
    rounds: [
      [
        ["grunts", 10, 4],
        ["grunts", 18, 4],
        ["grunts", 26, 4],
        ["grunts", 34, 4],
      ],
      ({ seen }) =>
        onFlank(thinFlank(seen), [
          ["grunts", 0, 4],
          ["grunts", 5, 4],
          ["skirmishers", 0, 1],
          ["skirmishers", 5, 1],
          ["skirmishers", 10, 1],
        ]),
      [
        ["grunts", 14, 1],
        ["grunts", 22, 1],
        ["grunts", 30, 1],
      ],
    ],
  },
  briefing: [
    { who: "archivist", text: "The goblins have appealed the goat. Under the Compact a loss may be appealed once, as a longer match." },
    {
      who: "sergeant",
      text: "Rounds, Marshal. Each round you add champions, and whatever you've placed stays where it is. After every battle the survivors take a bite out of the other side's standing. First side to run out loses.",
    },
    { who: "boss", text: "BEST OF... LOTS." },
    { who: "archivist", text: "They've moved the Field to Millbrook Ford. There is a pond in the middle. I'd not plan on anyone walking through it." },
  ],
  page: {
    title: "Page 2: What Is Placed Stays Placed",
    text: "You will see what they fielded, never what they will add.",
    drill: "Read their last army. Guess their answer. Add yours.",
  },
  objective: "Bring the Boss's HP to nothing before yours runs out. Your squads stay on the Field, and every round brings more supply to add.",
  win: [
    { who: "sergeant", text: "Boring wins. Twice now." },
    { who: "archivist", text: "The appeal is dismissed. The goat has eaten the appeal." },
    { who: "boss", text: "THAT WAS OUR ONLY COPY." },
  ],
  hints: [
    {
      when: (c) => c.army.every((sq) => sq.round === 1),
      line: { who: "sergeant", text: "Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will." },
    },
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "Bolts alone again. A mob needs steel to run onto." } },
    {
      line: {
        who: "sergeant",
        text: "Their archers hid behind a goblin screen, on the flank we'd left thin. You saw them there. Next time, put steel on that flank and bows behind it, or guess it before they do.",
      },
    },
  ],
  commendation: { name: "Guess Right", text: "Win every round of the appeal.", earned: allRoundsWon },
  reference: {
    wins: [
      // guesses the flank attack and covers both flanks in round 2
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 38, 20], ["knights", 6, 20]],
        [["crossbowmen", 37, 22], ["crossbowmen", 7, 22], ["crossbowmen", 30, 22], ["crossbowmen", 15, 22], ["crossbowmen", 33, 24]],
      ],
      // loses round 2 to the archers, then covers the flanks
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["crossbowmen", 30, 22], ["crossbowmen", 16, 22], ["crossbowmen", 34, 22], ["crossbowmen", 12, 22]],
        [["knights", 36, 20], ["knights", 8, 20], ["crossbowmen", 37, 24]],
      ],
      // knights first
      [
        [["knights", 20, 20], ["knights", 24, 20]],
        [["knights", 36, 20], ["knights", 8, 20]],
        [["crossbowmen", 37, 22], ["crossbowmen", 8, 22], ["crossbowmen", 20, 22], ["crossbowmen", 24, 22], ["crossbowmen", 28, 22]],
      ],
    ],
    loses: [
      // never adds after round 1
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]]],
      // only bows after round 1
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["crossbowmen", 30, 22], ["crossbowmen", 16, 22], ["crossbowmen", 34, 22], ["crossbowmen", 12, 22]],
        [["crossbowmen", 37, 22], ["crossbowmen", 8, 22], ["crossbowmen", 41, 22], ["crossbowmen", 4, 22], ["crossbowmen", 31, 24]],
      ],
      // all bows
      [
        [["crossbowmen", 18, 22], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22], ["crossbowmen", 30, 22]],
        [["crossbowmen", 14, 22], ["crossbowmen", 34, 22], ["crossbowmen", 10, 22], ["crossbowmen", 38, 22]],
        [["crossbowmen", 6, 22], ["crossbowmen", 42, 22], ["crossbowmen", 2, 22], ["crossbowmen", 44, 24], ["crossbowmen", 20, 24]],
      ],
    ],
    commended: [
      [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
      [["knights", 38, 20], ["knights", 6, 20]],
      [["crossbowmen", 37, 22], ["crossbowmen", 7, 22], ["crossbowmen", 30, 22], ["crossbowmen", 15, 22], ["crossbowmen", 33, 24]],
    ],
  },
};

// Mission 3: Keeps, the collapse Daze and Keep levels. The Boss's Wolf Riders have Tower Raiders: in rounds 2 and 3
// they come through the long grass on the player's thin flank and go for that Keep, while the rest of the Boss's
// reinforcements join the center. Tuned by simulation: steel beside the Keeps, or levels on them, wins; no steel
// loses; Knights beside both Keeps from the start keep every Keep standing (the commendation).
const TWO_KEEPS: MissionDef = {
  id: "wardens-3",
  supply: 400,
  units: ["knights", "crossbowmen"],
  hp: [100, 100],
  towers: true,
  upgrades: false,
  veterancy: false,
  map: "long-grass",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers", "wolf_riders"],
    upgrades: { wolf_riders: ["tower_raiders"] },
    rounds: [
      [
        ["grunts", 14, 4],
        ["grunts", 22, 4],
        ["grunts", 30, 4],
        ["skirmishers", 22, 1],
      ],
      ({ seen }) => [...onFlank(thinFlank(seen), [["wolf_riders", 0, 3]]), ["grunts", 14, 1], ["grunts", 30, 1]],
      ({ seen }) => [...onFlank(thinFlank(seen), [["wolf_riders", 3, 3]]), ["grunts", 18, 1], ["skirmishers", 26, 1]],
      [
        ["grunts", 10, 4],
        ["grunts", 34, 4],
        ["skirmishers", 38, 1],
      ],
    ],
  },
  briefing: [
    { who: "archivist", text: "Marshal, a goblin has painted something on the West Keep." },
    { who: "sergeant", text: "It's rude." },
    { who: "boss", text: "IT'S A GOOD LIKENESS." },
    {
      who: "archivist",
      text: "Every Field has two Keeps a side. They don't fight, and they don't count toward winning a battle. But if one falls, the whole army loses its nerve.",
    },
    { who: "sergeant", text: "And the grass on the flanks is long this year. Goblins like long grass." },
  ],
  page: {
    title: "Page 3: Two Keeps",
    text: "Every Field has two Keeps. If one falls, the whole army loses its nerve.",
    drill: "Guard the flanks, or build the walls higher.",
  },
  objective: "Win the match, and mind your Keeps: a fallen Keep Dazes your whole army. You can buy Keep levels under Keeps.",
  win: [
    { who: "sergeant", text: "Boring wins. Write that down. Again." },
    { who: "archivist", text: "The painting has been scrubbed off the West Keep. Mostly." },
    { who: "boss", text: "FINE. WE'RE GETTING THE TROLL." },
  ],
  hints: [
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "Bolts alone again. A mob needs steel to run onto." } },
    {
      when: (c) => keepFell(c) && c.towerLevels.every((l) => l === 0),
      line: {
        who: "sergeant",
        text: "Their wolves went round us and pulled down a Keep, and the whole line lost its nerve. Put steel beside the Keeps. A level on one costs 100 and makes a raid work for it.",
      },
    },
    { line: { who: "sergeant", text: "They got to the Keeps anyway. Walls only buy time: put steel beside them, where the wolves come in." } },
  ],
  commendation: { name: "Not One Stone", text: "Win without losing a Keep.", earned: (c) => !keepFell(c) },
  reference: {
    wins: [
      // a level on each Keep before the raid, and a Knight squad on one flank
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]], { squads: [["knights", 16, 20]], keeps: [0, 1] }, [["knights", 28, 20], ["crossbowmen", 17, 24], ["crossbowmen", 27, 24], ["crossbowmen", 32, 22]], [["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 22, 25], ["crossbowmen", 40, 22]]],
      // loses a Keep to the first raid, then guards that flank and buys levels
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]], [["knights", 16, 20], ["crossbowmen", 28, 22], ["crossbowmen", 14, 22]], { squads: [["knights", 36, 20], ["crossbowmen", 17, 24]], keeps: [0, 1] }, [["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 22, 25], ["crossbowmen", 40, 22]]],
      // steel beside both Keeps from round 2
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]], [["knights", 9, 20], ["knights", 35, 20]], [["crossbowmen", 9, 22], ["crossbowmen", 36, 22], ["crossbowmen", 17, 24], ["crossbowmen", 27, 24], ["crossbowmen", 32, 22]], [["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 22, 25], ["crossbowmen", 40, 22]]],
    ],
    loses: [
      // no new steel: bows and levels only
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]], { squads: [["crossbowmen", 28, 22], ["crossbowmen", 16, 22]], keeps: [0, 1] }, [["crossbowmen", 28, 24], ["crossbowmen", 17, 24], ["crossbowmen", 13, 22], ["crossbowmen", 32, 22], ["crossbowmen", 36, 22]]],
      // all bows
      [
        [["crossbowmen", 18, 22], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22], ["crossbowmen", 30, 22]],
        [["crossbowmen", 14, 22], ["crossbowmen", 34, 22], ["crossbowmen", 10, 22], ["crossbowmen", 38, 22]],
        [["crossbowmen", 6, 22], ["crossbowmen", 42, 22], ["crossbowmen", 2, 22], ["crossbowmen", 44, 24], ["crossbowmen", 20, 24]],
      ],
    ],
    // steel beside both Keeps from the first round, and more on both flanks in round 3
    commended: [
      [["knights", 9, 20], ["knights", 35, 20]],
      [["crossbowmen", 9, 22], ["crossbowmen", 36, 22], ["knights", 22, 20]],
      [["knights", 5, 20], ["knights", 39, 20], ["crossbowmen", 19, 22]],
    ],
  },
};

export const CAMPAIGNS: CampaignInfo[] = [
  {
    id: "wardens",
    faction: "warden",
    title: "The Drill Book",
    tagline: "A new Marshal, a four-hundred-year-old book of formations, and a goblin Boss with a season's worth of grievances.",
    missions: [
      { title: "Hands Off", teaser: "A goat has wandered across the border at Millbrook. Settle it on the Field.", play: HANDS_OFF },
      { title: "The Appeal", teaser: "The goblins appeal the goat. Under the Compact, an appeal is a longer match.", play: THE_APPEAL },
      { title: "Two Keeps", teaser: "Someone has painted something rude on the West Keep.", play: TWO_KEEPS },
      { title: "Under the Bridge", teaser: "The goblins have adopted the troll under the toll bridge. And its toll." },
      { title: "Plain Steel", teaser: "A goblin Tinker accuses the Wardens of stealing the wheelbarrow." },
      { title: "Look Up", teaser: "The Compact draws borders on the ground. The goblins have noticed." },
      { title: "Old Grumm", teaser: "Thirty years ago, an ogre ate the Sergeant's helmet." },
      { title: "The Marches", teaser: "The season final. The Boss stakes the whole border." },
    ],
  },
  {
    id: "goblins",
    faction: "goblin",
    title: "The Tinker's Odds",
    tagline: "“Lads, they had pointy sticks and we had nothing. So I made a bigger thing.”",
    missions: [],
  },
  {
    id: "elementals",
    faction: "elemental",
    title: "We Burn",
    tagline: "“We are not complicated because we are clever. We are complicated because we burn.”",
    missions: [],
  },
];

// Every playable mission, with where it sits: its campaign and its number in it.
export const MISSIONS = CAMPAIGNS.flatMap((c) =>
  c.missions.flatMap((m, i) => (m.play ? [{ campaign: c, number: i + 1, title: m.title, def: m.play }] : [])),
);
export type MissionEntry = (typeof MISSIONS)[number];
