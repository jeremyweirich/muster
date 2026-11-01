# Balance plan: Common Ground against Mechabellum

November 2026. Balance is being redone from scratch, following `docs/BALANCE.md`. Mechabellum is the reference game;
its roles, matchups and stats are in `docs/REFERENCE.md` and `docs/REFERENCE_2.md`. This document maps our roster onto
Mechabellum's, says what that shows about the current units, and sets out the order of work. The targets live as data
in `src/data/balance.ts`, and `npm run balance` measures the simulator against them.

## 1. What changed

**Removed.** Everything that used to decide balance:
- the faction triangle as a balance goal (it is now a story device only; `docs/VISION.md`)
- the counter web in DESIGN.md §4 and the faction-vs-faction results table
- the faction reference armies and `scripts/balance-experiments.ts` (modes A to G)
- the faction power claims ("the Wardens are the strongest", "Elementals may have total counters")
- local rules like "keep every non-goblin attack ≥ 10" and "short lethal fights"
- the 2026-10 playtest reports as guidance (they stay as history, marked superseded)

**Adapted.**
- `src/game/lab.ts` now gives both sides **the same supply**. The old lab bought `floor(1000 / cost)` squads, so the
  Dragon fought 1000 supply with 600, the Giant with 700 and every 150-cost unit with 900. It also reports value
  retained for both sides and can randomize formations. The Counters tab uses the same code.
- `npm run matrix` is now a mode of the new harness: win rate, value margin, fight time and the Nash mix.

**New.**
- `src/data/balance.ts`: each unit's role, Mechabellum analogue, self-TTK band and relationship table, plus the
  tolerances from BALANCE.md §4.
- `src/game/balance.ts`: self-TTK, HP and DPS per supply, Lanchester value, and a Nash solver.
- `npm run balance -- <mode>`: the benchmarks from BALANCE.md §5 (listed in DESIGN.md §4, Balance).

**Simulator fix.** BALANCE.md's first sanity check, "a mirror match is 50%, or your simulator is biased", failed
badly. With one placement reflected onto the other side, the bottom side won 100% of Knight, Pikemen, Troll, Golem,
Ogre and Griffon mirrors, and 0% of Skirmisher and Air Elemental mirrors. There were two causes:
1. Models updated in creation order, and side 0's models are always created first. Hits land at once, so in every
   even exchange the bottom side struck first and its victim never swung back. Now the order is shuffled every tick,
   from its own seeded stream, so battles stay deterministic.
2. A squad's short last row was laid out at the bottom of its footprint. That is the back for side 0 but the front for
   side 1. Now it is at the back for both sides.

The player is always side 0, so this was also a fairness bug in real matches. After the fix, 19 of 20 units are
inside 40–60% at 32 seeds. Cloudlings (31% at 32 seeds, 38% at 64) and the Air Elemental (38–41%) still lean slightly
toward the top side, which may be a small leftover bias in target tie-breaking. `npm run balance -- mirror` re-checks
it, and a test guards the big case.

## 2. The analogues

Size class comes from the `size:*` tag: small = light, medium = medium, large = giant, huge = titan. "Fit" says how
closely the unit plays like its analogue today.

| Unit | Cost | Role | Analogue | Size | Fit | Why |
|---|---|---|---|---|---|---|
| Grunts | 100 | Chaff | Crawler | light | good | Cheap, fast melee swarm that soaks big single hits |
| Skirmishers | 100 | Chaff | Fang | light | good | Cheap ranged swarm that doubles as weak anti-air |
| Cloudlings | 100 | Chaff | Wasp | light | good | Air chaff: bodies in the sky that ground-only units can't touch |
| Elven Archers | 100 | Chaff clear | Mustang | light | good | Many small hits at long range, hits air. **Baseline unit (1.0)** |
| Pikemen | 150 | Chaff clear | Tarantula | light | rough | Tanky short-range splash. Also carries ×1.75 vs large, a second damage profile |
| Air Elemental | 200 | Chaff clear | Arclight → Raiden | medium | good | Chain lightning; *Take Flight* turns it into the air version (Raiden) |
| Fire Elemental | 250 | Chaff clear | Stormcaller | medium | good | Long-range splash artillery, weak to divers and air |
| Ogre Brute | 250 | Chaff clear | Fire Badger | giant | rough | Tanky short-range splash on a big body |
| Giant | 350 | Chaff clear | Vulcan | titan | rough | A giant that clears swarms; ranged boulders rather than flame |
| Frost Elemental | 150 | Anti-medium | Void Eye | medium | good | Cheap ranged single-target damage that goes through armor: the answer to the anchor |
| Griffon Riders | 200 | Anti-medium | Phantom Ray | medium | good | Air unit with big hits (*Dive Attack*) that kills mediums which can't shoot up |
| Ballista | 150 | Anti-giant carry | Marksman | medium | good | Glass sniper that targets the biggest unit and loses to chaff |
| Knights | 200 | Tank | Sledgehammer | medium | rough | **The anchor.** The reference medium unit everything is tuned against. Sledgehammer is mid-range; Knights are melee |
| Troll | 200 | Tank | Sabertooth | giant | good | Medium tank; *Berserk* (ramping damage) turns it toward Steel Ball |
| Stone Golem | 200 | Tank | Fortress | titan | good | Giant frontline body |
| Wolf Riders | 150 | Diver | Rhino | medium | good | Fast charger that hunts the back line |
| Giant Bats | 200 | Diver | none | medium | none | An air diver. Nearest are Wasp (air, beats ground-only units) and Rhino (hunts the back line) |
| Cleric | 150 | Utility | none | light | none | Mechabellum has no healers. Judge it with the composition test only |
| Water Elemental | 250 | Utility | none | giant | none | An enabler (Wet) on a tank body; closest in spirit to Hacker. Composition test only |
| Dragon | 600 | Late-game | Overlord | titan | good | The big flier that splashes the ground |

The draft relationship table in `src/data/balance.ts` is these analogues' Mechabellum matchups, translated
(for example, Sledgehammer loses to Void Eye, so Knights should lose to Frost Elementals). Pairs whose Mechabellum
counterpart has no analogue here drop out.

## 3. What the mapping shows

**The roster shape is close to Mechabellum's early-access template** (`npm run balance -- coverage`):

| Role | Ours | Suggested first pass |
|---|---|---|
| Chaff | 3 | 2–3 |
| Chaff clear | 6 | 4 |
| Anti-medium | 2 | 1–2 |
| Anti-giant carry | **1** | 3–4 |
| Tank | 3 | 3 |
| Diver | 2 | (counted with tanks) |
| Utility | 2 | 1 |
| Late-game | 1 | 1 |

Things to fix, most important first:

1. **Not enough anti-giant carries.** The carry corner of the cycle (carries beat chaff clear and everything bigger)
   is just the Ballista. Meanwhile we have six giants or titans (Troll, Ogre, Water, Golem, Giant, Dragon). In the
   translated table the Stone Golem has **no counter at all**, because Mechabellum answers the Fortress with Melting
   Point and the titans, and we have neither. Cheapest options: give the Troll its ramp (*Berserk*) as base behavior,
   making it a melee Steel Ball, and/or move Griffon Riders from Phantom Ray toward Phoenix (an air carry that kills
   big ground units and loses to anti-air chaff).
2. **Big units are walls with little damage.** Self-TTK (HP ÷ own DPS per model) is 48 s for the Giant, 71 s for the
   Dragon and 60 s for the Water Elemental. Mechabellum's late-game units sit at 13–25 s. Lanchester value (HP × DPS per
   supply, baseline 1.0) puts them near the bottom: Dragon 0.13, Water 0.16, Giant 0.29. Splash makes up some of this
   against swarms, but not against single targets.
3. **Some cheap units are very strong on paper.** Knights are worth 3.45 baselines, Pikemen 2.63 and Wolf Riders 1.94,
   before the Knights' 30% physical armor. That is why Knights beat Elven Archers from **every** starting distance in
   the closing-distance test: the melee tax costs them nothing against arrows. BALANCE.md expects a crossover distance.
4. **Pikemen have two damage profiles**: splash (good against light) and ×1.75 against large (anti-giant). Mechabellum
   units have one. Choose one, probably splash (Tarantula), or keep the bonus against cavalry only (the diver answer).
5. **The anchor is melee, but its reference isn't.** Sledgehammer is mid-range (95 m) with self-TTK 26 s. BALANCE.md
   puts a melee knight at 15–25 s, and Knights are at 18 s with armor. Keeping them melee makes the closing-distance
   test the deciding benchmark for them. Making them short-range (javelins) would also suit the owner's wish for fewer
   pure melee units.
6. **The goblin 10 HP design breaks the self-TTK bands.** Grunts are at 0.3 s and Skirmishers at 1.2 s, against a chaff
   band of 3–10 s. In Mechabellum, chaff is light but not one-shot by everything. That may be fine (they are chaff by
   overkill: one arrow, one goblin), but it makes every many-small-hits unit a hard counter to them. The matrix will
   show whether that is too much.
7. **Cost tiers.** Mechabellum uses 100 / 200 / 300 / 400 / 500 / 800. We use 100 / 150 / 200 / 250 / 350 / 600. With
   multiples of 100, every equal-cost fight at 1200 supply is exact, and units sit cleanly in tiers. Worth considering
   once the roles settle.
8. **Factions don't cover every role.** Wardens have no chaff; Goblins have no carry or anti-medium unit; Elementals
   have no carry. That's fine while players can mix factions, as in Mechabellum, which has none. It matters once
   faction bonuses reward staying in one faction (DESIGN.md §8).
9. **Player-facing text describes the old web.** The How to Play page says "Goblins swarm Knights · Knights shrug off
   arrows · Elven Archers pick off Goblins", but the sim has Knights beating Grunts outright. Unit descriptions and
   the intro should follow the relationship table once it is signed off.

## 4. What the simulator says today

`npm run balance -- check` on the current roster, after the simulator fix (8 seeds, about 1000 supply, level 1):

- **33 of 53 draft targets hold.** The misses cluster in a few units, which is the useful part:
  - **Wolf Riders (Rhino) win none of their 7 targets**, including Knights, Pikemen and the Ogre. They need to become
    a real diver, or move to a different role.
  - **Ballista (Marksman) loses to all three of its targets**: Frost, Griffons and Air Elementals. A one-model glass
    sniper at 150 is too fragile for its cost against anything that shoots back.
  - **Frost Elementals (Void Eye) lose to Knights** (0%, margin −66). They are meant to be the cheap answer to the
    anchor. Armor-piercing frost isn't enough on its own.
  - **The Stone Golem (Fortress) loses to Knights and Pikemen.** The Pikemen's ×1.75 bonus against huge units is
    doing the anti-giant job that the roster otherwise lacks.
  - **Air Elementals (Arclight) lose to Grunts and Archers**, the chaff they should clear.
  - Knights lose to Fire Elementals (13%), which the table says they should beat.
- **Fliers break the "nothing hard-counters everything" rule.** Cloudlings hard-counter 13 of 19 units, Griffon
  Riders 12 and Giant Bats 11. Most ground units can't shoot up. Mechabellum's answer is anti-air in every role.
- **No hard counter at all:** Elven Archers, Griffon Riders and the Dragon.
- **Nash mix:** 6 of 20 units get weight (Dragon 32%, Ballista 25%, Frost 20%, Fire 14%, Griffons 5%, Golem 4%).
- **Fights are short:** about 18–20 s on average, against a 90 s limit. BALANCE.md's self-TTK bands assume rounds of
  40–60 s. Either the bands shift down to match, or the game slows down. That is a decision, not a tuning detail.
- **Sensitivity** (Knights, small roster): Knights vs Fire Elemental flips from 25% to 75% on +10% HP or +10% attack
  rate. That matchup is brittle.
- **Veterancy is very cost-efficient.** A level-N squad has N× HP and N× damage, so N² the Lanchester strength, for
  1 + 0.5(N − 1) times the cost. A level-2 Knight squad already beats Fire Elementals at equal investment (`upgrades
  knights`). This is the "veterancy snowball" from the October playtest, now with a number on it.
- **Scale test** (8 units at 1×, 2× and 4×): mostly stable. Only Fire Elemental vs Ogre Brute flips (17% at 1×, 67% at
  2× and 4×).

## 5. Order of work

BALANCE.md §6, made concrete:

1. **Sign off the relationship table.** Edit `beats` / `losesTo` in `src/data/balance.ts` in words first. Decide items
   1, 4 and 5 above, because they change roles. `npm run balance -- coverage` checks that the table is consistent.
2. **Lock the baseline.** Elven Archers are 1.0 by definition. Tune only what the table needs from them (their wins
   against chaff, their losses to tanks and divers).
3. **Tune the anchor.** Get Knights into their self-TTK band and give the Archer matchup a crossover distance
   (`distance knights elven_archers`). Then make the Knights' listed counters hold (Frost Elemental, Griffon Riders,
   Wolf Riders, the giants).
4. **Add units one at a time**, rerunning `check` after each: chaff and chaff clear first (the cycle), then the
   carries, then tanks and divers, then the big units. For each one, run `sensitivity <unit>` before moving on, so no
   matchup flips on a 10% change.
5. **Scale and composition.** `matrix --scale 1,2,4` for swarms and splash, `fight` for frontliners judged by what they
   enable (Knights + Cleric against Frost + Cleric, and so on). Utility units (Cleric, Water) are judged only here.
6. **Upgrades and veterancy.** `upgrades <unit>` for each unit once the base matrix is right.
7. **Nash check.** The mix should put weight on many units. One-unit armies over-reward fliers, so expect air units
   to stand out until the anti-air answers in each role are in place.
8. **Then human playtests**: pick rate, and win rate when picked.

## 6. Decisions for the owner

- The relationship table: sign off the draft, or edit it.
- The anti-giant gap: Troll *Berserk* as base, Griffons toward Phoenix, a new unit, or something else.
- Pikemen: splash or anti-large.
- Knights: melee or short-range.
- Whether to move costs to multiples of 100.
- Whether the goblins' one-hit-kill design stays.
- Fight length: shift the self-TTK bands to our 20-second fights, or slow fights toward Mechabellum's 40–60 s.
- Wolf Riders: make them a real diver (Rhino), or give them a different role.
