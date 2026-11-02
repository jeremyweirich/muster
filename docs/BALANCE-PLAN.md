# Balance plan: Common Ground against Mechabellum

November 2026. Balance follows `docs/BALANCE.md`, with Mechabellum as the reference game (`docs/MECHABELLUM.md`). The owner signed off the approach and the answers below, and left the relationship table to
Claude to refine. Targets live in `src/data/balance.ts`; `npm run balance` measures the simulator against them.

## 1. Decisions (owner, Nov 2026)

| Question | Decision |
|---|---|
| Relationship table | Good enough; Claude refines it |
| The anti-giant gap | Troll gets Berserk as base (Steel Ball). Griffons get a Phoenix upgrade (*Giant Slayers*). Elementals solve it with frost (the Frost Elemental's cold ramps, Melting Point). Independents are the costly fallback |
| Independents | Their purpose: any faction can use them to cover its holes, but they cost more to unlock and are less cost-efficient than a faction's own answer. Rebalanced Nov 2, 2026, and a third added: the **Bog Toad Riders**, the anti-medium the goblins and elementals lack (owner loved the pitch; fewer archers, a little weird). Snared is the owner's net idea |
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
| Wolf Riders | Diver (Rhino) | 200 cost, 540 HP, 45 damage with a ×5 opening javelin, speed 24 |
| Troll | Anti-giant (Steel Ball) | Berserk is built in (+35% per hit in a row, up to ×3). *Gorge* (heal 30% of damage dealt) takes its slot |
| Ogre Brute | Chaff clear (Fire Badger) | 300 cost, 2200 HP, 200 damage every 1.8 s |
| Giant Bats | Diver (none) | 280 HP, 45 damage |
| Fire Elemental | Chaff clear (Stormcaller) | 200 cost, 4 × 180 HP, 45 fire every 3 s, splash 1.3, fire resist 0.3 (was immune) |
| Water Elemental | Utility | 300 cost, 2400 HP, water resist 0.3 (was immune) |
| Air Elemental | Chaff clear (Arclight → Raiden) | 50 lightning every 1.2 s (two chain links kill a goblin each), lightning resist 0.3. Beats Knights; *Warded Plate* flips it |
| Cloudlings | Chaff (Wasp) | 14 per flock, 40 HP, speed 19 |
| Frost Elemental | Anti-giant (Melting Point) | 200 cost, ramping cold (+25% per hit, up to ×3), frost resist 0.3 (was immune) |
| Stone Golem | Tank (Fortress) | 300 cost, 3600 HP, 300 damage, speed 9, physical resist 0.4, lightning and fire 0.3 (were immune) |
| Dragon | Late-game power (Overlord), independent | Fire resist 0.3 (was immune). Nov 2: 4200 HP, breath 95 → 130; *Ancient Scales* became Toughness 15. Late-game only: one-unit results don't matter (owner) |
| Giant | Chaff clear (Vulcan), independent | 400 cost. Nov 2: 3200 → 2600 HP, boulders 215 / 3.2 s → 120 / 2.4 s, so its counters work again |
| Bog Toad Riders | Anti-medium (no exact match; *Spit Bile* → Mustang), independent | New Nov 2: 200 cost, tongue-lash beam, hits air, ×1.8 against medium |

**The starter triangle** follows the cycle: a goblin swarm soaks Crossbow bolts, the bolts punch through Knights, and
Knights cut down the swarm. The How to Play page says so.

## 3. Where it stands

`npm run balance -- check` (8 seeds, about 1000 supply, level 1), after the independents pass (Nov 2, 2026):

- **95 of 97 relations hold.** Both misses are even fights (50%): Troll against Ogre, and Frost against the Giant
  (63% at 16 seeds).
- **39 of 41 upgrade intents hold.** Misses: Ballista *Reinforced Frame* against Giant Bats (13%), Fire Elemental
  *Living Inferno* against Wolf Riders (38%).
- Nash mix (after the Dragon's HP went back to 4200): Crossbowmen 45%, Dragon 19%, Cloudlings 12%, Ballista 8%,
  Skirmishers 8%, Wolf Riders 4%, Grunts 3%. The Dragon hard-counters 12 of 20, mostly ground units that can't hit
  air; the owner doesn't count that against it (it's late-game, and fliers beating melee is fine). The Toad Riders
  have no 2:1 counter yet.
- **Faction holes** (Nov 2 playtest, `coverage` split by faction): the Wardens lack chaff and native splash; the
  Goblins lack anti-medium, long range and real anti-air (Skirmishers are their only anti-air; massed *Barbed*
  Skirmishers do work against Bats and Cloudlings); the Elementals lack anti-medium and a diver. The goblins' chaff
  clear and bruiser are both large, so Ballistae and Pikemen shut them down. The Toad Riders patch the anti-medium
  hole, and with *Gulp* beside Trolls they're the goblins' Dragon answer (`fight "toad_riders,troll*2" dragon`: 100%).
- The rest of this section predates the independents pass.
- **Fight shape** (`density`, mirrored mixed armies): first contact at 4–6 s (was under 2), fights of 31–42 s (were
  21–36), 58–67% of each army fighting at once (was about 75%). Close to Mechabellum's 40–60 s, but the faster
  armies are still short of it.
- **Every faction unit is inside its Mechabellum self-TTK band** (`stats`).
- **Roster shape matches the template** (`coverage`): 3 chaff, 4 chaff clear, 2 anti-medium, 4 anti-giant, 2 tanks,
  2 divers, 2 utility, 1 late-game, and six upgrade paths into other roles.

**Open problems, most important first**
1. **Veterancy is worth too much** (Nov 2). Level N is N× HP and N× damage, about 4× the combat value for 1.5× the
   price (a promotion costs half the unit). It's what made a Ballista park behind a Grunt screen untouchable in a
   playtest: replayed with everyone demoted to level 1, all 12 Ballistae died. Range 11 from row 0 reaches mid-field,
   where the screen meets the attackers, and divers' preferences are local, so they fight the screen. Levers:
   veterancy's value or price first, Ballista range only after. The AI promoting Wolf Riders early is the same
   problem.
2. **Wolf Riders: ×5 opening javelin, or ×2 raised to ×3 by an upgrade?** Pending the owner, who wants them swingy
   (a huge impact the round they arrive, countered fairly cheaply). At equal supply, ×5 has a mean margin of 24 and
   loses only to fliers, Pikemen (25%) and the Golem (38%); plain ×2 drops to 4 and loses to the Crossbowmen it
   exists to kill (38%); ×2 with *Bloodthirst* raising it to ×3 gives 18. Left at ×5.
3. **Titans' self-TTK** runs far above the bands (Giant 52 s, Dragon 63 s, like the Golem). Decide whether they get
   their own band.
4. **Not yet tried in a full match:** Gulp + Trolls against a real Dragon, and Elementals using the Toad Riders.
5. **Fliers still win one-unit fights too broadly.** Cloudlings hard-counter 13 of 19 units, Griffons 12, Giant Bats
   11. Most of it is ground-only units that can't touch air, which one-unit armies exaggerate. Mixed-army tests
   (`fight`) are the better read, and Knights' optional anti-air javelin is the lever we've held back. Nov 1, 2026:
   the owner found Cloudlings too strong; base damage moved into Freezing Rain, attack speed into Downpour, and HP
   50 → 40 so a cloud falls to four arrows. Skirmishers now beat them (87%), and the Nash mix's Cloudling weight
   fell from 31% to 14% (now Crossbowmen 53%, Dragon 16%, Cloudlings 14%, Skirmishers 8%).
   Wolf Riders were the strongest unit per supply (Lanchester 2.70) and beat every ground unit. Sustained damage moved
   into the opening javelin (70 ×3 → 45 ×5, so it still one-shots a 220 HP Crossbowman): their mean margin fell from
   33 to 22, and Stone Golem and Pikemen now beat them, as Fortress beats Rhino. Cutting HP or speed instead flipped
   their back-line wins first. Still open: Troll (Steel Ball, Rhino's main counter) loses to them, and they now lose to
   the Giant (38%, against "too fast for its boulders").
6. **Crossbowmen and Frost Elementals have soft counters but no hard counter.** Their chaff counters win at equal
   supply, but not at 2:1.
7. **Small leftover side bias.** At 32 seeds, Crossbowmen and Air Elementals lean to the bottom side (63%), Grunts and
   Wolf Riders to the top (31–34%). The big bias is gone; the rest may be target tie-breaking or the new geometry.
8. **The goblin mirror never ends.** Once the Skirmishers are gone, neither side's bats can hit the other's. It times
   out at 120 s.
9. **Coin-flip intents.** At 16 seeds, Knights *Shield Wall* vs Wolf Riders (44%) and *Veterans* vs Troll (50%) sit on
   the line; Troll vs Ogre too (50%).
10. **Two intents lost their matchup claims**: Griffon *Dive Attack* and *Armored Saddles* can't flip the Crossbowmen or
   Air Elementals that hard-counter Griffons. Their intents need a matchup they can move.
11. **Campaign mission 1** says "Archers one-shot grunts"; with Crossbowmen, grunts now beat them. The mission's punch
   needs rewriting when the campaign is built.

## 4. How to tune

1. Change intent first: a line in `RELATIONS` or an upgrade's intent in `src/data/balance.ts`, in words.
2. Change numbers in `src/data/units.ts`.
3. `npm run balance -- targets <unit…>` (seconds) while iterating; `npm run balance -- check` (minutes) before
   committing; `density` when movement, range or the field changes.
4. `sensitivity <unit>` before calling a unit done; `upgrades <unit>` for the upgrade and veterancy curve; `matrix
   --scale 1,2,4` for swarms and splash.
5. Then human playtests: pick rate, and win rate when picked.
