# Balance plan: Common Ground against Mechabellum

November 2026. Balance follows `docs/BALANCE.md`, with Mechabellum as the reference game (`docs/REFERENCE.md`,
`docs/REFERENCE_2.md`). The owner signed off the approach and the answers below, and left the relationship table to
Claude to refine. Targets live in `src/data/balance.ts`; `npm run balance` measures the simulator against them.

## 1. Decisions (owner, Nov 2026)

| Question | Decision |
|---|---|
| Relationship table | Good enough; Claude refines it |
| The anti-giant gap | Troll gets Berserk as base (Steel Ball). Griffons get a Phoenix upgrade (*Giant Slayers*). Elementals solve it with frost (the Frost Elemental's cold ramps, Melting Point). Independents are the costly fallback |
| Independents | Their purpose: any faction can use them to cover its holes, but they cost more to unlock and are less cost-efficient than a faction's own answer. Not rebalanced yet |
| Upgrades | Capture intent, not numbers: every upgrade has a written intent (`src/data/balance.ts`) |
| Pikemen | Anti-large, with more models than the shooters |
| Elven Archers | Became **Crossbowmen**: few models, heavy bolts |
| Knights | Stay melee. If needed later: an anti-air javelin on a cooldown (not built) |
| Costs | Multiples of 100 |
| Goblins' one-hit design | Flexible (now 40 HP: most hits kill one, but not all) |
| Fight length | Match Mechabellum (about 40–60 s), **through space and movement, not HP**, so positioning matters |
| Wolf Riders | A real diver (Rhino) |
| Immunities | None: an element's own creatures resist it mildly (0.3). Weaknesses stay |
| Focus priority | Local only: of the enemies in front of you, prefer this one. Never cross the field for it |

## 2. What changed in the game

**Mechanics**
- **Local preferences.** `prefers`, towers-first and highest/lowest-HP targeting only choose among enemies within attack
  range + `RULES.preferReach` (4 tiles). Bats pick out the shooters just behind a line, but don't fly across the field
  for them. Air Elementals with *Eye of the Storm* don't chase a lone flier on the far side.
- **Ramping units lock on.** A unit with a ramp (Troll, Frost Elemental) keeps hitting the target it's building on
  while it's in reach, instead of retargeting to whatever is nearest.
- **Fight shape.** Each side deploys in 7 rows (was 9), so no-man's-land is 13 rows (was 9) and nothing starts in range.
  Units move at half speed (`RULES.speedScale` 0.1: speed 10 = 1 tile/s). The time limit is 120 s (was 90).
- **Side fairness** (earlier): models act in a shuffled order each tick, and a squad's short row stands at the back.

**Roster** (costs now 100 / 200 / 300 / 400 / 600)

| Unit | Role (analogue) | What changed |
|---|---|---|
| Knights | Tank (Sledgehammer), anchor | 600 HP, 40 damage, speed 12. *Warded Plate* +50%, *Veterans* +30% |
| Crossbowmen (was Elven Archers) | Anti-medium (Void Eye), **baseline 1.0** | 3 heavy crossbows: 85 damage every 3 s, range 7, ×1.5 against medium units. Upgrades: Longshot, Fire Bolts, *Repeaters* (→ chaff clear), Skyhunters |
| Ballista | Anti-giant (Marksman) | 100 cost, ×2 against large and huge, range 11 |
| Griffon Riders | Anti-medium (Phantom Ray) | *Giant Slayers* replaces Pride: ×2.5 against large and huge (→ Phoenix) |
| Cleric | Utility | 200 cost, heals 80 |
| Pikemen | Anti-giant: an anti-large line | 6 × 300 HP, reach 1.5, ×3.5 against large units and cavalry, no splash. *Heavy Halberds* (→ chaff clear), *Long Pikes* (→ beats Wolf Riders) |
| Grunts | Chaff (Crawler) | 40 HP, 8 damage every 0.6 s, speed 20 |
| Skirmishers | Chaff (Fang) | 12 per squad, 30 HP, speed 16 |
| Wolf Riders | Diver (Rhino) | 200 cost, 540 HP, 70 damage, speed 24 |
| Troll | Anti-giant (Steel Ball) | Berserk is built in (+35% per hit in a row, up to ×3). *Gorge* (heal 30% of damage dealt) takes its slot |
| Ogre Brute | Chaff clear (Fire Badger) | 300 cost, 2200 HP, 200 damage every 1.8 s |
| Giant Bats | Diver (none) | 280 HP, 45 damage |
| Fire Elemental | Chaff clear (Stormcaller) | 200 cost, 4 × 180 HP, 45 fire every 3 s, splash 1.3, fire resist 0.3 (was immune) |
| Water Elemental | Utility | 300 cost, 2400 HP, water resist 0.3 (was immune) |
| Air Elemental | Chaff clear (Arclight → Raiden) | 50 lightning every 1.2 s (two chain links kill a goblin each), lightning resist 0.3. Beats Knights; *Warded Plate* flips it |
| Cloudlings | Chaff (Wasp) | 14 per flock, 50 HP, speed 19 |
| Frost Elemental | Anti-giant (Melting Point) | 200 cost, ramping cold (+25% per hit, up to ×3), frost resist 0.3 (was immune) |
| Stone Golem | Tank (Fortress) | 300 cost, 3600 HP, 300 damage, speed 9, physical resist 0.4, lightning and fire 0.3 (were immune) |
| Dragon, Giant | Independents | Fire resist 0.3 (was immune). Giant 400 cost, stats scaled with it. Not rebalanced |

**The starter triangle** follows the cycle: a goblin swarm soaks Crossbow bolts, the bolts punch through Knights, and
Knights cut down the swarm. The How to Play page says so.

## 3. Where it stands

`npm run balance -- check` (8 seeds, about 1000 supply, level 1), after the Grunt speed change:

- **82 of 86 relations hold.** Three misses involve the independents (Frost and Pikemen against the Giant; Dragon against
  the Golem), which aren't rebalanced yet. The only faction miss is Troll against Ogre, an even fight (50%).
- **33 of 35 upgrade intents hold.** Misses: Ballista *Reinforced Frame* against Giant Bats (13%), Fire Elemental
  *Living Inferno* against Wolf Riders (38%).
- **Fight shape** (`density`, mirrored mixed armies): first contact at 4–6 s (was under 2), fights of 31–42 s (were
  21–36), 58–67% of each army fighting at once (was about 75%). Close to Mechabellum's 40–60 s, but the faster
  armies are still short of it.
- **Every faction unit is inside its Mechabellum self-TTK band** (`stats`).
- **Roster shape matches the template** (`coverage`): 3 chaff, 4 chaff clear, 2 anti-medium, 4 anti-giant, 2 tanks,
  2 divers, 2 utility, 1 late-game, and six upgrade paths into other roles.

**Open problems, most important first**
1. **Fliers still win one-unit fights too broadly.** Cloudlings hard-counter 13 of 19 units, Griffons 12, Giant Bats
   11, and the Nash mix puts its weight on Ballista, Cloudlings and the Dragon. Most of it is ground-only units that
   can't touch air, which one-unit armies exaggerate. Mixed-army tests (`fight`) are the better read, and Knights'
   optional anti-air javelin is the lever we've held back.
2. **Crossbowmen and Frost Elementals have soft counters but no hard counter.** Their chaff counters win at equal
   supply, but not at 2:1.
3. **Small leftover side bias.** At 32 seeds, Crossbowmen and Air Elementals lean to the bottom side (63%), Grunts and
   Wolf Riders to the top (31–34%). The big bias is gone; the rest may be target tie-breaking or the new geometry.
4. **The goblin mirror never ends.** Once the Skirmishers are gone, neither side's bats can hit the other's. It times
   out at 120 s.
5. **Coin-flip intents.** At 16 seeds, Knights *Shield Wall* vs Wolf Riders (44%) and *Veterans* vs Troll (50%) sit on
   the line; Troll vs Ogre too (50%).
6. **Two intents lost their matchup claims**: Griffon *Dive Attack* and *Armored Saddles* can't flip the Crossbowmen or
   Air Elementals that hard-counter Griffons. Their intents need a matchup they can move.
7. **Campaign mission 1** says "Archers one-shot grunts"; with Crossbowmen, grunts now beat them. The mission's punch
   needs rewriting when the campaign is built.

## 4. How to tune

1. Change intent first: a line in `RELATIONS` or an upgrade's intent in `src/data/balance.ts`, in words.
2. Change numbers in `src/data/units.ts`.
3. `npm run balance -- targets <unit…>` (seconds) while iterating; `npm run balance -- check` (minutes) before
   committing; `density` when movement, range or the field changes.
4. `sensitivity <unit>` before calling a unit done; `upgrades <unit>` for the upgrade and veterancy curve; `matrix
   --scale 1,2,4` for swarms and splash.
5. Then human playtests: pick rate, and win rate when picked.
