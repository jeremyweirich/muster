# Balance plan: Common Ground against Mechabellum

Balance follows `docs/BALANCE.md`, with Mechabellum as the reference game (`docs/MECHABELLUM.md`). The owner signed off
the approach and the decisions below, and left the relationship table to Claude to refine. Targets live in
`src/data/balance.ts`; `npm run balance` measures the simulator against them. What changed when is in `CHANGELOG.md`.

## 1. Decisions (owner)

| Question | Decision |
|---|---|
| Relationship table | Good enough; Claude refines it |
| The campaign as tests | Missions that are hard to design mean the balance needs adjusting. The missions' authored battles matter more than one-unit matchups, which don't all need preserving: each mission's reference plans are integration tests, and the unit a mission introduces must be able to win it (`docs/CAMPAIGN.md` §10) |
| The anti-giant gap | Troll has Berserk built in (Steel Ball). Griffons get a Phoenix upgrade (*Giant Slayers*). Elementals solve it with frost (the Frost Elemental's cold ramps, Melting Point). Independents are the costly fallback |
| Independents | Any faction can use them to cover its holes, but they cost more to unlock and are less cost-efficient than a faction's own answer. Three: the **Giant** (splash artillery), the **Dragon** (the late-game flier) and the **Bog Toad Riders** (the anti-medium the goblins and elementals lack; a little weird, and not another archer). Snared is the owner's net idea |
| Upgrades | Capture intent, not numbers: every upgrade has a written intent (`src/data/balance.ts`) |
| Pikemen | Anti-large, with more models than the shooters |
| Crossbowmen | Few models, heavy bolts |
| Knights | Stay melee. If needed later: an anti-air javelin on a cooldown (not built) |
| Costs | Multiples of 100 |
| Goblins' one-hit design | Flexible: 40 HP, so most hits kill one, but not all |
| Fight length | Match Mechabellum (about 40–60 s), **through space and movement, not HP**, so positioning matters |
| Wolf Riders | A real diver (Rhino), and swingy: a huge impact the round they arrive, countered fairly cheaply |
| Dragon | Late-game: it never meets one-unit fights in play, so its one-unit results don't matter, and fliers beating melee that can't hit up is fine |
| Immunities | None: an element's own creatures resist it mildly (0.3). Weaknesses stay |
| Focus priority | Local only: of the enemies in front of you, prefer this one. Never cross the field for it |

## 2. The roster against Mechabellum

Each unit's role and analogue, as `src/data/balance.ts` records them. Numbers are in DESIGN.md §4's roster table.

| Unit | Role (analogue) | Notes |
|---|---|---|
| Knights | Tank (Sledgehammer), second anchor | |
| Crossbowmen | Anti-medium (Void Eye), **baseline 1.0** | Half damage to fliers until *Skyhunters*. *Repeaters* makes them chaff clear |
| Ballista | Anti-giant (Marksman) | Winds up every shot. ×2 against large and huge, range 11 |
| Griffon Riders | Anti-medium (Phantom Ray) | ×1.5 against medium units. *Giant Slayers* → Phoenix |
| Cleric | Utility | Heals the line it stands behind; *Blessing* adds a damage aura. Stands behind the line it follows |
| Pikemen | Anti-giant: an anti-large line | Reach 1.5, ×4.5 against large units and cavalry, no splash. *Heavy Halberds* → chaff clear, *Long Pikes* → beats Wolf Riders |
| Grunts | Chaff (Crawler) | |
| Skirmishers | Chaff (Fang) | |
| Wolf Riders | Diver (Rhino) | The damage is in a ×5 opening javelin |
| Troll | Anti-giant (Steel Ball) | Berserk built in. *Gorge* takes its slot |
| Ogre Brute | Chaff clear (Fire Badger) | |
| Giant Bats | Diver (none) | |
| Fire Elemental | Chaff clear (Stormcaller) | |
| Water Elemental | Utility | |
| Air Elemental | Chaff clear (Arclight → Raiden) | Beats Knights; *Warded Plate* flips it |
| Cloudlings | Chaff (Wasp) | Hit hard only with *Freezing Rain* |
| Frost Elemental | Anti-giant (Melting Point) | Ramping cold |
| Stone Golem | Tank (Fortress) | |
| Dragon | Late-game power (Overlord), independent | *Ancient Scales* gives Toughness |
| Giant | Chaff clear (Vulcan), independent | |
| Bog Toad Riders | Anti-medium (no exact match; *Spit Bile* → Mustang), independent | Tongue-lash beam, hits air, ×1.8 against medium |

**The starter triangle** follows the cycle: a goblin swarm soaks Crossbow bolts, the bolts punch through Knights, and
Knights cut down the swarm. The How to Play page says so.

## 3. Where it stands

`npm run balance -- check` (8 seeds, about 1000 supply, level 1):

- **93 of 95 relations hold.** Both misses are even fights (50%): Troll against Ogre, and Frost against the Giant.
- **39 of 41 upgrade intents hold.** Misses: Ballista *Reinforced Frame* against Giant Bats (0%), Fire Elemental
  *Living Inferno* against Wolf Riders (38%).
- **Nash mix:** Ballista 35%, Dragon 30%, Skirmishers 20%, Cloudlings 11%, Wolf Riders 4%. With Crossbowmen weak against
  fliers, fliers and the Ballista take their place in one-unit fights, which exaggerate fliers. One-unit fights list
  nearly everything as a "hard counter" to the Cleric, which has no attack: judge it in mixed armies.
- **Story missions:** every reference plan does what it's meant to (`npm run mission -- all`), and each mission's
  featured unit has a winning plan.
- **Faction holes** (`coverage` split by faction): the Wardens lack chaff and native splash; the Goblins lack anti-medium,
  long range and real anti-air (Skirmishers are their only anti-air; massed *Barbed* Skirmishers do work against Bats and
  Cloudlings); the Elementals lack anti-medium and a diver. The goblins' chaff clear and bruiser are both large, so
  Ballistae and Pikemen shut them down. The Toad Riders patch the goblins' anti-medium hole, and with *Gulp* beside
  Trolls they're the goblins' Dragon answer (`fight "toad_riders,troll*2" dragon`: 100%).
- **Fight shape** (`density`, mirrored mixed armies): first contact at 4–6 s, fights of 31–42 s, 58–67% of each army
  fighting at once. Close to Mechabellum's 40–60 s, but the faster armies are still short of it.
- **Every faction unit is inside its Mechabellum self-TTK band** (`stats`).
- **Roster shape matches the template** (`coverage`): 3 chaff, 4 chaff clear, 2 anti-medium, 4 anti-giant, 2 tanks,
  2 divers, 2 utility, 1 late-game, and six upgrade paths into other roles.

**Open problems, most important first**
1. **Veterancy is strong, and the owner wants it that way** (4 November): it rewards placing well early, and the same
   layout plays differently depending on who levelled. Level N is N× HP and N× damage, about 4× the combat value for
   1.5× the price. **Price stays** (other prices would leave odd leftovers); the knobs are the XP for the first level
   and the curve after it (`veterancyXp` in `rules.ts`). Measured in 40 Hard AI-vs-AI matches (median 7 rounds):
   the first promotion comes in round 5 (median), no squad passes level 2, at most ~10% of squads are veterans, and
   promotions take 2% of spending; a side with a 25%+ level edge wins 71% of those rounds. With the first level at
   1200 XP instead of 2000, more squads earn a level by round 3–4 but promotions still start in round 5: the limit
   is the AI, which only promotes inside random candidate plans (60% per squad) and often prefers more squads. So
   levels are rare against the AI, not too common; a human who promotes eagerly will see far more of them. Next:
   whether the AI should value promotions better (judge with `ai-duel`), then the Ballista park behind a screen
   (replayed at level 1, all 12 Ballistae die; Ballista range only after).
2. **The Ballista leads the Nash mix.** Watch whether it becomes the "answer to everything" in the missions.
3. **Wolf Riders: ×5 opening javelin, or ×2 raised to ×3 by an upgrade?** Pending the owner. At equal supply, ×5 has a
   mean margin of 24 and loses only to fliers, Pikemen (25%) and the Golem (38%); plain ×2 drops to 4 and loses to the
   Crossbowmen it exists to kill (38%); ×2 with *Bloodthirst* raising it to ×3 gives 18. It stays at ×5 until then.
4. **Titans' self-TTK** runs far above the bands (Giant 52 s, Dragon 74 s, like the Golem). Decide whether they get
   their own band.
5. **Not yet tried in a full match:** Gulp + Trolls against a real Dragon, and Elementals using the Toad Riders.
6. **Fliers win one-unit fights too broadly.** Cloudlings and the Dragon hard-counter 12 of 20 units, Griffons and Giant
   Bats 11. Most of it is ground-only units that can't touch air, which one-unit armies exaggerate. Mixed-army tests
   (`fight`) are the better read, and Knights' optional anti-air javelin is the lever held back.
7. **Wolf Riders' matchups:** Troll (Steel Ball, Rhino's main counter) loses to them, and they lose to the Giant (38%,
   against "too fast for its boulders").
8. **Crossbowmen and Toad Riders have no hard counter.** Their soft counters win at equal supply, but not at 2:1.
9. **Small side bias.** Crossbowmen (63%) and Air Elementals (72%) lean to the bottom side in their mirrors. It may be
   target tie-breaking or the geometry.
10. **The goblin mirror ended** once the bats' claws reached fliers (with the opening dive, 4 November). Full goblin
    mirrors now last about 30 s, and the bat mirror is 56% for the bottom side. Diving bats pass through enemy fliers;
    when they bumped, the mirror was 9%.
11. **Coin-flip intents.** At 16 seeds, Knights *Shield Wall* vs Wolf Riders (44%) and *Veterans* vs Troll (50%) sit on
    the line; Troll vs Ogre too (50%).
12. **Two intents have no matchup to move:** Griffon *Dive Attack* and *Armored Saddles* can't flip the Crossbowmen or
    Air Elementals that hard-counter Griffons.

## 4. How to tune

1. Change intent first: a line in `RELATIONS` or an upgrade's intent in `src/data/balance.ts`, in words.
2. Change numbers in `src/data/units.ts`.
3. `npm run mission -- all` (seconds): every story mission's reference plans, before and after; the campaign's
   battles are the integration tests (`docs/CAMPAIGN.md` §10). `npm run balance -- targets <unit…>` (seconds) while
   iterating; `npm run balance -- check` (minutes) before committing; `density` when movement, range or the field
   changes.
4. `sensitivity <unit>` before calling a unit done; `upgrades <unit>` for the upgrade and veterancy curve; `matrix
   --scale 1,2,4` for swarms and splash.
5. Then human playtests: pick rate, and win rate when picked.
6. When a change lands, update §3 to the new numbers, and add a line to `CHANGELOG.md` if players would notice it.
