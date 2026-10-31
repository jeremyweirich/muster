# Playtest and balance notes, October 2026

A snapshot written for a future session that will combine these notes with the narrative overhaul (`PROMPT.md`) and the
campaign plans. It records what Claude learned by playing full matches against the AI and running controlled fights,
taken at commit `b958793` (the 21-unit roster in DESIGN.md §4).

**How to use this.** The roster is about to be redesigned, so treat the per-unit numbers as evidence about *mechanics*
and not as a to-do list for units that may not survive. The structural findings (§2) apply to any roster. The
per-unit notes (§5) say which mechanics worked or failed, and why, so new units can reuse what worked. Re-run the
checks in §8 after any big change; every number here goes stale with the next roster edit.

DESIGN.md stays the source of truth for the design. This file is evidence and advice.

## 1. Method

- **Five full matches against the Hard AI** through `npm run playtest` (`scripts/playtest.ts`). It drives the real
  match flow and AI from the command line, one round per call, with the same calls as `PlayView`. Each match used a
  different strategy: Kingdom, Greenskin, Elemental, Independent, and air-heavy.
- **Controlled experiments** through `npm run experiments -- <mode>` (`scripts/balance-experiments.ts`), about 10,000
  fights in total. Most use four **reference armies** of about 950–1000 supply, one per faction:
  - Kingdom: 2 Knights, 3 Longbowmen, Ballista, Halberdiers
  - Greenskin: 3 Goblin Hordes, Wolf Riders, 2 Sappers, Bat Riders, Alchemist
  - Elemental: Water, Air, Stone Golem, Wisps, Frost
  - Independent: 2 Trolls, Giant, 2 Longbowmen
- **The yardstick for "worth its price":** compare a purchase with spending the same supply on Longbows/Knights in the
  same army, against the same opponents. "Value diff" is the supply value left alive on your side minus the other's.
- **Caveats:** 4–12 seeds per cell, automatic placement (no flanking, unlike a human or the AI's left/right styles),
  level 1 except where noted. Small differences are noise. The AI has a real information edge (§2.8), so match results
  understate the player's side.

## 2. Structural findings (these apply to any roster)

### 2.1 Veterancy is the strongest system in the game, and it snowballs
- Lv2 needs 1,200 XP. **Nearly every squad that fights in round 1 reaches it**, including the losing side's Knights.
- A level is a full copy of the squad's stats for half its base price, with no extra footprint.
- XP is damage dealt, and damage scales with level, so a Lv3 squad levels about 3× faster. Meanwhile the price stays
  flat at half the base cost per level.
  - By Lv5 a squad has 5× the stats for 3× the price.
  - In match 1, Lv4–5 Halberdiers (150 + 4×75 supply invested) dealt 19–23k a round, about half the army's damage.
  - In match 2, Lv5 Sappers dealt about 5k a round.
- **Experiment A** (two Lv2 squads at 1.5× the cost vs four Lv1 squads at 2×): even on average, so Lv2 is about 25%
  cheaper than buying the same stats fresh.
  - Concentrated HP favors sturdy melee: Knights, Trolls, Halberdiers and Giants won 83–100% with Lv2.
  - Spreading wins for ranged and fragile units: Longbows, Ballista and Wolves won 0–17% with Lv2.
- **Effect on play:** across five matches I bought 2–3 upgrades per match and dozens of promotions. The answer to an
  army became "whoever leveled", not a unit pick. Power piles into a few squads, which also deepens the lock-in from
  permanent squads.
- **Options:** promotion price scaling with level (for example base cost × (level − 1) / 2), +50% per level instead of
  +100%, or XP relative to the squad's own cost (damage ÷ cost), so cheap high-damage units don't level fastest.
- **For the campaign:** veterancy is a natural fit ("champions who survive become legends"), but carrying veterans
  between missions would amplify the snowball. Decide whether campaign armies carry levels.

### 2.2 The air layer is the hidden axis of the whole game
- Only 7 of 21 units can hit air: Longbowmen, Ballista, Griffon Riders, Air Elemental, Wisps, Frost Elemental and
  Dragon.
- **Greenskins have none at all.** Bat Riders fly but attack only ground. **Independents have only the Dragon**, 800
  supply to field.
- In every non-Kingdom match I had to buy Kingdom Longbows. Longbows are a tax on every army, not a choice. That's
  the strongest form of "the same composition always works".
- **A Greenskin mirror always times out at 90 s.** Each side's Bat Riders are untouchable by the other army.
- Fliers are not dominant in real games, despite the one-unit lab: massed Longbows beat my air army in match 5 (their
  Longbows ended 6/6 alive, having taken 0 damage). The lab's flier bias is an artifact of one-unit armies.
- **Rule for new rosters:** every faction needs a way to hit air, ideally among its first one or two unlocks. Units
  that can't hit air should know it. Giant, Troll, Golem and Water Elemental each lost whole rounds to fliers they
  couldn't touch.

### 2.3 First upgrades are usually worth less than more units
- **Experiment D**, upgrades inside each faction's reference army, against the other three. **200 supply of extra
  Longbows improved value diff by +281 to +632.** Almost no first upgrade (also 200) beat that.
  - Exceptions: Stone Golem Quake (+627) and Granite (+442), Water Tidal Surge (+478), Sapper Thunder Kegs (+284).
- The 400 / 600 / 800 tiers are worse still. In play I never wanted a third or fourth upgrade.
- Flat global prices reward stacking one unit, since an upgrade applies to every squad of it. In match 2 I ended with
  10 Sapper squads and Big Kegs. That works against varied armies.
- Promotions (§2.1) beat upgrades for value by a wide margin. That's the main reason upgrades go unbought.

### 2.4 Full restoration makes one-shot attacks free
- Every squad is restored after each battle, so Goblin Sappers' self-destruct costs nothing. One 100-supply squad dealt
  2,900 in 10 s in round 1 and does it again every round.
- Any one-use mechanic (bombs, sacrifices, a single huge charge) needs a cost that persists between battles, or it is
  far too cheap.

### 2.5 Targeting by tags has gaps
- Bat Riders and Wolf Riders' Flankers hunt `class:ranged` / `class:caster` / `class:siege`.
- Fire Elemental, Frost Elemental and Giant are ranged (they have `role:ranged`) but lack any of those class tags, so
  the hunters ignore them.
- In match 2, two Meteor Fire Elementals (11 range) dealt over 15k and **took 0 damage**: nothing could reach them, and
  the units meant to dive the back line didn't try. This is also why Flankers tested negative.
- **Rule:** decide whether "back line" means a class tag or a role tag, and make one source of truth. Every unit with
  range ≥ 5 should match the back-line selector.

### 2.6 Speed differences inside one army split it up
- At speed 10 the Troll outruns the Giant (5) and Longbows (8) in an Independent army. It arrived alone and died
  having dealt 126 damage, twice in match 4.
- There's no formation-keeping (DESIGN.md roadmap #7). Until there is, a faction's front line should not be its
  fastest unit, unless it's meant as a raider.

### 2.7 Splash everywhere means swarms never pay off
- The Goblin Horde (16 × 10 HP) did almost nothing in every match: 50–200 damage a battle. Every army has some splash
  or chain lightning.
- Because it dies first, it never earns XP, so veterancy widens the gap every round.
- The Wisps swarm works because it flies, and few things hit air (§2.2).
- If the narrative wants "goblins are numbers", the swarm needs protection from splash. Spacing exists as a stat and
  isn't used by any unit. The gang-absorbs-losses theme could also become a mechanic, such as morale or bodies that
  shield the others.

### 2.8 The AI counters well but late
- The AI simulates its candidate plans against the player's exact last army. Squads are locked once placed, so that
  army is a reliable preview, and in 4 of 5 matches I lost round 1 or 2.
- But it mostly sticks to units it has already unlocked (about 55% of its candidates allow no new unlock). So it was
  slow to find real counters:
  - Wisps against my Halberdiers came in round 9 of 9.
  - Wisps with Flicker plus Meteor Fire Elementals against my Sappers + Longbows came in round 8.
- For **campaign missions** the AI's "plan by simulation" won't reliably produce a story beat. Scripted or authored
  enemy armies (with the AI only placing) are the safer way to stage "the pike line they had no answer to".

### 2.9 Smaller structural notes
- **Round damage ignores levels**, so a veteran army wins rounds while dealing only 36–110 damage. Match 1 took 9
  rounds; match 2 took 11. Losing the first three rounds cost me only about 150 of 400 HP.
- **Tower levels never pay off.** 200 on tower levels lost to 200 of Longbows in every reference army (experiment B).
  Keeps fell in most rounds of my matches, but mostly once the army was already losing. Nobody buys levels.
- **The field fills** at about 22 squads by around round 10. After that, supply only goes to promotions and upgrades.
- Physical damage is 13 of 21 main attacks, fire 3, lightning 2, water and frost 1 each. Elemental damage is rare
  outside the Elementals, so resistances other than physical rarely matter.

## 3. The current triangle vs the narrative triangle

Experiment G: the reference armies against each other, towers on, 12 seeds. Each cell is the row army's win rate,
then its mean value diff.

| | vs Kingdom | vs Greenskin | vs Elemental | vs Independent |
|---|---|---|---|---|
| **Kingdom** | — | 100% / +619 | 100% / +738 | 100% / +725 |
| **Greenskin** | 8% / −546 | — | 0% / −712 | 100% / +204 |
| **Elemental** | 0% / −740 | 100% / +675 | — | 8% / −479 |
| **Independent** | 0% / −727 | 0% / −215 | 100% / +525 | — |

`PROMPT.md` wants Kingdom > Goblins > Elementals > Kingdom.

- **Kingdom > Goblins already holds**, for the reason the story gives: Halberdiers (×1.75 vs cavalry and large) and
  Longbows (one arrow kills a goblin) are a pike line goblins have no answer to. This edge is ready.
- **Goblins > Elementals is reversed** (0%). Elementals have the fliers (Air, Wisps) that Greenskins can't hit, plus
  chain lightning and splash that delete 10-HP goblins.
- **Elementals > Kingdom is reversed** (0%). Knights have the best HP per supply in the game, Longbows shoot down Air
  and Wisps, and Warded Plate cancels the elemental damage. The Wet + lightning combo that should beat a tight shield
  wall isn't strong enough. The Water Elemental is one of the weakest units (§5).
- **Kingdom beats everyone.** DESIGN.md calls Kingdom "the strongest and most straightforward faction" on purpose. The
  narrative wants the final standings tied, which conflicts with that.

Two different balance targets are easy to blur:

1. **Campaign arc.** Each campaign's finale exploits a weakness, and the next campaign fixes it. This can be told
   through *which units and upgrades each side has* in authored missions. The "X" a faction invents can be a new
   unlock or upgrade. It doesn't need the open roster to be unbalanced.
2. **Skirmish balance.** At the end of the story everyone is "tied, and everybody got better". With the full roster
   available the triangle should be close to even, with counters coming from army choices rather than faction
   identity.

### Where the mechanics already fit the story (suggestions, not decisions)
- **The goblins' missing anti-air is a ready-made "X".** The Tinker's invention could be the first goblin unit or
  upgrade that hits air. It answers the Elementals' fliers and fixes the biggest structural gap (§2.2) in one move.
- **"Fire is free, point it at THEM."** Neutral statuses and surfaces already burn your own troops. Napalm and Wildfire
  already hurt their own side (Napalm tested negative for its owner). Steering fire away from allies can be the
  goblin lesson, with the elementals' Controlled Burn (enemies-only statuses) as the expert version.
- **"We are complicated because we burn."** Friendly fire from statuses is already the elemental cost.
  `onHitAffects: "enemies"` (Controlled Burn) is literally the young fire elemental learning not to burn its
  neighbors. Positioning-as-care maps onto the existing friendly-fire rules with no new systems.
- **"Against storms, spread out."** `spacing` already exists as a unit stat (extra distance while advancing, less
  splash taken), and no unit uses it. It's an exact fit for the Kingdom's epilogue drill-book page, and a counter to
  the elemental combo field.
- **Kingdom "boring wins".** Plain stat upgrades, best HP per supply and the most reliable units already read as
  boring and correct. The Kingdom's weakness needs to be made real: splash against tight formations is the natural one.
- **"The gang absorbs the losses."** This is currently the opposite of what happens: goblins die first and gain nothing
  (§2.7). A mechanic where goblin deaths fuel the survivors (on-death buffs, already expressible with `onDeath`
  effects) would make the theme mechanical.

## 4. Match log (Hard AI)

| # | My strategy | Result | What happened |
|---|---|---|---|
| 1 | Kingdom: Knights + Longbows, then Halberdiers | Won, round 9 | Lost rounds 1–3 to Knights + Wolf Riders flanking my archers. Halberdiers reached Lv2 in round 4 and won 6 straight. The AI kept adding Wolf Riders into the pikes and found Wisps (which Halberdiers can't hit) only in round 9 |
| 2 | Greenskin: Sappers + Longbows (Hordes and Bats did nothing) | Lost, round 11 | Led until round 7 on Sappers. The AI countered with Wisps + Flicker (vs arrows), then two Meteor Fire Elementals that outranged everything and took 0 damage. The field filled by round 10 |
| 3 | Elemental: Water, Air, Wisps, Golem | Lost 0–6 | The Water Elemental can't hit air and takes extra lightning damage. The Golem dealt 462 a battle. Both Keeps fell almost every round. Pivoting to Knights came too late |
| 4 | Independent: Giant (discounted opening), Troll | Lost 0–6 | The Giant can't hit air and lost to Griffons + Wisps untouched. The Troll ran ahead and died alone. The Giant became a monster when leveled (Lv3: 13.6k a battle) but still lost to fliers |
| 5 | Air: Griffons, Wisps | Lost 0–5 | Massed Longbows shredded every flier. Real counterplay exists for air |

The pattern: **every dominant army got countered eventually**, so there's no single composition that always wins. The
thing that always worked was a *style*: a Knight or Halberdier front, Longbows, and promoting everything. A Kingdom
unit was in every winning army on both sides.

## 5. Per-unit evidence (current roster)

Experiment E: value diff from adding one squad to every reference army, compared with the same supply of
Longbows/Knights. Averaged over all pairings at level 1. Positive means better than the filler.

| Unit (cost) | E | Notes: what worked or failed, and why |
|---|---|---|
| Halberdiers (150) | +142 | Best in class. ×1.75 vs cavalry and large, and splash punishes anything that charges. Pike Wall took one-unit mass armies from 50% to 88%. Dominant once leveled |
| Fire Elemental (250) | +129 | Meteor (+4 range, 11 total) outranges almost everything. Untouchable without hunters that actually target it (§2.5) |
| Goblin Sappers (100) | +117 | Free self-destruct (§2.4). The best value in the game early |
| Wisps (100) | +114 | Flying swarm, which few things can hit. Flicker (+50% physical) answers arrows: a clean counter-upgrade |
| Wolf Riders (150) | +98 | Javelins at 2.5 range plus speed 20 run down archers. Dire Wolves is strong. Tower Raiders, Flankers and Bloodthirst tested negative or flat |
| Knights (200) | +73 | About twice the effective HP per supply of any other unit (21.7 vs 6–15). Damage per supply (1.2) equals Wolf Riders and beats Longbows (0.88), so "hits softly" isn't true per supply |
| Ballista (150) | +71 | Decent in mixed armies, terrible massed (320 HP). Heavy Bolts and Reinforced Frame are its useful upgrades |
| Ogre Brute (250) | +69 | Fine. Warboss does nothing without goblins nearby, as intended |
| Stone Golem (200) | +47 | Weak at base (one slow model, gets surrounded, 462 damage a battle in play). Quake and Granite are the two strongest upgrades in the game. Fold some into the base? |
| Griffon Riders (200) | +15 | Strong against armies with no anti-air, weak against Longbows. Armored Saddles and Pride are strong |
| Longbowmen (100) | 0 | The filler itself. Mandatory everywhere (§2.2). Fire Arrows is the strongest single upgrade in mass tests (54% → 96%, it ignores Knight armor) |
| Air Elemental (200) | −8 | The only Elemental answer to air. Thunderhead and Tempest are good; Eye of the Storm is narrow |
| Goblin Alchemist (100) | −17 | Weak until Firebombs, which takes it from 0% to 50% in mass tests. Oil Slick is a dud by itself |
| Water Elemental (250) | −37 | Weak at base (0.12 damage per supply, the lowest of any attacker), can't hit air, takes extra lightning. Tidal Surge carries it. The combo enabler isn't worth fielding without its upgrade |
| Dragon (600 + 200 unlock) | −53 | Too expensive to appear: nobody fielded one until the AI's last round of match 2. Its damage per supply is the lowest of any unit (0.10) |
| Goblin Horde (100) | −66 | Did nothing in any match (§2.7). No upgrade fixes it: 0–4% in mass tests with every upgrade |
| Giant (350 + 150) | −68 | Bad at Lv1, can't hit air, very strong when leveled. Thick Hide is its only strong upgrade |
| Troll (200) | −85 | Runs ahead and dies alone (§2.6). Regeneration rarely matters in fights this short. Upgrades barely move it |
| Bat Riders (200) | −87 | Hits only ground, so Air and Longbows delete it (dealt 0 in match 2). Its back-line hunting misses the elemental casters (§2.5). Shriek is good |
| Cleric (150) | −95 | Healing 45 every 2 s barely matters in 10–45 s fights. The upgrades (Blessing, Battle Hymn) are the point, but they cost 200–800 on top |
| Frost Elemental (200) | −145 | The worst unit tested. Single-target chill/freeze needs physical allies to shatter, and damage is 0.20 per supply. Blizzard is its only good upgrade |

## 6. Upgrade evidence

From experiments C (mass armies vs the reference armies) and D (inside the faction's reference army). Treat ±50 as
noise.

- **Strong** (more than the price in at least one test):
  - Golem: Quake, Granite
  - Water: Tidal Surge
  - Sappers: Thunder Kegs, Big Kegs, Volatile Powder
  - Bat Riders: Shriek
  - Longbows: Fire Arrows
  - Halberdiers: Pike Wall, Long Pikes
  - Knights: Shield Wall
  - Griffons: Armored Saddles, Pride
  - Air: Thunderhead, Tempest
  - Alchemist: Firebombs
  - Wolves: Dire Wolves
  - Giant: Thick Hide
- **Duds** (zero or negative in both tests):
  - Sappers: Napalm (negative for its owner in both)
  - Wolves: Tower Raiders, Flankers (the tag gap), Bloodthirst
  - Alchemist: Oil Slick
  - Troll: Devour
  - Golem: Landslide
  - Wisps: Kindling, Static Sparks
  - Ogre: Warboss (outside goblin armies)
- **Can't judge from these tests:**
  - Cleric upgrades (no attack, so no mass test)
  - Dragon and Bat Rider upgrades (results are dominated by who can hit air)
  - Eye of the Storm and Overcharge (situational)
- **Counter-upgrades that read clearly in play:** Wisps Flicker vs arrows, Fire Arrows vs Knights, Pike Wall vs
  melee rushes. These are the "punch / counterpunch" the owner wants. Keep making this kind.

## 7. Role coverage: too many and too few

From `npm run experiments -- F`.

| Role | Count | By faction |
|---|---|---|
| Sturdy | 7 | Greenskin 1, Kingdom 1, Elemental 2, Independent 3 |
| Fast, Melee, Splash, Slow | 6 each | |
| Ranged, Flier | 5 each | |
| Combo | 4 | Greenskin 1, Elemental 3 |
| Anti-air | 3 tagged, 7 can actually hit air | none in Greenskin, only Dragon in Independent |
| Swarm, Glass cannon, Raider, Skirmisher, Anti-large | 2 each | Anti-large is both Kingdom |
| Sniper, Healer, Support, Regenerates | 1 each | |

By attack range:
- **Melee (≤ 1):** 8 units. Horde, Sappers, Bats, Ogre, Knights, Halberdiers, Golem, Troll.
- **Short (1–3):** 4. Wolves, Griffons, Wisps, Dragon.
- **Mid (3–6):** 5. Alchemist, Water, Air, Frost, Giant.
- **Long (> 6):** 3. Longbows, Ballista, Fire Elemental.

**Over-represented:**
- **Big, slow, ground-only bruisers.** Ogre, Golem, Troll, Giant, plus the Water and Frost Elementals: six single- or
  double-model ground units, most of them slow. Four of them (Ogre, Golem, Troll, Giant) do much the same job, and only
  the Ogre performs at base.
- **Melee.** 8 melee units against 2 skirmishers. The owner already wants more short-range attacks; the data agrees.
- **Physical damage.** 13 of 21 main attacks.

**Under-represented or missing:**
- **Anti-air outside the Kingdom.** The single biggest gap (§2.2).
- **Healing and support.** Just the Cleric, which underperforms, plus Water's Wellspring upgrade. Greenskins have only
  aura upgrades (War Drums, Warboss).
- **Anti-large.** Both units are Kingdom, so other factions answer big units only through raw damage.
- **A cheap Elemental front line.** Nothing plays the Knights' role. The Golem is one slow model at 200.
- **Back-line hunters that work.** The two that exist miss the elemental casters (§2.5).
- **A ground unit that protects the back line** (bodyguard or interceptor). Raiders have no natural predator except
  Halberdiers.
- **Mid-range ground fighters for Greenskins.** Everything is melee or the weak Alchemist.

## 8. Rules of thumb for designing the new roster

1. Every faction can hit air within its first one or two unlocks.
2. Every ranged unit (range ≥ 5) matches the back-line selector that hunters use.
3. One-use attacks need a cost that persists between battles (§2.4).
4. A faction's front line is not its fastest unit (§2.6).
5. Swarms need protection from splash or a reason splash doesn't end them (§2.7).
6. Judge a unit in mixed armies against "the same supply of Longbows/Knights" (`npm run experiments -- E`), not in
   the one-unit lab.
7. Judge a first upgrade against "+200 supply of units" (`npm run experiments -- D`). If almost none beat it,
   upgrades are overpriced relative to units.
8. Check the faction triangle (`npm run experiments -- G`) against the intended story edges.
9. Play at least one full match per faction with `npm run playtest`. Several problems (Troll running ahead, Hordes
   never earning XP, untouchable Meteor elementals, Greenskin mirrors timing out) only showed up in real matches.
10. Revisit veterancy pricing (§2.1) before tuning anything else. It drowns out every other number.

The reference armies in `scripts/balance-experiments.ts` (`REFS`) use current unit ids. Rewrite them for the new
roster first.

## 9. Open questions for the owner

- **Independents.** The story has three peoples. Do the Dragon, Troll and Giant fold into factions (the Kingdom
  already includes dwarves and elves), become neutral mercenaries or Compact referees, or go away?
- **Faction strength.** DESIGN.md makes the Kingdom the strongest faction on purpose. The story ends tied. Which wins
  for skirmish play?
- **Veterancy in the campaign.** Do champions carry levels between missions? If so, §2.1 matters even more.
- **Authored vs simulated enemies.** Campaign beats probably need authored enemy armies (§2.8). Is the AI's planner
  still wanted for skirmish only?
