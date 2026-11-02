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
- Tabs: **Play** (default, the full game), **PvP** (play a friend by link; `docs/MULTIPLAYER.md`), **Story** (campaigns, coming soon; `docs/CAMPAIGN.md`), **Codex** (the
  rulebook for a brand-new player), **Counters** ("what beats X?", basic unit matchups only, no upgrades). Game screens
  don't explain rules: keywords link to Codex entries (DESIGN.md §10, "Codex links").
- When a request is ambiguous, pick a reading, say which one, and make it easy to flip (usually a single data value).
- **Commit and push** to `main` once a change is done and verified (tests pass, build is clean). No need to ask first.
- **Two computers, one source of truth.** The owner works on a desktop and a laptop. Claude Code's memory is per
  machine and isn't shared, so anything the other machine should know (decisions, preferences, conventions, status,
  how-tos) goes in this file or `docs/`, committed and pushed. Don't rely on memory for that. Keep memory for local
  details only: this machine's paths, installed tools and their versions, and quirks.
- **Naming:** anything user-facing or newly named uses the game's name, Common Ground (`common-ground` as a slug), e.g.
  the PvP relay Worker `common-ground-relay`. `muster` stays only in the repo, its npm package and the `/muster/` Pages
  path.

## Designing units (checklist)

- Units are pure data (`UnitDef` in `src/sim/types.ts`). Prefer composing existing effects, traits and selectors. Add a
  new trait or effect type only when a design really needs it, then describe it in `describe.ts` (and in
  `src/game/counters.ts` if it changes who beats whom). New statuses, surfaces, roles or rules need a Codex entry
  (`CodexView.tsx`, or `detail` in `roles.ts`); a test checks that every Codex link has a target.
- Every unit needs:
  - tags: `faction:*` (goblin, warden, elemental, independent), `race:*`, `size:*`, and 2–4 `role:*` tags from
    `src/data/roles.ts`
  - a one-line description
  - an unlock cost: 100 (independents 200). Nothing is unlocked at the start; the opening packs (`src/data/openings.ts`)
    unlock two units each, and a test checks every pack's squads add up to `RULES.openingPackValue`
  - **four upgrades** that make the unit an increasingly expensive specialist, not a jack of all trades. About one should
    deepen an existing path, and pairs should combine in tempting ways. Prices are global and flat by buy order
    (`RULES.upgradeCosts`: 200 / 400 / 600 / 800). Each upgrade has a short player-facing `description`. A test checks
    the count, descriptions and tags.
- Every unit also needs an entry in `src/data/balance.ts`: its balance role, Mechabellum analogue, an **intent for
  each upgrade** (what it's for, any role it moves the unit into, which matchups it should flip), and its lines in
  `RELATIONS` (who it beats, with the reason in words). Capture intent, not numbers: write these before choosing
  numbers (`docs/BALANCE.md` step 1), then tune until the harness agrees. A test checks every upgrade has an intent.
- Elements: an element's own creatures **resist** it mildly (0.3) and are never immune. Weaknesses stay as they are.
- Target preferences (`prefers`, towers-first, highest/lowest HP) are **local**: they only choose among enemies within
  attack range + `RULES.preferReach`. Never make a unit cross the field for a preferred target.
- No independents rebalance for now. Their purpose: any faction can use them to cover its holes, but they cost more to
  unlock and are less cost-efficient than a faction's own answer.
- Faction feel: the **Wardens** (formerly the Kingdom) are the most straightforward faction (plain stat upgrades).
  **Elementals** are the most complex to play (combos). Goblins sit between them. This is about feel, not power:
  balance is per unit (see "Where things stand").
- **Complexity budget:** baseline units apply statuses (Wet, Burning, Chilled/Frozen, Shocked, Oiled, Dazed) and do
  **not** create surfaces. Surfaces come only from specific upgrades. Don't add new statuses, surfaces or elements
  without the owner agreeing.
- Speed is in points: 10 = 1 tile/s (`RULES.speedScale`); the range is about 5 (siege) to 20 (wolves).
- After changing units:
  - `npm test`
  - `npm run balance -- targets <unit…>` while tuning (seconds), then `npm run balance -- check` (minutes), which grades
    the equal-supply matrix and the upgrade intents against `src/data/balance.ts`. The other modes are listed at the top
    of `scripts/balance.ts`; `density` checks fight shape.
  - `npm run roster-table`, then paste the output into DESIGN.md §4.
  - If behavior changed, update DESIGN.md.

## Invariants

- `src/sim` is deterministic and DOM-free: fixed 50 ms tick, seeded `Rng`, no `Math.random`, no wall-clock time.
  Replays, the AI, the Counters tab and the tests depend on this.
- Simulation speed matters (the AI and the harness run thousands of battles). Before and after touching `src/sim`,
  run `npm run bench`: a pure speedup must keep the fingerprint; a changed fingerprint means results changed.
  `docs/SIMULATION.md` has the profile recipe, what's been done and the next levers. The balance harness runs
  matchups on a thread pool (`scripts/sim-pool.ts`); queue many with `Promise.all`.
- Main attack damage only hits enemies. Statuses, surfaces and reactions are neutral, so friendly fire is on.
- Each side fights with its own upgraded unit definitions (`upgradedDefs`, `new Battle([defsA, defsB], …)`).
- The AI only uses the simulator, so new units must work with it without special-casing.
- Don't add `localStorage`, analytics, network calls or external scripts. The site is a static page with no data
  collection. The one exception is PvP (`docs/MULTIPLAYER.md`): it talks to the owner's relay (`relay/`, a Cloudflare
  Worker), and only after a player starts or joins a match. Single-player stays offline.
- PvP needs both browsers to run identical battles: in `src/sim`, use only `+ − × ÷`, `sqrt`, `floor` and the like,
  never `Math.sin`/`cos`/`atan2`/`exp`/`pow` on values that affect the outcome (they can differ between browsers).

## Commands

```bash
npm install           # see the npm note below
npm run dev           # http://localhost:5173
npm test              # vitest (sim, upgrades, towers, AI, Codex links, counter reasons)
npm run build         # typecheck + static build in dist/
npm run balance -- <mode>  # balance harness (modes listed at the top of scripts/balance.ts)
npm run matrix        # shortcut for the equal-supply matrix: win rate, value margin, Nash mix
npm run roster-table  # roster tables for DESIGN.md
npm run bench         # simulator speed, plus a fingerprint of every outcome (docs/SIMULATION.md)
npm run ai-duel -- snapshot | run   # judge an AI change in full AI-vs-AI matches against a saved baseline
npm run relay         # local PvP relay for `npm run dev` (docs/MULTIPLAYER.md); deploy the real one from relay/
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

See DESIGN.md §12 for the roadmap. As of November 2026:
- **Balance** follows `docs/BALANCE.md`, with Mechabellum as the reference game (`docs/REFERENCE.md`,
  `docs/REFERENCE_2.md`). `docs/BALANCE-PLAN.md` has the owner's decisions, the analogue mapping, the current
  results and the open problems. Balance is per unit at equal supply, against the intent in `src/data/balance.ts`
  (roles, `RELATIONS` with reasons, an intent per upgrade); the owner left that table to Claude to refine. The old
  approach is gone; don't bring it back: the faction triangle as a balance goal (it's story only), the counter web,
  faction reference armies, "Wardens are the strongest", "keep every non-goblin attack ≥ 10". The October playtest
  reports (`docs/PLAYTEST-2026-10*.md`) are history; their balance conclusions are superseded.
- **Fight shape:** fights should be spread out like Mechabellum's (about 40–60 s, a long approach, not everyone
  fighting at once), so positioning matters. Get there through space and movement, never by inflating HP.
- **Opening:** nothing is unlocked at the start; round 1 offers three two-unit packs or a war chest
  (`src/data/openings.ts`, DESIGN.md §5). The AI always takes a pack.
- **AI:** plans in Web Workers while the player deploys; Hard runs a phased search on up to 4 cores (DESIGN.md §9).
  Judge AI changes with `npm run ai-duel` (40+ paired matches), not by feel.
- **Simulation speed** matters and will matter more: `docs/SIMULATION.md` has the rules (fingerprint), the profile
  recipe, what's done and the next levers.
- The owner playtests and brings revision notes. Expect redesigns, not just tuning.
- Two upgrades are **placeholders** for slots the owner deferred until after the campaign: Skirmishers *Skyshot* and
  Troll *Boulder Toss*. Expect the owner to replace them. History: Greenskins became Goblins; Longbowmen became Elven
  Archers, then Crossbowmen; Halberdiers became Pikemen.
- The owner wants **fewer pure melee units and more short-range attacks** (Wolf Riders throw javelins, Griffon Riders
  throw spears; role `skirmisher`). Lean that way when designing new units.
- Layout: the game is landscape-only by design (16:9 field, 1 : 3 sidebar/field). Keep it working on a phone held
  sideways (about 844 × 390).
- Faction bonuses are designed but not built (DESIGN.md §8). Independents cover a faction's holes at a higher unlock
  cost and lower efficiency; they haven't been rebalanced yet.
- **Campaigns** are outlined in `docs/CAMPAIGN.md` (Wardens, then Goblins, then Elementals). Not built yet. Mission 1's
  punch ("archers one-shot grunts") no longer matches the roster. Parked idea to keep: the campaign finale's last
  Drill Book page is generated from the player's own winning board. It needs stored progress, which the owner hasn't
  decided on yet. When it lands, the Hard-win easter egg (`src/ui/LoveLetter.tsx`, DESIGN.md §10) must
  remember it was shown and never show again; for now it shows once per visit.
- Ideas not yet built: combo pairs in the balance harness, reinforcement cards, spells, pathfinding.
- **PvP (Nov 1, 2026):** play a friend by link is live (`docs/MULTIPLAYER.md`). The relay is deployed on the owner's
  Cloudflare account and needs no upkeep; redeploy only when `relay/` changes. Tested with two scripted Chrome windows
  against the real relay, then played by the owner and a friend on their own machines (no desync reported). Not yet
  checked: whether Firefox and Safari run battles identically to Chrome (a desync shows a notice and the host's result
  wins).
- **Playtest with a friend (Nov 1, 2026):** the intro became three short pages in large type; after a battle each
  surviving squad flies its damage to the HP bar (Keeps don't); placing shows a banner with Done/Esc; small tokens
  (Skirmishers, Cloudlings, Grunts) now show their icon in battle; PvP players can take back Fight. Escape not cancelling
  placement on the friend's Mac wasn't reproduced; the key handler was made more robust and Done added. Recheck on a Mac.
- **Playtest vs Hard (Nov 1, 2026):** after it, veterancy got rarer (`veterancyXp` knobs, DESIGN.md §5c), Keep levels
  became +3,000 HP each (later cut to +2,000), and playback fast-forwards once a fight is decided. Owner decisions: round damage ignoring
  levels is intentional; battles can't end early because the survivors set the round damage (only playback speeds up).
  Deferred by the owner, don't raise again unprompted: most fights end in 15–25 s, short of the 40–60 s goal; and the
  report doesn't say why a hard-countered squad dealt 0. Not yet checked: whether the AI now buys Keep levels, and
  how the new XP curve plays over a full match.
