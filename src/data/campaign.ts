// The story campaigns, as planned in docs/CAMPAIGN.md. A mission with a `play` setup is playable from the Story tab;
// the rest are listed as coming soon. Teasers are player-facing, so keep them spoiler-light. The framework is
// described in docs/CAMPAIGN.md §6; src/game/mission.ts turns a MissionDef into a match.

import type { BattleResult } from "../sim/battle";
import type { PlacedSquad } from "../sim/types";

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

// What a debrief reads: the player's army as it fought the last battle, and that battle.
export interface MissionContext {
  army: PlacedSquad[];
  result: BattleResult;
}

export interface MissionDef {
  id: string; // `#story/<id>`
  supply: number; // the player's supply in round 1; later rounds get the standard income
  units: string[]; // the player's units, unlocked and free
  shop?: string[]; // more units the player may unlock, at the usual price
  hp?: [number, number]; // each side's HP; absent: one battle decides the mission
  towers: boolean; // the Keeps stand
  upgrades: boolean; // the Upgrades tab exists
  enemy: {
    name: string; // on its HP bar and in the sidebar
    units: string[]; // its unlocks, shown as the AI's are
    revealed?: boolean; // round 1's squads are placed and visible before the player deploys
    rounds: SquadSpec[][]; // squads it adds each round
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
  // Armies that must win and must lose against the script (tests/campaign.test.ts), so the punch and the
  // counterpunch stay true when units are rebalanced. `commended` must also earn the commendation.
  reference: { wins: SquadSpec[][]; loses: SquadSpec[][]; commended?: SquadSpec[] };
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

const HANDS_OFF: MissionDef = {
  id: "wardens-1",
  supply: 400,
  units: ["knights", "crossbowmen"],
  towers: false,
  upgrades: false,
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
      [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
      [["knights", 6, 20], ["crossbowmen", 3, 22], ["crossbowmen", 9, 22]],
      [["crossbowmen", 20, 20], ["crossbowmen", 25, 20], ["knights", 22, 26]],
      [["knights", 44, 26], ["crossbowmen", 3, 20], ["crossbowmen", 7, 20]],
      [["knights", 20, 20], ["knights", 24, 20]],
    ],
    loses: [
      [["crossbowmen", 18, 20], ["crossbowmen", 21, 20], ["crossbowmen", 24, 20], ["crossbowmen", 27, 20]],
      [["crossbowmen", 20, 21], ["crossbowmen", 24, 21], ["crossbowmen", 20, 23], ["crossbowmen", 24, 23]],
      [["crossbowmen", 18, 22], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22]],
    ],
    commended: [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
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
      { title: "The Appeal", teaser: "The goblins appeal the goat. Under the Compact, an appeal is a longer match." },
      { title: "Two Keeps", teaser: "Someone has painted something rude on the West Keep." },
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
