# Common Ground: notes for Claude

Common Ground is a fantasy deploy-then-autobattle strategy game. The repo and package keep its working title, `muster`. It's a browser app (TypeScript, Vite, React and Canvas).
- **Live site:** https://jeremyweirich.github.io/muster/. It deploys automatically on every push to `main`.
- **Design:** `docs/DESIGN.md` is the source of truth for the design. Read it before making design changes and keep it
  up to date.
- **Vision:** `docs/VISION.md` is the owner's story and themes: the Compact, the faction triangle (a story device, not a balance target), care as the quiet
  theme, and each faction's voice. Read it before writing player-facing text (Story, Codex, unit descriptions) or
  campaign content. `docs/CAMPAIGN.md` turns it into missions.

## How the owner works

- They playtest, then come back with revision notes. **Unit and balance changes are requested verbally.** Claude edits
  `src/data/units.ts` (and `elements.ts`, `towers.ts`, `rules.ts`). There is no in-app unit editor, by choice.
- They value: clear unit identities, upgrades with personality, readable battles, and good player-facing tools (battle
  report, Codex, Counters). Keep all of those working.
- Tabs: **Play** (default, the full game), **Story** (campaigns, coming soon; `docs/CAMPAIGN.md`), **Codex** (the
  rulebook for a brand-new player), **Counters** ("what beats X?", basic unit matchups only, no upgrades). Game screens
  don't explain rules: keywords link to Codex entries (DESIGN.md §10, "Codex links").
- When a request is ambiguous, pick a reading, say which one, and make it easy to flip (usually a single data value).

## Designing units (checklist)

- Units are pure data (`UnitDef` in `src/sim/types.ts`). Prefer composing existing effects, traits and selectors. Add a
  new trait or effect type only when a design really needs it, then describe it in `describe.ts` (and in
  `src/game/counters.ts` if it changes who beats whom). New statuses, surfaces, roles or rules need a Codex entry
  (`CodexView.tsx`, or `detail` in `roles.ts`); a test checks that every Codex link has a target.
- Every unit needs:
  - tags: `faction:*` (goblin, warden, elemental, independent), `race:*`, `size:*`, and 2–4 `role:*` tags from
    `src/data/roles.ts`
  - a one-line description
  - an unlock cost: 0 for starter units only
  - **four upgrades** that make the unit an increasingly expensive specialist, not a jack of all trades. About one should
    deepen an existing path, and pairs should combine in tempting ways. Prices are global and flat by buy order
    (`RULES.upgradeCosts`: 200 / 400 / 600 / 800). Each upgrade has a short player-facing `description`. A test checks
    the count, descriptions and tags.
- Every unit also needs an entry in `src/data/balance.ts`: its balance role, Mechabellum analogue and relationship
  table (beats / loses to). Write the relationships in words before choosing numbers (`docs/BALANCE.md` step 1).
- Faction feel: the **Wardens** (formerly the Kingdom) are the most straightforward faction (plain stat upgrades).
  **Elementals** are the most complex to play (combos). Goblins sit between them. This is about feel, not power:
  balance is per unit (see "Where things stand").
- **Complexity budget:** baseline units apply statuses (Wet, Burning, Chilled/Frozen, Shocked, Oiled, Dazed) and do
  **not** create surfaces. Surfaces come only from specific upgrades. Don't add new statuses, surfaces or elements
  without the owner agreeing.
- Speed is in points: 10 = 2 tiles/s (`RULES.speedScale`); the range is about 5 (siege) to 20 (wolves).
- After changing units:
  - `npm test`
  - `npm run balance -- check`, which grades the equal-supply matrix against `src/data/balance.ts`. The other modes
    (stats, coverage, distance, fight, sensitivity, upgrades) are listed at the top of `scripts/balance.ts`.
  - `npm run roster-table`, then paste the output into DESIGN.md §4.
  - If behavior changed, update DESIGN.md.

## Invariants

- `src/sim` is deterministic and DOM-free: fixed 50 ms tick, seeded `Rng`, no `Math.random`, no wall-clock time.
  Replays, the AI, the Counters tab and the tests depend on this.
- Main attack damage only hits enemies. Statuses, surfaces and reactions are neutral, so friendly fire is on.
- Each side fights with its own upgraded unit definitions (`upgradedDefs`, `new Battle([defsA, defsB], …)`).
- The AI only uses the simulator, so new units must work with it without special-casing.
- Don't add `localStorage`, analytics, network calls or external scripts. The site is a static page with no data
  collection.

## Commands

```bash
npm install           # see the npm note below
npm run dev           # http://localhost:5173
npm test              # vitest (sim, upgrades, towers, AI, Codex links, counter reasons)
npm run build         # typecheck + static build in dist/
npm run balance -- <mode>  # balance harness (modes listed at the top of scripts/balance.ts)
npm run matrix        # shortcut for the equal-supply matrix: win rate, value margin, Nash mix
npm run roster-table  # roster tables for DESIGN.md
npm run playtest      # play a full match vs the AI from the command line (usage at the top of scripts/playtest.ts)
```

**npm note:** npm 10 (the version bundled with Node 22) crashes resolving vitest 4's optional peer dependencies
("Cannot read properties of null (reading 'edgesOut')"). To **change dependencies**, use `npx -y npm@11 install …`.
`npm ci` from the committed lockfile works on npm 10, which is what CI uses.

## Verifying UI changes

Playwright and Chromium are available in the cloud environment (`require('playwright')`). On the owner's Windows machine,
install `playwright-core` in a scratch directory and launch the installed Chrome via `executablePath`. Drive
`npm run dev` and take screenshots. **Write screenshots and scratch scripts outside the repo.** Two stray PNGs were committed once by
accident.

## Deploying

Pushing to `main` runs `.github/workflows/pages.yml`, which installs, tests, builds and publishes `dist/` to GitHub
Pages. Vite uses `base: "./"`, so the build works under `/muster/`.

## Where things stand

See DESIGN.md §12 for the roadmap. Open threads:
- **Balance is being redone (Nov 2026)** following `docs/BALANCE.md`, with Mechabellum as the reference game
  (`docs/REFERENCE.md`, `docs/REFERENCE_2.md`). `docs/BALANCE-PLAN.md` maps our units onto Mechabellum's and sets out
  the order of work. The old approach is gone; don't bring it back: the faction triangle as a balance goal, the counter
  web, faction reference armies, "Wardens are the strongest", "keep every non-goblin attack ≥ 10". Balance per unit at
  equal supply against the targets in `src/data/balance.ts`, which stay a draft until the owner signs them off. The two
  playtest reports (`docs/PLAYTEST-2026-10*.md`) are kept as history; their balance conclusions are superseded.
- The owner is playtesting and will bring **major revision notes**. Expect redesigns, not just tuning.
- **Big changes in progress (Oct 2026):** four upgrades per unit, flat upgrade prices, the round-1 opening offer, two
  new elementals (Frost Elemental, Stone Golem), slightly more elemental interaction, a sixth Warden unit
  (Pikemen), and veterancy (squads earn XP from damage dealt and pay to promote; DESIGN.md §5c). Balance-test at level
  1 first; `npm run balance -- upgrades <unit>` covers the upgrade and veterancy curve.
- **Goblin rework done (Oct 2026, from the owner's unit notes):** Greenskins became Goblins (`faction:goblin`):
  Grunts, Skirmishers (goblin archers that hit air), Wolf Riders, Troll (moved from the independents), Ogre Brute,
  Giant Bats. Sappers and the Alchemist are gone. Longbowmen became Elven Archers and Halberdiers became Pikemen. Two
  upgrades are **placeholders** for slots the owner deferred until after the campaign: Skirmishers *Skyshot* and Troll
  *Boulder Toss*. Expect the owner to replace them.
- The owner wants **fewer pure melee units and more short-range attacks** (Wolf Riders throw javelins, Griffon Riders
  throw spears; role `skirmisher`). Lean that way when designing new units.
- Layout: the game is landscape-only by design (16:9 field, 1 : 3 sidebar/field). Keep it working on a phone held
  sideways (about 844 × 390).
- Faction bonuses are designed but not built (DESIGN.md §8).
- **Campaigns** are outlined in `docs/CAMPAIGN.md` (Wardens, then Goblins, then Elementals). Not built yet. Parked
  idea to keep: the campaign finale's last Drill Book page is generated from the player's own winning board. It needs
  stored progress, which the owner hasn't decided on yet.
- Ideas not yet built: combo pairs in the balance harness, reinforcement cards, spells, pathfinding.
