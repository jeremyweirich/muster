// The story campaigns, as planned in docs/CAMPAIGN.md. A mission with a `play` setup is playable from the Story tab;
// the rest are listed as coming soon. Teasers are player-facing, so keep them spoiler-light. The framework is
// described in docs/CAMPAIGN.md §6; src/game/mission.ts turns a MissionDef into a match.

import type { BattleResult } from "../sim/battle";
import type { PlacedSquad } from "../sim/types";
import { canPlace, defMap } from "../game/army";
import { DEFAULT_UNITS } from "./units";

// The cast. Voices are in docs/VISION.md: the Wardens are proud of being boring, the Boss SHOUTS, and the Tinker
// gives odds on every gadget and always gets them wrong.
export const CAST = {
  sergeant: { name: "Sergeant Dunmor", side: "warden" },
  archivist: { name: "Archivist Ithiel", side: "warden" },
  boss: { name: "The Boss", side: "goblin" },
  tinker: { name: "The Tinker", side: "goblin" },
} as const;
export type Speaker = keyof typeof CAST;

export interface Line {
  who: Speaker;
  text: string;
}

// A squad in field tiles: the unit, its footprint's top-left corner, whether it's rotated, and its level (a veteran;
// absent: level 1). The player deploys in rows 20–26 at the bottom, the enemy in rows 0–6 at the top.
export type SquadSpec = [defId: string, x: number, y: number, rot?: boolean, level?: number];

// What a debrief reads: the player's army as it fought the last battle, that battle, and every battle of the match.
export interface MissionContext {
  army: PlacedSquad[];
  result: BattleResult;
  results: BattleResult[];
  towerLevels: number[]; // the player's Keep levels at the end
  upgrades: Record<string, string[]>; // the player's upgrades at the end
}

// What a scripted round can look at: the player's army as the enemy saw it (squads placed in earlier rounds, with
// their levels), its upgrades, who won each earlier battle (0 = the player) and how many the enemy has lost.
export interface ScriptContext {
  round: number;
  seen: PlacedSquad[];
  upgrades: Record<string, string[]>;
  winners: (0 | 1 | null)[];
  lost: number;
  own: PlacedSquad[]; // the enemy's army so far
}
// What the enemy adds in a round: squads, upgrades it buys that round (shown as ★ once the battle starts), and a
// line someone says while the player deploys.
export interface EnemyTurn {
  squads: SquadSpec[];
  upgrades?: Record<string, string[]>;
  line?: Line;
}
// A round of the enemy's script: fixed squads, or squads chosen from what it saw (the Boss hits your thin flank).
export type EnemyRound = SquadSpec[] | EnemyTurn | ((c: ScriptContext) => SquadSpec[] | EnemyTurn);
// A reference army, round by round: the squads the player adds, or an object with squads and what else it buys:
// Keep levels (Keep indexes, 0 = West, 1 = East, one entry per level), upgrades in the order bought, promotions (every
// squad with a level waiting, in order, while supply lasts) and, in a mission with an opening offer, round 1's choice
// (an offered pack's position, or "flat"). Units from the mission's shop are unlocked on first use, at their price.
export interface PlanTurn {
  squads?: SquadSpec[];
  keeps?: number[];
  upgrades?: [unitId: string, upgradeId: string][];
  promote?: boolean;
  opening?: number | "flat";
}
export type PlanRound = SquadSpec[] | PlanTurn;
export type Plan = PlanRound[];
export const planTurn = (r: PlanRound | undefined): PlanTurn => (!r ? {} : Array.isArray(r) ? { squads: r } : r);

export interface MissionDef {
  id: string; // `#story/<id>`
  supply: number; // the player's supply in round 1; later rounds get the standard income
  units: string[]; // the player's units, unlocked and free
  shop?: string[]; // more units the player may unlock, at the usual price
  opening?: [string, string][]; // round 1 offers these packs (each named by its two units) or the war chest, as a skirmish does
  lastPage?: { title: string; text: string }; // on a win, the debrief draws the player's winning board as a page of the book
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

// Squads moved, where needed, to the nearest spot that's free of the enemy's army and of each other (rounds that
// depend on how the match went can't be laid out by hand).
const DEFS = defMap(DEFAULT_UNITS);
function fit(own: PlacedSquad[], specs: SquadSpec[]): SquadSpec[] {
  const placed = [...own];
  return specs.map(([id, x, y, rot, level]) => {
    const def = DEFS.get(id)!;
    let best: [number, number] | null = null;
    let bestCost = Infinity;
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -24; dx <= 24; dx++) {
        const cost = Math.abs(dx) + 1.5 * Math.abs(dy);
        if (cost < bestCost && canPlace(def, x + dx, y + dy, 1, placed, DEFS, undefined, rot)) {
          best = [x + dx, y + dy];
          bestCost = cost;
        }
      }
    if (!best) return [id, x, y, rot, level];
    placed.push({ uid: `fit${placed.length}`, defId: id, x: best[0], y: best[1], rot, round: 0 });
    return [id, best[0], best[1], rot, level];
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

// Mission 4: unlocks and big units. The Boss's trolls come over the bridge from round 2 and beat Knights (the rage
// builds through the armor); the Ballista, the first unit the player has to unlock, hunts the biggest target from
// across the water. Tuned by simulation: Ballistae behind steel win, whether from round 1 or after meeting the trolls;
// steel and bows alone, Ballistae with no steel in front, and never adding all lose.
const UNDER_THE_BRIDGE: MissionDef = {
  id: "wardens-4",
  supply: 400,
  units: ["knights", "crossbowmen"],
  shop: ["ballista"],
  hp: [160, 140],
  towers: true,
  upgrades: false,
  veterancy: false,
  map: "toll-bridge",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers", "troll"],
    rounds: [
      [
        ["grunts", 14, 4],
        ["grunts", 22, 4],
        ["grunts", 30, 4],
        ["skirmishers", 22, 1],
      ],
      [
        ["troll", 14, 2],
        ["troll", 20, 3],
        ["troll", 28, 3],
      ],
      [
        ["troll", 18, 0],
        ["troll", 26, 0],
        ["troll", 32, 1],
      ],
      [
        ["troll", 8, 1],
        ["troll", 38, 1],
        ["troll", 22, 0],
        ["grunts", 40, 3],
        ["grunts", 4, 3],
      ],
      [
        ["troll", 16, 0],
        ["troll", 30, 0],
        ["troll", 20, 5],
        ["troll", 26, 5],
      ],
      [
        ["troll", 10, 5],
        ["troll", 36, 5],
        ["troll", 2, 0],
        ["troll", 44, 0],
      ],
    ],
  },
  briefing: [
    { who: "archivist", text: "Marshal, there is a troll under the toll bridge at Hob's Crossing. It has lived there longer than the bridge has." },
    { who: "sergeant", text: "The goblins have adopted it. They've also adopted the toll." },
    { who: "boss", text: "HE'S FAMILY NOW. FAMILY GETS PAID." },
    {
      who: "sergeant",
      text: "Trolls go through Knights like a boot through a hedge. Every blow in a row lands harder, and they heal while they fight.",
    },
    {
      who: "archivist",
      text: "The river is deep on both sides of the bridge, so the Field's short way across is the middle. And the armory holds the Ballista. It costs the Treasury once per Field; after that, a squad is only a squad.",
    },
  ],
  page: {
    title: "Page 4: The Armory",
    text: "The armory holds more than the book's first pages. Each new engine costs the Treasury once per Field.",
    drill: "Big things need engines. Engines need steel in front.",
    diagram: [["knights", "knights"], ["ballista", "crossbowmen", "ballista"]],
  },
  objective: "Win the match. The Boss has trolls. The Ballista waits in the shop: unlock it once this match (100), then buy squads as usual.",
  win: [
    { who: "sergeant", text: "Boring wins. Big, slow, boring wins bigger." },
    { who: "archivist", text: "The troll has gone back under the bridge. It has agreed to charge the goblins as well." },
    { who: "boss", text: "THAT'S NOT FAMILY BEHAVIOR. I'M TELLING THE TINKER." },
  ],
  hints: [
    {
      when: (c) => c.army.every((sq) => sq.round === 1),
      line: { who: "sergeant", text: "Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will." },
    },
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "Bolts alone again. A mob needs steel to run onto." } },
    {
      when: (c) => !fielded(c, "ballista"),
      line: {
        who: "sergeant",
        text: "Steel against trolls is a fair fight, and they brought more trolls than we brought steel. The Ballista hunts the biggest thing on the Field: unlock it in the shop.",
      },
    },
    {
      when: (c) => c.army.filter((sq) => sq.defId === "knights").length < 2,
      line: { who: "sergeant", text: "The Ballistae had nothing in front of them, and a mob that reaches an engine wrecks it. Steel in front, engines behind." },
    },
    {
      line: {
        who: "sergeant",
        text: "The trolls got through anyway. Add Ballistae every round, behind the Knights, and leave the trolls to them.",
      },
    },
  ],
  commendation: {
    name: "Bridge Held",
    text: "Win with Ballistae on the Field, and lose none of them in the last battle.",
    earned: (c) => {
      const engines = c.army.filter((sq) => sq.defId === "ballista");
      return engines.length > 0 && engines.every((sq) => c.result.stats[sq.uid]?.alive === c.result.stats[sq.uid]?.total);
    },
  },
  reference: {
    wins: [
      // meets the trolls with steel in round 2, then adds Ballistae behind it
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        [["ballista", 17, 22], ["ballista", 28, 22], ["ballista", 14, 24], ["crossbowmen", 30, 24]],
        [["knights", 34, 20], ["ballista", 22, 24], ["ballista", 26, 24], ["ballista", 18, 25], ["crossbowmen", 31, 22]],
        [["knights", 4, 20], ["knights", 40, 20], ["ballista", 10, 25], ["ballista", 36, 25], ["crossbowmen", 31, 25]],
      ],
      // Ballistae as soon as the trolls show
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["ballista", 17, 22], ["ballista", 28, 22], ["ballista", 14, 24]],
        [["knights", 16, 20], ["ballista", 30, 24], ["ballista", 21, 24], ["crossbowmen", 25, 25]],
        [["knights", 28, 20], ["knights", 9, 20], ["ballista", 26, 23], ["ballista", 17, 25]],
      ],
      // a Ballista from round 1, behind the Knights (it loses round 1: one bolt, one goblin)
      [
        [["knights", 22, 20], ["ballista", 23, 22]],
        [["knights", 16, 20], ["ballista", 19, 22], ["ballista", 27, 22]],
        [["knights", 28, 20], ["ballista", 21, 24], ["ballista", 25, 24], ["ballista", 17, 24]],
        [["knights", 9, 20], ["knights", 35, 20], ["ballista", 29, 24], ["ballista", 15, 22]],
      ],
    ],
    loses: [
      // never adds after round 1
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]]],
      // steel and bows only, every round
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        [["knights", 10, 20], ["crossbowmen", 16, 22], ["crossbowmen", 28, 22], ["crossbowmen", 31, 22]],
        [["knights", 34, 20], ["knights", 22, 25], ["crossbowmen", 18, 25], ["crossbowmen", 28, 25]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 14, 25], ["crossbowmen", 31, 25], ["crossbowmen", 25, 26]],
      ],
      // Ballistae with no new steel in front
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["ballista", 17, 22], ["ballista", 28, 22], ["ballista", 14, 24]],
        [["ballista", 30, 24], ["ballista", 22, 24], ["ballista", 26, 24], ["ballista", 18, 25], ["ballista", 32, 22]],
        [["ballista", 6, 22], ["ballista", 40, 22], ["ballista", 3, 22], ["ballista", 43, 22], ["ballista", 3, 25], ["ballista", 44, 25]],
      ],
      // all bows
      [
        [["crossbowmen", 18, 22], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22], ["crossbowmen", 30, 22]],
        [["crossbowmen", 14, 22], ["crossbowmen", 34, 22], ["crossbowmen", 10, 22], ["crossbowmen", 38, 22]],
        [["crossbowmen", 6, 22], ["crossbowmen", 42, 22], ["crossbowmen", 2, 22], ["crossbowmen", 44, 24], ["crossbowmen", 20, 24]],
      ],
    ],
    // Ballistae as soon as the trolls show: every engine comes home from the last battle
    commended: [
      [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
      [["ballista", 17, 22], ["ballista", 28, 22], ["ballista", 14, 24]],
      [["knights", 16, 20], ["ballista", 30, 24], ["ballista", 21, 24], ["crossbowmen", 25, 25]],
      [["knights", 28, 20], ["knights", 9, 20], ["ballista", 26, 23], ["ballista", 17, 25]],
    ],
  },
};

// Mission 5: upgrades. The Tinker arrives with gadgets: in round 2 every Grunt on the Field, including those already
// placed, gets Scrap Armor (each goblin shrugs off its first hit), and in round 3 the trolls get Thick Blood. The
// counter is a drill of your own: Repeaters (many small bolts) reaches every Crossbowman. Tuned by simulation: any
// plan with Repeaters wins, whenever it's bought; the same supply spent on more squads loses, and so does the wrong
// drill (Knights' Veterans). Two Clerics behind the line after Repeaters win too (docs/CAMPAIGN.md §10).
const PLAIN_STEEL: MissionDef = {
  id: "wardens-5",
  supply: 400,
  units: ["knights", "crossbowmen"],
  shop: ["ballista", "cleric"],
  hp: [180, 160],
  towers: true,
  upgrades: true,
  veterancy: false,
  map: "standing-stones",
  enemy: {
    name: "The Tinker",
    units: ["grunts", "skirmishers", "troll"],
    rounds: [
      [
        ["grunts", 14, 4],
        ["grunts", 22, 4],
        ["grunts", 30, 4],
        ["skirmishers", 22, 1],
      ],
      {
        squads: [
          ["grunts", 6, 4],
          ["grunts", 38, 4],
          ["skirmishers", 30, 1],
        ],
        upgrades: { grunts: ["scrap_armor"] },
      },
      {
        squads: [
          ["troll", 18, 3],
          ["troll", 28, 3],
          ["grunts", 14, 1],
        ],
        upgrades: { troll: ["thick_blood"] },
      },
      [
        ["grunts", 2, 1],
        ["grunts", 42, 1],
        ["troll", 22, 0],
        ["skirmishers", 6, 0],
      ],
      [
        ["troll", 16, 0],
        ["troll", 34, 5],
        ["grunts", 18, 5],
        ["grunts", 26, 5],
      ],
      [
        ["troll", 10, 5],
        ["grunts", 0, 5],
        ["grunts", 44, 5],
        ["grunts", 2, 3],
        ["skirmishers", 42, 3],
      ],
    ],
  },
  briefing: [
    { who: "archivist", text: "Marshal, we have been accused of theft. A goblin Tinker says we stole the wheelbarrow." },
    { who: "tinker", text: "THE wheelbarrow. One wheel, two handles. I drew it first." },
    { who: "archivist", text: "We have had wheelbarrows for four hundred and twelve years." },
    {
      who: "sergeant",
      text: "This one tinkers, Marshal. Whatever the goblins bring today will have been improved, and every improvement shows: a star by the unit, once the horn sounds.",
    },
    { who: "tinker", text: "Scrap Armor! Nine chances in ten it stops a bolt. Or ten in nine. Something in nine." },
    { who: "archivist", text: "The book answers in kind. A drill improves every squad that knows it, even those already on the Field." },
  ],
  page: {
    title: "Page 5: Drills",
    text: "A drill improves every squad that knows it, even those already on the Field.",
    drill: "Read their stars. Answer with a drill.",
  },
  objective: "Win the match. Upgrades are open: a drill changes every squad of that unit, even ones already placed. The Tinker's upgrades show as ★.",
  win: [
    { who: "sergeant", text: "Boring wins. Boring, repeated quickly, wins faster." },
    { who: "tinker", text: "The odds were good on that one. Very good. I'll redo the sums." },
    { who: "archivist", text: "The wheelbarrow stays with us. The Tinker has asked to borrow it." },
    { who: "boss", text: "FORGET THE GROUND. NOBODY OWNS THE SKY." },
  ],
  hints: [
    {
      when: (c) => c.army.every((sq) => sq.round === 1),
      line: { who: "sergeant", text: "Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will." },
    },
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "Bolts alone again. A mob needs steel to run onto." } },
    {
      when: (c) => Object.keys(c.upgrades).length === 0,
      line: {
        who: "sergeant",
        text: "Every goblin in that mob shrugged off the first bolt it took. We fought new gadgets with old drills. Buy a drill under Upgrades: it reaches every squad on the Field.",
      },
    },
    {
      when: (c) => !c.upgrades.crossbowmen?.includes("repeaters"),
      line: {
        who: "sergeant",
        text: "The right drill matters. Their armor stops one hit per goblin, so a heavy bolt is wasted on it. Repeaters shoot many small bolts: the armor only stops the first.",
      },
    },
    { line: { who: "sergeant", text: "Close. Buy the drill the round you see their stars, and keep adding steel in front of the bows." } },
  ],
  // the armor first shows in round 2's battle, so the answer can come from round 3
  commendation: { name: "Well Drilled", text: "Once their armor shows, win every round after it.", earned: (c) => c.results.slice(2).every((r) => r.winner === 0) },
  reference: {
    wins: [
      // Repeaters the round after the armor shows
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        { squads: [["crossbowmen", 14, 22], ["crossbowmen", 30, 22], ["crossbowmen", 22, 24]], upgrades: [["crossbowmen", "repeaters"]] },
        [["knights", 10, 20], ["knights", 34, 20], ["crossbowmen", 17, 26], ["crossbowmen", 27, 26]],
        { squads: [["knights", 4, 20], ["crossbowmen", 31, 24], ["crossbowmen", 14, 25]], upgrades: [["knights", "shield_wall"]] },
      ],
      // Repeaters in round 2, on the Tinker's word
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        { squads: [["knights", 16, 20]], upgrades: [["crossbowmen", "repeaters"]] },
        [["knights", 28, 20], ["crossbowmen", 14, 22], ["crossbowmen", 30, 22], ["crossbowmen", 22, 24]],
        [["knights", 10, 20], ["knights", 34, 20], ["crossbowmen", 17, 26], ["crossbowmen", 27, 26]],
        { squads: [["knights", 4, 20], ["crossbowmen", 31, 24], ["crossbowmen", 14, 25]], upgrades: [["knights", "shield_wall"]] },
      ],
      // Repeaters before the first battle, with one squad of steel
      [
        { squads: [["knights", 22, 20]], upgrades: [["crossbowmen", "repeaters"]] },
        [["knights", 16, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 28, 20], ["crossbowmen", 14, 22], ["crossbowmen", 30, 22], ["crossbowmen", 22, 24]],
        [["knights", 10, 20], ["knights", 34, 20], ["crossbowmen", 17, 26], ["crossbowmen", 27, 26]],
        { squads: [["knights", 4, 20], ["crossbowmen", 31, 24], ["crossbowmen", 14, 25]], upgrades: [["knights", "shield_wall"]] },
      ],
      // Repeaters after the armor, then two Clerics behind the line
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        { squads: [["crossbowmen", 14, 22], ["crossbowmen", 30, 22], ["crossbowmen", 22, 24]], upgrades: [["crossbowmen", "repeaters"]] },
        [["cleric", 18, 21], ["cleric", 26, 21], ["knights", 10, 20], ["crossbowmen", 31, 24]],
        [["knights", 34, 20], ["knights", 4, 20], ["crossbowmen", 17, 25], ["crossbowmen", 27, 25], ["crossbowmen", 6, 22]],
      ],
    ],
    loses: [
      // never adds after round 1
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]]],
      // no drills: the same supply on more Crossbowmen
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        [["crossbowmen", 14, 22], ["crossbowmen", 30, 22], ["crossbowmen", 22, 24], ["crossbowmen", 18, 24], ["crossbowmen", 26, 24]],
        [["knights", 10, 20], ["knights", 34, 20], ["crossbowmen", 17, 26], ["crossbowmen", 27, 26]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 31, 24], ["crossbowmen", 14, 25], ["crossbowmen", 6, 22]],
      ],
      // no drills: Ballistae instead
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        [["ballista", 17, 22], ["ballista", 28, 22], ["crossbowmen", 14, 22], ["crossbowmen", 30, 22]],
        [["knights", 10, 20], ["knights", 34, 20], ["ballista", 22, 24], ["ballista", 26, 24]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 16, 25], ["crossbowmen", 30, 25], ["ballista", 19, 24]],
      ],
      // the wrong drill: Knights' Veterans against armored mobs
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        { squads: [["knights", 10, 20], ["crossbowmen", 14, 22]], upgrades: [["knights", "veterans"]] },
        [["knights", 34, 20], ["knights", 4, 20], ["crossbowmen", 30, 22], ["crossbowmen", 22, 24]],
      ],
    ],
    // Repeaters after the armor, then Shield Wall
    commended: [
      [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
      [["knights", 16, 20], ["knights", 28, 20]],
      { squads: [["crossbowmen", 14, 22], ["crossbowmen", 30, 22], ["crossbowmen", 22, 24]], upgrades: [["crossbowmen", "repeaters"]] },
      { squads: [["knights", 10, 20], ["knights", 34, 20]], upgrades: [["knights", "shield_wall"]] },
      [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 31, 24], ["crossbowmen", 14, 25], ["crossbowmen", 18, 24]],
    ],
  },
};

// Mission 6: the air layer. In round 2 four squads of the Boss's Giant Bats fly over the line and land on the bows;
// from round 4 his Skirmishers shoot at anything that flies. Tuned by simulation: Crossbowmen with Skyhunters win, and
// so do Griffon Riders (alone or beside the bows); plain bows (half damage to fliers), steel alone and Ballistae (the
// bats land on them) lose.
const LOOK_UP: MissionDef = {
  id: "wardens-6",
  supply: 400,
  units: ["knights", "crossbowmen"],
  shop: ["ballista", "cleric", "griffon_riders"],
  hp: [240, 240],
  towers: true,
  upgrades: true,
  veterancy: false,
  map: "the-mire",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers", "troll", "giant_bats"],
    rounds: [
      [
        ["grunts", 14, 4],
        ["troll", 23, 3],
        ["grunts", 30, 4],
        ["skirmishers", 22, 0],
      ],
      [
        ["giant_bats", 4, 2],
        ["giant_bats", 42, 2],
        ["giant_bats", 18, 1],
        ["giant_bats", 28, 1],
      ],
      [
        ["giant_bats", 8, 4],
        ["giant_bats", 38, 4],
        ["grunts", 22, 4],
      ],
      [
        ["skirmishers", 4, 0],
        ["skirmishers", 40, 0],
        ["troll", 18, 3],
        ["giant_bats", 26, 1],
      ],
      [
        ["giant_bats", 16, 0],
        ["giant_bats", 30, 0],
        ["grunts", 2, 4],
        ["grunts", 42, 4],
        ["troll", 26, 5],
      ],
      [
        ["giant_bats", 12, 0],
        ["giant_bats", 34, 0],
        ["skirmishers", 10, 5],
        ["skirmishers", 34, 5],
        ["troll", 20, 5],
        ["troll", 24, 2],
      ],
      [
        ["giant_bats", 0, 0],
        ["giant_bats", 46, 0],
        ["grunts", 14, 2],
        ["grunts", 30, 2],
        ["troll", 10, 4],
        ["troll", 36, 4],
      ],
    ],
  },
  briefing: [
    { who: "archivist", text: "Marshal, a point of law. The Compact draws the Field's borders on the ground." },
    { who: "sergeant", text: "And the goblins have noticed it says nothing about above it." },
    { who: "boss", text: "WHO OWNS THE SKY? NOBODY. SO IT'S OURS." },
    { who: "sergeant", text: "Bats, Marshal. Big ones, with goblins on. They fly over the line and go for whoever's standing behind it." },
    {
      who: "archivist",
      text: "The book is calm about this. Knights cannot strike what flies; Crossbowmen and Ballistae can, and Griffon Riders fly themselves. The Mire slows anyone on foot. It slows nothing with wings.",
    },
  ],
  page: {
    title: "Page 6: Look Up",
    text: "Knights cannot strike what flies. Know which of your champions can.",
    drill: "Bows under the sky. Wings against wings.",
    diagram: [["knights", "knights"], ["crossbowmen", "griffon_riders", "crossbowmen"]],
  },
  objective: "Win the match. The Boss has taken to the air, and Knights can't hit fliers. Crossbowmen, Ballistae and Griffon Riders can.",
  win: [
    { who: "sergeant", text: "Boring wins. Looking up is boring too. Write that down." },
    { who: "archivist", text: "Ruled: the sky over the Field belongs to the Field. The bats have gone home." },
    { who: "boss", text: "FINE. I'M CALLING GRUMM." },
    { who: "sergeant", text: "...Grumm?" },
  ],
  hints: [
    {
      when: (c) => c.army.every((sq) => sq.round === 1),
      line: { who: "sergeant", text: "Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will." },
    },
    {
      when: (c) => !c.army.some((sq) => sq.round > 1 && (sq.defId === "crossbowmen" || sq.defId === "griffon_riders")),
      line: {
        who: "sergeant",
        text: "Knights can't hit what flies, and the bats knew it. Crossbowmen can, and so can Griffon Riders: put them where the bats come down.",
      },
    },
    {
      when: (c) => c.army.filter((sq) => sq.defId === "ballista").length > c.army.filter((sq) => sq.defId === "crossbowmen").length,
      line: { who: "sergeant", text: "Bats land on engines. A Ballista hits fliers, but slowly: Crossbowmen behind the steel shoot them down faster." },
    },
    {
      line: {
        who: "sergeant",
        text: "The bats went over the line and landed on the bows. More bows, Marshal, and Skyhunters picks out the fliers first.",
      },
    },
  ],
  commendation: { name: "Wings Against Wings", text: "Win with Griffon Riders on the Field.", earned: (c) => fielded(c, "griffon_riders") },
  reference: {
    wins: [
      // Skyhunters as soon as the bats have shown, and bows every round
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        { squads: [["knights", 16, 20]], upgrades: [["crossbowmen", "skyhunters"]] },
        [["knights", 28, 20], ["crossbowmen", 14, 22], ["crossbowmen", 30, 22], ["crossbowmen", 22, 24]],
        [["knights", 10, 20], ["knights", 34, 20], ["crossbowmen", 17, 26], ["crossbowmen", 27, 26]],
        { squads: [["knights", 4, 20], ["crossbowmen", 31, 24], ["crossbowmen", 14, 25]], upgrades: [["knights", "shield_wall"]] },
        [["knights", 40, 20], ["knights", 22, 26], ["crossbowmen", 4, 22], ["crossbowmen", 40, 22], ["crossbowmen", 38, 24], ["crossbowmen", 6, 24]],
      ],
      // Griffons with Sky Patrol after the bats show, then bows and Griffons
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        { squads: [["griffon_riders", 15, 23]], upgrades: [["griffon_riders", "sky_patrol"]] },
        [["griffon_riders", 30, 23], ["knights", 10, 20], ["crossbowmen", 14, 22], ["crossbowmen", 30, 22]],
        [["knights", 34, 20], ["knights", 4, 20], ["crossbowmen", 17, 26], ["crossbowmen", 27, 26], ["crossbowmen", 6, 22]],
        [["knights", 40, 20], ["griffon_riders", 6, 24], ["griffon_riders", 38, 22], ["crossbowmen", 30, 26], ["crossbowmen", 14, 26]],
      ],
    ],
    loses: [
      // never adds after round 1
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]]],
      // steel only after round 1
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        [["knights", 10, 20], ["knights", 34, 20], ["crossbowmen", 16, 22]],
        { squads: [["knights", 4, 20], ["knights", 40, 20]], upgrades: [["knights", "shield_wall"]] },
        [["knights", 22, 25], ["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 30, 22]],
      ],
      // Ballistae for the fliers: the bats land on them
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["ballista", 17, 22], ["ballista", 28, 22], ["ballista", 14, 24]],
        [["knights", 16, 20], ["ballista", 30, 24], ["ballista", 21, 24], ["crossbowmen", 25, 25]],
        { squads: [["knights", 10, 20], ["knights", 34, 20]], upgrades: [["ballista", "heavy_bolts"]] },
        [["knights", 4, 20], ["knights", 40, 20], ["ballista", 17, 25], ["ballista", 26, 23], ["ballista", 33, 24]],
      ],
      // plain bows, no Skyhunters: half damage to fliers
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["crossbowmen", 14, 22], ["crossbowmen", 30, 22]],
        [["knights", 28, 20], ["crossbowmen", 17, 24], ["crossbowmen", 27, 24], ["crossbowmen", 22, 24]],
        [["knights", 10, 20], ["knights", 34, 20], ["crossbowmen", 17, 26], ["crossbowmen", 27, 26]],
        [["knights", 4, 20], ["crossbowmen", 31, 24], ["crossbowmen", 14, 25], ["knights", 40, 20], ["crossbowmen", 22, 26]],
        [["knights", 4, 22], ["knights", 40, 22], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24], ["crossbowmen", 33, 26], ["crossbowmen", 9, 26]],
      ],
    ],
    // bows and Skyhunters first, then Griffons alongside them
    commended: [
      [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
      [["knights", 16, 20], ["crossbowmen", 14, 22], ["crossbowmen", 30, 22]],
      { squads: [["knights", 28, 20], ["crossbowmen", 22, 24]], upgrades: [["crossbowmen", "skyhunters"]] },
      [["griffon_riders", 17, 25], ["knights", 10, 20], ["crossbowmen", 27, 24]],
      [["griffon_riders", 26, 25], ["knights", 34, 20], ["crossbowmen", 34, 22], ["crossbowmen", 6, 22], ["crossbowmen", 13, 24]],
      [["knights", 4, 20], ["knights", 40, 20], ["griffon_riders", 6, 24], ["crossbowmen", 40, 22], ["crossbowmen", 38, 24]],
    ],
  },
};

// Mission 7: veterancy and promotions. Old Grumm, a level-3 Ogre Brute with Warboss (he calls a grunt every 5 s),
// arrives in round 2 and walks off the Field alive; then wolves, trolls and more ogres. Pikemen are the page the
// Archivist revives. Tuned by simulation: Pikemen whose veterans are promoted win, and the same plan putting that
// supply into fresh squads instead loses. Knights and bows (no pikes) win too.
const OLD_GRUMM: MissionDef = {
  id: "wardens-7",
  supply: 400,
  units: ["knights", "crossbowmen"],
  shop: ["ballista", "cleric", "griffon_riders", "pikemen"],
  hp: [300, 300],
  towers: true,
  upgrades: true,
  veterancy: true,
  map: "broken-hills",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers", "wolf_riders", "troll", "ogre_brute"],
    upgrades: { ogre_brute: ["warboss"] },
    rounds: [
      [
        ["grunts", 14, 4],
        ["grunts", 30, 4],
        ["skirmishers", 22, 4],
        ["grunts", 22, 1],
      ],
      [
        ["ogre_brute", 20, 1, false, 3], // Old Grumm
        ["grunts", 16, 1],
      ],
      [
        ["wolf_riders", 40, 3],
        ["wolf_riders", 8, 1],
        ["grunts", 26, 0],
      ],
      [
        ["troll", 16, 0],
        ["troll", 30, 0],
        ["skirmishers", 34, 4],
        ["grunts", 2, 0],
      ],
      [
        ["ogre_brute", 12, 4],
        ["wolf_riders", 44, 0],
        ["grunts", 38, 0],
        ["skirmishers", 6, 5],
      ],
      [
        ["troll", 20, 5],
        ["troll", 26, 5],
        ["wolf_riders", 0, 5],
        ["wolf_riders", 46, 5],
        ["grunts", 12, 0],
      ],
      [
        ["ogre_brute", 38, 5],
        ["ogre_brute", 10, 0],
        ["grunts", 30, 2],
        ["skirmishers", 18, 3],
      ],
    ],
  },
  briefing: [
    { who: "archivist", text: "Marshal, the Boss has named a champion: Old Grumm." },
    { who: "sergeant", text: "Thirty years ago, at a Field match, Grumm ate my helmet. I was nearly still in it." },
    { who: "boss", text: "GRUMM'S BEEN FIGHTING SINCE BEFORE YOU WERE BORN. HE'S GOOD AT IT NOW." },
    {
      who: "archivist",
      text: "Squads that fight well learn from it, and Grumm has learned a great deal. Ours can too: when a squad has a level waiting, you may promote it, for half its price.",
    },
    { who: "archivist", text: "And there is a page in the book no one has turned to in two hundred years. There was nothing large enough to need it." },
    { who: "sergeant", text: "The pikes. Dwarven Pikemen, Marshal: long sticks for large problems." },
  ],
  page: {
    title: "Page 7: The Pike Line",
    text: "Against the largest, the longest. Hold them at the point.",
    drill: "Pikes where the big ones walk. Promote what lives.",
    diagram: [["pikemen", "knights", "pikemen"], ["crossbowmen", "crossbowmen"]],
  },
  objective: "Win the match. Squads now earn experience: one with a level waiting shows a gold ▲, and promoting it costs half its price.",
  win: [
    { who: "sergeant", text: "Boring wins. And I've got my helmet back. It's been chewed." },
    { who: "archivist", text: "The pike page has been copied out fresh. The old ink had faded." },
    { who: "boss", text: "RIGHT. THAT'S IT. THE WHOLE BORDER. EVERYTHING. NEXT TIME." },
  ],
  hints: [
    {
      when: (c) => c.army.every((sq) => sq.round === 1),
      line: { who: "sergeant", text: "Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will." },
    },
    {
      when: (c) => c.army.every((sq) => (sq.level ?? 1) === 1),
      line: {
        who: "sergeant",
        text: "Squads that live through a battle learn from it. We had veterans waiting and never promoted one. When you see the gold ▲, promote: half a squad's price buys a whole squad's worth.",
      },
    },
    { line: { who: "sergeant", text: "Grumm walked through us. Keep promoting, put the pikes where he walks, and keep bows behind them to finish him." } },
  ],
  commendation: {
    name: "Old Page, New Ink",
    text: "Win with a promoted squad of Dwarven Pikemen on the Field.",
    earned: (c) => c.army.some((sq) => sq.defId === "pikemen" && (sq.level ?? 1) > 1),
  },
  reference: {
    wins: [
      // pikes from round 2, and every veteran promoted with what's left
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        { squads: [["pikemen", 16, 20], ["crossbowmen", 28, 22]], promote: true },
        { squads: [["pikemen", 26, 20], ["knights", 10, 20], ["crossbowmen", 14, 22]], promote: true },
        { squads: [["pikemen", 34, 20], ["crossbowmen", 31, 22]], upgrades: [["pikemen", "pike_wall"]], promote: true },
        { squads: [["knights", 4, 20], ["pikemen", 40, 20], ["crossbowmen", 18, 24], ["crossbowmen", 26, 24]], promote: true },
        { squads: [["knights", 40, 22], ["pikemen", 4, 22], ["pikemen", 14, 25], ["crossbowmen", 30, 25]], promote: true },
        { squads: [["pikemen", 22, 25], ["knights", 10, 22], ["knights", 34, 22], ["crossbowmen", 8, 26]], promote: true },
      ],
      // pikes from round 1, on the Archivist's word
      [
        [["pikemen", 22, 20], ["crossbowmen", 23, 22]],
        { squads: [["knights", 16, 20], ["crossbowmen", 28, 22]], promote: true },
        { squads: [["pikemen", 26, 20], ["knights", 10, 20], ["crossbowmen", 14, 22]], promote: true },
        { squads: [["pikemen", 34, 20], ["crossbowmen", 31, 22]], upgrades: [["pikemen", "pike_wall"]], promote: true },
        { squads: [["knights", 4, 20], ["pikemen", 40, 20], ["crossbowmen", 18, 24], ["crossbowmen", 26, 24]], promote: true },
        { squads: [["knights", 40, 22], ["pikemen", 4, 22], ["pikemen", 14, 25], ["crossbowmen", 30, 25]], promote: true },
        { squads: [["pikemen", 22, 25], ["knights", 10, 22], ["knights", 34, 22], ["crossbowmen", 8, 26]], promote: true },
      ],
      // the old drill: Knights and bows, a squad of each every round
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        { squads: [["knights", 16, 20], ["knights", 28, 20]], promote: true },
        { squads: [["knights", 10, 20], ["crossbowmen", 16, 22], ["crossbowmen", 28, 22], ["crossbowmen", 31, 22]], promote: true },
        { squads: [["knights", 34, 20], ["crossbowmen", 18, 24], ["crossbowmen", 28, 24]], upgrades: [["crossbowmen", "repeaters"]], promote: true },
        { squads: [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 14, 25], ["crossbowmen", 31, 25], ["crossbowmen", 25, 26]], promote: true },
        { squads: [["knights", 4, 22], ["knights", 40, 22], ["knights", 16, 26], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24]], promote: true },
        { squads: [["knights", 22, 25], ["knights", 10, 22], ["knights", 34, 22], ["crossbowmen", 8, 26], ["crossbowmen", 37, 26], ["crossbowmen", 30, 26]], promote: true },
      ],
    ],
    loses: [
      // never adds after round 1
      [[["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]]],
      // the first plan, but a fresh squad every round instead of promotions
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["pikemen", 16, 20], ["crossbowmen", 28, 22]],
        [["pikemen", 26, 20], ["knights", 10, 20], ["crossbowmen", 14, 22]],
        { squads: [["pikemen", 34, 20], ["crossbowmen", 31, 22]], upgrades: [["pikemen", "pike_wall"]] },
        [["knights", 4, 20], ["pikemen", 40, 20], ["crossbowmen", 18, 24], ["crossbowmen", 26, 24], ["crossbowmen", 22, 25]],
        [["knights", 40, 22], ["pikemen", 4, 22], ["pikemen", 14, 25], ["crossbowmen", 30, 25], ["crossbowmen", 34, 25]],
      ],
    ],
    // pikes from round 1, promoted: a pike squad reaches level 3
    commended: [
      [["pikemen", 22, 20], ["crossbowmen", 23, 22]],
      { squads: [["knights", 16, 20], ["crossbowmen", 28, 22]], promote: true },
      { squads: [["pikemen", 26, 20], ["knights", 10, 20], ["crossbowmen", 14, 22]], promote: true },
      { squads: [["pikemen", 34, 20], ["crossbowmen", 31, 22]], upgrades: [["pikemen", "pike_wall"]], promote: true },
      { squads: [["knights", 4, 20], ["pikemen", 40, 20], ["crossbowmen", 18, 24], ["crossbowmen", 26, 24]], promote: true },
      { squads: [["knights", 40, 22], ["pikemen", 4, 22], ["pikemen", 14, 25], ["crossbowmen", 30, 25]], promote: true },
      { squads: [["pikemen", 22, 25], ["knights", 10, 22], ["knights", 34, 22], ["crossbowmen", 8, 26]], promote: true },
    ],
  },
};

// Mission 8: the full Compact, from the opening offer. The Boss throws his biggest goblins at the line; once he has
// lost twice, the Tinker takes over with tempo: a bat swarm, a raid on both Keeps, Skirmishers that never touch the
// pikes. Scripted, not the AI, so the story beats land and the tests can fight it; each wave is fitted around the
// goblins already on the Field (`fit`), and the last wave repeats until the match ends.
const BOSS_WAVES: SquadSpec[][] = [
  [["troll", 22, 3], ["grunts", 14, 4], ["grunts", 30, 4], ["wolf_riders", 6, 3]],
  [["ogre_brute", 22, 0], ["troll", 14, 1], ["grunts", 34, 1]],
  [["wolf_riders", 40, 3], ["wolf_riders", 4, 0], ["troll", 28, 1], ["grunts", 16, 0]],
  [["ogre_brute", 12, 4], ["ogre_brute", 34, 4], ["grunts", 22, 5], ["wolf_riders", 40, 3]],
  [["troll", 18, 5], ["troll", 28, 5], ["ogre_brute", 22, 0], ["grunts", 2, 5]],
];
const TINKER_WAVES: EnemyTurn[] = [
  {
    squads: [["giant_bats", 8, 0], ["giant_bats", 38, 0], ["giant_bats", 22, 0]],
    upgrades: { giant_bats: ["shriek"] },
    line: { who: "tinker", text: "My turn! Bats. Four chances in five they work. I counted twice, and got two answers." },
  },
  {
    squads: [["wolf_riders", 2, 3], ["wolf_riders", 44, 3], ["skirmishers", 14, 0]],
    upgrades: { wolf_riders: ["tower_raiders"] },
    line: { who: "tinker", text: "Both Keeps at once. Nobody does both Keeps at once. That's what makes it work." },
  },
  {
    squads: [["giant_bats", 14, 0], ["giant_bats", 30, 0], ["skirmishers", 6, 5], ["skirmishers", 38, 5]],
    upgrades: { skirmishers: ["ambush"] },
    line: { who: "boss", text: "NO. BIGGER." },
  },
  {
    squads: [["giant_bats", 4, 0], ["wolf_riders", 10, 3], ["wolf_riders", 36, 3], ["skirmishers", 22, 5]],
  },
];
function theMarches(c: ScriptContext): EnemyTurn {
  // the battle (0-based) in which the Boss lost for the second time
  let losses = 0;
  const takeover = c.winners.findIndex((w) => w === 0 && ++losses === 2);
  if (takeover < 0) return { squads: fit(c.own, BOSS_WAVES[Math.min(c.round, BOSS_WAVES.length) - 1]) };
  const t = TINKER_WAVES[Math.min(c.round - takeover - 2, TINKER_WAVES.length - 1)];
  return { ...t, squads: fit(c.own, t.squads) };
}

// Tuned by simulation: the pike line wins, and so do steel and bows; never adding, all bows and a Ballista park lose.
// Everyone loses the round the bats arrive, and the double raid takes both Keeps, even with a level on each.
const THE_MARCHES: MissionDef = {
  id: "wardens-8",
  supply: 0,
  units: [],
  shop: ["knights", "crossbowmen", "ballista", "griffon_riders", "cleric", "pikemen", "giant"],
  opening: [
    ["knights", "crossbowmen"],
    ["crossbowmen", "pikemen"],
    ["knights", "pikemen"],
  ],
  hp: [400, 400],
  towers: true,
  upgrades: true,
  veterancy: true,
  map: "border-pass",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers", "wolf_riders", "troll", "ogre_brute", "giant_bats"],
    rounds: Array(12).fill(theMarches),
  },
  briefing: [
    { who: "archivist", text: "Marshal, the season final. The Boss has staked the whole border: the Marches, from the Toll Bridge to the hills." },
    { who: "boss", text: "EVERYTHING. ALL OF IT. AND THE GOAT." },
    {
      who: "sergeant",
      text: "Full Compact rules today. Nobody sees the other army before the horn. The Treasury offers an opening, and the whole armory is ours to unlock.",
    },
    { who: "tinker", text: "And if the Boss loses twice, it's my turn. I've been working on something. Several somethings." },
    {
      who: "archivist",
      text: "Every page of the book applies. A Giant from the hills has offered to hire on, which the book doesn't cover. And there is one blank page at the back. It has been blank for four hundred years.",
    },
  ],
  page: {
    title: "Page 8: The Full Compact",
    text: "Every commander chooses, every commander places, and no one sees the other's army before the horn.",
    drill: "Every page at once.",
    diagram: [["pikemen", "knights", "pikemen"], ["crossbowmen", "ballista", "crossbowmen"]],
  },
  objective: "Win the season final. Round 1 offers three Warden packs or the war chest, the whole armory is open, and the goblins stay hidden until the horn.",
  win: [
    { who: "sergeant", text: "Boring wins. A whole border's worth of boring." },
    { who: "tinker", text: "I had ideas. Good ones. Nobody listened." },
    { who: "boss", text: "...SAME TIME NEXT SEASON?" },
    { who: "archivist", text: "The Marshal has written on the blank page. In ink." },
  ],
  lastPage: { title: "Page 9, in the Marshal's hand", text: "What we fielded at the Marches, and what held." },
  hints: [
    {
      when: (c) => c.army.every((sq) => sq.round === 1),
      line: { who: "sergeant", text: "Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will." },
    },
    {
      when: (c) => !c.army.some((sq) => ["knights", "pikemen"].includes(sq.defId)),
      line: { who: "sergeant", text: "Nothing in front of the bows, Marshal. The Boss sent his biggest, and they walked straight in. Steel in front." },
    },
    {
      when: (c) => !c.army.some((sq) => ["crossbowmen", "griffon_riders"].includes(sq.defId)),
      line: { who: "sergeant", text: "The Tinker's bats came over the line, and nothing of ours could reach them. Bows under the sky." },
    },
    {
      when: keepFell,
      line: {
        who: "sergeant",
        text: "The Tinker went for both Keeps at once, and the line lost its nerve. Steel beside the Keeps, or a level on each, before it comes.",
      },
    },
    { line: { who: "sergeant", text: "Every page at once, Marshal: steel in front, bows behind, eyes up, Keeps guarded, veterans promoted." } },
  ],
  commendation: {
    name: "Boring Wins",
    text: "Win the final with only the two units your opening pack gave you.",
    earned: (c) => {
      const pack = new Set(c.army.filter((sq) => sq.free).map((sq) => sq.defId));
      return pack.size > 0 && c.army.every((sq) => pack.has(sq.defId));
    },
  },
  reference: {
    wins: [
      // the pike line: pikes and bows from the pack, more of both, Pike Wall, Skyhunters, promotions
      [
        { opening: 1, squads: [["pikemen", 18, 21]] },
        { squads: [["pikemen", 28, 21], ["crossbowmen", 19, 23], ["crossbowmen", 27, 23]], promote: true },
        { squads: [["pikemen", 13, 21], ["crossbowmen", 30, 25]], upgrades: [["crossbowmen", "skyhunters"]], promote: true },
        { squads: [["pikemen", 33, 21], ["crossbowmen", 14, 23], ["crossbowmen", 31, 23]], upgrades: [["pikemen", "pike_wall"]], promote: true },
        { squads: [["pikemen", 8, 21], ["crossbowmen", 16, 25], ["crossbowmen", 38, 23], ["crossbowmen", 6, 23]], promote: true },
        { squads: [["pikemen", 38, 21], ["crossbowmen", 2, 21], ["crossbowmen", 43, 21]], upgrades: [["crossbowmen", "repeaters"]], promote: true },
        { squads: [["pikemen", 3, 25], ["pikemen", 41, 25], ["crossbowmen", 9, 25], ["crossbowmen", 35, 25]], promote: true },
        { squads: [["knights", 22, 20], ["knights", 28, 20], ["crossbowmen", 22, 26], ["crossbowmen", 26, 26]], promote: true },
      ],
      // the pike line, with a level on each Keep and pikes beside them before the Tinker's raid
      [
        { opening: 1, squads: [["pikemen", 18, 21]] },
        { squads: [["pikemen", 28, 21], ["crossbowmen", 19, 23], ["crossbowmen", 27, 23]], promote: true },
        { squads: [["pikemen", 8, 21]], keeps: [0, 1], promote: true },
        { squads: [["pikemen", 34, 21], ["pikemen", 13, 21]], upgrades: [["crossbowmen", "skyhunters"]], promote: true },
        { squads: [["crossbowmen", 31, 23], ["crossbowmen", 14, 23], ["crossbowmen", 16, 25], ["crossbowmen", 6, 23], ["crossbowmen", 38, 23]], upgrades: [["pikemen", "pike_wall"]], promote: true },
        { squads: [["pikemen", 38, 25], ["pikemen", 3, 21], ["crossbowmen", 30, 25], ["crossbowmen", 43, 22]], promote: true },
        { squads: [["pikemen", 3, 25], ["pikemen", 41, 23], ["crossbowmen", 9, 25]], upgrades: [["crossbowmen", "repeaters"]], promote: true },
      ],
    ],
    loses: [
      // never adds after the opening
      [{ opening: 0 }],
      // all bows
      [
        { opening: 0, squads: [["crossbowmen", 26, 22], ["crossbowmen", 16, 22]] },
        [["crossbowmen", 14, 24], ["crossbowmen", 30, 24], ["crossbowmen", 10, 22], ["crossbowmen", 34, 22]],
        [["crossbowmen", 6, 22], ["crossbowmen", 38, 22], ["crossbowmen", 2, 22], ["crossbowmen", 42, 22], ["crossbowmen", 20, 22]],
        { squads: [["crossbowmen", 24, 23], ["crossbowmen", 17, 24], ["crossbowmen", 27, 24], ["crossbowmen", 6, 24]], upgrades: [["crossbowmen", "repeaters"]] },
        [["crossbowmen", 38, 24], ["crossbowmen", 2, 24], ["crossbowmen", 42, 24], ["crossbowmen", 14, 26], ["crossbowmen", 30, 26], ["crossbowmen", 6, 26], ["crossbowmen", 38, 26]],
      ],
      // a Ballista park
      [
        { opening: 0, squads: [["ballista", 14, 22]] },
        [["ballista", 26, 22], ["ballista", 30, 22], ["ballista", 8, 21], ["ballista", 34, 21]],
        { squads: [["ballista", 6, 22], ["ballista", 38, 21], ["ballista", 2, 22]], upgrades: [["ballista", "heavy_bolts"]] },
        [["ballista", 42, 21], ["ballista", 17, 23], ["ballista", 2, 25], ["ballista", 44, 24], ["ballista", 6, 25], ["ballista", 40, 25]],
      ],
    ],
    // Knights and Crossbowmen from the pack, and nothing else: it loses only two rounds
    commended: [
      { opening: 0, squads: [["crossbowmen", 26, 25], ["crossbowmen", 16, 25]] },
      { squads: [["knights", 25, 20], ["knights", 13, 20]], promote: true },
      { squads: [["knights", 31, 20], ["crossbowmen", 28, 22], ["crossbowmen", 17, 22], ["crossbowmen", 22, 22]], promote: true },
      { squads: [["knights", 7, 20], ["knights", 37, 20]], upgrades: [["crossbowmen", "skyhunters"]], promote: true },
      { squads: [["knights", 2, 22], ["knights", 42, 22], ["crossbowmen", 8, 22], ["crossbowmen", 36, 22], ["crossbowmen", 31, 22]], promote: true },
      { squads: [["knights", 19, 24], ["knights", 25, 24]], upgrades: [["knights", "shield_wall"]], promote: true },
      { squads: [["knights", 8, 25], ["knights", 36, 25], ["crossbowmen", 13, 25], ["crossbowmen", 31, 25], ["crossbowmen", 3, 25]], promote: true },
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
      { title: "Under the Bridge", teaser: "The goblins have adopted the troll under the toll bridge. And its toll.", play: UNDER_THE_BRIDGE },
      { title: "Plain Steel", teaser: "A goblin Tinker accuses the Wardens of stealing the wheelbarrow.", play: PLAIN_STEEL },
      { title: "Look Up", teaser: "The Compact draws borders on the ground. The goblins have noticed.", play: LOOK_UP },
      { title: "Old Grumm", teaser: "Thirty years ago, an ogre ate the Sergeant's helmet.", play: OLD_GRUMM },
      { title: "The Marches", teaser: "The season final. The Boss stakes the whole border.", play: THE_MARCHES },
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
