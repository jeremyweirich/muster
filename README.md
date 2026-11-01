# Muster

**Play it: https://jeremyweirich.github.io/muster/**

A fantasy deploy-then-auto-battle strategy prototype. Each round you recruit squads and place them on your half of the field. Then
both armies fight on their own. Your army carries over between rounds, and the loser takes damage from the winner's survivors.
The focus is elemental combos: puddles you can electrify or freeze, oil you can ignite, steam that blinds archers. Units are
pure data, so the main way to play with the design is the in-app unit editor.

## Running

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # sim tests
npm run matrix     # unit-vs-unit win-rate matrix in the terminal
npm run roster-table  # default roster as a Markdown table
npm run build      # static build in dist/
```

See [docs/DESIGN.md](docs/DESIGN.md) for the full design.

## Tabs

- **Play**: you against the AI. Click a unit, then click your (blue) zone to place it; right-click or **R** rotates. Click a
  squad you placed this round to move it, and press **Delete** to sell it. **Ctrl+Z** undoes your last purchase. Squads from
  earlier rounds are locked. 🔒 units cost a one-time unlock per match, and every unit has two one-time upgrades. Each
  side has two fragile towers that you can upgrade; when one falls, its owner's army is Dazed (8s, minus 1s per level). After
  each battle there is a battle report: hover a squad to see who it hurt and who hurt it, right on the field. Then a replay.
- **Units**: the unit editor, a sandbox for experiments. Edits apply right away and reset on reload; the real roster lives in
  `src/data/units.ts`. It covers stats, attack, on-hit effects, traits, upgrades and tags, and has a raw JSON view and a
  sandbox where you can watch the unit fight another unit or run 10 headless sims.
- **Balance Lab**: every unit against every other unit at equal supply, simulated in a Web Worker.
- **Codex**: reference tables for statuses, surfaces, reactions, towers and roles.

## How it fits together

```
src/
  sim/        deterministic battle simulation (no DOM). Fixed tick, seeded RNG.
    types.ts      unit / effect / trait / selector / reaction data types
    battle.ts     the simulation
    surfaces.ts   ground surface grid + surface reactions (spreading, reverting)
    selectors.ts  tag-based unit selection, used by auras and bonus damage now, factions later
  data/       tunable content: units.ts, elements.ts (statuses, surfaces, reactions), rules.ts (economy, field)
  game/       match flow, placement, AI, balance lab
  render/     canvas drawing
  ui/         React views
```

Main design rules in the current prototype (all open to change):

- **Units are data.** Attacks, traits and reactions are built from a shared set of effects: `damage`, `status`, `surface` and
  `heal`. A new mechanic means a new effect or trait type, which every unit can then use.
- **Friendly fire:** main attack damage only hits enemies. Statuses, surfaces and reactions are neutral and hit both sides.
  Surfaces don't belong to a side, so the enemy's lightning can electrify your puddle. Fliers ignore surfaces.
- **Tags** use a `category:value` format (`faction:greenskin`, `race:ogre`, `size:large`). Anything that cares about groups of
  units goes through **selectors**, which is how faction bonuses will plug in later.
- **AI:** each round it generates candidate purchases and placements and simulates each one against the army you fielded last
  round, then keeps the best. It only relies on the simulator, so it understands any unit you design. Difficulty sets how many
  candidates it tries.

## Deploying

Every push to `main` runs `.github/workflows/pages.yml`: it installs, tests, builds and publishes to GitHub Pages. The site is
static, with no storage or analytics. Single-player makes no network calls; PvP talks only to the relay in `relay/`
(`docs/MULTIPLAYER.md`).
