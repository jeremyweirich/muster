# Muster — Design Document

Status: living document, written after the first playable prototype. Every number here is a starting point to tune, not
a final value. Sections marked **Decided** are settled direction. Sections marked **Open** still need a decision. Values
in code are the source of truth; this document explains what they are for.

## 1. Pitch

Muster is a fantasy deploy-then-autobattle strategy game. Two armies face each other across a field. Each round, both
players recruit squads and place them on their half of the field without seeing what the other is adding. Then the
battle plays out with no input. Armies carry over from round to round and grow, so every round is a reaction to what
the opponent showed last time.

Muster sets itself apart through elements. Units make puddles, set fires, spread oil and call down lightning, and these
effects combine with each other. Positioning is about formations, and it is also about the ground the fight will happen
on.

### Pillars

1. **Read and react.** You always see the enemy's last army, so the skill is predicting their answer to your answer.
   Unlock costs make it expensive to hard-counter every move.
2. **The field is a weapon.** Surfaces and statuses persist, spread and react. Two cheap units together can beat one
   expensive unit.
3. **Elements are neutral.** Your fire burns your own troops, and the enemy can electrify your puddle. Combos are
   strong, and that strength comes with risk.
4. **Designing units is part of the fun.** Units are pure data built from shared building blocks. The editor, sandbox,
   lab and battle report exist so you can invent and tune units quickly.
5. **Readable field.** The field should stay readable. Baseline units create **statuses**, not surfaces. Surfaces are a
   reward that comes from specific upgrades, so the ground only fills up when players choose it.

## 2. Core loop — Decided

```
Round N
 ├─ Income: supply += 200 + 100·N, except round 1 which starts at 400 (unspent supply carries over)
 ├─ Opening (round 1 only): take a random unit's unlock 100 cheaper, or +50 supply (section 5)
 ├─ Deployment (simultaneous, blind)
 │    ├─ see the enemy army as it stood last round, plus their unlocks, upgrades and tower levels
 │    ├─ unlock units (one-time cost per match)
 │    ├─ buy upgrades (four per unit; 200 / 400 / 600 / 800 in the order bought, whatever the unit)
 │    ├─ upgrade towers (100 / 200 / 400 / 800)
 │    ├─ buy squads, place and rotate them in your zone
 │    ├─ squads from earlier rounds are locked in place
 │    └─ Undo (Ctrl+Z) reverses purchases one at a time; fighting without spending asks for confirmation
 ├─ Battle (automatic, deterministic, up to 90 s; always starts at 1× playback, which is half real time)
 └─ Resolution
      ├─ loser takes damage = Σ over the winner's surviving squads of (cost × fraction alive × 0.08 + 4)
      ├─ time-out: each side takes damage from the other's survivors
      ├─ every unit is restored for the next round (armies are permanent; battles are not)
      └─ battle report and replay
Match ends when a player reaches 0 HP (start: 400).
```

Rules live in `src/data/rules.ts`: income, HP, damage formula, time limit, field size, friendly fire, locking, unlocks
and towers.

## 3. Battlefield — Decided

- **48 × 27 tiles**, a 16:9 field shaped like a landscape screen. Armies face each other across the short axis, so
  the front is wide and there's room to flank. Each side deploys in its back 9 rows. The 9 rows in the middle are
  no-man's-land.
- **Grid placement.** Each squad has a rectangular footprint in tiles. Footprints can't overlap each other or a tower.
- **Rotation.** Right-click or press **R** to swap a footprint's width and height when placing. You can also right-click
  a squad placed this round to rotate it in place. This only changes how the squad is laid out, for example goblins in a
  wide line or in a column. It does not change facing or behavior.
- **Locking.** Squads placed in earlier rounds can't be moved or sold. Squads placed this round can be moved or sold for
  a full refund.
- **Two layers: ground and air.** Fliers ignore ground surfaces and don't collide with ground units. Only attacks that
  target air can hit them.

### Screen layout — Decided

- **Landscape everywhere.** The Play screen is one sidebar (supply, Fight, the recruit list with the unit details
  directly under it, towers, enemy unlocks) beside the field, about 1 : 3. The field keeps its 16:9 shape and fits
  whichever of width or height runs out first.
- **Phones play sideways.** On short landscape screens the header and padding shrink so the field gets the height. In
  portrait, touch devices get a "turn your phone sideways" screen with a full-screen + landscape-lock button (works on
  Android; iOS has to rotate by hand) and a "play in portrait anyway" escape, which stacks the field above the sidebar.

### Towers — Decided (values open)

Each side has two Keeps (West and East) near the back of its zone, 2 rows in from the back edge
(`RULES.towerInset`), spaced apart horizontally and mirrored for the opponent. Squads can stand behind them.

| Tower | Layer | Base HP | Weapon |
|---|---|---|---|
| Keep (×2) | ground | 150 | none |

- **Unupgraded towers are fragile.** Almost any squad that reaches one kills it in a second or two.
- **Tower upgrades.** Each tower is upgraded separately. Levels cost 100 / 200 / 400 / 800, and each adds +300 HP, so HP
  grows in a straight line while the price doubles.
- **Collapse.** When a tower falls, **its owner's entire army is Dazed**: it deals 10% damage and takes double damage.
  The Daze lasts **4 s at level 0, 0.5 s less per level** (minimum 2 s), in sim time; at 1× playback (half real time) that reads as 8 s.
- Towers don't move and don't count toward winning the round. A side loses when its *army* is gone.
- **Why:** a single strong deathball in the center leaves the flanks open. A cheap raider that slips through and snipes a
  tower can swing the main fight. Tower levels are the counter-investment: you pay supply for insurance instead of army.
- Both Keeps are ground structures with no weapons, so any army can reach them and they never shoot back. Wolf Riders
  can buy *Tower Raiders* to go straight for towers.

## 4. Units — Decided (data model), Open (roster)

A unit definition is pure data (`src/sim/types.ts`, `UnitDef`):

| Field | Meaning |
|---|---|
| `cost` | supply per squad |
| `unlockCost` | one-time cost per match before the first purchase; 0 = available from the start |
| `squadSize` | models per purchase (16 goblins, or 1 dragon) |
| `footprint` | deployment tiles, w × h (rotatable) |
| `layer` | ground or air |
| `hp`, `size` | per model; size is the collision radius in tiles |
| `speed` | speed points, mostly between 5 and 20; tiles/s = points × 0.2 (`RULES.speedScale`), so 10 = 2 tiles/s |
| `spacing` | extra distance kept from allies **while advancing**; ranks close once fighting. Reduces splash damage taken |
| `resist` | per element: 0.3 = takes 30% less, -0.35 = takes 35% more, 1 = immune |
| `immuneStatuses` | statuses that never apply |
| `attack` | damage, element, cooldown, range, targets, targeting, delivery, splash, chain, `bonusVs`, `prefers` (hunt matching enemies first), `selfDestruct` (dies after its first attack), `onHit` effects |
| `traits` | aura, onDeath, regen, periodic, retaliate, charge, onKill |
| `upgrades` | four upgrades per unit (section 5b); prices are global (`RULES.upgradeCosts`) |
| `tags` | `category:value` labels used by selectors, including `faction:*` and `role:*` |
| `structure` | towers only: anchored and not counted toward winning |

**Behavior.** Each model picks a target (nearest, highest HP, lowest HP, towers first, or enemies matching `prefers` first, among layers it can hit),
walks until it is in range, and attacks. Units with no attack follow the nearest armed ally. Models push each other apart; heavier models get pushed less, and towers never move. Enemies block each other fully, but allies only nudge each other (`RULES.allyPush` = 0.15), so units behind a front line can squeeze through to reach the fight. There is no pathfinding yet.

**Damage pipeline:**
`attack damage × aura buffs × attacker status (Dazed) → reactions with the target's statuses (Conduct ×2, Shatter ×2, …) → bonusVs → target resist → target status (Dazed ×2)`

### Roster (generated by `npm run roster-table`)

There are three factions (Greenskins and Elementals have six units, the Kingdom five), plus independents. Factions are currently tags and groupings in the
recruit list; faction bonuses come later (section 8).

#### Greenskins

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Goblin Horde | 100 | 0 | 16 (4×2) | 15 | 10 | 8 physical / 0.25s, range 0.4 | Swarm, Fast, Melee, Glass cannon | **Frenzy**: Run 30% faster and stab 40% faster.<br>**Bigger Mob**: +8 goblins per squad: more bodies to soak the hits, more knives in the fight.<br>**War Drums**: Every goblin near a horde attacks 25% faster, wolves and bats included. Stacks with Frenzy.<br>**Scrap Armor**: Pots and planks: +15 HP, so a goblin lives through one arrow. 15% slower. |
| Wolf Riders | 150 | 50 | 4 (2×2) | 20 | 320 | 45 physical / 1s, range 0.5 | Fast, Raider, Melee | **Dire Wolves**: Bigger wolves: +50% HP, +20% damage.<br>**Tower Raiders**: Ignore the army and go straight for the enemy's towers.<br>**Flankers**: Circle the line and run down archers, casters and siege first, with ×1.5 damage to them.<br>**Bloodthirst**: Every kill readies another ×3 charge bite. Deadly with Flankers against soft targets. |
| Goblin Alchemist | 100 | 50 | 3 (3×1) | 11 | 100 | 18 physical / 2s, range 5, splash 1.2 | Combo, Ranged | **Oil Slick**: Flasks leave oil on the ground. It slows, and fire or lightning sets it all ablaze.<br>**Firebombs**: Flasks burst into flame: fire damage ×2, igniting oiled targets.<br>**Acid Flasks**: ×2.5 damage to sturdy units: knights, ogres, trolls, golems. Stacks with Firebombs.<br>**Mad Batch**: Brews faster: throws 40% faster, and flasks splash wider. |
| Goblin Sappers | 100 | 50 | 6 (3×2) | 16 | 50 | 125 fire / 1s, range 0.3, splash 1.4 | Splash, Fast, Glass cannon | **Volatile Powder**: Kegs also go off when a sapper is killed, so cutting them down up close still hurts.<br>**Big Kegs**: +50% blast damage and a wider blast.<br>**Thunder Kegs**: Survivors of a blast are Dazed for 2s: they deal 10% damage and take double.<br>**Napalm**: Blasts leave burning ground. It burns whoever walks in, your own troops too. |
| Bat Riders | 200 | 100 | 4 (2×2, air) | 20 | 220 | 45 physical / 1s, range 0.6 | Flier, Fast, Raider | **Shriek**: Each hit Dazes the target for 2s: it deals 10% damage and takes double.<br>**Colony**: +2 bats per squad.<br>**Torch Riders**: Riders drop torches: every hit sets the target Burning, and Ignites oiled ones.<br>**Bloodsuckers**: The bats feed as they fight: regenerate 15 HP/s. |
| Ogre Brute | 250 | 100 | 1 (2×2) | 7 | 2400 | 200 physical / 2s, range 0.7, splash 1.1 | Sturdy, Splash, Slow, Melee | **Thick Skull**: +40% HP and no more fire weakness.<br>**Rampage**: Swings 50% faster and moves 30% faster.<br>**Wrecking Swing**: A wider swing: +0.8 splash radius and +20% damage. Swarms melt.<br>**Warboss**: Goblins near the ogre fight harder: +25% damage. Hordes one-stab other goblins. |

#### Kingdom

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Knights | 200 | 0 | 4 (4×1) | 10 | 760 | 60 physical / 1s, range 0.6 | Sturdy, Melee | **Shield Wall**: +25% HP and +20% physical resistance.<br>**Lance Charge**: 30% faster, and the first strike deals ×4 damage.<br>**Warded Plate**: +40% resistance to fire, frost, lightning and water. The answer to elementals.<br>**Veterans**: +50% damage. With Lance Charge, the opening strike is brutal. |
| Longbowmen | 100 | 0 | 6 (3×2) | 8 | 100 | 22 physical / 1.5s, range 8 | Ranged, Anti-air | **Longshot**: +3 range.<br>**Fire Arrows**: Arrows burn: fire damage +25%, ignites oiled targets, melts ice.<br>**Volley**: Shoot 40% faster.<br>**Skyhunters**: ×2 damage to fliers. |
| Ballista | 150 | 75 | 1 (2×2) | 5 | 320 | 340 physical / 3.5s, range 10 | Sniper, Anti-large, Anti-air, Slow | **Heavy Bolts**: +50% damage. Still one target at a time.<br>**Repeater**: Fires twice as fast for 60% damage per bolt.<br>**Chain Harpoons**: Bolts Chill the target. Hit it again and it freezes; the bolt after that shatters it for double. Pairs with Repeater.<br>**Reinforced Frame**: +100% HP and +30% physical resistance, so raiders can't just walk over it. |
| Griffon Riders | 200 | 100 | 3 (3×2, air) | 18 | 400 | 55 physical / 1s, range 0.8 | Flier, Fast, Raider | **Dive Attack**: The first strike deals ×4 damage.<br>**Armored Saddles**: +40% HP and +20% physical resistance.<br>**Sky Patrol**: Hunt fliers first, with ×1.75 damage to them.<br>**Pride**: +1 griffon per squad. |
| Cleric | 150 | 75 | 2 (2×1) | 8 | 220 | none | Healer, Support | **Sanctuary**: A second prayer heals 30 more, in a wider circle.<br>**Blessing**: Allies nearby deal +20% damage.<br>**Purify**: Every 2.5s, washes every status off nearby allies: Burning, Frozen, Wet, Oiled, Dazed.<br>**Battle Hymn**: Allies nearby attack 25% faster. With Blessing, the line hits much harder. |

#### Elementals

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Fire Elemental | 250 | 100 | 1 (2×2) | 7 | 1100 | 145 fire / 2.5s, range 7, splash 2 | Splash, Ranged, Slow | **Controlled Burn**: Its flames only catch on enemies, so it can fight right beside your army. +20% damage.<br>**Meteor**: Artillery: +4 range, +50% damage and a wider blast, but fires 30% slower.<br>**Wildfire**: Fireballs leave burning ground. Controlled Burn can't tame it, so keep your army out.<br>**Living Inferno**: Scorches enemies within 2 tiles (20 fire per second), and melee attackers catch fire. |
| Water Elemental | 250 | 100 | 1 (2×2) | 6 | 1800 | 60 water / 2s, range 4, splash 1.2 | Sturdy, Combo | **Glacial Heart**: +40% HP. Enemies that hit it are chilled; hit it twice and they freeze.<br>**Tidal Surge**: +60% damage, +3 range, and hits leave puddles.<br>**Wellspring**: Heals nearby allies 40 every 2s. The only healing the elementals have.<br>**Tsunami**: Waves crash wider: +1 splash radius and +25% damage. Soaks whole formations for lightning. |
| Air Elemental | 200 | 100 | 2 (2×1, air) | 14 | 350 | 45 lightning / 2s, range 5, chain ×2 | Flier, Anti-air, Combo | **Thunderhead**: Lightning jumps 3 more times and hits 20% harder.<br>**Tempest**: +40% HP and attacks 40% faster.<br>**Eye of the Storm**: Hunts fliers first, with ×2 more damage to them (×3 in all). Nothing in the sky survives.<br>**Overcharge**: Each bolt stuns for 1s instead of a flicker. With Thunderhead, whole lines lock up. |
| Wisps | 100 | 50 | 10 (3×2, air) | 16 | 45 | 12 lightning / 1.4s, range 2 | Swarm, Flier, Fast | **Kindling**: Each wisp bursts into flame when destroyed.<br>**Brighter Swarm**: +6 wisps per squad.<br>**Static Sparks**: Each zap stuns for a flicker. A big swarm keeps a lone giant locked down.<br>**Flicker**: Hard to hit with steel: +50% physical resistance. Arrows and swords barely touch them. |
| Frost Elemental | 200 | 100 | 1 (2×2) | 7 | 1500 | 65 frost / 1.6s, range 5 | Combo, Ranged, Slow | **Blizzard**: The beam bursts: frost hits and chills everything within 1.4 tiles, for 30% less damage.<br>**Permafrost**: Hits leave ice on the ground that chills anyone standing in it. Fire melts it to water.<br>**Cold Snap**: Attacks 50% faster: chill, freeze, chill, freeze.<br>**Glacier**: +50% HP and +30% physical resistance. |
| Stone Golem | 200 | 75 | 2 (2×1) | 7 | 1000 | 110 physical / 1.8s, range 0.6 | Sturdy, Melee, Slow | **Granite**: +40% HP and +20% physical resistance.<br>**Quake**: Slams shake the ground: they splash, and stun everything around for 0.5s.<br>**Magma Core**: Fists turn molten: fire damage that sets enemies Burning. Melts armor and stops trolls healing.<br>**Landslide**: Rolls into battle 60% faster, and its first slam deals ×3. |

#### Independents

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Dragon | 600 | 200 | 1 (4×4, air) | 9 | 4200 | 95 fire / 1.6s, range 3, splash 1.8 | Flier, Splash, Sturdy | **Inferno**: +25% damage, and its breath leaves burning ground.<br>**Ancient Scales**: +40% HP and +30% physical resistance.<br>**Elder Blood**: Regenerates 40 HP/s, except while Chilled.<br>**Dread**: Its breath terrifies: everything it scorches is Dazed for 1.5s (deals 10%, takes double). |
| Troll | 200 | 75 | 2 (2×1) | 10 | 1000 | 90 physical / 1.3s, range 0.6 | Sturdy, Regenerates, Melee | **Rock Skin**: +30% physical resistance, and fire only hurts it a little extra.<br>**Berserk**: Attacks 65% faster and regenerates even quicker.<br>**Devour**: Eats what it kills: each kill heals it 250.<br>**Thick Blood**: Regenerates 20 HP/s even while Burning. Fire alone won't stop it any more. |
| Giant | 350 | 150 | 1 (3×3) | 5 | 3000 | 200 physical / 3.2s, range 6, splash 1.8 | Splash, Sturdy, Slow, Ranged | **Earthshaker**: Boulders briefly stun everything they land on.<br>**Thick Hide**: +40% HP and +25% physical resistance.<br>**Rockslide**: Bigger rocks, thrown farther: +3 range and a wider blast.<br>**Frost Giant**: Boulders of ice: frost damage that Chills where they land and freezes anything Wet or already chilled. |

### Counter web — Decided (direction), Open (numbers)

Rock-paper-scissors is the main balance goal. Every unit should be strong against some things and clearly weak against
others, and no army should be a safe default. Knight + Longbow spam in particular must have several direct answers.

Lethality: fights are meant to be short. A Knight mirror resolves in about 25–30 s; most mixed fights end in 10–45 s.

- **Goblin Horde** dies to any single non-goblin hit (10 HP) but stabs very fast (8 damage every 0.25 s). Archers and
  anything that hits often stop it; a horde that reaches soft or slow units shreds them. Frenzy and Bigger Mob make it
  much deadlier; Scrap Armor (25 HP) buys it out of the one-arrow rule, at a price.
- **Knights** are the tank: the most effective HP per supply, low damage per supply. Arrows bounce off them. Fire,
  Sappers, Ogres, Trolls and Acid Flasks answer them; Warded Plate answers the elemental answers.
- **Longbowmen** are steady single-target arrows: they pick off swarms and Griffons, and lose to armor, Bat Riders and
  anything big. Skyhunters turns them into flier hunters.
- **Goblin Sappers** run in and blow up (fire, splash), one blast each. They delete clumped Knights and big units, but
  archers can pop them on the way in.
- **Bat Riders** fly over the front line and hunt ranged, caster and siege units first (×2 damage to them). They can
  only hit the ground, so Griffons, Air Elementals and other anti-air swat them.
- **Fire** (Fire Elemental, Sappers, Firebombs, Fire Arrows, Magma Core) ignores physical armor and stops the Troll's
  regeneration (until Thick Blood).
- **Air Elemental** is the dedicated anti-air (×1.5 vs fliers, chain lightning). With Eye of the Storm it is a total
  counter to fliers: Wisps, Bats and Griffons simply die. It resists lightning (60%) but isn't immune, so Air mirrors end.
- The **Ballista** is a single-target sniper (no splash, even fully upgraded) that hunts the biggest unit: Ogre, Giant,
  elementals, Dragon. Swarms and raiders beat it. **Splash** (Ogre, Fire Elemental, Giant, Alchemist) shreds swarms.
  **Wolf Riders** run down archers and siege. Water and Air Elementals are a combo pair.
- **Frost Elemental** is single-target control: chill, then freeze; physical allies shatter frozen enemies for ×2. Fire
  melts it (−60% fire resistance). **Stone Golem** is the elementals' plain front line: immune to lightning, hard to burn,
  worn away by water, and swarmed by goblins.

Faction armies at about 1000 supply, towers on, sides alternated (8 seeds, one cheap upgrade on key units; win rate of
the row army):

| Army | vs Kingdom | vs Greenskin | vs Storm | vs Frost/Fire | vs Independents |
|---|---|---|---|---|---|
| Kingdom (2 Knights, 3 Longbow, Ballista, Cleric) | — | ~50% | 100% | 100% | 100% |
| Greenskin (3 Horde, Wolves, 2 Sappers, Bats, Alchemist) | ~75% | — | 0% | 0% | 100% |
| Storm (Water, 2 Air, Golem, Wisps) | ~15% | 100% | — | 100% | 100% |
| Frost/Fire (Fire, Frost, Golem, Air, Wisps) | 0% | 100% | 0% | — | 100% |

Kingdom comes out on top overall, and the factions form a triangle: Kingdom beats Elementals, Elementals beat Greenskins,
and Greenskins trade about evenly with the Kingdom. Fights last 7–25 s. The gap between "Kingdom vs Greenskin" and
"Greenskin vs Kingdom" is placement noise. Upgrades haven't been tuned; expect balance to move a lot.

One-unit-type lab fights still over-reward fliers, because most ground units can't hit them at all.

### Roles

Role tags (`role:*`) say what a unit is *for*. They show on hover in the recruit list and in the Codex. The current
roles are Sturdy, Swarm, Fast, Slow, Sniper, Ranged, Melee, Splash, Anti-air, Anti-large, Flier, Support, Healer, Combo,
Regenerates, Glass cannon and Raider. They live in `src/data/roles.ts`.

## 5. Unlocks — Decided (values open)

- Units with `unlockCost: 0` (Goblin Horde, Knights, Longbowmen) are available from the start. Every other unit costs a
  one-time unlock per match, paid from supply, before its first squad.
- **Purpose:** to tax a perfect counter-pick and reward sticking with what you already have. Sticking with your units in
  turn makes you easier to read, which is the intended trade-off.
- Each player sees which units the opponent has unlocked.
- The AI counts unlock prices in its budget and values a fresh unlock at 50% of its price beyond the current round.

**Open:** whether unlock costs should scale with the round, and whether the opening should offer more than one unit.

### Opening offer — Decided (values open)

A small, fair bit of variety at the start of each match. In round 1, each player chooses one:

- **A cheaper unlock:** one random unit whose unlock costs at least 100 (`RULES.openingMinUnlock`) gets
  `RULES.openingDiscount` (100) off its unlock for the whole match, or
- **War chest:** `RULES.openingBonus` (50) extra supply right away.

The discount is worth more but only if you commit to that unit, so the offer nudges a game in a direction without handing
anyone an edge. Each side rolls its own unit. The player must choose before the first Fight. The AI chooses at random
when the match starts, and tries its discounted unit more often while planning. The enemy's choice is shown from round 2.

## 5b. Upgrades — Decided (values open)

- Every unit has **four upgrades**. Each is a one-time purchase per match that changes **every squad** of that unit,
  including squads placed in earlier rounds.
- **Flat prices by order:** a unit's upgrades cost **200 / 400 / 600 / 800** in the order you buy them, whatever the unit
  (`RULES.upgradeCosts`). Each step makes the unit a deeper, more expensive specialist. The price is the same for a
  Goblin Horde and a Dragon, so upgrading a unit you field a lot of is better value.
- **Specialists, not jacks of all trades.** Roughly: two upgrades set the unit's main paths, one deepens a path, and one
  opens a new direction. Pairs are designed to multiply each other, so the later, pricier buys stay tempting:
  - Goblin Horde *Frenzy* + *War Drums* (attack speed stacks); Ogre *Warboss* near hordes (goblins one-stab goblins)
  - Wolf Riders *Flankers* + *Bloodthirst* (each kill re-arms the ×3 charge bite)
  - Alchemist *Oil Slick* + *Firebombs* (burning oil that spreads); *Acid Flasks* + *Firebombs* against armor
  - Ballista *Chain Harpoons* + *Repeater* (chill → freeze → shatter for ×2)
  - Air Elemental *Thunderhead* + *Overcharge* (whole lines stunned); Water *Tsunami* next to Air (mass Conduct)
  - Frost Elemental *Blizzard* + *Cold Snap* (mass freezing); Cleric *Blessing* + *Battle Hymn*
- **Counterpunch upgrades.** Several upgrades answer a specific answer: Knights *Warded Plate* (vs elementals), Troll
  *Thick Blood* (regenerates while burning), Ballista *Reinforced Frame* (vs raiders), Wisps *Flicker* (vs arrows), Goblin
  *Scrap Armor* (vs archers), Cleric *Purify* (vs statuses), Golem *Magma Core* (vs trolls and armor).
- **Kingdom upgrades stay plain**: armor, damage, range, rate of fire, more bodies. The elementals' and greenskins'
  upgrades are where the combos live.
- **Surfaces come from upgrades.** Inferno, Wildfire, Napalm, Oil Slick, Tidal Surge and Permafrost are the only things
  that put surfaces on the field. Everything else uses statuses.
- Data: an upgrade can apply stat mods (`value × mult + add` to hp, speed, size, spacing, squadSize, damage, cooldown,
  range, splash or chainCount). It can replace the attack's element, targets, targeting or preferred targets
  (`prefers`); add bonus damage (`bonusVs`) and on-hit effects; limit who its on-hit statuses land on (`onHitAffects`,
  e.g. Controlled Burn: enemies only, so no friendly fire); add or replace traits; and add resistances, status
  immunities and tags. Upgraded units are computed per side, so each army fights with its own upgrades.
- Bought upgrades show as ★ next to the unit in the shop. The enemy's upgrades are visible too.
- **Buying:** the sidebar's Upgrades tab lists every unlocked unit with its upgrades as one-click buttons (name, price,
  what it does), plus tower levels. The tab shows how many upgrades you can afford right now.

## 6. The elemental system — Decided (structure), Open (tables)

Elements: **Physical, Fire, Water, Frost, Lightning.** Earth and Poison come next, followed by Arcane, Holy and Shadow.

There are three layers:

1. **Damage elements.** Every hit has an element, which resistances act on.
2. **Statuses on units.** Each status carries an element. Applying a status counts as that element "hitting" the unit,
   so it can trigger reactions.
3. **Surfaces on the ground.** These sit on a grid finer than the deployment grid (2 cells per tile). Every 0.5 s,
   surfaces apply their effects to the ground units standing on them. Surfaces expire and some revert to another surface
   (ice melts back to puddle). Some reactions spread through connected cells.

**Reactions** are data tables (`src/data/elements.ts`):

- *Unit reactions:* element × existing status → result. Examples:
  - Lightning on Wet → **Conduct**, ×2 damage
  - Frost on Wet or Chilled → **Freeze**
  - Physical or Lightning on Frozen → **Shatter**, ×2
  - Fire or Lightning on Oiled → **Ignite**, +60 fire and the target is left Burning
  - Fire on Wet → **Evaporate**
  - Water on Burning → **Douse**
- *Surface reactions:* element × surface → new surface. Examples:
  - Lightning on Puddle → **Electrified Water**, which spreads through the connected puddle
  - Frost on Puddle → **Ice**
  - Fire on Puddle → **Steam**, which blocks ranged targeting and scalds whoever stands in it (6 fire per tick)
  - Fire or Lightning on Oil → **Fire**, which spreads
  - Fire on Ice → **Puddle**

**Dial setting (Oct 2026):** the first prototype was far too complex and was cut back hard. The current pass turns it up
a little, with no new statuses, surfaces or elements: lightning now also sparks oil and shatters ice, Ignite leaves
targets burning, steam scalds, and more upgrades (Wildfire, Napalm, Permafrost) put surfaces down.
- Placing a surface onto another counts as its element hitting it, so a puddle poured onto fire becomes steam.

### Friendly fire — Decided

- Main attack damage and splash damage **only hit enemies**.
- Statuses, surfaces and reactions are **neutral**: they hit both sides, and surfaces belong to no one. A Fire Mage's
  burning ground hurts your own knights, and the enemy's Stormcaller can electrify the puddle your Tidecaller made.
- An effect can override this with `affects: enemies | allies | all`. Tower collapse, for example, targets only allies.

The full current tables are shown in-game in the **Codex** tab.

### Complexity budget — Decided

New units should **not** add new surfaces or statuses by default. Prefer reusing Wet, Burning, Chilled/Frozen, Shocked
and Oiled. Surfaces belong behind upgrades (section 5b). Adding a new element (Earth, Poison) is a deliberate, separate
decision.

## 7. Building blocks: effects, traits, tags, selectors — Decided

- **Effects** are the shared vocabulary for attacks, traits, reactions and (later) spells:
  - `damage` (element, radius)
  - `status` (radius or global, `affects`)
  - `surface`
  - `heal`
  - `cleanse`: removes every status from allies in a radius (Cleric Purify)

  A new mechanic is added once as a new effect or trait type, and from then on every unit can use it.
- **Traits:**
  - `aura`: buffs units that match a selector within a radius
  - `onDeath`: effects when a model dies
  - `regen`, optionally stopped while a status is on the unit (`suppressedBy`; Burning stops the Troll)
  - `periodic`: effects every N seconds (the Cleric's heal)
  - `retaliate`: effects applied to an enemy that hits this unit (Glacial Heart)
  - `charge`: the first attack of the battle deals ×N damage (Wolf Riders, Lance Charge, Dive Attack)
  - `onKill`: effects at the killer when one of its attacks kills an enemy, and optionally `recharge` to re-arm its charge
    (Troll Devour heals, Wolf Bloodthirst re-arms the bite)
- **Tags** use `category:value`, for example `faction:greenskin`, `race:goblin`, `class:caster`, `size:large` and
  `element:fire`.
- **Selectors** are the single way to say "these units": side (ally/enemy/any), tag, any-of tags, lacks tag, layer. They
  are used today by auras and `bonusVs`. Factions and upgrades will use them too.

## 8. Factions — Decided (roster), Open (bonuses)

| Faction | Identity | Strengths | Weaknesses |
|---|---|---|---|
| **Greenskins** (goblin, ogre) | numbers, speed, things that explode | swarms, raiders, bats that hunt archers, sappers that blow up armor, oil into fire, goblin auras | goblins die to any hit, ogres take extra fire damage |
| **Kingdom** (human) | discipline and anti-everything; **the strongest and most straightforward faction** | armor, range, anti-air, anti-large, healing, plain stat upgrades | few elemental tools, slow siege |
| **Elementals** | elemental combos; **harder to use**, with hard weaknesses and some total counters (Air vs fliers, Golem vs lightning) | big splash, Wet + lightning, freezing, stuns | slow ground bodies, weak to the opposite element |
| **Independents** | big, unique monsters | Dragon, Troll (regeneration), Giant (boulders) | expensive unlocks, no faction synergies |

**Still open:** faction bonuses for staying in-faction. The plan is to build them from army modifiers based on tags: a
condition that counts squads by tag, plus a stat change applied through a selector. Examples:
- "4+ `faction:greenskin` squads → greenskin units +15% speed"
- "3+ elemental squads → statuses last 50% longer"

Faction weaknesses already work through resistances.

## 9. AI — Decided (approach)

The AI plans by simulation. At the start of each deployment it generates candidate plans: purchases and placements
(with rotation and placement styles), and sometimes an upgrade for a unit it already fields or a tower level. It
simulates each plan against the player's army from last round, including the player's upgrades and tower levels. It
keeps the best by: win (±1000) + surviving value difference + 50% of the money spent on one-time purchases (unlocks,
upgrades, tower levels). Difficulty sets the number of
candidates and the time budget: Easy is 3 candidates plus random noise, Normal 12, Hard 30.

Because the AI only uses the simulator, it handles any unit you design without new code.

**Open:**
- Predict the player's next additions instead of planning only against their last army.
- Plan unlocks over several rounds.
- Learn placement (flanking, tower snipes) instead of using templates.

## 10. Tools — Decided

| Tool | What it's for |
|---|---|
| **Unit editor** | Every field, live, including the two upgrades; raw JSON view; copy/paste of the whole roster. Session-only |
| **Sandbox** | Watch a unit fight another at equal supply, with or without its upgrades, or run 10 headless sims |
| **Balance Lab** | Every unit against every unit at equal supply, in a Web Worker. One-unit-type armies undervalue combo units |
| **Battle report** | After each battle the field resets to deployment positions. The top three damage dealers on each side get gold, silver and bronze medals on the field and an MVP board in the sidebar. Hover any squad: every squad it fought gets a label on the field ("dealt X" / "took Y"). The sidebar shows damage dealt, kills, damage taken, friendly fire, healing, and breakdowns (dealt through mechanism; taken by source, element and reaction) |
| **Replay** | Rerun the exact battle; it is deterministic |
| **How to play** | A five-page walkthrough for new players (header button; opens on the Play tab). The site stores nothing, so it shows on every visit to Play; Skip closes it. The AI defaults to Easy |
| **Codex** | Elemental rules and towers |
| `npm run matrix` | The lab's win-rate matrix in the terminal |

### Damage attribution rules (battle report)

- Attacks and on-hit effects are credited to the attacking squad.
- Status damage over time (Burning) is credited to the squad that applied the status.
- Surface damage is credited to the squad that created the surface, or to the squad that last reacted with it. For
  example, when a Stormcaller electrifies a Tidecaller's puddle, the Stormcaller gets the credit.
- Extra damage from a reaction multiplier, such as Conduct's ×2, is shown as that reaction both in the dealer's "dealt
  through" breakdown and in the victim's "extra damage from reactions" breakdown.
- Damage to your own side counts as friendly fire, never as damage dealt. On the victim's side it is labelled "(ally)".

## 10b. Battle visuals

- Team color (blue = you, red = enemy) marks ownership everywhere: unit outlines, the facing notch, projectile halos and
  trails, and beam glows.
- Element color marks *what* is being thrown: projectile cores and beam cores.
- Size marks *how hard*: projectile radius and beam thickness scale with damage per hit.
- Melee units lunge on attack and leave a slash arc on the target; ranged units recoil.
- Fliers hover above a shadow at their real position and bob gently. Winged fliers (Griffons, Bats, Dragon) flap
  wings; elemental fliers (Wisps, Air Elemental) glow instead.
- Every unit has a vector icon (`src/render/icons.ts`), drawn on its token and in the shop.

## 11. Architecture — Decided

```
src/sim/     deterministic simulation: fixed 50 ms tick, seeded RNG, no DOM
src/data/    content: units, towers, elements and reactions, rules
src/game/    match flow, placement, unlocks, AI, lab
src/render/  canvas drawing
src/ui/      React views
```

- **Determinism is load-bearing.** The same armies with the same seed and the same data always produce the same battle.
  Replays, the AI, the lab and tests all depend on this. Playback speed never changes the outcome; the renderer interpolates models and projectiles between the last two ticks so motion stays smooth at any speed.
- The roster lives in `src/data/units.ts`. The in-app editor is a session-only sandbox; edits reset on reload. Unit changes
  are made in code, by request.
- The app is fully static (GitHub Pages): no storage, no network calls, no analytics. Commit units by exporting them and
  pasting into `src/data/units.ts`.

## 12. Roadmap

Rough priority order. Everything is open to reshuffling.

1. **Balance pass** using the lab and battle reports. A first rock-paper-scissors pass is done (section 4, counter
   web): Knights became low-damage tanks, Longbowmen became anti-swarm and anti-air volleys, and all units move a third
   faster. Still open: in one-unit-type lab fights, fliers (Griffons, Wisps, Air Elementals) dominate because most
   ground units can't hit them. Decide whether that's a lab artifact or a real problem. Upgrades (four per unit since Oct 2026) haven't been tuned.
2. **Faction bonuses** (section 8).
3. **Reaction editor** in-app, so statuses, surfaces and reactions can be iterated like units.
4. **Lab with upgrades and mixed armies**, to compare upgrade A vs B and test combo pairs.
5. **Reinforcement cards / specialists:** a choice at the start of a round, as data-driven modifiers.
6. **Spells:** one-shot effects placed during deployment, using the same effect vocabulary.
7. **Pathfinding and formations:** move around obstacles, and keep squads together.
8. **AI improvements** (section 9).
9. **More elements** (Earth, Poison), only if the complexity budget allows (section 6).
10. **Multiplayer:** much later. Determinism makes lockstep networking feasible.
