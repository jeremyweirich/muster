# Recruits: mid-match unit unlock offers (spec)

Status: **specified, not built.** Owner's decision, 16 November 2026. This page is the brief for the implementing
session. The feature's working name is *Recruits*; it's used for the state field, the rules keys and the player-facing
heading, and is easy to rename in one pass.

## 1. What it is and why

Every few rounds of the main game mode (Play against the AI, and PvP), both players are offered the **same three
recruits**: a unit neither of them has unlocked, already unlocked and with a few squads placed for you, at a small
price. Or they skip the offer and take supply instead. The goal is dynamism and reactivity: a match's roster keeps
changing, a counter the player hadn't unlocked can arrive at a discount, and both players see the same options, so each
can guess what the other may field next round.

It's the **opening offer, repeated** (DESIGN.md §5 "Opening offer", `src/data/openings.ts`, `chooseOpening` in
`src/game/match.ts`): same shape in the state, the turn, the AI and the UI. When in doubt, do what the opening does.

## 2. Rules (owner's)

- **When:** rounds 4, 7, 10, 13… (`round > 1 && (round - 1) % RULES.recruitEvery === 0`, `recruitEvery = 3`).
- **Same for both:** the three options are a pure function of the match seed, the round, and what the two sides had
  unlocked when the round started. Both PvP browsers compute them; nothing is sent over the relay but the choice.
- **Three options, or skip** for supply worth about 80% of an option (`RULES.recruitSkip = 0.8`), like the war chest.
- **An option** is a unit unlock plus **X squads at level Y** of that unit, for **Z supply**. X ≥ 1, Y in 1..3
  (`RULES.recruitMaxLevel = 3`), 0 ≤ Z ≤ 200 (`RULES.recruitMaxPrice = 200`).
- **The unit is always one neither side has unlocked** at the start of the round (after both of last round's turns).
- **All three options are worth the same**, valued at the game's own prices:

  ```
  value(option) = unlockPrice(unit) + X × squadPrice(unit, Y) − Z
  squadPrice(unit, Y) = unit.cost + (Y − 1) × promotePrice(unit)      // promotePrice = cost / 2
  ```

  so a level-2 squad is worth 1.5 squads and a level-3 squad 2 squads, matching what a promotion costs.

## 3. Numbers (the open knobs; each is one value in `RULES`)

| Key | Proposed | Why |
| --- | --- | --- |
| `recruitEvery` | 3 | owner's "about every 3 rounds" |
| `recruitChoices` | 3 | owner's |
| `recruitValue(round)` | `floor(RULES.income(round) / 2 / 50) * 50` → 300 at round 4, 450 at 7, 600 at 10, 750 at 13 | scales with the economy; big enough to matter, never bigger than the round's income |
| `recruitSkip` | 0.8 | owner's "~80%"; the skip pays `round(recruitSkip × value / 50) × 50` → 250, 350, 500, 600 |
| `recruitMaxPrice` | 200 | owner's "Z shouldn't be larger than ~200" |
| `recruitMaxLevel` | 3 | level 4–5 squads from an offer would be absurd; 3 keeps the "a few veterans" flavor |

The value function is the knob to turn if offers feel too weak or too strong. Prices and promotions are all multiples
of 50, so with a value that's a multiple of 50 every Z lands on a multiple of 50 by itself.

### Worked examples (value 300, round 4)

| Unit (cost, unlock) | Valid (X, Y, Z) | Reads as |
| --- | --- | --- |
| Knights (200, 100) | (1, 1, 0), (1, 2, 100), (2, 1, 200) | "Knights, free" / "Knights Lv 2 · 100" / "2× Knights · 200" |
| Crossbowmen (100, 100) | (2, 1, 0), (3, 1, 100), (4, 1, 200), (2, 2, 100), (1, 3, 0), (3, 2, 200)… | "2× Crossbowmen, free" / "Crossbowmen Lv 3, free"… |
| Ogre Brute (300, 100) | (1, 1, 100) | "Ogre Brute · 100" |
| Toad Riders (200, 200) | (1, 1, 100), (1, 2, 200) | |
| Giant (400, 200) | none (Z would be 300) | not offered until value ≥ 400 (round 7) |
| Dragon (600, 200) | none | not offered until value ≥ 600 (round 10): the owner's "Dragons are late-game", for free |

A unit with no valid triple at this round's value simply isn't in the pool that round. If fewer than three units are
eligible, offer what there is; with none, there's no offer that round (no skip supply either).

### Picking

Its own `Rng` stream, so the opening packs and the map don't change: `new Rng((seed ^ 0x6a09e667 ^ (round * 2654435761)) >>> 0)`.
Draw three distinct eligible units, then for each one draw one of its valid triples at random. One refinement worth the
few lines: when a unit has several valid triples, prefer one whose shape (many cheap squads, one veteran, one plain squad)
differs from the options already drawn, so the three read differently. Don't tune beyond that.

## 4. Data model

```ts
// src/data/recruits.ts (new; sits beside openings.ts and imports DEFAULT_UNITS the same way)
export interface RecruitOption { unitId: string; count: number; level: number; price: number }  // X, Y, Z
export type RecruitChoice = number | "skip";                                                     // index into options
export interface RecruitOffer { round: number; options: RecruitOption[]; choice: [RecruitChoice | null, RecruitChoice | null] }

export function recruitRound(round: number): boolean;
export function recruitValue(round: number): number;              // from RULES
export function recruitSkipSupply(round: number): number;
export function recruitTriples(unit: UnitDef, value: number): RecruitOption[];   // every valid (X, Y, Z)
export function recruitOptions(seed: number, round: number, unlocked: [string[], string[]], units = DEFAULT_UNITS): RecruitOption[];
export function recruitLabel(o: RecruitOption, units: UnitDef[]): string;        // "2× Knights Lv 2" (like packLabel)
```

`MatchState` (`src/game/match.ts`) gains:

- `seed: number` — the match seed. `newMatch` already takes it and derives the map from it; it just isn't stored.
  `newMissionMatch` sets 1.
- `recruit?: RecruitOffer | null` — this round's offer, set by `nextRound` on a recruit round and cleared otherwise.
- `recruits?: boolean` — `false`: never offered (story missions by default, see §7); absent: offered. Same convention
  as `towers` and `veterancy`.

`Rules` (`src/sim/types.ts`, `src/data/rules.ts`) gains the six keys from §3.

`Turn` gains `recruit?: RecruitChoice` (a recruit round only), next to `opening`. `AiPlan` gains the same.

Recruited squads are `PlacedSquad`s with `free: true` and `level: Y` (xp absent), placed by `autoPlace(…, "center")`
with `new Rng(seed * 31 + side + round * 7)`, exactly like a pack's squads. `free` already means "not paid for in
`turnCost`, can't be sold" (`src/game/match.ts`, `PlayView.tsx` "From your opening: free"); widen its comment to "came
with an offer". They were placed this round, so they can be moved this round and are locked after, as any squad.

## 5. Flow

**`nextRound(state)`** — on a recruit round, computes the offer: `recruit = { round, options: recruitOptions(state.seed,
round, state.unlocked), choice: [null, null] }`; otherwise `recruit = null`. Skip when `state.recruits === false`.
Because it uses `state.unlocked` after both turns were applied, both PvP browsers and a restore from the log get the
same options.

**`chooseRecruit(state, side, choice, units)`** — the twin of `chooseOpening`: refuses if already chosen or the index
isn't offered or the side can't pay Z; otherwise records the choice, adds the unlock, subtracts Z (or adds the skip
supply), and appends the placed free squads to the army. The player's path.

**`applyTurn`** — if `turn.recruit !== undefined` and the side hasn't chosen: record the choice, unlock, and adjust supply
(the squads are in `turn.army`, flagged free, as with a pack). `turnCost` stays as is: free squads cost nothing and the
offer's unlock isn't in `turn.unlocks`. The AI's and the PvP friend's path.

**`turnFrom(start, now)`** (`src/game/pvp.ts`) — derives `recruit` from `start.recruit.choice[0] === null &&
now.recruit.choice[0] !== null`, and leaves the recruited unit out of `unlocks` (as `fromPack` does for the pack).

**`checkTurn`** — add: the free squads a turn adds in a recruit round must be exactly the chosen option's (unit, count,
level), and none in any other round. A warning, like the other checks.

**`restore`** — nothing to add: it replays `nextRound` and `applyTurn`, which now carry the offer and the choice.

**The player (PlayView)** — on a recruit round the offer must be answered before Fight, like the opening
(`openingPending` → add `recruitPending = match.recruit && match.recruit.choice[0] === null`; Fight says "Pick your
recruits first"). Choosing isn't undoable (neither is the opening). An unaffordable option is disabled with its price
shown; skip is always possible. Nothing else is blocked while the offer is open (buying and placing work), unlike
round 1, since supply already exists.

**The AI** (`planAiRound`, `src/game/ai.ts`) — before the search, on a recruit round (the offer is passed in
`PlanOptions.recruit`), pick one option at random among those it can afford, never skip (as with the opening: easier to
read, and ai-duel will tell if that's wrong), place its squads with `autoPlace` into `me.army` as free squads, deduct Z
from the supply the search may spend, and return the choice in `AiPlan.recruit` with the squads in `AiPlan.squads`.
The AI must not reason about recruits beyond that in this pass; its plan is applied with `applyTurn`, so its recruited
squads and unlock stay hidden until the battle, as everything it buys does (the "enemy as it stood last round" rule in
PlayView). Hard's parallel searches may pick different options; the best plan wins whole, which is fine.

**Spectate** — both sides are AIs, so nothing to do beyond the log: `TurnLog` adds a "Recruits" line (the choice's
label, or "skipped") next to "Opening".

**Scripts** — `scripts/playtest.ts`: show the offer in the status lines and add `recruit <0|1|2|skip>`; `npm run
playtest` is how the owner will try it from the command line first. `scripts/ai-duel-thread.ts` and
`src/game/missionRun.ts` need nothing if the choice travels in `AiPlan`: every AI path turns the plan into a `Turn` with
`planTurn` (`src/game/spectate.ts`, also used by PlayView) and applies it with `applyTurn`, so `planTurn` must copy
`recruit` across.

## 6. UI

- **Panel:** `RecruitOffer` in `src/ui/PlayPanels.tsx`, a copy of `OpeningOffer`'s structure and classes (`up-btn
  can-buy`, `up-btn-head`, `up-name`, `up-price`, `up-desc`): one button per option showing the unit's `Swatch`, "2×
  Knights" with "Lv 2" when Y > 1, "unlocks Knights", and the price ("free" when Z is 0, else "· 100"); then a Skip
  button "+250 supply". Heading: "Recruits: pick one (the enemy / your friend is offered the same)". A `CodexLink` to
  the entry below. Shown where the opening offer is shown, in both layouts (`PlayView.tsx` has two `OpeningOffer`
  sites: the desktop sidebar and the phone sheet; mirror both).
- **Held squad note:** "From your opening: free, so it can't be sold" becomes "Came free with an offer, so it can't be
  sold".
- **Enemy unlock strip note:** from the following round, beside the enemy's unlocks, "recruited 2× Knights Lv 2" (or
  "skipped the recruits"), the way `enemyOpening` says what it opened with. Only for the latest offer.
- **Battle report / tally:** nothing changes.
- **Codex:** a "Recruits" entry in `CodexView.tsx` (id `recruits`), plain words per CLAUDE.md: when it happens, that both
  sides see the same three, what an option contains, that the squads are free and can't be sold, what skipping pays. The
  Codex-links test needs the target to exist. Add a sentence to the Intro/How to play only if there's a natural slot;
  the Codex is enough.

## 7. Missions and the campaign

Off by default: `newMissionMatch` sets `recruits: false`. A future `MissionDef.recruits?: true` can turn it on for a
mission that teaches it (the Wardens campaign is built and its reference plans are the balance's integration tests;
don't change what they fight). The scripted enemy never takes an offer. `npm run mission -- all` must print the same
results as before the change.

## 8. Docs to update in the same commit

- `docs/DESIGN.md` §5: a "Recruits" subsection after "Opening offer", stating the rules above as decided, values open,
  and listing the `RULES` knobs. Mark this page as built.
- `CHANGELOG.md`: a line under the date (a new rule and feature).
- `docs/COPY.md`: regenerate (`npm run -s copy-doc > docs/COPY.md`) after the Codex entry and panel text exist.
- `docs/MULTIPLAYER.md`: one line under the turn format (the `recruit` field; both browsers compute the offer).
- `CLAUDE.md` "Where things stand": a line that recruits are built and where the knobs are.

## 9. Tests (`tests/`)

- `recruits.test.ts` (new):
  - every option of every offer, for a few hundred (seed, round, unlocked) draws, values to exactly `recruitValue(round)`,
    with X ≥ 1, 1 ≤ Y ≤ `recruitMaxLevel`, 0 ≤ Z ≤ `recruitMaxPrice`;
  - options never name a unit either side has unlocked, and the three units differ;
  - the same inputs give the same options (determinism), and different seeds usually differ;
  - Giant and Dragon never appear at round 4; Dragon appears for some seed at round 10;
  - `chooseRecruit` applies the unlock, the supply change and X free level-Y squads; refuses a second choice, an
    unaffordable option and an index not offered; skip pays `recruitSkipSupply(round)`;
  - `nextRound` sets the offer on rounds 4, 7, 10 and `null` elsewhere, and never when `recruits === false`.
- `pvp.test.ts`: a match that reaches round 4 where both seats choose (one takes an option, one skips); `turnFrom`
  carries the choice and no unlock for it; `restore` from the log rebuilds the same state on both seats; `checkTurn`
  flags a turn whose free squads don't match the choice.
- `spectate.test.ts`: a full AI-vs-AI match past round 4 runs and each AI's plan has a `recruit` on recruit rounds.
- `campaign.test.tsx`: unchanged, and must stay green (missions are off).
- `guide.test.tsx`: the new Codex id is a link target.

## 10. Verifying

1. `npm test`, `npm run build`, `npm run mission -- all` (unchanged results).
2. `npm run ai-duel -- snapshot` **before** starting, then `npm run ai-duel -- run` after: Hard's strength shouldn't
   drop; if the AI with recruits loses to its baseline, its pick rule is the first suspect.
3. `npm run playtest`: play to round 7 against Hard, taking one offer and skipping one; the report and the enemy note
   read right.
4. In the browser (CLAUDE.md "Verifying UI changes"): desktop and the phone layout (844 × 390), the offer on round 4, an
   unaffordable option disabled, Fight blocked until chosen, the free squads movable this round and locked after, the
   enemy's note next round. Then a PvP match between two tabs through `npm run relay`, choosing differently on each seat
   and reloading one tab mid-round to exercise `restore`.

## 11. Out of scope, on purpose

- The AI weighing which option counters the player (a later AI pass, judged with ai-duel).
- Per-unit availability rules (a `minRound` tag): the value function already keeps Giants and Dragons out of early
  offers; add a rule only if a unit turns out wrong in play.
- Offers in story missions, undo of a choice, and offers that include upgrades or towers.
