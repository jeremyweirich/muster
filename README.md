# Common Ground

**Play it: https://jeremyweirich.github.io/muster/**

A fantasy deploy-then-autobattle strategy game for the browser. Each round, both sides recruit squads and place them on
their half of the field without seeing what the other is adding. Then the battle plays out on its own. Armies carry
over and grow from round to round, and the survivors of each fight damage the loser's HP, so every round is a reaction
to the last one.

Three peoples settle their quarrels on the Field under an old treaty, the Compact: the steady **Wardens**, the
reckless **Goblins** and the volatile **Elementals**, plus a few **Independents** for hire. There are 21 units, each with
four upgrades. The Elementals play on combos: puddles you can electrify or freeze, oil you can ignite, steam that
blinds archers.

## Tabs

- **Story**: where the site opens. The Wardens campaign, nine missions that teach the game a rule at a time; the
  Goblin and Elemental campaigns are coming.
- **Play**: you against the AI (Easy, Normal or Hard). Click a unit, then click your blue zone to place it.
  Right-click or **R** rotates, **Esc** stops placing, **Delete** sells the squad you're holding and **Ctrl+Z** undoes
  your last purchase. After each battle a report shows who hurt whom, and you can replay the fight.
- **PvP**: play a friend. Create a match link and send it to them.
- **Units**: the whole roster, with a small showcase fight for each unit and a "Try it" button on every upgrade.
- **Codex**: the rules, for a brand-new player. Keywords anywhere in the game link here.
- **Counters**: pick a unit and see what beats it, from simulated fights.
- **Spectate**: the AI plays itself, round by round, for watching how units interact.

It works on a phone held sideways. The site is static, with no accounts or analytics. Your browser keeps your story
progress and a few settings (`localStorage`), and nothing leaves it: single-player makes no network calls, and PvP
talks only to a small relay (`relay/`, `docs/MULTIPLAYER.md`).

## Running it locally

```bash
npm ci
npm run dev           # http://localhost:5173
npm test              # simulation, upgrades, AI, Codex links, PvP, story missions
npm run build         # typecheck + static build in dist/
npm run balance -- check   # the balance harness (modes listed at the top of scripts/balance.ts)
```

## How it fits together

```
src/
  sim/      deterministic battle simulation (no DOM): fixed 50 ms tick, seeded RNG
  data/     the content: units, elements (statuses, surfaces, reactions), towers, rules, balance targets
  game/     match flow, placement, the AI, the Counters lab, PvP
  net/      the PvP client
  render/   canvas drawing
  ui/       React views
relay/      the PvP relay (a Cloudflare Worker)
scripts/    balance harness, benchmarks, headless playtests
```

- **Units are data.** Attacks, traits and reactions are built from a shared set of effects (`damage`, `status`,
  `surface`, `heal`), so a new mechanic is a new effect type that every unit can use.
- **Friendly fire:** main attack damage only hits enemies. Statuses, surfaces and reactions are neutral and hit both
  sides, so the enemy's lightning can electrify your puddle.
- **The AI only uses the simulator.** Each round it tries candidate purchases and placements against the army you
  fielded last round and keeps the best, so it understands any unit without special cases. Hard plans in Web Workers
  while you deploy.
- **Determinism** makes replays, the AI, PvP (both browsers run the same battle) and the balance harness possible.

## Docs

- [docs/DESIGN.md](docs/DESIGN.md): the full design, and the source of truth.
- [docs/VISION.md](docs/VISION.md): the story and themes. [docs/CAMPAIGN.md](docs/CAMPAIGN.md): the planned campaigns.
- [docs/BALANCE.md](docs/BALANCE.md) and [docs/BALANCE-PLAN.md](docs/BALANCE-PLAN.md): how the game is balanced, and
  where it stands.
- [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md), [docs/SIMULATION.md](docs/SIMULATION.md): PvP and simulator speed.
- [CHANGELOG.md](CHANGELOG.md): the big changes, by date.

## Deploying

Every push to `main` runs `.github/workflows/pages.yml`, which installs, tests, builds and publishes to GitHub Pages.

## License and credits

Common Ground is a free, non-commercial fan project inspired by [Mechabellum](https://store.steampowered.com/app/669330/Mechabellum/).
It is not affiliated with or endorsed by Game River, and Mechabellum and related names are their trademarks. If you
enjoy this, go play and support the real thing. This project will never be sold or monetized.

The code is under the [PolyForm Noncommercial License 1.0.0](LICENSE): you're welcome to play, study, modify and share
it for any non-commercial purpose, but not to sell it or use it commercially.
