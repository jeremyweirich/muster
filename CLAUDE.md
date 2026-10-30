# Muster: notes for Claude

Muster is a fantasy deploy-then-autobattle strategy game. It's a browser app (TypeScript, Vite, React and Canvas).
- **Live site:** https://jeremyweirich.github.io/muster/. It deploys automatically on every push to `main`.
- **Design:** `docs/DESIGN.md` is the source of truth for the design. Read it before making design changes and keep it
  up to date.

## How the owner works

- They playtest, then come back with revision notes. **Unit and balance changes are requested verbally.** Claude edits
  `src/data/units.ts` (and `elements.ts`, `towers.ts`, `rules.ts`). There is no local roster JSON to sync. The in-app
  Units tab is a session-only sandbox: edits reset on reload.
- They value: clear unit identities, upgrades with personality, readable battles, and good tools (editor, sandbox,
  Balance Lab, battle report, Codex). Keep all of those working.
- When a request is ambiguous, pick a reading, say which one, and make it easy to flip (usually a single data value).

## Designing units (checklist)

- Units are pure data (`UnitDef` in `src/sim/types.ts`). Prefer composing existing effects, traits and selectors. Add a
  new trait or effect type only when a design really needs it, then expose it in the editor (`EditorView.tsx`,
  `fields.tsx`) and in `describe.ts`.
- Every unit needs:
  - tags: `faction:*` (greenskin, kingdom, elemental, independent), `race:*`, `size:*`, and 2–4 `role:*` tags from
    `src/data/roles.ts`
  - a one-line description
  - an unlock cost: 0 for starter units only
  - **two upgrades with distinct personalities**. Whichever is bought first costs the unit's price (`upgradeCost`), the
    second double. Each upgrade has a short player-facing `description`.
- **Complexity budget:** baseline units apply statuses (Wet, Burning, Chilled/Frozen, Shocked, Oiled, Dazed) and do
  **not** create surfaces. Surfaces come only from specific upgrades. Don't add new statuses, surfaces or elements
  without the owner agreeing.
- Speed is in points: 10 = 2 tiles/s (`RULES.speedScale`); the range is about 5 (siege) to 20 (wolves).
- After changing units:
  - `npm test`
  - `npm run matrix` for a balance sanity check. One-unit-type lab fights over-reward fliers, so read it with that in
    mind.
  - `npm run roster-table`, then paste the output into DESIGN.md §4.
  - If behavior changed, update DESIGN.md.

## Invariants

- `src/sim` is deterministic and DOM-free: fixed 50 ms tick, seeded `Rng`, no `Math.random`, no wall-clock time.
  Replays, the AI, the lab and the tests depend on this.
- Main attack damage only hits enemies. Statuses, surfaces and reactions are neutral, so friendly fire is on.
- Each side fights with its own upgraded unit definitions (`upgradedDefs`, `new Battle([defsA, defsB], …)`).
- The AI only uses the simulator, so new units must work with it without special-casing.
- Don't add `localStorage`, analytics, network calls or external scripts. The site is a static page with no data
  collection.

## Commands

```bash
npm install           # see the npm note below
npm run dev           # http://localhost:5173
npm test              # vitest (sim, upgrades, towers, AI)
npm run build         # typecheck + static build in dist/
npm run matrix        # unit-vs-unit win-rate matrix
npm run roster-table  # roster tables for DESIGN.md
```

**npm note:** npm 10 (the version bundled with Node 22) crashes resolving vitest 4's optional peer dependencies
("Cannot read properties of null (reading 'edgesOut')"). To **change dependencies**, use `npx -y npm@11 install …`.
`npm ci` from the committed lockfile works on npm 10, which is what CI uses.

## Verifying UI changes

Playwright and Chromium are available in the cloud environment (`require('playwright')`). Drive `npm run dev` and take
screenshots. **Write screenshots and scratch scripts outside the repo.** Two stray PNGs were committed once by
accident.

## Deploying

Pushing to `main` runs `.github/workflows/pages.yml`, which installs, tests, builds and publishes `dist/` to GitHub
Pages. Vite uses `base: "./"`, so the build works under `/muster/`.

## Where things stand

See DESIGN.md §12 for the roadmap. Open threads:
- The owner is playtesting and will bring **major revision notes**. Expect redesigns, not just tuning.
- Balance: one rock-paper-scissors pass is done (DESIGN.md §4, counter web). The owner wants clear counters, not
  generic units that are good at everything. Fliers still dominate one-unit-type lab fights. Upgrades haven't been
  retuned since the pass.
- Layout: the game is landscape-only by design (16:9 field, 1 : 3 sidebar/field). Keep it working on a phone held
  sideways (about 844 × 390).
- Faction bonuses are designed but not built (DESIGN.md §8).
- Ideas not yet built: reaction editor, lab with upgrades and mixed armies, reinforcement cards, spells, pathfinding.
