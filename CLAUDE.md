# Common Ground: notes for Claude

Common Ground is a fantasy deploy-then-autobattle strategy game. The repo and package keep its working title, `muster`. It's a browser app (TypeScript, Vite, React and Canvas).
- **Live site:** https://jeremyweirich.github.io/muster/. The game is released to the owner's friends, so it **deploys only when the
  owner says so** (a manual run of the Pages workflow; see "Deploying"). Pushes to `main` don't change the live game.
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
- Tabs: **Story** (left-most and the default: the campaigns; playable missions open at `#story/<id>`,
  `docs/CAMPAIGN.md`), **Play** (the full game), **PvP** (play a friend by link; `docs/MULTIPLAYER.md`), **Units** (browse the
  roster; each unit has a small showcase fight from `src/data/showcases.ts`, links are `#units/<id>`), **Codex** (the
  rulebook for a brand-new player), **Counters** ("what beats X?", basic unit matchups only, no upgrades), **Spectate**
  (the AI plays itself, round by round, for watching unit interactions; Copy round exports a battle's setup to
  reproduce), **Thoughts** (the owner's essay on building the game, `docs/THOUGHTS.md`, rendered as is, with a
  signed note from Claude at the end). Game screens don't explain rules:
  keywords link to Codex entries (DESIGN.md §10, "Codex links").
- **Reference text is plain.** Unit descriptions, upgrade descriptions, showcase captions and Codex entries are read to
  understand the game, so flourishes are distractions: say what it does in simple words and name the facts a player
  needs (e.g. "attacks faster while at full HP"). The model is the Troll's description: "Two tough melee brutes. They
  attack faster while at full HP, and each hit in a row on the same target deals more damage. They regenerate HP,
  except while Burning." Story text keeps its voice (VISION.md). Not enforced as a sweep: whenever a change touches an
  entry, take the chance to simplify its wording.
- When a request is ambiguous, pick a reading, say which one, and make it easy to flip (usually a single data value).
- **Commit and push** to `main` once a change is done and verified (tests pass, build is clean). No need to ask first.
  Pushing doesn't deploy; **never deploy** (run the Pages workflow) unless the owner asks for it.
  When a commit carries something big (a new unit, a big rebalance, a new rule, tab or feature), add a line to
  `CHANGELOG.md` under today's date in the same commit, and keep the date's version range current (vN = commit count,
  as shown in the game's corner). Small fixes stay in the commit history. The debug panel links to it.
- **Two computers, one source of truth.** The owner works on a desktop and a laptop. Claude Code's memory is per
  machine and isn't shared, so anything the other machine should know (decisions, preferences, conventions, status,
  how-tos) goes in this file or `docs/`, committed and pushed. Don't rely on memory for that. Keep memory for local
  details only: this machine's paths, installed tools and their versions, and quirks.
  **Pull before starting work** (`git pull --rebase`, or `git fetch` and compare with `origin/main`): the other
  machine has often pushed since this checkout was last used. A local start-of-session git status can say "clean"
  while being far behind. Building on a stale checkout means redoing the work on top of the new code afterwards.
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
  - a showcase fight in `src/data/showcases.ts` (the Units tab): an opponent it beats in a way that shows off what
    it does, and a caption. A test checks the featured side wins
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
- Independents: any faction can use them to cover its holes, but they cost more to unlock and are less cost-efficient
  than a faction's own answer. Each patches named holes (DESIGN.md §8). Their flavor can be a little weird (the owner
  loves the Bog Toad Riders), and the owner wants **fewer archers**: give new units a fresh attack style, not another
  plain projectile.
- Faction feel: the **Wardens** are the most straightforward faction (plain stat upgrades).
  **Elementals** are the most complex to play (combos). Goblins sit between them. This is about feel, not power:
  balance is per unit (see "Where things stand").
- **Complexity budget:** baseline units apply statuses (Wet, Burning, Chilled/Frozen, Shocked, Oiled, Dazed; Snared
  only from the Toad Riders' Gulp) and do
  **not** create surfaces. Surfaces come only from specific upgrades. Don't add new statuses, surfaces or elements
  without the owner agreeing.
- Speed is in points: 10 = 1 tile/s (`RULES.speedScale`); the range is about 5 (siege) to 20 (wolves).
- After changing units:
  - `npm test`, and `npm run mission -- all` (seconds): the story missions are the balance's integration tests, and
    matter more than one-unit matchups (CAMPAIGN.md §10). A mission's featured unit must be able
    to win it; when a mission is hard to design, suspect the balance.
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
  collection. Two exceptions, both owner decisions: **story progress** (missions won, commendations earned), the
  Hard win streak, the AI difficulty last picked on Play, whether How to play has been seen and the love letter's "already shown" flag live in this browser's `localStorage`
  (`src/ui/progress.ts`, `src/ui/LoveLetter.tsx`), guarded so the game works when storage is blocked; nothing else
  is stored. And PvP (`docs/MULTIPLAYER.md`): it talks to the owner's relay (`relay/`, a Cloudflare
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
npm run mission -- <id> ['<plan json>']  # play a story mission's reference plans, or one plan, round by round
npm run mission -- all                   # every mission's reference plans, one line each: the balance dashboard
npm run -s copy-doc > docs/COPY.md       # every word a player reads (missions, units, Codex…) in one page, for editing the copy
npx tsx scripts/faction-holes.ts <csv>   # each faction's best answer to every unit, from `balance -- matrix --csv`
```

**Making story missions:** the owner wants many more. Follow the recipe in `docs/CAMPAIGN.md` §6 ("Making a
mission"): story and punch first, then a `MissionDef`, then tune by simulation with `npm run mission` until careless
plans lose and sensible ones win, and keep the clearest plans as references (the tests fight them).

**Playtesting rounds:** when the owner asks for "a round of playtesting against Hard", follow `docs/PLAYTESTING.md`
(goal and hypothesis, pure-faction matches, reading the AI, writing `docs/PLAYTEST-YYYY-MM-DD.md`). Smooth the tooling
as you go and note the change there.

**npm note:** npm 10 (the version bundled with Node 22) crashes resolving vitest 4's optional peer dependencies
("Cannot read properties of null (reading 'edgesOut')"). To **change dependencies**, use `npx -y npm@11 install …`.
`npm ci` from the committed lockfile works on npm 10, which is what CI uses.

## Verifying UI changes

Playwright and Chromium are available in the cloud environment (`require('playwright')`). On the owner's Windows machine,
install `playwright-core` in a scratch directory and launch the installed Chrome via `executablePath`. Drive
`npm run dev` and take screenshots. **On Windows, stopping a background dev server leaves vite running** (only the
shell dies), and the next start fails on a busy port. Before starting one, check the port
(`netstat -ano | grep ':PORT .*LISTENING'`): a vite already there can just be reused, since it serves the current files.
When done, kill whatever holds the port:
`for p in $(netstat -ano | grep ':PORT .*LISTENING' | awk '{print $5}' | sort -u); do taskkill //PID $p //F; done`. **Write screenshots and scratch scripts outside the repo.** Two stray PNGs were committed once by
accident.

## Deploying

Pushing to `main` runs `.github/workflows/pages.yml`, which installs, tests and builds, and stops there. Publishing
`dist/` to GitHub Pages happens only on a manual run (owner's call since the release to friends, 9 November 2026):
GitHub → Actions → "Deploy to GitHub Pages" → Run workflow on `main`, or `gh workflow run pages.yml --ref main`. Only
when the owner asks. Vite uses `base: "./"`, so the build works under `/muster/`.

## Where things stand

The roadmap is DESIGN.md §12, and the owner's open to-do items are in `docs/TODO.md` (repo only, not in the app). What
changed when is in `CHANGELOG.md` and the git history; the docs describe the game as it is now.

- **Balance** follows `docs/BALANCE.md`, with Mechabellum as the reference game (`docs/MECHABELLUM.md`).
  `docs/BALANCE-PLAN.md` has the owner's decisions, the analogue mapping, the current results and the open problems.
  Balance is per unit at equal supply, against the intent in `src/data/balance.ts` (roles, `RELATIONS` with reasons, an
  intent per upgrade); the owner left that table to Claude to refine. Don't bring back the old approach: the faction
  triangle as a balance goal (it's story only), the counter web, faction reference armies, "Wardens are the strongest",
  "keep every non-goblin attack ≥ 10".
- **The story missions are the balance's integration tests** (CAMPAIGN.md §10): a mission that's hard to design means
  the balance needs adjusting.
- **Fight shape:** fights should be spread out like Mechabellum's (about 40–60 s, a long approach, not everyone
  fighting at once), so positioning matters. Get there through space and movement, never by inflating HP.
- **Opening:** nothing is unlocked at the start; round 1 offers three two-unit packs or a war chest
  (`src/data/openings.ts`, DESIGN.md §5). The AI always takes a pack.
- **AI:** plans in Web Workers while the player deploys; Hard runs a phased search on up to 4 cores (DESIGN.md §9).
  Judge AI changes with `npm run ai-duel` (40+ paired matches), not by feel.
- **Simulation speed** matters and will matter more: `docs/SIMULATION.md` has the rules (fingerprint), the profile
  recipe, what's done and the next levers.
- The owner playtests and brings revision notes. Expect redesigns, not just tuning.
- **Owner's calls on units:**
  - **Dragons are late-game** and never meet one-unit fights in play, and fliers beating melee that can't hit up is
    fine. Don't flag those matchups.
  - **Wolf Riders should be swingy**: a huge impact the round they arrive (one dropped on a flank kills a Keep, then the
    Crossbowmen), countered fairly cheaply. ×5 opening javelin or ×2 raised to ×3 is pending the owner
    (`docs/BALANCE-PLAN.md` §3).
  - **Giant Bats** open every battle with a **dive** (the owner's design): a fixed distance straight ahead, no targets,
    no attacks, 25% less physical damage, passing through enemy fliers; then they fight, and their claws reach fliers.
    Where they're placed decides where they land. *Long Dive* goes further; *Bloodsuckers* has no dive (an anti-air
    escort). Kept light on purpose: Warden anti-air is all physical.
  - **Veterancy stays strong** (owner): it rewards early placement and makes matches differ. Promotion price is
    fixed; the only knobs are the first level's XP and the curve. The AI promotes late and rarely (BALANCE-PLAN.md §3,
    problem 1), so that's the next place to look, before the Ballista park behind a screen.
  - The deferred upgrade slots are filled (owner's picks, 4 November): Skirmishers *Recruiters* (each kill adds an
    archer) and Troll *Uprooted Tree* (in *Boulder Toss*'s place: the goblin campaign's "bigger thing" that reaches past a
    Pike Wall). Troll *Grab and Throw* was built and taken out again: the owner loved it but it added too much complexity
    (it's in git history, commit 0352a17).
  - The owner wants **fewer pure melee units and more short-range attacks** (Wolf Riders throw javelins, Griffon
    Riders throw spears; role `skirmisher`). Lean that way when designing new units.
- **Owner's calls on rules:** round damage ignores levels, on purpose; battles can't end early, because the survivors
  set the round damage (only playback speeds up). **Deferred by the owner, don't raise again unprompted:** most fights
  end in 15–25 s, short of the 40–60 s goal; and the report doesn't say why a hard-countered squad dealt 0.
- **Layout:** the game is landscape-only by design (16:9 field, 1 : 3 sidebar/field). Keep it working on a phone held
  sideways (about 844 × 390).
- **Faction bonuses** are designed but not built (DESIGN.md §8).
- **Campaigns:** planned in `docs/CAMPAIGN.md` (Wardens, then Goblins, then Elementals; owner decisions in §8,
  independents and maps in §9). **The Wardens campaign is built** (missions 1–9). Campaign missions charge no unlock prices (every unit met so far is
  free) and starting supply grows mission by mission (400 to 1200). A mission is a `MissionDef` in
  `src/data/campaign.ts` played on the ordinary Play board (`PlayView`'s `mission` prop); each lists reference plans
  that must win, lose and earn its commendation, and `tests/campaign.test.tsx` fights them. Make new ones with the
  recipe in CAMPAIGN.md §6 and `npm run mission` (both use `src/game/missionRun.ts`). Every word of the missions is in
  `docs/COPY.md`, with the Story intro, How to play, units, role chips and Codex (generated; the owner edits it, and
  Claude puts the edits back where each text lives: `campaign.ts`, `units.ts`, `showcases.ts`, `roles.ts`,
  `CodexView.tsx`, `Intro.tsx`, `StoryView.tsx`; then regenerates and diffs to check nothing was missed). Speakers get a portrait and
  a parchment speech bubble (`src/ui/Portraits.tsx`; a new speaker needs a face). Story is the left-most tab and where
  the site opens; progress is stored and missions open in order. The debug panel can open every mission for testing.
  **Next:** the owner's structural changes to the Wardens campaign, then the goblin campaign. Page 9 (the finale's
  winning board) is shown in the debrief, not kept.
- **Terrain:** rocks and ponds (impassable for ground units, who slide along the edge), rough ground (half speed) and
  tall grass (hides ground units from ground shooters until they attack); fliers ignore all of it. Nine
  point-symmetric maps; skirmish draws one per match (not Toll Bridge, a mission map only), missions name one
  (DESIGN.md §3). Owner rule: **units and the AI
  never plan around terrain** (no pathfinding); it's for map variety and a step toward spells cast on no-man's land,
  which are out of scope until the owner asks.
- **PvP:** play a friend by link is live (`docs/MULTIPLAYER.md`). The relay is deployed on the owner's Cloudflare
  account and needs no upkeep; redeploy only when `relay/` changes.
- **Phones:** 60 fps in every scenario on the owner's phone; no more rendering work is needed, and moving the sim to a
  worker (the next lever) is shelved unless a slower device needs it. **Getting numbers from the owner's phone:** the
  debug panel (click the version in the header, or `#debug`) runs a one-minute performance test and shows a text
  report with Copy/Share; ask the owner to run it on the live site and paste the report.
- Ideas not yet built: combo pairs in the balance harness, reinforcement cards, spells, pathfinding.
- **Not yet checked:** a PvP match on a real iPhone (Firefox and WebKit run battles bit-identical to Chrome: checked
  4 November, docs/MULTIPLAYER.md); Escape cancelling placement on a Mac (a friend saw it fail; not reproduced, and Done was added);
  the black-field fix on the owner's phone (a GPU reset, DESIGN.md §10b); whether the AI buys Keep levels; how the XP
  curve plays over a full match for a human (AI-vs-AI is measured); Gulp + Trolls against a real Dragon in a full match.
