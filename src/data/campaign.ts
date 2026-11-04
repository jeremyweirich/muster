// The story campaigns, as planned in docs/CAMPAIGN.md. A mission with a `play` setup is playable from the Story tab;
// the rest are listed as coming soon. Teasers are player-facing, so keep them spoiler-light. The framework is
// described in docs/CAMPAIGN.md §6; src/game/mission.ts turns a MissionDef into a match.

import type { BattleResult } from "../sim/battle";
import type { PlacedSquad } from "../sim/types";
import { canPlace, defMap } from "../game/army";
import { DEFAULT_UNITS } from "./units";

// The cast. Voices are in docs/VISION.md: Dunmor knows the Field and has never read the book, Ithiel knows the book
// and has never seen the Field, the Marshal (the player) is new and asks out loud, the Boss SHOUTS, and the Tinker
// picks upgrades.
export const CAST = {
  sergeant: { name: "Sergeant Dunmor", side: "warden" },
  archivist: { name: "Archivist Ithiel", side: "warden" },
  marshal: { name: "Marshal", side: "warden" }, // the player
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
  // on a win, the debrief draws the player's winning board as a page of the book, under a line in the Marshal's hand
  lastPage?: { title: string; handwritten?: string; text: string };
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
    text: string; // the rule
    note?: string; // the Marshal's pencil note in the margin
    diagram?: string[][]; // unit ids by rank, front rank first
  };
  objective: string; // the sidebar's one line while deploying: just the goal
  roundLines?: Record<number, Line>; // said in the sidebar while the player deploys that round (beside any EnemyTurn line)
  win: Line[];
  winNote?: string; // the Marshal's pencil note after a win
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

// Rounds whose squads are fitted around the enemy's army so far, for scripts too long to lay out by hand.
const fitted = (rounds: (SquadSpec[] | EnemyTurn)[]): EnemyRound[] =>
  rounds.map((r) => (c) => (Array.isArray(r) ? fit(c.own, r) : { ...r, squads: fit(c.own, r.squads) }));

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
    { who: "archivist", text: "Is that the goat? It's much smaller than the literature suggests! There's also a precedent involving a turnip, if we have an hour." },
    { who: "sergeant", text: "We don't. Knights in front, Crossbowmen behind them, so the mob has something to run into. When the horn goes, hands in your pockets. Book says so." },
    { who: "archivist", text: "It says \"no hand may touch the Field.\" It doesn't mention pockets." },
    { who: "sergeant", text: "Well, that's where I keep mine." },
    { who: "marshal", text: "Sorry, so once it starts, what do I do?" },
    { who: "sergeant", text: "Nothing. Best part of the job." },
    { who: "boss", text: "IT'S OUR GOAT. WE HAVE THREE MOBS OF WITNESSES." },
    { who: "archivist", text: "The challenger deploys first, so you can study their army for as long as you like. I certainly intend to!" },
  ],
  page: {
    title: "Page 1: The Compact",
    text: "Choose your units. Place them. When the horn sounds, no hand may touch the Field.",
    note: "Knights in front, Crossbowmen behind. Surely there's more to it? Ask whether pockets are required.",
    diagram: [["knights"], ["crossbowmen", "crossbowmen"]],
  },
  objective: "Win the battle.",
  win: [
    { who: "sergeant", text: "Everybody back? Good, less paperwork. Boring wins. Book says so." },
    { who: "archivist", text: "It doesn't, actually! I'd remember." },
    { who: "sergeant", text: "Well, it should." },
    { who: "boss", text: "YOU BEAT THREE MOBS. WE HAVE MORE MOBS. WE'RE APPEALING." },
    { who: "marshal", text: "Can they do that?" },
    { who: "archivist", text: "Oh, I very much hope so!" },
  ],
  winNote: "\"Boring wins\" (Sgt.). Not in the book, says Ithiel. Sgt. says it should be.",
  hints: [
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "Crossbowmen only get so many shots, and there were more goblins than shots. A mob needs something to run into. Put Knights in front." } },
    { line: { who: "sergeant", text: "They got round your Knights. Put them where the goblins are heading, between the mob and your Crossbowmen." } },
  ],
  commendation: {
    name: "Knights in Front",
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
  supply: 500,
  units: ["knights", "crossbowmen"],
  hp: [70, 110],
  towers: false,
  upgrades: false,
  veterancy: false,
  map: "millbrook-ford",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers"],
    rounds: [
      [
        ["grunts", 11, 4],
        ["grunts", 17, 4],
        ["grunts", 23, 4],
        ["grunts", 29, 4],
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
    { who: "archivist", text: "They've appealed! Under the Compact, a loss can be appealed once, as a longer match. I've only ever read about one of these!" },
    { who: "marshal", text: "How much longer?" },
    { who: "sergeant", text: "Rounds. Each round you add units, and whatever you've already placed stays put. After each battle, the survivors take a bite out of the other side's HP. First to zero loses." },
    { who: "boss", text: "WE CAME BACK WITH MORE. THEN WE COME BACK WITH MORE AFTER THAT. THAT'S WHAT ROUNDS ARE." },
    { who: "archivist", text: "According to the map, Millbrook Ford is a shallow crossing." },
    { who: "sergeant", text: "It's been a pond for sixty years. Nobody's walking through that." },
    { who: "archivist", text: "The map is wrong? How wonderful!" },
  ],
  page: {
    title: "Page 2: What Is Placed Stays Placed",
    text: "You will see what the other side has fielded, but never what they will add.",
    note: "So I look at their last army and guess? Is guessing allowed? Asked Sgt. He said \"Everyone guesses.\" That doesn't help.",
  },
  objective: "Bring the Boss's HP to zero before yours runs out.",
  roundLines: {
    2: { who: "boss", text: "THAT WAS THE SHORT VERSION." },
    3: { who: "sergeant", text: "See where they put those Skirmishers? On the side we left thin. Goblins always check." },
  },
  win: [
    { who: "archivist", text: "The appeal is dismissed, and the goat has eaten it! I can't find a precedent!" },
    { who: "boss", text: "THAT WAS OUR ONLY COPY." },
    { who: "marshal", text: "Does that count as a ruling?" },
    { who: "archivist", text: "I have no idea. Isn't that marvelous?" },
    { who: "sergeant", text: "It's a goat. Who's got lunch?" },
  ],
  winNote: "Millbrook Ford is a pond (Sgt.). The map is older than the pond (Ithiel, thrilled). Look at the thin side of your own army first.",
  hints: [
    { when: (c) => c.army.every((sq) => sq.round === 1), line: { who: "sergeant", text: "You stopped adding units after round 1. Supply in your pocket doesn't fight, and they kept coming." } },
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "No Knights, so nothing stopped the mob reaching your Crossbowmen. Put Knights in front." } },
    { line: { who: "sergeant", text: "Their Skirmishers hid behind Grunts, on the flank we left thin. Next time, put Knights on that flank with Crossbowmen behind them, or get there before they do." } },
  ],
  commendation: { name: "Guess Right", text: "Win every round of the appeal.", earned: allRoundsWon },
  reference: {
    wins: [
      // one Knight and three Crossbowmen, then guesses the flank attack and covers both flanks in round 2
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 22, 24]],
        [["knights", 38, 20], ["knights", 6, 20]],
        [["crossbowmen", 37, 22], ["crossbowmen", 7, 22], ["crossbowmen", 30, 22], ["crossbowmen", 15, 22], ["crossbowmen", 33, 24]],
      ],
      // loses round 2 to the archers, then covers the flanks
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 22, 24]],
        [["crossbowmen", 30, 22], ["crossbowmen", 16, 22], ["crossbowmen", 34, 22], ["crossbowmen", 12, 22]],
        [["knights", 36, 20], ["knights", 8, 20], ["crossbowmen", 37, 24]],
      ],
      // Knights first
      [
        [["knights", 20, 20], ["knights", 24, 20], ["crossbowmen", 22, 22]],
        [["knights", 36, 20], ["knights", 8, 20]],
        [["crossbowmen", 37, 22], ["crossbowmen", 8, 22], ["crossbowmen", 18, 22], ["crossbowmen", 26, 22], ["crossbowmen", 28, 24]],
      ],
      // three Crossbowmen behind one Knight, then both flanks
      [
        [["knights", 22, 20], ["crossbowmen", 16, 22], ["crossbowmen", 21, 22], ["crossbowmen", 26, 22]],
        [["knights", 38, 20], ["knights", 6, 20]],
        [["crossbowmen", 37, 22], ["crossbowmen", 7, 22], ["crossbowmen", 31, 22], ["crossbowmen", 12, 22], ["crossbowmen", 33, 24]],
      ],
    ],
    loses: [
      // never adds after round 1
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 22, 24]],
      ],
      // only Crossbowmen after round 1
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 22, 24]],
        [["crossbowmen", 30, 22], ["crossbowmen", 16, 22], ["crossbowmen", 34, 22], ["crossbowmen", 12, 22]],
        [["crossbowmen", 37, 22], ["crossbowmen", 8, 22], ["crossbowmen", 41, 22], ["crossbowmen", 4, 22], ["crossbowmen", 31, 24]],
      ],
      // all Crossbowmen
      [
        [["crossbowmen", 18, 22], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22], ["crossbowmen", 30, 22], ["crossbowmen", 34, 22]],
        [["crossbowmen", 14, 22], ["crossbowmen", 38, 22], ["crossbowmen", 10, 22], ["crossbowmen", 42, 22]],
        [["crossbowmen", 6, 22], ["crossbowmen", 42, 22], ["crossbowmen", 2, 22], ["crossbowmen", 44, 24], ["crossbowmen", 20, 24]],
      ],
    ],
    // guesses the flank attack: Knights on both flanks in round 2
    commended: [
      [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 22, 24]],
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
  supply: 600,
  units: ["knights", "crossbowmen"],
  hp: [100, 200],
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
    { who: "archivist", text: "A goblin has painted something on the West Keep! I've seen this sort of thing in marginalia, but never at this scale." },
    { who: "sergeant", text: "It's rude." },
    { who: "marshal", text: "Is that supposed to be me?" },
    { who: "boss", text: "IT'S A GOOD LIKENESS." },
    { who: "archivist", text: "Each side has two Keeps. They don't fight, and they don't count toward winning a battle, but you very much want to hold on to them. Page 3 is quite firm!" },
    { who: "sergeant", text: "Lose one and everyone stands around blinking. And the grass on the flanks is long this year. Goblins hide in it." },
    { who: "archivist", text: "The book doesn't mention grass at all!" },
    { who: "sergeant", text: "Goblins don't read it either." },
  ],
  page: {
    title: "Page 3: Two Keeps",
    text: "If a Keep falls, the whole army is Dazed. A Keep can be built higher.",
    note: "Book says buy levels (Keeps tab). Sgt. says put Knights beside the Keeps. Which? Does anyone know? Do both?",
  },
  objective: "Win the match.",
  roundLines: {
    2: { who: "boss", text: "NICE KEEPS. BE A SHAME." },
    3: { who: "archivist", text: "Wolf Riders! See the star beside them? That's an upgrade, Tower Raiders, so they go straight for Keeps. Volume Four calls this \"an unsporting tendency\"!" },
  },
  win: [
    { who: "sergeant", text: "Told you about the grass." },
    { who: "archivist", text: "You did! I went and stood in it. May I add it to the book?" },
    { who: "sergeant", text: "Thought it was already in there." },
    { who: "archivist", text: "The painting has been scrubbed off the West Keep. Mostly. I kept a sketch." },
    { who: "marshal", text: "Please don't keep a sketch." },
    { who: "boss", text: "SCRUB ALL YOU LIKE. WE'RE GETTING THE TROLL." },
  ],
  winNote: "Keep levels buy time (book). Knights stop the wolves (Sgt.). Long grass hides wolves (Sgt., and now Ithiel, who has some in his hair).",
  hints: [
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "No Knights on the Field, so nothing stopped the mob or the wolves. Buy some Knights." } },
    { when: (c) => keepFell(c) && c.towerLevels.every((l) => l === 0), line: { who: "sergeant", text: "The wolves pulled down a Keep and the whole army was Dazed. Put Knights beside the Keeps. A level costs 100 and slows the wolves down, too." } },
    { line: { who: "archivist", text: "Page 3 says higher walls help, and they do, for a while! It seems the wolves just take longer. Knights beside the Keeps are what actually stop them." } },
  ],
  commendation: { name: "Both Keeps Standing", text: "Win without losing a Keep.", earned: (c) => !keepFell(c) },
  reference: {
    wins: [
      // a level on each Keep before the raid, and a Knight squad on one flank
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 15, 22], ["crossbowmen", 29, 22]],
        { squads: [["knights", 16, 20]], keeps: [0,1] },
        [["knights", 28, 20], ["crossbowmen", 17, 24], ["crossbowmen", 27, 24], ["crossbowmen", 32, 22]],
        [["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 22, 25], ["crossbowmen", 40, 22]],
      ],
      // guards one flank after the first raid, then buys levels
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 15, 22], ["crossbowmen", 29, 22]],
        [["knights", 16, 20], ["crossbowmen", 32, 22], ["crossbowmen", 12, 22]],
        { squads: [["knights", 36, 20], ["crossbowmen", 17, 24]], keeps: [0,1] },
        [["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 22, 25], ["crossbowmen", 40, 22]],
      ],
      // Knights beside both Keeps from round 2
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 15, 22], ["crossbowmen", 29, 22]],
        [["knights", 9, 20], ["knights", 35, 20]],
        [["crossbowmen", 9, 22], ["crossbowmen", 36, 22], ["crossbowmen", 17, 24], ["crossbowmen", 27, 24], ["crossbowmen", 32, 22]],
        [["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 22, 25], ["crossbowmen", 40, 22]],
      ],
    ],
    loses: [
      // no new Knights: Crossbowmen and levels only
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 15, 22], ["crossbowmen", 29, 22]],
        { squads: [["crossbowmen", 32, 22], ["crossbowmen", 12, 22]], keeps: [0,1] },
        [["crossbowmen", 17, 24], ["crossbowmen", 27, 24], ["crossbowmen", 9, 22], ["crossbowmen", 36, 22], ["crossbowmen", 40, 22]],
        [["crossbowmen", 22, 25], ["crossbowmen", 16, 25], ["crossbowmen", 28, 25], ["crossbowmen", 4, 22], ["crossbowmen", 44, 22], ["crossbowmen", 8, 24]],
      ],
      // all Crossbowmen
      [
        [["crossbowmen", 18, 22], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22], ["crossbowmen", 30, 22], ["crossbowmen", 14, 22], ["crossbowmen", 34, 22]],
        [["crossbowmen", 10, 22], ["crossbowmen", 38, 22], ["crossbowmen", 18, 24], ["crossbowmen", 26, 24]],
        [["crossbowmen", 6, 22], ["crossbowmen", 42, 22], ["crossbowmen", 2, 22], ["crossbowmen", 22, 24], ["crossbowmen", 14, 24]],
        [["crossbowmen", 30, 24], ["crossbowmen", 2, 24], ["crossbowmen", 6, 24], ["crossbowmen", 40, 24], ["crossbowmen", 18, 26], ["crossbowmen", 26, 26]],
      ],
    ],
    // Knights beside both Keeps from the first round
    commended: [
      [["knights", 9, 20], ["knights", 35, 20], ["crossbowmen", 17, 22], ["crossbowmen", 27, 22]],
      [["crossbowmen", 9, 22], ["crossbowmen", 36, 22], ["knights", 22, 20]],
      [["knights", 5, 20], ["knights", 39, 20], ["crossbowmen", 20, 22]],
      [["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 22, 25], ["crossbowmen", 32, 22]],
    ],
  },
};

// Mission 4: the Ballista and big units, on the Furrows: a ploughed band across the middle where anything on foot
// moves at half speed. The Boss opens with a wall of Skirmishers that shoots any Knights who march out to meet them,
// then sends trolls, which beat a Knight line. The answer is Ballistae, with the Knights kept at the very back: they
// reach the mud as the trolls do, while the Ballistae shoot the trolls crossing it. Tuned by simulation: Knights at the
// back with Ballistae win, from round 1 or with the Ballistae a round later; Knights at the front, Knights and
// Crossbowmen without Ballistae, all Crossbowmen, a Ballista park with nothing in front, and never adding lose. A
// round-1 charge can't be undone in the same match (placed squads stay), so the lesson lands on Try again.
const THE_TROLL: MissionDef = {
  id: "wardens-4",
  supply: 700,
  units: ["knights", "crossbowmen", "ballista"],
  hp: [200,180],
  towers: true,
  upgrades: false,
  veterancy: false,
  map: "the-furrows",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers", "troll"],
    rounds: [
      [["grunts", 4, 4], ["grunts", 40, 4], ["skirmishers", 10, 4], ["skirmishers", 16, 4], ["skirmishers", 22, 4], ["skirmishers", 28, 4], ["skirmishers", 34, 4]],
      [["troll", 14, 2], ["troll", 19, 2], ["troll", 26, 2], ["troll", 32, 2]],
      [["troll", 16, 0], ["troll", 28, 0], ["skirmishers", 4, 1], ["skirmishers", 40, 1]],
      [["troll", 10, 0], ["troll", 36, 0], ["troll", 22, 0], ["troll", 32, 0], ["troll", 4, 0]],
      [["troll", 14, 1], ["troll", 30, 1], ["troll", 0, 4], ["troll", 46, 4], ["troll", 8, 2], ["troll", 40, 0]],
      [["troll", 0, 6], ["troll", 46, 6], ["troll", 6, 6], ["troll", 40, 6], ["troll", 20, 6]],
    ],
  },
  briefing: [
    { who: "archivist", text: "A troll! I have three volumes on trolls, and I can finally see if they got the knees right." },
    { who: "sergeant", text: "Knees are the last thing you'll notice. They go through Knights like a boot through a hedge. Every blow in a row lands harder, and they heal while they fight." },
    { who: "boss", text: "WE GOT TROLLS. AND ENOUGH SKIRMISHERS FOR EVERY KNIGHT YOU OWN." },
    { who: "marshal", text: "What do we do about a troll?" },
    { who: "sergeant", text: "Ballista. Big, slow, and goes for the biggest thing it can see. Put Knights in front, or a mob will wreck it. Book says so." },
    { who: "archivist", text: "It actually does, for once! Page 4! How did you know?" },
    { who: "sergeant", text: "Stood in front of one once. And they've ploughed the middle of the Field. Anything on foot crosses it at half speed, trolls included." },
  ],
  page: {
    title: "Page 4: Ballistae",
    text: "Ballistae deal double damage to large units. Ballistae need Knights in front of them.",
    note: "Ploughed ground: half speed on foot. Theirs and ours. In front, but how far in front? Sgt. says don't be in a hurry.",
    diagram: [["knights", "knights"], ["ballista", "crossbowmen", "ballista"]],
  },
  objective: "Win the match.",
  roundLines: {
    2: { who: "boss", text: "HERE COME THE TROLLS." },
    3: { who: "archivist", text: "An actual troll! Volume One has the knees completely wrong! Oh, and it's healing. It's still healing. Look at that!" },
  },
  win: [
    { who: "sergeant", text: "Big, slow, and it worked. That's what I like in a plan." },
    { who: "archivist", text: "The trolls have gone home, and I've drawn the correct knees." },
    { who: "marshal", text: "Is that going in the book?" },
    { who: "archivist", text: "It had better be!" },
    { who: "boss", text: "FINE. YOU WANT TO PLAY CLEVER? MEET THE TINKER." },
  ],
  winNote: "Trolls get worse the longer they keep hitting something (Sgt.). Knights waited at the back and met them in the mud. For knees, see Ithiel's drawing.",
  hints: [
    { when: (c) => c.army.every((sq) => sq.round === 1), line: { who: "sergeant", text: "You stopped adding units after round 1. The trolls didn't stop." } },
    { when: (c) => !fielded(c, "ballista"), line: { who: "sergeant", text: "Knights against trolls is a fair fight, and they brought more trolls. Ballistae go for the biggest thing on the Field." } },
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "Nothing stood in front of the Ballistae, and a mob that reaches a Ballista wrecks it. Knights in front." } },
    {
      when: (c) => c.army.some((sq) => sq.defId === "knights" && sq.y < 24),
      line: { who: "sergeant", text: "Your Knights marched out to meet them, and the Skirmishers shot them on the way. Keep them at the back. The trolls will come to you, slowly, through the mud." },
    },
    { line: { who: "sergeant", text: "The trolls still got through. Add Ballistae every round, behind your Knights, and leave the trolls to them." } },
  ],
  commendation: {
    name: "In No Hurry",
    text: "Win with every Knight squad in your back two rows.",
    earned: (c) => {
      const knights = c.army.filter((sq) => sq.defId === "knights");
      return knights.length > 0 && knights.every((sq) => sq.y >= 25);
    },
  },
  reference: {
    wins: [
      // Knights at the very back, Ballistae in front of them from round 1
      [
        [["knights", 16, 25], ["knights", 28, 25], ["ballista", 20, 22], ["ballista", 24, 22], ["crossbowmen", 21, 24]],
        [["ballista", 16, 22], ["ballista", 28, 22], ["knights", 22, 26]],
        [["ballista", 32, 22], ["knights", 8, 25], ["knights", 36, 25]],
        [["ballista", 13, 22], ["ballista", 30, 22], ["knights", 2, 25], ["knights", 40, 25]],
        [["ballista", 4, 22], ["ballista", 40, 22], ["knights", 12, 26], ["knights", 32, 26], ["crossbowmen", 26, 24]],
      ],
      // Knights at the back, Ballistae from round 2
      [
        [["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 19, 22], ["crossbowmen", 23, 22], ["crossbowmen", 27, 22]],
        [["ballista", 16, 22], ["ballista", 13, 22], ["ballista", 30, 22], ["ballista", 32, 22]],
        [["ballista", 38, 22], ["knights", 8, 25], ["knights", 36, 25]],
        [["ballista", 6, 22], ["ballista", 40, 22], ["ballista", 21, 24], ["ballista", 25, 24], ["knights", 22, 26]],
        [["ballista", 4, 20], ["ballista", 42, 20], ["knights", 12, 26], ["knights", 32, 26], ["crossbowmen", 17, 24]],
      ],
    ],
    loses: [
      // Knights marched to the front of the zone
      [
        [["knights", 16, 20], ["knights", 28, 20], ["ballista", 20, 22], ["ballista", 24, 22], ["crossbowmen", 21, 24]],
        [["ballista", 16, 22], ["ballista", 28, 22], ["knights", 22, 20]],
        [["ballista", 32, 22], ["knights", 8, 20], ["knights", 36, 20]],
        [["ballista", 13, 22], ["ballista", 30, 22], ["knights", 2, 20], ["knights", 40, 20]],
        [["ballista", 4, 22], ["ballista", 40, 22], ["knights", 12, 21], ["knights", 32, 21], ["crossbowmen", 26, 24]],
      ],
      // no Ballistae: Knights and Crossbowmen
      [
        [["knights", 16, 25], ["knights", 28, 25], ["crossbowmen", 19, 22], ["crossbowmen", 23, 22], ["crossbowmen", 27, 22]],
        [["knights", 22, 26], ["knights", 10, 25]],
        [["knights", 34, 25], ["crossbowmen", 15, 22], ["crossbowmen", 31, 22], ["crossbowmen", 11, 22]],
        [["knights", 4, 25], ["knights", 40, 25], ["crossbowmen", 35, 22]],
        [["knights", 8, 26], ["knights", 36, 26], ["crossbowmen", 7, 22], ["crossbowmen", 39, 22]],
      ],
      // all Crossbowmen
      [
        [["crossbowmen", 10, 22], ["crossbowmen", 14, 22], ["crossbowmen", 18, 22], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22], ["crossbowmen", 30, 22], ["crossbowmen", 34, 22]],
        [["crossbowmen", 10, 26], ["crossbowmen", 14, 24], ["crossbowmen", 18, 24], ["crossbowmen", 26, 26]],
        [["crossbowmen", 30, 24], ["crossbowmen", 34, 26], ["crossbowmen", 38, 24], ["crossbowmen", 6, 22], ["crossbowmen", 38, 22]],
        [["crossbowmen", 6, 24], ["crossbowmen", 42, 24], ["crossbowmen", 2, 22], ["crossbowmen", 42, 22], ["crossbowmen", 2, 24], ["crossbowmen", 30, 26]],
        [["crossbowmen", 6, 26], ["crossbowmen", 14, 26], ["crossbowmen", 18, 26], ["crossbowmen", 22, 26], ["crossbowmen", 38, 26], ["crossbowmen", 26, 26], ["crossbowmen", 2, 26]],
      ],
      // a Ballista park with nothing in front
      [
        [["ballista", 8, 22], ["ballista", 14, 22], ["ballista", 18, 22], ["ballista", 22, 22], ["ballista", 26, 22], ["ballista", 30, 22], ["ballista", 38, 22]],
        [["ballista", 6, 22], ["ballista", 42, 22], ["ballista", 33, 24], ["ballista", 2, 22]],
        [["ballista", 14, 25], ["ballista", 18, 25], ["ballista", 22, 25], ["ballista", 26, 25], ["ballista", 30, 25]],
        [["ballista", 6, 25], ["ballista", 2, 25], ["ballista", 38, 25], ["ballista", 42, 25], ["crossbowmen", 15, 20], ["crossbowmen", 27, 20]],
        [["crossbowmen", 19, 20], ["crossbowmen", 23, 20], ["crossbowmen", 31, 20], ["crossbowmen", 7, 20], ["crossbowmen", 37, 20], ["crossbowmen", 11, 20], ["crossbowmen", 41, 20]],
      ],
      // never adds after round 1
      [
        [["knights", 16, 25], ["knights", 28, 25], ["ballista", 20, 22], ["ballista", 24, 22], ["crossbowmen", 21, 24]],
      ],
    ],
    // Knights at the very back
    commended: [
      [["knights", 16, 25], ["knights", 28, 25], ["ballista", 20, 22], ["ballista", 24, 22], ["crossbowmen", 21, 24]],
      [["ballista", 16, 22], ["ballista", 28, 22], ["knights", 22, 26]],
      [["ballista", 32, 22], ["knights", 8, 25], ["knights", 36, 25]],
      [["ballista", 13, 22], ["ballista", 30, 22], ["knights", 2, 25], ["knights", 40, 25]],
      [["ballista", 4, 22], ["ballista", 40, 22], ["knights", 12, 26], ["knights", 32, 26], ["crossbowmen", 26, 24]],
    ],
  },
};

// Mission 5: upgrades. The Tinker picks upgrades: in round 2 every Grunt on the Field, including those already placed,
// gets Scrap Armor (each goblin shrugs off its first hit), and in round 3 the trolls get Thick Blood. The counter is an
// upgrade of your own: Repeaters (many small bolts) reaches every Crossbowman. No Clerics yet (they come in mission 6;
// Knights and Clerics alone beat most chaff). Tuned by simulation: Repeaters win, bought in round 1, 2 or 3, and so does
// Shield Wall; the same supply spent on more Crossbowmen, more Knights or Ballistae loses, and so does the wrong
// upgrade (Knights' Veterans). Adding Knights for round 4's flank mobs earns the commendation.
const THE_WHEELBARROW: MissionDef = {
  id: "wardens-5",
  supply: 800,
  units: ["knights", "crossbowmen", "ballista"],
  hp: [180,200],
  towers: true,
  upgrades: true,
  veterancy: false,
  map: "standing-stones",
  enemy: {
    name: "The Tinker",
    units: ["grunts", "skirmishers", "troll"],
    rounds: [
      [["grunts", 6, 4], ["grunts", 14, 4], ["grunts", 22, 4], ["grunts", 30, 4], ["grunts", 38, 4], ["skirmishers", 18, 1], ["skirmishers", 26, 1]],
      { squads: [["grunts", 2, 1], ["grunts", 42, 1], ["skirmishers", 14, 0]], upgrades: { grunts: ["scrap_armor"] } },
      { squads: [["troll", 18, 3], ["troll", 28, 3]], upgrades: { troll: ["thick_blood"] }, line: { who: "tinker", text: "Thick Blood on the trolls! I considered something flashier, but it wouldn't have been as annoying." } },
      [["grunts", 2, 4], ["grunts", 42, 4], ["troll", 34, 4], ["skirmishers", 38, 0]],
      [["troll", 24, 3], ["troll", 32, 3], ["grunts", 18, 5], ["grunts", 26, 5]],
      [["troll", 10, 6], ["troll", 36, 6], ["troll", 4, 6], ["troll", 40, 6]],
    ],
  },
  briefing: [
    { who: "archivist", text: "We've been accused of theft! A goblin says we stole the wheelbarrow. We've had wheelbarrows for four hundred and twelve years. I brought the records!" },
    { who: "tinker", text: "Four hundred and twelve years, and it still has one wheel! Nobody who invented that would have stopped there. So you must have stolen it." },
    { who: "marshal", text: "Is that an argument?" },
    { who: "archivist", text: "It's a very good one!" },
    { who: "tinker", text: "I'll have a look at your army, then I'll pick my upgrades. It's called thinking! It's free, you should try it!" },
    { who: "sergeant", text: "Our squads get better all at once sometimes, even the ones already out there. Never knew why." },
    { who: "archivist", text: "That's Page 5! Those are upgrades, and someone has to buy them!" },
    { who: "sergeant", text: "Ah. That explains the invoices." },
  ],
  page: {
    title: "Page 5: Upgrades",
    text: "An upgrade improves every squad of that unit, even those already on the Field. Enemy upgrades show as a star beside the unit.",
    note: "Check for stars, then pick an upgrade that answers them. Does Sgt. know he's been paying for these? He does now.",
  },
  objective: "Win the match.",
  roundLines: {
    2: { who: "tinker", text: "Just a small change this round! You'll notice!" },
    3: { who: "archivist", text: "That star is Scrap Armor. It stops one hit per Grunt! So one big hit is wasted, but lots of small hits... oh, what a lovely problem!" },
  },
  win: [
    { who: "sergeant", text: "The right upgrade. Forty years, I thought they just turned up like that some seasons." },
    { who: "tinker", text: "You picked the right upgrade! Most people don't look. Can I see one up close?" },
    { who: "archivist", text: "The wheelbarrow stays with us. The Tinker has asked to borrow it." },
    { who: "marshal", text: "Should we let them?" },
    { who: "sergeant", text: "It's a wheelbarrow." },
    { who: "boss", text: "ENOUGH THINKING. WE'RE TAKING THE BRIDGE." },
  ],
  winNote: "Sgt. has been buying upgrades for forty years without knowing it. Wheelbarrow: is one wheel a problem? Nobody here has ever asked.",
  hints: [
    { when: (c) => c.army.every((sq) => sq.round === 1), line: { who: "sergeant", text: "They kept adding squads and you stopped. That's the whole story." } },
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "The mob ran straight onto your Crossbowmen. Put Knights in front." } },
    { when: (c) => Object.keys(c.upgrades).length === 0, line: { who: "archivist", text: "Every Grunt shrugged off its first hit, and we never answered! Open the Upgrades tab. An upgrade reaches every squad already on the Field." } },
    { when: (c) => !c.upgrades.crossbowmen?.includes("repeaters"), line: { who: "archivist", text: "Scrap Armor stops one hit per Grunt, so a heavy bolt is wasted on it. Repeaters fire lots of small bolts, and the armor only stops the first!" } },
    { line: { who: "sergeant", text: "Close. Buy the upgrade the round you see the star, and keep adding Knights in front of your Crossbowmen." } },
  ],
  commendation: { name: "Right Upgrade", text: "Once their armor shows, win every round after it.", earned: (c) => c.results.slice(2).every((r) => r.winner === 0) },
  reference: {
    wins: [
      // Repeaters the round after the armor shows
      [
        [["knights", 16, 20], ["knights", 26, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["knights", 8, 20], ["knights", 36, 20]],
        { squads: [["crossbowmen", 16, 24], ["crossbowmen", 26, 24], ["crossbowmen", 21, 24]], upgrades: [["crossbowmen", "repeaters"]] },
        [["knights", 21, 20], ["crossbowmen", 8, 22], ["crossbowmen", 37, 22], ["crossbowmen", 3, 22], ["crossbowmen", 41, 22]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24], ["crossbowmen", 14, 26]],
        [["knights", 12, 25], ["knights", 30, 25], ["crossbowmen", 0, 22], ["crossbowmen", 45, 22], ["crossbowmen", 35, 24], ["crossbowmen", 0, 24]],
      ],
      // Repeaters in round 2, on the Tinker's word
      [
        [["knights", 16, 20], ["knights", 26, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        { squads: [["knights", 8, 20]], upgrades: [["crossbowmen", "repeaters"]] },
        [["knights", 36, 20], ["crossbowmen", 16, 24], ["crossbowmen", 26, 24], ["crossbowmen", 21, 24]],
        [["knights", 21, 20], ["crossbowmen", 8, 22], ["crossbowmen", 37, 22], ["crossbowmen", 3, 22], ["crossbowmen", 41, 22]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24], ["crossbowmen", 14, 26]],
        [["knights", 12, 25], ["knights", 30, 25], ["crossbowmen", 0, 22], ["crossbowmen", 45, 22], ["crossbowmen", 35, 24], ["crossbowmen", 0, 24]],
      ],
      // Repeaters before the first battle
      [
        { squads: [["knights", 16, 20], ["knights", 26, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]], upgrades: [["crossbowmen", "repeaters"]] },
        [["knights", 8, 20], ["knights", 36, 20]],
        [["crossbowmen", 16, 24], ["crossbowmen", 26, 24], ["crossbowmen", 21, 24], ["crossbowmen", 13, 22], ["crossbowmen", 31, 22]],
        [["knights", 21, 20], ["crossbowmen", 8, 22], ["crossbowmen", 37, 22], ["crossbowmen", 3, 22], ["crossbowmen", 41, 22]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24], ["crossbowmen", 14, 26]],
        [["knights", 12, 25], ["knights", 30, 25], ["crossbowmen", 0, 22], ["crossbowmen", 45, 22], ["crossbowmen", 35, 24], ["crossbowmen", 0, 24]],
      ],
    ],
    loses: [
      // no upgrades: the same supply on more Crossbowmen
      [
        [["knights", 16, 20], ["knights", 26, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["knights", 8, 20], ["knights", 36, 20]],
        [["crossbowmen", 16, 24], ["crossbowmen", 26, 24], ["crossbowmen", 21, 24], ["crossbowmen", 8, 22], ["crossbowmen", 37, 22]],
        [["knights", 21, 20], ["crossbowmen", 3, 22], ["crossbowmen", 41, 22], ["crossbowmen", 11, 26], ["crossbowmen", 31, 26]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24], ["crossbowmen", 14, 26]],
        [["knights", 12, 25], ["knights", 30, 25], ["crossbowmen", 0, 22], ["crossbowmen", 45, 22], ["crossbowmen", 35, 24], ["crossbowmen", 0, 24]],
      ],
      // no upgrades: Knights in front and bows behind, spread wide every round
      [
        [["knights", 10, 20], ["knights", 22, 20], ["knights", 34, 20], ["crossbowmen", 14, 22], ["crossbowmen", 30, 22]],
        [["knights", 16, 20], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22]],
        [["knights", 28, 20], ["crossbowmen", 10, 22], ["crossbowmen", 34, 22], ["crossbowmen", 18, 22]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 6, 22], ["crossbowmen", 38, 22]],
        [["knights", 0, 21], ["knights", 44, 21], ["crossbowmen", 14, 24], ["crossbowmen", 22, 24], ["crossbowmen", 30, 24]],
        [["knights", 16, 26], ["knights", 28, 26], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24], ["crossbowmen", 9, 24], ["crossbowmen", 35, 24]],
      ],
      // no upgrades: the same supply on more Knights
      [
        [["knights", 16, 20], ["knights", 26, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["knights", 8, 20], ["knights", 36, 20]],
        [["knights", 21, 20], ["knights", 12, 25], ["crossbowmen", 26, 24]],
        [["knights", 30, 25], ["knights", 4, 20], ["knights", 40, 20]],
        [["knights", 0, 22], ["knights", 44, 22], ["crossbowmen", 8, 22], ["crossbowmen", 37, 22], ["crossbowmen", 21, 24]],
        [["knights", 16, 26], ["knights", 22, 26], ["knights", 36, 26], ["crossbowmen", 3, 24], ["crossbowmen", 41, 24]],
      ],
      // no upgrades: Ballistae instead
      [
        [["knights", 16, 20], ["knights", 26, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["knights", 8, 20], ["knights", 36, 20]],
        [["ballista", 16, 24], ["ballista", 26, 24], ["ballista", 21, 24], ["ballista", 8, 22], ["ballista", 38, 22]],
        [["knights", 21, 20], ["ballista", 4, 22], ["ballista", 42, 22], ["crossbowmen", 12, 26], ["crossbowmen", 31, 26]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24], ["crossbowmen", 14, 26]],
        [["knights", 12, 25], ["knights", 30, 25], ["crossbowmen", 0, 22], ["crossbowmen", 45, 22], ["crossbowmen", 35, 24], ["crossbowmen", 0, 24]],
      ],
      // the wrong upgrade: Knights' Veterans against armored mobs
      [
        [["knights", 16, 20], ["knights", 26, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["knights", 8, 20], ["knights", 36, 20]],
        { squads: [["crossbowmen", 16, 24], ["crossbowmen", 26, 24], ["crossbowmen", 21, 24]], upgrades: [["knights", "veterans"]] },
        [["knights", 21, 20], ["crossbowmen", 8, 22], ["crossbowmen", 37, 22], ["crossbowmen", 3, 22], ["crossbowmen", 41, 22]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24], ["crossbowmen", 14, 26]],
        [["knights", 12, 25], ["knights", 30, 25], ["crossbowmen", 0, 22], ["crossbowmen", 45, 22], ["crossbowmen", 35, 24], ["crossbowmen", 0, 24]],
      ],
      // never adds after round 1
      [
        [["knights", 16, 20], ["knights", 26, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
      ],
    ],
    // Repeaters in round 2, and Knights added for round 4's flank mobs
    commended: [
      [["knights", 16, 20], ["knights", 26, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
      { squads: [["knights", 8, 20]], upgrades: [["crossbowmen", "repeaters"]] },
      [["knights", 36, 20], ["crossbowmen", 16, 24], ["crossbowmen", 26, 24], ["crossbowmen", 21, 24]],
      [["knights", 21, 20], ["crossbowmen", 8, 22], ["crossbowmen", 37, 22], ["crossbowmen", 3, 22], ["crossbowmen", 41, 22]],
      [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 4, 24], ["crossbowmen", 40, 24], ["crossbowmen", 14, 26]],
      [["knights", 12, 25], ["knights", 30, 25], ["crossbowmen", 0, 22], ["crossbowmen", 45, 22], ["crossbowmen", 35, 24], ["crossbowmen", 0, 24]],
    ],
  },
};

// Mission 6: Clerics, at the toll bridge: a river right across the Field with one wide bridge in the middle, so
// nothing on foot can flank. Mobs pour over the bridge with Skirmishers behind them, then trolls. Knights holding the
// bridge wear down without healing; Clerics behind them keep them standing, once they pray every second (Constant
// Prayer): prayers don't stack, so the base prayer every 5s can't keep a busy bridge up. Tuned by simulation: Clerics
// with Constant Prayer win, bought before round 1 (every round) or in round 2, and so does Shield Wall on the Knights
// instead (both keep the Knights standing). Clerics without the prayer, no Clerics (Crossbowmen, Ballistae or
// Repeaters instead), all Crossbowmen and never adding lose. Round 6's five trolls finish any plan still going.
const UNDER_THE_BRIDGE: MissionDef = {
  id: "wardens-6",
  supply: 900,
  units: ["knights", "crossbowmen", "ballista", "cleric"],
  hp: [260, 260],
  towers: true,
  upgrades: true,
  veterancy: false,
  map: "toll-bridge",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers", "troll"],
    rounds: [
      [["grunts", 14, 4], ["grunts", 18, 4], ["grunts", 22, 4], ["grunts", 26, 4], ["grunts", 30, 4], ["grunts", 38, 4], ["skirmishers", 16, 1], ["skirmishers", 22, 1], ["skirmishers", 28, 1]],
      [["grunts", 2, 4], ["grunts", 6, 4], ["grunts", 42, 4], ["skirmishers", 40, 1], ["skirmishers", 4, 1], ["troll", 20, 3]],
      [["grunts", 0, 2], ["grunts", 44, 2], ["troll", 26, 3], ["troll", 14, 3], ["skirmishers", 8, 0]],
      [["grunts", 0, 0], ["grunts", 12, 0], ["grunts", 44, 0], ["troll", 32, 3], ["troll", 24, 3], ["skirmishers", 32, 0]],
      [["troll", 4, 6], ["troll", 10, 6], ["troll", 16, 6], ["troll", 22, 6], ["troll", 28, 6], ["grunts", 36, 0]],
      [["troll", 34, 6], ["troll", 40, 6], ["troll", 44, 6], ["troll", 38, 2], ["troll", 46, 6]],
    ],
  },
  briefing: [
    { who: "archivist", text: "The river at Hob's Crossing runs right across the Field, and there's only one bridge. The goblins have put a toll on it!" },
    { who: "boss", text: "THE BRIDGE IS OURS NOW. SO IS THE TOLL. EXACT CHANGE ONLY." },
    { who: "sergeant", text: "One way across, and it's wide. Put Knights on our end of it and they'll have to come through them." },
    { who: "marshal", text: "Won't the Knights get worn down?" },
    { who: "sergeant", text: "They would. That's what Clerics are for. They stand behind the Knights and patch them up." },
    { who: "archivist", text: "Page 6! It's mostly hymns, but the healing is very well described." },
  ],
  page: {
    title: "Page 6: Clerics",
    text: "Clerics heal the units around them. They don't fight, so keep them behind the line.",
    note: "One bridge, so they all come the same way. Knights on it, Clerics behind. Ithiel has marked his favorite hymns.",
    diagram: [["knights", "knights"], ["cleric", "cleric"], ["crossbowmen", "crossbowmen"]],
  },
  objective: "Win the match.",
  roundLines: {
    2: { who: "boss", text: "TOLL'S GONE UP." },
    3: { who: "sergeant", text: "They'll keep coming over that bridge. Keep Knights on it, Clerics behind them, and get those Clerics praying faster." },
  },
  win: [
    { who: "sergeant", text: "Nobody crossed. That's the job." },
    { who: "archivist", text: "The toll is abolished! I kept a receipt." },
    { who: "marshal", text: "Did we pay it?" },
    { who: "sergeant", text: "No." },
    { who: "boss", text: "THE GROUND'S FULL ANYWAY. WE'LL USE THE SKY." },
  ],
  winNote: "Knights on the bridge, Clerics behind them. Nobody crosses. Ithiel kept a receipt for a toll we never paid.",
  hints: [
    { when: (c) => c.army.every((sq) => sq.round === 1), line: { who: "sergeant", text: "You stopped adding units after round 1. They kept coming over that bridge." } },
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "Nothing held the bridge, so they walked straight over it. Put Knights on it." } },
    {
      when: (c) => !fielded(c, "cleric"),
      line: { who: "archivist", text: "The Knights held the bridge until they wore out! Clerics behind them would have kept them standing." },
    },
    {
      when: (c) => !c.upgrades.cleric?.includes("constant_prayer"),
      line: { who: "archivist", text: "The Clerics couldn't keep up! One big prayer every five seconds, and the bridge never stops. Constant Prayer heals a little every second. It's on the Upgrades tab!" },
    },
    { line: { who: "sergeant", text: "Close. Add Knights on the bridge and Clerics behind them, every round, and Ballistae when the trolls come." } },
  ],
  commendation: { name: "Nobody Crosses", text: "Win every round.", earned: allRoundsWon },
  reference: {
    wins: [
      // Knights on the bridge, Clerics behind them, and Constant Prayer before the first battle
      [
        { squads: [["knights", 18, 20], ["knights", 26, 20], ["cleric", 20, 21], ["cleric", 26, 21], ["crossbowmen", 22, 23]], upgrades: [["cleric", "constant_prayer"]] },
        [["knights", 22, 20], ["knights", 14, 20]],
        [["knights", 30, 20], ["crossbowmen", 19, 23], ["crossbowmen", 26, 23], ["crossbowmen", 16, 22]],
        [["cleric", 17, 21], ["cleric", 30, 21], ["knights", 10, 20], ["knights", 34, 20]],
        [["ballista", 20, 24], ["ballista", 26, 24], ["knights", 18, 26], ["knights", 26, 26], ["cleric", 23, 22]],
      ],
      // Constant Prayer in round 2
      [
        [["knights", 18, 20], ["knights", 26, 20], ["cleric", 20, 21], ["cleric", 26, 21], ["crossbowmen", 19, 22], ["crossbowmen", 26, 22], ["crossbowmen", 22, 23]],
        { squads: [["knights", 22, 20]], upgrades: [["cleric", "constant_prayer"]] },
        [["knights", 14, 20], ["knights", 30, 20], ["crossbowmen", 16, 22]],
        [["cleric", 17, 21], ["cleric", 30, 21], ["knights", 10, 20], ["knights", 34, 20]],
        [["ballista", 20, 24], ["ballista", 26, 24], ["knights", 18, 26], ["knights", 26, 26], ["cleric", 23, 22]],
      ],
      // no Clerics, but Shield Wall keeps the Knights standing too
      [
        { squads: [["knights", 18, 20], ["knights", 26, 20], ["crossbowmen", 19, 22], ["crossbowmen", 26, 22], ["crossbowmen", 22, 23]], upgrades: [["knights", "shield_wall"]] },
        [["knights", 22, 20], ["crossbowmen", 11, 22], ["crossbowmen", 34, 22]],
        [["knights", 14, 20], ["knights", 30, 20], ["crossbowmen", 16, 24]],
        [["ballista", 14, 23], ["ballista", 29, 23], ["knights", 10, 20], ["knights", 34, 20]],
        [["ballista", 20, 24], ["ballista", 26, 24], ["knights", 18, 26], ["knights", 28, 26], ["crossbowmen", 24, 26]],
      ],
    ],
    loses: [
      // Clerics without Constant Prayer: one prayer every 5s can't keep up
      [
        [["knights", 18, 20], ["knights", 26, 20], ["cleric", 20, 21], ["cleric", 26, 21], ["crossbowmen", 19, 22], ["crossbowmen", 26, 22], ["crossbowmen", 22, 23]],
        [["knights", 22, 20], ["cleric", 23, 21], ["crossbowmen", 22, 24]],
        [["knights", 14, 20], ["knights", 30, 20], ["crossbowmen", 16, 22]],
        [["cleric", 17, 21], ["cleric", 30, 21], ["knights", 10, 20], ["knights", 34, 20]],
        [["ballista", 20, 24], ["ballista", 26, 24], ["knights", 18, 26], ["knights", 26, 26], ["cleric", 23, 22]],
      ],
      // no Clerics, and Repeaters (last mission's answer) instead
      [
        [["knights", 18, 20], ["knights", 26, 20], ["crossbowmen", 19, 22], ["crossbowmen", 26, 22], ["crossbowmen", 22, 23], ["crossbowmen", 15, 22], ["crossbowmen", 30, 22]],
        { squads: [["knights", 22, 20]], upgrades: [["crossbowmen", "repeaters"]] },
        [["knights", 14, 20], ["knights", 30, 20], ["crossbowmen", 16, 24]],
        [["ballista", 14, 23], ["ballista", 29, 23], ["knights", 10, 20], ["knights", 34, 20]],
        [["ballista", 20, 24], ["ballista", 26, 24], ["knights", 18, 26], ["knights", 28, 26], ["crossbowmen", 24, 26]],
      ],
      // no Clerics: Knights, Crossbowmen and Ballistae
      [
        [["knights", 18, 20], ["knights", 26, 20], ["crossbowmen", 19, 22], ["crossbowmen", 26, 22], ["crossbowmen", 22, 23], ["crossbowmen", 15, 22]],
        [["knights", 22, 20], ["crossbowmen", 30, 22], ["crossbowmen", 11, 22]],
        [["knights", 14, 20], ["knights", 30, 20], ["crossbowmen", 16, 24]],
        [["ballista", 14, 23], ["ballista", 29, 23], ["knights", 10, 20], ["knights", 34, 20]],
        [["ballista", 20, 24], ["ballista", 26, 24], ["knights", 18, 26], ["knights", 28, 26], ["crossbowmen", 24, 26]],
      ],
      // Ballistae instead of Clerics
      [
        [["knights", 18, 20], ["knights", 26, 20], ["ballista", 20, 22], ["ballista", 24, 22], ["ballista", 16, 22], ["ballista", 28, 22]],
        [["knights", 22, 24], ["ballista", 14, 23], ["ballista", 30, 23]],
        [["knights", 14, 20], ["knights", 30, 20], ["ballista", 22, 22]],
        [["ballista", 17, 24], ["ballista", 26, 24], ["knights", 10, 20], ["knights", 34, 20]],
        [["ballista", 20, 25], ["ballista", 32, 24], ["knights", 4, 20], ["knights", 40, 20], ["ballista", 6, 22]],
      ],
      // all Crossbowmen
      [
        [["crossbowmen", 10, 22], ["crossbowmen", 14, 22], ["crossbowmen", 18, 22], ["crossbowmen", 22, 22], ["crossbowmen", 26, 22], ["crossbowmen", 30, 22], ["crossbowmen", 34, 22], ["crossbowmen", 38, 22]],
        [["crossbowmen", 14, 24], ["crossbowmen", 18, 24], ["crossbowmen", 22, 24], ["crossbowmen", 26, 24]],
        [["crossbowmen", 30, 24], ["crossbowmen", 6, 22], ["crossbowmen", 42, 22], ["crossbowmen", 2, 22], ["crossbowmen", 18, 26]],
        [["crossbowmen", 22, 26], ["crossbowmen", 26, 26], ["crossbowmen", 30, 26], ["crossbowmen", 6, 24], ["crossbowmen", 38, 24], ["crossbowmen", 14, 26]],
      ],
      // never adds after round 1
      [
        [["knights", 18, 20], ["knights", 26, 20], ["cleric", 20, 21], ["cleric", 26, 21], ["crossbowmen", 19, 22], ["crossbowmen", 26, 22]],
      ],
    ],
    // Constant Prayer before the first battle
    commended: [
      { squads: [["knights", 18, 20], ["knights", 26, 20], ["cleric", 20, 21], ["cleric", 26, 21], ["crossbowmen", 22, 23]], upgrades: [["cleric", "constant_prayer"]] },
      [["knights", 22, 20], ["knights", 14, 20]],
      [["knights", 30, 20], ["crossbowmen", 19, 23], ["crossbowmen", 26, 23], ["crossbowmen", 16, 22]],
      [["cleric", 17, 21], ["cleric", 30, 21], ["knights", 10, 20], ["knights", 34, 20]],
      [["ballista", 20, 24], ["ballista", 26, 24], ["knights", 18, 26], ["knights", 26, 26], ["cleric", 23, 22]],
    ],
  },
};

// Mission 7: the air layer. In round 2 four squads of the Boss's Giant Bats, with Savage Claws, fly over the line and
// land on the bows; more bats come every round, and from round 4 his Skirmishers shoot at anything that flies. Tuned by
// simulation: Crossbowmen with Skyhunters win (bought on the Sergeant's warning or once the bats show), and so do
// Griffon Riders (from round 1, or once the bats show); plain bows (half damage to fliers), Clerics healing through
// it, steel alone and Ballistae (the bats land on them) lose. Without Savage Claws, Clerics heal through the bats.
const LOOK_UP: MissionDef = {
  id: "wardens-7",
  supply: 1000,
  units: ["knights", "crossbowmen", "ballista", "cleric", "griffon_riders"],
  hp: [240, 240],
  towers: true,
  upgrades: true,
  veterancy: false,
  map: "the-mire",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers", "troll", "giant_bats"],
    rounds: fitted([
      [["grunts", 6, 4], ["grunts", 14, 4], ["grunts", 30, 4], ["troll", 23, 3], ["troll", 38, 3], ["skirmishers", 10, 0], ["skirmishers", 22, 0]],
      { squads: [["giant_bats", 4, 2], ["giant_bats", 42, 2], ["giant_bats", 18, 1], ["giant_bats", 28, 1]], upgrades: { giant_bats: ["savage_claws"] } },
      [["giant_bats", 8, 4], ["giant_bats", 38, 4], ["giant_bats", 23, 3], ["grunts", 22, 4]],
      [["skirmishers", 4, 0], ["skirmishers", 40, 0], ["troll", 18, 3], ["giant_bats", 26, 1], ["giant_bats", 12, 1]],
      [["giant_bats", 16, 0], ["giant_bats", 30, 0], ["giant_bats", 6, 0], ["grunts", 2, 4], ["grunts", 42, 4], ["troll", 26, 5]],
      [["giant_bats", 12, 0], ["giant_bats", 34, 0], ["giant_bats", 23, 0], ["skirmishers", 10, 5], ["skirmishers", 34, 5], ["troll", 20, 5], ["troll", 24, 2]],
      [["giant_bats", 0, 0], ["giant_bats", 46, 0], ["giant_bats", 23, 0], ["grunts", 14, 2], ["grunts", 30, 2], ["troll", 10, 3], ["troll", 36, 3]],
    ]),
  },
  briefing: [
    { who: "archivist", text: "A point of law! The Compact draws the Field's borders on the ground and says nothing about the air above it. I've read that clause a hundred times and never once looked up." },
    { who: "boss", text: "YOU DREW A LINE ON THE GROUND. WE'RE GOING OVER IT. THAT'S NOT CHEATING, THAT'S READING." },
    { who: "archivist", text: "He's right!" },
    { who: "sergeant", text: "Bats. Big ones, with goblins on. They go over your Knights and come down on whoever's behind them. The Mire won't slow them down, either." },
    { who: "marshal", text: "What can hit them?" },
    { who: "archivist", text: "Page 7 has a list! Griffon Riders are on it. The griffon is described here as noble and gentle-natured." },
    { who: "sergeant", text: "They bite." },
  ],
  page: {
    title: "Page 7: Fliers",
    text: "Knights cannot hit what flies. Crossbowmen, Ballistae and Griffon Riders can.",
    note: "Griffons bite (Sgt.). Book says gentle-natured. Ithiel would like to check. Please don't let him check.",
    diagram: [["knights", "knights"], ["crossbowmen", "griffon_riders", "crossbowmen"]],
  },
  objective: "Win the match.",
  roundLines: {
    2: { who: "boss", text: "YOU MIGHT WANT TO LOOK UP." },
    3: { who: "archivist", text: "Giant Bats! Actual ones, and with Savage Claws! Did you see how they fold their wings before they land on the Crossbowmen? Volume Two gets that completely wrong!" },
    5: { who: "sergeant", text: "More Skirmishers, and they shoot fliers. Don't send your Griffon Riders in alone." },
  },
  win: [
    { who: "sergeant", text: "Sore neck, but everyone looked up. That'll do." },
    { who: "archivist", text: "It's ruled: the sky over the Field belongs to the Field. The bats have gone home. And griffons do bite." },
    { who: "marshal", text: "You checked?" },
    { who: "archivist", text: "I've amended the entry!" },
    { who: "boss", text: "FINE. I'M CALLING GRUMM." },
    { who: "sergeant", text: "...Grumm?" },
  ],
  winNote: "Griffons bite (confirmed, Ithiel, left hand). Crossbowmen do half damage to fliers until you buy Skyhunters.",
  hints: [
    { when: (c) => c.army.every((sq) => sq.round === 1), line: { who: "marshal", text: "I kept my supply for later, and there wasn't a later. Add units every round." } },
    { when: (c) => !c.army.some((sq) => sq.round > 1 && (sq.defId === "crossbowmen" || sq.defId === "griffon_riders")), line: { who: "sergeant", text: "Knights can't reach the bats, and the bats know it. Put Crossbowmen or Griffon Riders where they come down." } },
    { when: (c) => c.army.filter((sq) => sq.defId === "ballista").length > c.army.filter((sq) => sq.defId === "crossbowmen").length, line: { who: "sergeant", text: "Bats land on Ballistae. A Ballista can hit fliers, but it's slow about it. Crossbowmen behind your Knights do it faster." } },
    { line: { who: "archivist", text: "The bats went over the line and landed on the Crossbowmen! Crossbowmen do half damage to fliers unless you buy Skyhunters. It's on the Upgrades tab." } },
  ],
  commendation: { name: "Air Cover", text: "Win with Griffon Riders on the Field.", earned: (c) => fielded(c, "griffon_riders") },
  reference: {
    wins: [
      // Skyhunters once the bats have shown, and bows every round
      [
        [["knights", 14, 20], ["knights", 22, 20], ["knights", 30, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["knights", 6, 20], ["crossbowmen", 16, 24], ["crossbowmen", 28, 24]],
        { squads: [["crossbowmen", 10, 22], ["crossbowmen", 34, 22], ["crossbowmen", 22, 24]], upgrades: [["crossbowmen", "skyhunters"]] },
        [["knights", 38, 20], ["crossbowmen", 6, 22], ["crossbowmen", 38, 22], ["cleric", 22, 21], ["crossbowmen", 18, 26]],
        [["knights", 4, 21], ["knights", 42, 20], ["crossbowmen", 14, 26], ["crossbowmen", 30, 26], ["cleric", 26, 21]],
        { squads: [["crossbowmen", 2, 24], ["crossbowmen", 42, 24], ["crossbowmen", 26, 26], ["crossbowmen", 10, 26]], upgrades: [["knights", "shield_wall"]] },
        [["knights", 0, 22], ["knights", 44, 22], ["knights", 21, 26], ["crossbowmen", 4, 26], ["crossbowmen", 40, 26], ["crossbowmen", 37, 24]],
      ],
      // Skyhunters in round 2, on the Sergeant's warning
      [
        [["knights", 14, 20], ["knights", 22, 20], ["knights", 30, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        { squads: [["crossbowmen", 16, 24], ["crossbowmen", 28, 24]], upgrades: [["crossbowmen", "skyhunters"]] },
        [["knights", 6, 20], ["crossbowmen", 10, 22], ["crossbowmen", 34, 22], ["crossbowmen", 22, 24]],
        [["knights", 38, 20], ["crossbowmen", 6, 22], ["crossbowmen", 38, 22], ["cleric", 22, 21], ["crossbowmen", 18, 26]],
        [["knights", 4, 21], ["knights", 42, 20], ["crossbowmen", 14, 26], ["crossbowmen", 30, 26], ["cleric", 26, 21]],
        { squads: [["crossbowmen", 2, 24], ["crossbowmen", 42, 24], ["crossbowmen", 26, 26], ["crossbowmen", 10, 26]], upgrades: [["knights", "shield_wall"]] },
        [["knights", 0, 22], ["knights", 44, 22], ["knights", 21, 26], ["crossbowmen", 4, 26], ["crossbowmen", 40, 26], ["crossbowmen", 37, 24]],
      ],
      // Griffon Riders from round 1, with Sky Patrol
      [
        [["knights", 16, 20], ["knights", 26, 20], ["griffon_riders", 14, 23], ["griffon_riders", 28, 23], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        { squads: [["griffon_riders", 21, 24]], upgrades: [["griffon_riders", "sky_patrol"]] },
        [["griffon_riders", 8, 23], ["griffon_riders", 32, 23], ["crossbowmen", 12, 22]],
        [["knights", 6, 20], ["knights", 36, 20], ["griffon_riders", 40, 24]],
        [["griffon_riders", 4, 24], ["griffon_riders", 40, 22], ["knights", 2, 20], ["cleric", 26, 21]],
        [["knights", 42, 20], ["griffon_riders", 10, 25], ["griffon_riders", 30, 25], ["crossbowmen", 20, 26], ["crossbowmen", 24, 26]],
        [["knights", 0, 22], ["knights", 44, 22], ["griffon_riders", 16, 25], ["crossbowmen", 4, 26], ["crossbowmen", 40, 26], ["crossbowmen", 36, 26], ["crossbowmen", 7, 26]],
      ],
    ],
    loses: [
      // never adds after round 1
      [
        [["knights", 14, 20], ["knights", 22, 20], ["knights", 30, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
      ],
      // steel only after round 1
      [
        [["knights", 14, 20], ["knights", 22, 20], ["knights", 30, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["knights", 6, 20], ["knights", 38, 20]],
        [["knights", 2, 22], ["knights", 42, 22], ["crossbowmen", 22, 24]],
        [["knights", 18, 25], ["knights", 26, 25], ["knights", 10, 25]],
        [["knights", 34, 25], ["knights", 6, 26], ["knights", 38, 26], ["crossbowmen", 22, 26]],
        [["knights", 0, 24], ["knights", 44, 24], ["knights", 14, 26], ["knights", 30, 26]],
        [["knights", 2, 26], ["knights", 42, 26], ["knights", 20, 23], ["knights", 22, 25], ["crossbowmen", 8, 24]],
      ],
      // Ballistae for the fliers: the bats land on them
      [
        [["knights", 14, 20], ["knights", 22, 20], ["knights", 30, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["ballista", 17, 23], ["ballista", 28, 23], ["ballista", 14, 24], ["ballista", 32, 24]],
        [["knights", 6, 20], ["ballista", 21, 24], ["ballista", 25, 24], ["ballista", 9, 24]],
        { squads: [["knights", 38, 20], ["ballista", 4, 23], ["ballista", 40, 23]], upgrades: [["ballista", "heavy_bolts"]] },
        [["knights", 2, 22], ["knights", 42, 22], ["ballista", 17, 25], ["ballista", 27, 25], ["ballista", 34, 25]],
        [["ballista", 7, 25], ["ballista", 36, 25], ["ballista", 0, 25], ["ballista", 44, 25], ["knights", 20, 26], ["knights", 29, 26]],
        [["knights", 3, 26], ["knights", 38, 26], ["ballista", 12, 25], ["ballista", 23, 24], ["ballista", 30, 24], ["ballista", 42, 25]],
      ],
      // plain bows, no Skyhunters: half damage to fliers
      [
        [["knights", 14, 20], ["knights", 22, 20], ["knights", 30, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["crossbowmen", 16, 24], ["crossbowmen", 28, 24], ["crossbowmen", 22, 24], ["crossbowmen", 10, 22]],
        [["knights", 6, 20], ["crossbowmen", 34, 22], ["crossbowmen", 4, 22], ["crossbowmen", 40, 22]],
        [["knights", 38, 20], ["crossbowmen", 6, 24], ["crossbowmen", 38, 24], ["cleric", 22, 21], ["crossbowmen", 26, 26]],
        [["knights", 2, 21], ["knights", 43, 22], ["crossbowmen", 14, 26], ["cleric", 26, 21], ["crossbowmen", 10, 26], ["crossbowmen", 36, 26]],
        [["knights", 18, 25], ["knights", 26, 25], ["crossbowmen", 2, 24], ["crossbowmen", 42, 24], ["crossbowmen", 22, 26], ["crossbowmen", 6, 26]],
        [["knights", 0, 23], ["knights", 44, 23], ["knights", 10, 25], ["crossbowmen", 40, 26], ["crossbowmen", 34, 25], ["crossbowmen", 13, 24], ["crossbowmen", 31, 24]],
      ],
      // Clerics to heal through it, and plain bows
      [
        [["knights", 14, 20], ["knights", 22, 20], ["knights", 30, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
        [["cleric", 16, 21], ["cleric", 28, 21], ["crossbowmen", 16, 24], ["crossbowmen", 28, 24]],
        [["knights", 6, 20], ["crossbowmen", 10, 22], ["crossbowmen", 34, 22], ["cleric", 22, 21]],
        [["knights", 38, 20], ["crossbowmen", 6, 22], ["crossbowmen", 38, 22], ["cleric", 10, 21], ["cleric", 34, 21]],
        [["knights", 4, 21], ["knights", 42, 20], ["crossbowmen", 14, 26], ["crossbowmen", 30, 26], ["cleric", 26, 21]],
        [["knights", 2, 22], ["knights", 44, 22], ["crossbowmen", 2, 24], ["crossbowmen", 42, 24], ["crossbowmen", 26, 26], ["crossbowmen", 10, 26]],
        [["knights", 0, 25], ["knights", 44, 25], ["knights", 20, 26], ["crossbowmen", 4, 26], ["crossbowmen", 40, 26], ["crossbowmen", 37, 24]],
      ],
    ],
    // Griffon Riders once the bats have shown, then Sky Patrol
    commended: [
      [["knights", 14, 20], ["knights", 22, 20], ["knights", 30, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22]],
      [["griffon_riders", 14, 24], ["griffon_riders", 28, 24]],
      { squads: [["griffon_riders", 21, 25], ["crossbowmen", 6, 22]], upgrades: [["griffon_riders", "sky_patrol"]] },
      [["griffon_riders", 6, 24], ["griffon_riders", 38, 24], ["knights", 38, 20]],
      [["griffon_riders", 10, 25], ["griffon_riders", 32, 25], ["knights", 4, 20], ["cleric", 22, 21]],
      [["knights", 42, 20], ["griffon_riders", 0, 24], ["griffon_riders", 44, 24], ["crossbowmen", 18, 26], ["crossbowmen", 24, 26]],
      [["knights", 0, 22], ["knights", 44, 22], ["griffon_riders", 17, 24], ["crossbowmen", 4, 26], ["crossbowmen", 40, 26], ["crossbowmen", 36, 26], ["crossbowmen", 7, 26]],
    ],
  },
};

// Mission 8: veterancy and promotions. Old Grumm, a level-3 Ogre Brute with Warboss (he calls a grunt every 5 s),
// arrives in round 2 and walks off the Field alive unless pikes are already waiting for him; then wolves, trolls and
// more ogres. Pikemen are the page the Archivist revives. Tuned by simulation (a player who promotes every veteran
// first, then buys squads): Pikemen from round 1, and Knights and bows, win when their veterans are promoted; Knights
// and bows putting that supply into fresh squads instead lose, and so do Pikemen from round 2 without promotions.
const OLD_GRUMM: MissionDef = {
  id: "wardens-8",
  supply: 1100,
  units: ["knights", "crossbowmen", "ballista", "cleric", "griffon_riders", "pikemen"],
  hp: [300, 300],
  towers: true,
  upgrades: true,
  veterancy: true,
  map: "broken-hills",
  enemy: {
    name: "The Boss",
    units: ["grunts", "skirmishers", "wolf_riders", "troll", "ogre_brute"],
    upgrades: { ogre_brute: ["warboss"] },
    rounds: fitted([
      [["grunts", 14, 4], ["grunts", 30, 4], ["skirmishers", 22, 0], ["grunts", 22, 1], ["troll", 8, 3], ["troll", 38, 3], ["wolf_riders", 2, 1], ["grunts", 42, 1]],
      [["ogre_brute", 20, 1, false, 3], ["grunts", 16, 1]], // Old Grumm
      [["wolf_riders", 40, 3], ["wolf_riders", 8, 1], ["grunts", 26, 0], ["troll", 18, 0]],
      [["troll", 16, 0], ["troll", 30, 0], ["skirmishers", 34, 4], ["grunts", 2, 0], ["wolf_riders", 44, 2]],
      [["ogre_brute", 12, 4], ["wolf_riders", 44, 0], ["grunts", 38, 0], ["skirmishers", 6, 5], ["troll", 24, 4]],
      [["troll", 20, 5], ["troll", 26, 5], ["wolf_riders", 0, 5], ["wolf_riders", 46, 5], ["grunts", 12, 0], ["ogre_brute", 34, 0]],
      [["ogre_brute", 38, 5], ["ogre_brute", 10, 0], ["grunts", 30, 2], ["skirmishers", 18, 3], ["troll", 22, 0], ["wolf_riders", 2, 2]],
    ]),
  },
  briefing: [
    { who: "sergeant", text: "Thirty years ago, Grumm ate my helmet. I was nearly still in it. Nothing you can do about an ogre that size. Book says so." },
    { who: "boss", text: "GRUMM REMEMBERS YOUR SERGEANT. SAYS THE HELMET NEEDED SALT." },
    { who: "archivist", text: "Page 8 is entirely about large things! Dwarven Pikemen, with very long pikes. Nobody's opened it in two hundred years!" },
    { who: "sergeant", text: "...There's a page." },
    { who: "marshal", text: "Are you all right?" },
    { who: "sergeant", text: "Thirty years." },
    { who: "sergeant", text: "Right. Squads that live through a battle get better at this. A gold ▲ means one has a level waiting. Promote it for half its price. That part I do know." },
  ],
  page: {
    title: "Page 8: The Pike Line",
    text: "Dwarven Pikemen do extra damage to large units. Put them where large units walk.",
    note: "Sgt. asked me to read this page to him. Twice.",
    diagram: [["pikemen", "knights", "pikemen"], ["crossbowmen", "crossbowmen"]],
  },
  objective: "Win the match.",
  roundLines: {
    2: { who: "boss", text: "GRUMM'S WARMED UP." },
    3: { who: "sergeant", text: "That's him. Hasn't changed. Put your Pikemen where he's walking, and promote anything with a gold ▲." },
    4: { who: "archivist", text: "The entry says \"broad in the swing\"! That doesn't really cover it, does it?" },
    5: { who: "boss", text: "ONE GRUMM WAS A COURTESY." },
  },
  win: [
    { who: "sergeant", text: "Got my helmet back. It's been chewed." },
    { who: "archivist", text: "I've copied the pike page out fresh, since the old ink had faded. It only says \"large,\" though. What was he actually like, up close?" },
    { who: "sergeant", text: "Give me that page. I'll tell you what's wrong with it." },
    { who: "marshal", text: "You're going to read it?" },
    { who: "sergeant", text: "Just that page." },
    { who: "boss", text: "RIGHT. THE WHOLE BORDER. EVERYTHING WE'VE GOT, ALL AT ONCE. COUNT THEM IF YOU CAN." },
  ],
  winNote: "Grumm's swing takes two or three at once (Sgt., dictating to Ithiel). Sgt. checked the page afterward. He's reading it.",
  hints: [
    { when: (c) => c.army.every((sq) => sq.round === 1), line: { who: "sergeant", text: "You stopped adding units after round 1. Grumm didn't stop." } },
    { when: (c) => c.army.every((sq) => (sq.level ?? 1) === 1), line: { who: "sergeant", text: "You had veterans waiting and never promoted one. When you see a gold ▲, promote it. Half a squad's price buys a whole squad's worth." } },
    { line: { who: "sergeant", text: "Grumm walked through us. Keep promoting, put your Pikemen where he walks, and keep Crossbowmen behind them to finish him." } },
  ],
  commendation: {
    name: "Page Eight",
    text: "Win with a promoted squad of Dwarven Pikemen on the Field.",
    earned: (c) => c.army.some((sq) => sq.defId === "pikemen" && (sq.level ?? 1) > 1),
  },
  reference: {
    wins: [
      // pikes from round 1, on the Archivist's word, and every veteran promoted
      [
        [["pikemen", 10, 20], ["pikemen", 22, 20], ["pikemen", 34, 20], ["knights", 16, 20], ["knights", 28, 20], ["cleric", 22, 23]],
        { squads: [["crossbowmen", 13, 22]], promote: true },
        { squads: [["pikemen", 40, 20]], promote: true },
        { squads: [["crossbowmen", 37, 23]], upgrades: [["pikemen", "pike_wall"]], promote: true },
      ],
      // the old way: Knights and bows, and every veteran promoted
      [
        [["knights", 16, 20], ["knights", 22, 20], ["knights", 28, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22], ["cleric", 22, 23]],
        { squads: [["knights", 10, 20], ["crossbowmen", 10, 22]], promote: true },
        { promote: true },
        { squads: [["knights", 4, 20], ["knights", 40, 20]], upgrades: [["crossbowmen", "repeaters"]], promote: true },
        { squads: [["crossbowmen", 14, 25], ["crossbowmen", 28, 25]], promote: true },
      ],
    ],
    loses: [
      // never adds after round 1
      [
        [["knights", 16, 20], ["knights", 22, 20], ["knights", 28, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22], ["cleric", 22, 23]],
      ],
      // the old way, but fresh squads instead of promotions
      [
        [["knights", 16, 20], ["knights", 22, 20], ["knights", 28, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22], ["cleric", 22, 23]],
        [["knights", 10, 20], ["knights", 34, 20]],
        [["crossbowmen", 10, 22], ["crossbowmen", 37, 23], ["crossbowmen", 6, 22], ["knights", 4, 20]],
        { squads: [["knights", 4, 21], ["knights", 40, 20]], upgrades: [["crossbowmen", "repeaters"]] },
        [["crossbowmen", 14, 25], ["crossbowmen", 28, 25], ["crossbowmen", 2, 23], ["crossbowmen", 42, 23], ["knights", 20, 25]],
        [["knights", 4, 25], ["knights", 38, 25], ["crossbowmen", 22, 26], ["crossbowmen", 10, 26], ["crossbowmen", 34, 26], ["crossbowmen", 16, 26]],
      ],
      // pikes from round 2, and fresh squads instead of promotions
      [
        [["knights", 16, 20], ["knights", 22, 20], ["knights", 28, 20], ["crossbowmen", 13, 22], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22], ["crossbowmen", 31, 22], ["cleric", 22, 23]],
        [["pikemen", 8, 20], ["pikemen", 34, 20]],
        [["pikemen", 40, 20], ["pikemen", 4, 20], ["crossbowmen", 10, 22]],
        { squads: [["crossbowmen", 37, 23], ["crossbowmen", 6, 24], ["pikemen", 16, 24]], upgrades: [["pikemen", "pike_wall"]] },
        [["pikemen", 2, 24], ["pikemen", 40, 24], ["crossbowmen", 13, 25], ["crossbowmen", 28, 25], ["crossbowmen", 20, 26]],
        [["knights", 9, 25], ["pikemen", 20, 24], ["crossbowmen", 34, 25], ["crossbowmen", 0, 26], ["pikemen", 0, 22]],
      ],
    ],
    // pikes from round 1, promoted: the pike squads reach level 3
    commended: [
      [["pikemen", 10, 20], ["pikemen", 22, 20], ["pikemen", 34, 20], ["knights", 16, 20], ["knights", 28, 20], ["cleric", 22, 23]],
      { squads: [["crossbowmen", 13, 22]], promote: true },
      { squads: [["pikemen", 40, 20]], promote: true },
      { squads: [["crossbowmen", 37, 23]], upgrades: [["pikemen", "pike_wall"]], promote: true },
    ],
  },
};

// Mission 9: the full Compact, with every Warden unit and the Giant. The Boss throws his biggest goblins at the line; once he has
// lost twice, the Tinker takes over with tempo: a bat swarm, a raid on both Keeps, Skirmishers that never touch the
// pikes. Scripted, not the AI, so the story beats land and the tests can fight it; each wave is fitted around the
// goblins already on the Field (`fit`), and the last wave repeats until the match ends.
const BOSS_WAVES: SquadSpec[][] = [
  [["troll", 22, 3], ["grunts", 14, 4], ["grunts", 30, 4], ["wolf_riders", 6, 3], ["troll", 34, 3], ["grunts", 40, 4], ["wolf_riders", 42, 1], ["ogre_brute", 18, 0]],
  [["ogre_brute", 22, 0], ["troll", 14, 1], ["grunts", 34, 1]],
  [["wolf_riders", 40, 3], ["wolf_riders", 4, 0], ["troll", 28, 1], ["grunts", 16, 0]],
  [["ogre_brute", 12, 4], ["wolf_riders", 34, 4], ["grunts", 22, 5], ["wolf_riders", 40, 3], ["wolf_riders", 4, 3]],
  [["troll", 18, 5], ["wolf_riders", 28, 5], ["ogre_brute", 22, 0], ["grunts", 2, 5], ["wolf_riders", 44, 2], ["wolf_riders", 0, 2]],
];
const TINKER_WAVES: EnemyTurn[] = [
  {
    squads: [["giant_bats", 8, 0], ["giant_bats", 38, 0], ["giant_bats", 22, 0], ["giant_bats", 14, 0]],
    upgrades: { giant_bats: ["shriek"] },
    line: { who: "tinker", text: "My turn! Bats, with Shriek. I checked your army first, so you're going to hate this." },
  },
  {
    squads: [["wolf_riders", 2, 3], ["wolf_riders", 44, 3], ["skirmishers", 14, 0], ["skirmishers", 30, 0]],
    upgrades: { wolf_riders: ["tower_raiders"] },
    line: { who: "tinker", text: "Tower Raiders, on both flanks. You'd have answered one raid, so I sent two." },
  },
  {
    squads: [["giant_bats", 14, 0], ["giant_bats", 30, 0], ["skirmishers", 6, 5], ["skirmishers", 38, 5], ["skirmishers", 22, 5]],
    upgrades: { skirmishers: ["ambush"] },
    line: { who: "boss", text: "NO. MORE." },
  },
  {
    squads: [["giant_bats", 4, 0], ["giant_bats", 42, 0], ["wolf_riders", 10, 3], ["wolf_riders", 36, 3], ["skirmishers", 22, 5]],
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

// Tuned by simulation (a player who promotes every veteran first, then buys squads): the pike line wins, with or
// without Keep levels, and so do Knights and Crossbowmen alone; never adding, all bows, a Ballista park and the pike
// line without promotions lose. All bows loses to the Boss three times, so the Tinker never comes; the wolves in the
// Boss's fourth and fifth waves only meet plans like that.
const THE_MARCHES: MissionDef = {
  id: "wardens-9",
  supply: 1200,
  units: ["knights", "crossbowmen", "ballista", "griffon_riders", "cleric", "pikemen", "giant"],
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
    { who: "archivist", text: "The season final! The Boss has staked the whole border, from the Toll Bridge to the hills. I've brought a hat." },
    { who: "boss", text: "EVERYTHING. ALL OF IT. AND THE GOAT." },
    { who: "marshal", text: "Full Compact rules, page 9. Nobody sees the other army before the horn. I've read it three times." },
    { who: "sergeant", text: "Page 3. If a Keep falls, the whole army is Dazed. I looked it up." },
    { who: "archivist", text: "You looked it up?" },
    { who: "sergeant", text: "Griffons?" },
    { who: "archivist", text: "Bite. I can show you the hand." },
    { who: "tinker", text: "If the Boss loses twice, it's my turn. I've watched what you field all season, so I know exactly which upgrades I want." },
    { who: "archivist", text: "A Giant from the hills has offered to hire on, and the book doesn't cover that!" },
    { who: "sergeant", text: "Book says hire anything that big." },
    { who: "archivist", text: "It absolutely does not!" },
    { who: "marshal", text: "Hire it if we need it. We'll write it in." },
  ],
  page: {
    title: "Page 9: The Full Compact",
    text: "Every commander chooses, every commander places, and no one sees the other's army before the horn.",
    note: "Knights in front, Crossbowmen behind. Watch the sky and the Keeps. Promote. I think I can do this. There's a blank page at the back.",
    diagram: [["pikemen", "knights", "pikemen"], ["crossbowmen", "ballista", "crossbowmen"]],
  },
  objective: "Win the season final.",
  roundLines: {
    2: { who: "archivist", text: "The histories never mention the noise!" },
  },
  win: [
    { who: "tinker", text: "Your wheelbarrow's outside. It has two wheels now. You're welcome." },
    { who: "sergeant", text: "It's better." },
    { who: "archivist", text: "It isn't in the book!" },
    { who: "marshal", text: "It could be." },
    { who: "sergeant", text: "Boring wins. Book says so." },
    { who: "archivist", text: "It doesn't, as I've told you every... oh. Oh! Page 10! In ink!" },
    { who: "marshal", text: "It kept coming up." },
    { who: "sergeant", text: "Told you it was in there." },
    { who: "boss", text: "...SAME TIME NEXT SEASON?" },
  ],
  lastPage: { title: "Page 10, in the Marshal's hand, in ink", handwritten: "Boring wins.", text: "What we fielded at the Marches, and what held." },
  hints: [
    { when: (c) => c.army.every((sq) => sq.round === 1), line: { who: "marshal", text: "We stopped adding after round 1. I know better than that." } },
    { when: (c) => !c.army.some((sq) => ["knights", "pikemen"].includes(sq.defId)), line: { who: "sergeant", text: "Nothing in front of your Crossbowmen. The Boss sent his biggest units, and they walked straight in. Put Knights or Pikemen in front." } },
    { when: (c) => !c.army.some((sq) => ["crossbowmen", "griffon_riders"].includes(sq.defId)), line: { who: "archivist", text: "The Tinker's bats came over the line, and nothing of ours could reach them! Crossbowmen and Griffon Riders can." } },
    { when: keepFell, line: { who: "sergeant", text: "The Tinker hit both Keeps at once, and the whole army was Dazed. Put Knights beside the Keeps, or buy a level on each, before it comes." } },
    { line: { who: "marshal", text: "All right. Knights in front, Crossbowmen behind, watch the sky, guard the Keeps, promote the veterans. Again." } },
  ],
  commendation: {
    name: "Boring Wins",
    text: "Win the final with only Knights and Crossbowmen.",
    earned: (c) => c.army.length > 0 && c.army.every((sq) => sq.defId === "knights" || sq.defId === "crossbowmen"),
  },
  reference: {
    wins: [
      // the pike line: pikes in front, bows behind, Skyhunters when the Tinker comes, Pike Wall, promotions
      [
        [["pikemen", 8, 21], ["pikemen", 18, 21], ["pikemen", 28, 21], ["pikemen", 38, 21], ["crossbowmen", 14, 23], ["crossbowmen", 24, 23], ["crossbowmen", 34, 22], ["crossbowmen", 4, 23]],
        { squads: [["crossbowmen", 19, 23], ["crossbowmen", 29, 23]], promote: true },
        { upgrades: [["crossbowmen", "skyhunters"]], promote: true },
        { squads: [["pikemen", 3, 21], ["crossbowmen", 14, 25]], upgrades: [["pikemen", "pike_wall"]], promote: true },
        { squads: [["crossbowmen", 17, 25], ["crossbowmen", 38, 25], ["crossbowmen", 6, 25]], promote: true },
      ],
      // the pike line, with a level on each Keep before the Tinker's raid
      [
        [["pikemen", 8, 21], ["pikemen", 18, 21], ["pikemen", 28, 21], ["pikemen", 38, 21], ["crossbowmen", 14, 23], ["crossbowmen", 24, 23], ["crossbowmen", 34, 22], ["crossbowmen", 4, 23]],
        { squads: [["crossbowmen", 19, 23], ["crossbowmen", 29, 23]], promote: true },
        { squads: [["pikemen", 13, 21]], promote: true },
        { squads: [["pikemen", 3, 21]], upgrades: [["pikemen", "pike_wall"]], promote: true },
        { squads: [["crossbowmen", 16, 25], ["crossbowmen", 38, 25], ["crossbowmen", 6, 25], ["pikemen", 23, 25]], promote: true },
        { squads: [["pikemen", 0, 23]], upgrades: [["crossbowmen", "repeaters"]], promote: true },
      ],
    ],
    loses: [
      // never adds after round 1
      [
        [["pikemen", 8, 21], ["pikemen", 18, 21], ["pikemen", 28, 21], ["pikemen", 38, 21], ["crossbowmen", 14, 23], ["crossbowmen", 24, 23], ["crossbowmen", 34, 22], ["crossbowmen", 4, 23]],
      ],
      // all bows
      [
        [["crossbowmen", 4, 23], ["crossbowmen", 8, 23], ["crossbowmen", 13, 23], ["crossbowmen", 16, 23], ["crossbowmen", 20, 23], ["crossbowmen", 24, 23], ["crossbowmen", 28, 23], ["crossbowmen", 32, 23], ["crossbowmen", 37, 23], ["crossbowmen", 40, 23], ["crossbowmen", 44, 23], ["crossbowmen", 0, 23]],
        [["crossbowmen", 14, 25], ["crossbowmen", 30, 25], ["crossbowmen", 10, 25], ["crossbowmen", 34, 25]],
        [["crossbowmen", 6, 25], ["crossbowmen", 38, 25], ["crossbowmen", 2, 25], ["crossbowmen", 42, 25], ["crossbowmen", 20, 25]],
        { squads: [["crossbowmen", 24, 26], ["crossbowmen", 17, 26], ["crossbowmen", 27, 26], ["crossbowmen", 6, 26]], upgrades: [["crossbowmen", "repeaters"]] },
        [["crossbowmen", 38, 26], ["crossbowmen", 2, 26], ["crossbowmen", 42, 26], ["crossbowmen", 14, 26], ["crossbowmen", 30, 26], ["crossbowmen", 10, 26], ["crossbowmen", 34, 26]],
      ],
      // a Ballista park
      [
        [["ballista", 4, 22], ["ballista", 8, 22], ["ballista", 13, 22], ["ballista", 16, 22], ["ballista", 20, 22], ["ballista", 24, 22], ["ballista", 28, 22], ["ballista", 32, 22], ["ballista", 37, 22], ["ballista", 40, 22], ["knights", 18, 20]],
        [["ballista", 26, 24], ["ballista", 30, 24], ["ballista", 8, 24], ["ballista", 33, 24]],
        { squads: [["ballista", 6, 24], ["ballista", 38, 24], ["ballista", 2, 24]], upgrades: [["ballista", "heavy_bolts"]] },
      ],
      // the pike line, but fresh squads instead of promotions
      [
        [["pikemen", 8, 21], ["pikemen", 18, 21], ["pikemen", 28, 21], ["pikemen", 38, 21], ["crossbowmen", 14, 23], ["crossbowmen", 24, 23], ["crossbowmen", 34, 22], ["crossbowmen", 4, 23]],
        [["crossbowmen", 19, 23], ["crossbowmen", 29, 23], ["pikemen", 13, 21]],
        { squads: [["crossbowmen", 30, 25], ["pikemen", 13, 24]], upgrades: [["crossbowmen", "skyhunters"]] },
        { squads: [["pikemen", 3, 21], ["pikemen", 43, 21]], upgrades: [["pikemen", "pike_wall"]] },
        [["crossbowmen", 17, 25], ["crossbowmen", 38, 25], ["crossbowmen", 6, 25], ["pikemen", 23, 25]],
        { squads: [["pikemen", 0, 23], ["pikemen", 44, 23], ["crossbowmen", 2, 25], ["crossbowmen", 43, 25]], upgrades: [["crossbowmen", "repeaters"]] },
        [["pikemen", 9, 25], ["pikemen", 34, 25], ["crossbowmen", 20, 26], ["crossbowmen", 27, 26]],
        [["knights", 22, 24], ["knights", 30, 26], ["crossbowmen", 17, 26], ["crossbowmen", 30, 24]],
      ],
    ],
    // Knights and Crossbowmen, and nothing else
    commended: [
      [["knights", 8, 20], ["knights", 18, 20], ["knights", 28, 20], ["knights", 38, 20], ["crossbowmen", 14, 22], ["crossbowmen", 24, 22], ["crossbowmen", 34, 22], ["crossbowmen", 4, 22]],
      { squads: [["crossbowmen", 19, 22]], promote: true },
      { squads: [["knights", 3, 20], ["crossbowmen", 9, 22]], promote: true },
      { squads: [["knights", 23, 24], ["crossbowmen", 14, 24]], upgrades: [["crossbowmen", "skyhunters"]], promote: true },
      { squads: [["knights", 0, 22], ["knights", 44, 22]], promote: true },
      { squads: [["knights", 18, 25], ["knights", 26, 25]], upgrades: [["knights", "shield_wall"]], promote: true },
      { squads: [["knights", 8, 25], ["knights", 36, 25], ["crossbowmen", 13, 26]], promote: true },
    ],
  },
};

export const CAMPAIGNS: CampaignInfo[] = [
  {
    id: "wardens",
    faction: "warden",
    title: "The Drill Book",
    tagline: "A nervous new Marshal, a sergeant who has never read the book, and an archivist who has never left it.",
    missions: [
      { title: "Hands Off", teaser: "A goat has wandered across the border at Millbrook. Settle it on the Field.", play: HANDS_OFF },
      { title: "The Appeal", teaser: "The goblins appeal the goat. Under the Compact, an appeal is a longer match.", play: THE_APPEAL },
      { title: "Two Keeps", teaser: "Someone has painted something rude on the West Keep.", play: TWO_KEEPS },
      { title: "The Troll", teaser: "The goblins have got hold of a troll. Several, in fact.", play: THE_TROLL },
      { title: "The Wheelbarrow", teaser: "A goblin Tinker accuses the Wardens of stealing the wheelbarrow.", play: THE_WHEELBARROW },
      { title: "Under the Bridge", teaser: "The goblins have put a toll on the bridge at Hob's Crossing.", play: UNDER_THE_BRIDGE },
      { title: "Look Up", teaser: "The Compact draws borders on the ground. The goblins have noticed.", play: LOOK_UP },
      { title: "Old Grumm", teaser: "Thirty years ago, an ogre ate the Sergeant's helmet.", play: OLD_GRUMM },
      { title: "The Marches", teaser: "The season final. The Boss stakes the whole border.", play: THE_MARCHES },
    ],
  },
  {
    id: "goblins",
    faction: "goblin",
    title: "The Tinker's Notebook", // working title
    tagline: '"They had pointy sticks and we had nothing. So I made a bigger thing."',
    missions: [],
  },
  {
    id: "elementals",
    faction: "elemental",
    title: "We Burn",
    tagline: '"We\'re not being rude. We\'re standing over here so you don\'t catch fire."',
    missions: [],
  },
];

// Every playable mission, with where it sits: its campaign and its number in it.
export const MISSIONS = CAMPAIGNS.flatMap((c) =>
  c.missions.flatMap((m, i) => (m.play ? [{ campaign: c, number: i + 1, title: m.title, def: m.play }] : [])),
);
export type MissionEntry = (typeof MISSIONS)[number];
