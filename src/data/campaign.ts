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
    { who: "archivist", text: "There's a troll under the toll bridge at Hob's Crossing, and it's been there longer than the bridge! I have three volumes on trolls. I can't wait to see if they got the knees right." },
    { who: "sergeant", text: "Knees are the last thing you'll notice. They go through Knights like a boot through a hedge. Every blow in a row lands harder, and they heal while they fight." },
    { who: "boss", text: "THE TROLL WORKS FOR US NOW. SO DOES THE TOLL. EXACT CHANGE ONLY." },
    { who: "marshal", text: "What do we do about a troll?" },
    { who: "sergeant", text: "Ballista. Big, slow, and goes for the biggest thing it can see. Put Knights in front, or a mob will wreck it. Book says so." },
    { who: "archivist", text: "It actually does, for once! Page 4! How did you know?" },
    { who: "sergeant", text: "Stood in front of one once. River's deep on both sides of the bridge, too, so the short way across is the middle." },
  ],
  page: {
    title: "Page 4: Unlocks",
    text: "Some units must be unlocked in the shop. Each unlock costs supply once per match, and after that you buy squads as usual. Ballistae need Knights in front of them.",
    note: "Sgt. and the book agree. Marking the date.",
    diagram: [["knights", "knights"], ["ballista", "crossbowmen", "ballista"]],
  },
  objective: "Win the match.",
  roundLines: {
    2: { who: "boss", text: "TOLL'S GONE UP." },
    3: { who: "archivist", text: "An actual troll! Volume One has the knees completely wrong! Oh, and it's healing. It's still healing. Look at that!" },
  },
  win: [
    { who: "sergeant", text: "Big, slow, and it worked. That's what I like in a plan." },
    { who: "archivist", text: "The troll has gone back under the bridge, and it's agreed to charge the goblins as well. Also, I've drawn the correct knees." },
    { who: "marshal", text: "Is that going in the book?" },
    { who: "archivist", text: "It had better be!" },
    { who: "boss", text: "YOU WANT TO PLAY CLEVER? MEET THE TINKER." },
  ],
  winNote: "Trolls get worse the longer they keep hitting something (Sgt.). For knees, see Ithiel's drawing.",
  hints: [
    { when: (c) => c.army.every((sq) => sq.round === 1), line: { who: "archivist", text: "You finished with supply unspent, and the goblins kept adding units. I've checked, and unspent supply has never won a battle. Not once in four hundred years of records!" } },
    { when: (c) => !fielded(c, "knights"), line: { who: "sergeant", text: "The mob got to your Crossbowmen with no Knights in the way. Buy some Knights." } },
    { when: (c) => !fielded(c, "ballista"), line: { who: "sergeant", text: "Knights against trolls is a fair fight, and they brought more trolls. Unlock the Ballista in the shop. It goes for the biggest thing on the Field." } },
    { when: (c) => c.army.filter((sq) => sq.defId === "knights").length < 2, line: { who: "sergeant", text: "Your Ballistae had nothing in front of them, and a mob that reaches a Ballista wrecks it. Knights in front, Ballistae behind." } },
    { line: { who: "sergeant", text: "The trolls still got through. Add Ballistae every round, behind your Knights, and leave the trolls to them." } },
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

// Mission 5: upgrades. The Tinker arrives with upgrades: in round 2 every Grunt on the Field, including those already
// placed, gets Scrap Armor (each goblin shrugs off its first hit), and in round 3 the trolls get Thick Blood. The
// counter is an upgrade of your own: Repeaters (many small bolts) reaches every Crossbowman. Tuned by simulation: any
// plan with Repeaters wins, whenever it's bought; the same supply spent on more squads loses, and so does the wrong
// upgrade (Knights' Veterans). Two Clerics behind the line after Repeaters win too (docs/CAMPAIGN.md §10).
const THE_WHEELBARROW: MissionDef = {
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
    1: { who: "sergeant", text: "Shop's got a Cleric now. Stands behind the Knights, patches them up, and they hit harder for it." },
    2: { who: "tinker", text: "Just a small change this round! You'll notice!" },
    3: { who: "archivist", text: "That star is Scrap Armor. It stops one hit per Grunt! So one big hit is wasted, but lots of small hits... oh, what a lovely problem!" },
    4: { who: "tinker", text: "Thick Blood on the trolls! I considered something flashier, but it wouldn't have been as annoying." },
  },
  win: [
    { who: "sergeant", text: "Repeaters. Forty years, I thought they just turned up like that some seasons." },
    { who: "tinker", text: "You picked the right upgrade! Most people don't look. Can I see one up close?" },
    { who: "archivist", text: "The wheelbarrow stays with us. The Tinker has asked to borrow it." },
    { who: "marshal", text: "Should we let them?" },
    { who: "sergeant", text: "It's a wheelbarrow." },
    { who: "boss", text: "THE GROUND'S FULL ANYWAY. WE'LL USE THE SKY." },
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
      // no upgrades: the same supply on more Crossbowmen
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        [["crossbowmen", 14, 22], ["crossbowmen", 30, 22], ["crossbowmen", 22, 24], ["crossbowmen", 18, 24], ["crossbowmen", 26, 24]],
        [["knights", 10, 20], ["knights", 34, 20], ["crossbowmen", 17, 26], ["crossbowmen", 27, 26]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 31, 24], ["crossbowmen", 14, 25], ["crossbowmen", 6, 22]],
      ],
      // no upgrades: Ballistae instead
      [
        [["knights", 22, 20], ["crossbowmen", 19, 22], ["crossbowmen", 25, 22]],
        [["knights", 16, 20], ["knights", 28, 20]],
        [["ballista", 17, 22], ["ballista", 28, 22], ["crossbowmen", 14, 22], ["crossbowmen", 30, 22]],
        [["knights", 10, 20], ["knights", 34, 20], ["ballista", 22, 24], ["ballista", 26, 24]],
        [["knights", 4, 20], ["knights", 40, 20], ["crossbowmen", 16, 25], ["crossbowmen", 30, 25], ["ballista", 19, 24]],
      ],
      // the wrong upgrade: Knights' Veterans against armored mobs
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
    { who: "archivist", text: "A point of law! The Compact draws the Field's borders on the ground and says nothing about the air above it. I've read that clause a hundred times and never once looked up." },
    { who: "boss", text: "YOU DREW A LINE ON THE GROUND. WE'RE GOING OVER IT. THAT'S NOT CHEATING, THAT'S READING." },
    { who: "archivist", text: "He's right!" },
    { who: "sergeant", text: "Bats. Big ones, with goblins on. They go over your Knights and come down on whoever's behind them. The Mire won't slow them down, either." },
    { who: "marshal", text: "What can hit them?" },
    { who: "archivist", text: "Page 6 has a list! Griffon Riders are on it. The griffon is described here as noble and gentle-natured." },
    { who: "sergeant", text: "They bite." },
  ],
  page: {
    title: "Page 6: Fliers",
    text: "Knights cannot hit what flies. Crossbowmen, Ballistae and Griffon Riders can.",
    note: "Griffons bite (Sgt.). Book says gentle-natured. Ithiel would like to check. Please don't let him check.",
    diagram: [["knights", "knights"], ["crossbowmen", "griffon_riders", "crossbowmen"]],
  },
  objective: "Win the match.",
  roundLines: {
    2: { who: "boss", text: "YOU MIGHT WANT TO LOOK UP." },
    3: { who: "archivist", text: "Giant Bats! Actual ones! Did you see how they fold their wings before they land on the Crossbowmen? Volume Two gets that completely wrong!" },
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
    { who: "sergeant", text: "Thirty years ago, Grumm ate my helmet. I was nearly still in it. Nothing you can do about an ogre that size. Book says so." },
    { who: "boss", text: "GRUMM REMEMBERS YOUR SERGEANT. SAYS THE HELMET NEEDED SALT." },
    { who: "archivist", text: "Page 7 is entirely about large things! Dwarven Pikemen, with very long pikes. Nobody's opened it in two hundred years!" },
    { who: "sergeant", text: "...There's a page." },
    { who: "marshal", text: "Are you all right?" },
    { who: "sergeant", text: "Thirty years." },
    { who: "sergeant", text: "Right. Squads that live through a battle get better at this. A gold ▲ means one has a level waiting. Promote it for half its price. That part I do know." },
  ],
  page: {
    title: "Page 7: The Pike Line",
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
    name: "Page Seven",
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
      // the old way: Knights and bows, a squad of each every round
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
    line: { who: "tinker", text: "My turn! Bats, with Shriek. I checked your army first, so you're going to hate this." },
  },
  {
    squads: [["wolf_riders", 2, 3], ["wolf_riders", 44, 3], ["skirmishers", 14, 0]],
    upgrades: { wolf_riders: ["tower_raiders"] },
    line: { who: "tinker", text: "Tower Raiders, on both flanks. You'd have answered one raid, so I sent two." },
  },
  {
    squads: [["giant_bats", 14, 0], ["giant_bats", 30, 0], ["skirmishers", 6, 5], ["skirmishers", 38, 5]],
    upgrades: { skirmishers: ["ambush"] },
    line: { who: "boss", text: "NO. MORE." },
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
    { who: "archivist", text: "The season final! The Boss has staked the whole border, from the Toll Bridge to the hills. I've brought a hat." },
    { who: "boss", text: "EVERYTHING. ALL OF IT. AND THE GOAT." },
    { who: "marshal", text: "Full Compact rules, page 8. Nobody sees the other army before the horn, and we choose an opening. I've read it three times." },
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
    title: "Page 8: The Full Compact",
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
    { who: "archivist", text: "It doesn't, as I've told you every... oh. Oh! Page 9! In ink!" },
    { who: "marshal", text: "It kept coming up." },
    { who: "sergeant", text: "Told you it was in there." },
    { who: "boss", text: "...SAME TIME NEXT SEASON?" },
  ],
  lastPage: { title: "Page 9, in the Marshal's hand, in ink", handwritten: "Boring wins.", text: "What we fielded at the Marches, and what held." },
  hints: [
    { when: (c) => c.army.every((sq) => sq.round === 1), line: { who: "marshal", text: "We stopped adding after round 1. I know better than that." } },
    { when: (c) => !c.army.some((sq) => ["knights", "pikemen"].includes(sq.defId)), line: { who: "sergeant", text: "Nothing in front of your Crossbowmen. The Boss sent his biggest units, and they walked straight in. Put Knights or Pikemen in front." } },
    { when: (c) => !c.army.some((sq) => ["crossbowmen", "griffon_riders"].includes(sq.defId)), line: { who: "archivist", text: "The Tinker's bats came over the line, and nothing of ours could reach them! Crossbowmen and Griffon Riders can." } },
    { when: keepFell, line: { who: "sergeant", text: "The Tinker hit both Keeps at once, and the whole army was Dazed. Put Knights beside the Keeps, or buy a level on each, before it comes." } },
    { line: { who: "marshal", text: "All right. Knights in front, Crossbowmen behind, watch the sky, guard the Keeps, promote the veterans. Again." } },
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
    tagline: "A nervous new Marshal, a sergeant who has never read the book, and an archivist who has never left it.",
    missions: [
      { title: "Hands Off", teaser: "A goat has wandered across the border at Millbrook. Settle it on the Field.", play: HANDS_OFF },
      { title: "The Appeal", teaser: "The goblins appeal the goat. Under the Compact, an appeal is a longer match.", play: THE_APPEAL },
      { title: "Two Keeps", teaser: "Someone has painted something rude on the West Keep.", play: TWO_KEEPS },
      { title: "Under the Bridge", teaser: "The goblins have adopted the troll under the toll bridge. And its toll.", play: UNDER_THE_BRIDGE },
      { title: "The Wheelbarrow", teaser: "A goblin Tinker accuses the Wardens of stealing the wheelbarrow.", play: THE_WHEELBARROW },
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
