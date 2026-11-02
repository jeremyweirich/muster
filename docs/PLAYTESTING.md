# Playtesting against the AI: how to

The owner often asks for "a round of playtesting against Hard", with a goal (for example: what should the
independents do?). This is the recipe. Each round's findings go in their own `docs/PLAYTEST-YYYY-MM-DD.md`; the most
recent is `docs/PLAYTEST-2026-11-02.md`.

## Before you start

1. Pull (`git pull --rebase`). Read the latest playtest report's open issues and `docs/BALANCE-PLAN.md` §3.
2. Write down the round's goal and a hypothesis to test ("the goblins have no anti-air"). Matches are slow, so
   aim them.
3. Know the structure you're testing: `npm run balance -- coverage` (roles), and for faction holes run
   `npm run balance -- matrix --csv <file>`, then `npx tsx scripts/faction-holes.ts <file>`. That second command lists,
   for every unit, each faction's best answer to it at equal supply (under 60% is a hole).

## Playing a match

`npm run playtest` plays the real game headless, one round per call, against the real AI (usage at the top of
`scripts/playtest.ts`):

```bash
npm run playtest -- new w1 21 hard                 # name, seed, difficulty; prints the opening offer
npm run playtest -- play w1 '{"opening":"flat","buy":[{"u":"knights","x":22,"y":20}]}'
npm run playtest -- show w1                        # the field map, legend and shop state
npm run playtest -- log w1 2                       # reprint the last 2 round reports
```

- `play` prints the round report, then next round's state and legend. `show` prints the field map, for placing by hand.
- Pass `< /dev/null` when running it from Claude Code's shell, or it can hang on stdin.
- **Plan keys:** `opening` (0, 1, 2 or `"flat"`; round 1 only), `promote` (uid suffixes from the legend, or `"all"`, which
  can overspend), `up` (`[[unit, upgrade]]`, which unlocks the unit if needed), `tower`, `buy` (`{u, x, y, rot?}` or
  `{u, auto: "center" | "spread" | "left" | "right"}`), and `fill` with `style` (keep buying these until broke).
- **Field:** 48 × 27. My rows are 20–26; the AI's are 0–6. My Keeps cover x 11–12 and 35–36 on rows 23–24, so a 4 × 2
  squad can't start at x 8–12 or 32–36 on rows 22–24. A failed placement prints my rows with what's in the way.
  Squads are locked once placed (they can't move or be sold). Uppercase legend letters are mine, lowercase the AI's.
- **Money:** income is 200 + 100 × round (round 1 is the opening: three packs or the 700 war chest). Unspent supply
  carries over. Unlocks cost 100 (independents 200), upgrades 200 / 400 / 600 / 800 per unit in buy order, and a
  promotion costs half the unit's price. The war chest is the way to play one faction pure.

## How the AI plays (so you can read it)

- It plans from the state at the start of deployment against **your last army**, plus (Normal and Hard) that army with
  a round's income spent on units you already use. It never sees what you buy this round. So it counters what you
  showed last round; a new unlock surprises it once.
- The headless script runs one search. The browser runs Hard on up to 4 cores (DESIGN.md §9), so in-browser Hard is a
  little stronger.
- Habits seen so far (Nov 2026): Wolf Riders on both flanks, promoted early; Cloudlings massed (Overcast) against
  ground-only armies; Pikemen against anything large; Ballista parks on row 0 behind a wall of Grunts; Skirmishers or
  Air Elementals against swarms; Take Flight when you bring ground-only splash.

## Playing like an expert

- To find a faction's holes, play it **pure** (war chest) until something beats you that the faction can't answer.
  Then reach for the patch (often an independent) and see whether it really answers it.
- Place on purpose: think about which flank meets which, and keep shooters out of the flanks the AI's divers use.
- Read the report as evidence: who dealt the damage, who **took 0** (an untouchable unit is a finding), kills, and
  friendly fire. Write one line per round: what you bought and why, the AI's answer, the result, the lesson.
- When a match is decided, stop it. Spend the rounds on the question, not on finishing.
- Back up a finding with the harness before acting on it: `targets` for relations, `fight` for a combination
  (for example `fight "toad_riders,troll*2" dragon --upsA toad_riders:gulp`).

## After the matches

1. Write `docs/PLAYTEST-YYYY-MM-DD.md`: the goal, the matches (one table row each), the findings, what changed and why,
   and the open issues. Earlier reports stay as history.
2. Changes follow `CLAUDE.md` ("Designing units", "After changing units") and `docs/BALANCE.md`: intent in
   `src/data/balance.ts` first, numbers second, then `npm run balance -- check`, tests, the roster table, DESIGN.md.
3. Unit and design changes the owner hasn't seen: pitch first, build after (the owner asked to read the Toad Riders'
   pitch before it was built).

## Checking how it looks

To see a new unit or effect on screen, use the Units tab (`#units/<id>`, with "Try it" on each upgrade), driven by
Playwright as in CLAUDE.md. Two things that help:
- The page scrolls inside a container: screenshot `locator("canvas:visible").first()` after `scrollIntoViewIfNeeded()`.
- Short effects (a 0.3 s tongue) are easy to miss between screenshots. Poll the canvas in the page with
  `requestAnimationFrame` and `getImageData` for the effect's color, and screenshot the moment it shows.
