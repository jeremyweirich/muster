# Common Ground: to do

The owner's open items, not yet started. Not shown in the game. Remove an item once it's done (the commit and
`CHANGELOG.md` keep the record).

- **The bridge map can't be in the random pool for standard games.** Skirmish draws any of `MAPS`
  (`src/game/match.ts`, the map pick from the seed), which includes Toll Bridge (`toll-bridge`, `src/data/terrain.ts`).
  Keep it for missions (Under the Bridge uses it). The Codex's list of maps may need the same split.
- **Giant Bats need tuning** (as they are now, with the opening dive).
- **Trolls are too complex at baseline.** Simplify the base unit; complexity belongs in upgrades.
- **Cloudlings are too strong.**
