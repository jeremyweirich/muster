# Common Ground — Design Document

(The repo and package are still called `muster`, the game's working title.)

Status: living document, written after the first playable prototype. Every number here is a starting point to tune, not
a final value. Sections marked **Decided** are settled direction. Sections marked **Open** still need a decision. Values
in code are the source of truth; this document explains what they are for.

## 1. Pitch

Common Ground is a fantasy deploy-then-autobattle strategy game. Two armies face each other across a field. Each round, both
players recruit squads and place them on their half of the field without seeing what the other is adding. Then the
battle plays out with no input. Armies carry over from round to round and grow, so every round is a reaction to what
the opponent showed last time.

Common Ground sets itself apart through elements. Units make puddles, set fires, spread oil and call down lightning, and these
effects combine with each other. Positioning is about formations, and it is also about the ground the fight will happen
on.

### Pillars

1. **Read and react.** You always see the enemy's last army, so the skill is predicting their answer to your answer.
   Unlock costs make it expensive to hard-counter every move.
2. **The field is a weapon.** Surfaces and statuses persist, spread and react. Two cheap units together can beat one
   expensive unit.
3. **Elements are neutral.** Your fire burns your own troops, and the enemy can electrify your puddle. Combos are
   strong, and that strength comes with risk.
4. **Units are data.** Units are pure data built from shared building blocks, so new ones are quick to invent and
   tune. They are changed in `src/data/units.ts` by request; the battle report and the CLI scripts are the tuning tools.
5. **Readable field.** The field should stay readable. Baseline units create **statuses**, not surfaces. Surfaces are a
   reward that comes from specific upgrades, so the ground only fills up when players choose it.

## 2. Core loop — Decided

```
Round N
 ├─ Income: supply += 200 + 100·N, except round 1 which starts at 400 (unspent supply carries over)
 ├─ Opening (round 1 only): take a random unit's unlock 100 cheaper (same unit for both sides), or +50 supply (section 5)
 ├─ Deployment (simultaneous, blind)
 │    ├─ see the enemy army as it stood last round, plus their unlocks, upgrades and tower levels
 │    ├─ unlock units (one-time cost per match)
 │    ├─ buy upgrades (four per unit; 200 / 400 / 600 / 800 in the order bought, whatever the unit)
 │    ├─ upgrade towers (100 / 200 / 400 / 800)
 │    ├─ promote veterans that earned a level (half unit cost per level; section 5c)
 │    ├─ buy squads, place and rotate them in your zone
 │    ├─ squads from earlier rounds are locked in place
 │    └─ Undo (Ctrl+Z) reverses purchases one at a time; fighting without spending asks for confirmation
 ├─ Battle (automatic, deterministic, up to 90 s; always starts at 1× playback, which is half real time)
 └─ Resolution
      ├─ loser takes damage = Σ over the winner's surviving squads of (cost × fraction alive × 0.08 + 4)
      ├─ time-out: each side takes damage from the other's survivors
      ├─ every squad gains XP = damage dealt + healing done; enough XP unlocks a level (section 5c)
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
  directly under it, towers) beside the field, about 1 : 3. The field keeps its 16:9 shape and fits
  whichever of width or height runs out first.
- **Unlocks in the header.** Above the field, each side's unlocked units sit at the outer end of its health bar (yours
  on the left, the enemy's on the right), with a gold count of upgrades bought. Hovering one shows its name and all of
  its upgrades, with the bought ones starred in gold. On short landscape screens and in portrait the header has no
  room, so the enemy's unlocks stay in the sidebar instead.
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
| `attack` | damage, element, cooldown, range, targets, targeting, delivery, splash, chain, `bonusVs`, `rangeVs` (extra range against matching targets), `prefers` (hunt matching enemies first), `selfDestruct` (dies after its first attack), `onHit` effects |
| `traits` | aura, onDeath, regen, periodic, retaliate, charge, onKill |
| `upgrades` | four upgrades per unit (section 5b); prices are global (`RULES.upgradeCosts`) |
| `tags` | `category:value` labels used by selectors, including `faction:*` and `role:*` |
| `structure` | towers only: anchored and not counted toward winning |

**Behavior.** Each model picks a target (nearest, highest HP, lowest HP, towers first, or enemies matching `prefers` first, among layers it can hit),
walks until it is in range, and attacks. Units with no attack follow the nearest armed ally. Models push each other apart; heavier models get pushed less, and towers never move. Enemies block each other fully, but allies only nudge each other (`RULES.allyPush` = 0.15), so units behind a front line can squeeze through to reach the fight. There is no pathfinding yet.

**Damage pipeline:**
`attack damage × aura buffs × attacker status (Dazed) → reactions with the target's statuses (Conduct ×2, Shatter ×2, …) → bonusVs → target resist → target status (Dazed ×2)`

### Roster (generated by `npm run roster-table`)

There are three factions of six units each (Goblins, Wardens, Elementals), plus two independents. Factions are currently tags and groupings in the
recruit list; faction bonuses come later (section 8).


#### Goblins

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Grunts | 100 | 0 | 16 (4×2) | 15 | 10 | 8 physical / 0.25s, range 0.4 | Swarm, Fast, Melee, Glass cannon | **Scrap Armor**: Pots and planks: +10 HP, and each goblin shrugs off the first hit it takes, so it takes two arrows to drop one. 15% slower.<br>**Feral Frenzy**: Run 30% faster and stab 40% faster.<br>**Party Time**: Goblins love a big fight: +8 goblins per squad.<br>**Oil Bombs**: Every goblin carries a jug of oil, which spills where it falls. Oil slows anyone in it, and fire turns it to burning ground. |
| Skirmishers | 100 | 50 | 10 (4×2) | 13 | 10 | 10 physical / 1.2s, range 3.5 | Skirmisher, Anti-air, Swarm | **Ambush**: Hidden in the grass: enemies can't target a skirmisher until it shoots, and only for 2s after each shot. Splash still finds them.<br>**Barbed Arrows**: Nasty barbed heads: +60% damage.<br>**Improvised Bombs**: Each skirmisher opens with a fire grenade, and lobs another every 6s: a wide blast of fire damage that leaves everyone in it Burning, your own troops too.<br>**Skyshot**: Hunt fliers first, with ×1.5 damage to them. |
| Wolf Riders | 150 | 50 | 4 (2×2) | 20 | 320 | 45 physical / 1s, range 2.5 | Fast, Raider, Skirmisher | **Dire Wolves**: Bigger wolves: +50% HP, +20% damage.<br>**Tower Raiders**: Ignore the army and go straight for the enemy's towers.<br>**Flankers**: Circle the line and run down archers, casters and siege first, with ×1.5 damage to them.<br>**Bloodthirst**: Every kill readies another ×3 charge javelin. Deadly with Flankers against soft targets. |
| Troll | 200 | 75 | 2 (2×1) | 10 | 1000 | 90 physical / 1.3s, range 0.6 | Sturdy, Regenerates, Melee | **Thick Blood**: Regenerates 20 HP/s even while Burning. Fire alone won't stop it any more.<br>**Berserk**: Attacks 50% faster while unhurt, and every hit in a row on the same target lands 25% harder, up to ×2.5. Wasted on small fry, brutal on big targets.<br>**Rock Skin**: Hide like a cliff face: +40% HP.<br>**Boulder Toss**: Throws rocks from 3 tiles away instead of punching, so it never has to touch a pike wall. |
| Ogre Brute | 250 | 100 | 1 (2×2) | 7 | 2400 | 200 physical / 2s, range 0.7, splash 1.1 | Sturdy, Splash, Slow, Melee | **Thick Skull**: +40% HP and no more fire weakness. When something hits it, 40% of the time a nearby goblin (the smaller the better) takes the blow instead, and dies.<br>**Rampage**: Swings 50% faster and moves 30% faster.<br>**Wrecking Swing**: A wider swing: +0.8 splash radius and +20% damage. Swarms melt.<br>**Warboss**: Goblins near the ogre deal 25% more damage and attack 25% faster, and every 5s it bellows a grunt out of nowhere to join the fight. |
| Giant Bats | 200 | 100 | 4 (2×2, air) | 20 | 220 | 45 physical / 1s, range 0.6 | Flier, Fast, Raider | **Leather Wings**: Tough hides shrug off arrows: +30% physical resistance. They also burst off the line 40% faster for the first 3s.<br>**Shriek**: Each bat shrieks as it dives in, and again every 10s: enemies around its target are Dazed for 3s, dealing 10% damage and taking double.<br>**Bloodsuckers**: The bats feed as they fight: they heal for 40% of the damage they deal.<br>**Savage Claws**: +15% HP and +60% damage. |

#### Wardens

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Knights | 200 | 0 | 4 (4×1) | 10 | 760 | 60 physical / 1s, range 0.6 | Sturdy, Melee | **Shield Wall**: +25% HP and +20% physical resistance.<br>**Lance Charge**: 30% faster, and the first strike deals ×4 damage.<br>**Warded Plate**: +40% resistance to fire, frost, lightning and water. The answer to elementals.<br>**Veterans**: Old hands: +25% damage, and each knight shrugs off the first hit it takes. |
| Elven Archers | 100 | 0 | 6 (3×2) | 8 | 100 | 22 physical / 1.5s, range 8 | Ranged, Anti-air | **Longshot**: +4 range.<br>**Fire Arrows**: Arrows burn: fire damage +25%, ignites oiled targets, melts ice.<br>**Volley**: Shoot 40% faster, but loose arcs reach 2 tiles less.<br>**Skyhunters**: Hunt fliers first, with +2 range against them: they shoot them down before they reach the line. |
| Ballista | 150 | 75 | 1 (2×2) | 5 | 320 | 340 physical / 3.5s, range 10 | Sniper, Anti-large, Anti-air, Slow | **Heavy Bolts**: +50% damage. Still one target at a time.<br>**Repeater**: Fires twice as fast for 60% damage per bolt.<br>**Chain Harpoons**: Bolts Chill the target. Hit it again and it freezes; the bolt after that shatters it for double. Pairs with Repeater.<br>**Reinforced Frame**: +100% HP and +30% physical resistance, so raiders can't just walk over it. |
| Griffon Riders | 200 | 100 | 3 (3×2, air) | 18 | 400 | 55 physical / 1s, range 2 | Flier, Fast, Skirmisher | **Dive Attack**: The first strike deals ×4 damage.<br>**Armored Saddles**: +40% HP and +20% physical resistance.<br>**Sky Patrol**: Hunt fliers first, with ×1.75 damage to them.<br>**Pride**: +1 griffon per squad. |
| Cleric | 150 | 75 | 2 (2×1) | 8 | 220 | none | Healer, Support | **Sanctuary**: A second prayer heals 30 more, in a wider circle.<br>**Blessing**: Allies nearby deal +20% damage.<br>**Purify**: Every 2.5s, washes every status off nearby allies: Burning, Frozen, Wet, Oiled, Dazed.<br>**Battle Hymn**: Allies nearby attack 25% faster. With Blessing, the line hits much harder. |
| Pikemen | 150 | 75 | 6 (3×2) | 9 | 260 | 40 physical / 1.2s, range 0.9, splash 0.6 | Anti-large, Splash, Melee | **Pike Wall**: Anyone who hits them in melee takes 30 damage back. Goblins die on the pikes.<br>**Long Pikes**: +1 range, so the back rank fights too.<br>**Heavy Halberds**: +60% damage and wider sweeps.<br>**Drilled Ranks**: +2 pikemen per squad. |

#### Elementals

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Fire Elemental | 250 | 100 | 1 (2×2) | 7 | 1100 | 145 fire / 2.5s, range 7, splash 2 | Splash, Ranged, Slow | **Controlled Burn**: Its flames only catch on enemies, so it can fight right beside your army. +20% damage.<br>**Meteor**: Artillery: +4 range, +50% damage and a wider blast, but fires 30% slower.<br>**Wildfire**: Fireballs leave burning ground. Controlled Burn can't tame it, so keep your army out.<br>**Living Inferno**: Scorches enemies within 2 tiles (20 fire per second), and melee attackers catch fire. |
| Water Elemental | 250 | 100 | 1 (2×2) | 6 | 1800 | 60 water / 2s, range 4, splash 1.2 | Sturdy, Combo | **Glacial Heart**: +40% HP. Enemies that hit it are chilled; hit it twice and they freeze.<br>**Tidal Surge**: +60% damage, +3 range, and hits leave puddles.<br>**Wellspring**: Heals nearby allies 40 every 2s. The only healing the elementals have.<br>**Tsunami**: Waves crash wider: +1 splash radius and +25% damage. Soaks whole formations for lightning. |
| Air Elemental | 200 | 100 | 2 (2×1, air) | 14 | 350 | 45 lightning / 2s, range 5, chain ×2 | Flier, Anti-air, Combo | **Thunderhead**: Lightning jumps 3 more times and hits 20% harder.<br>**Tempest**: +40% HP and attacks 40% faster.<br>**Eye of the Storm**: Hunts fliers first, with ×2 more damage to them (×3 in all). Nothing in the sky survives.<br>**Overcharge**: Each bolt stuns for 1s instead of a flicker. With Thunderhead, whole lines lock up. |
| Wisps | 100 | 50 | 10 (3×2, air) | 16 | 45 | 12 lightning / 1.4s, range 2 | Swarm, Flier, Fast | **Kindling**: Each wisp bursts into flame when destroyed.<br>**Brighter Swarm**: +6 wisps per squad.<br>**Static Sparks**: Each zap stuns for a flicker. A big swarm keeps a lone giant locked down.<br>**Flicker**: Hard to hit with steel: +50% physical resistance. Arrows and swords barely touch them. |
| Frost Elemental | 200 | 100 | 1 (2×2) | 7 | 1500 | 65 frost / 1.6s, range 5 | Combo, Ranged, Slow | **Blizzard**: The beam bursts: frost hits and chills everything within 1.4 tiles, for 30% less damage.<br>**Permafrost**: Hits leave ice on the ground that chills anyone standing in it. Fire melts it to water.<br>**Cold Snap**: Attacks 50% faster: chill, freeze, chill, freeze.<br>**Glacier**: +50% HP and +30% physical resistance. |
| Stone Golem | 200 | 75 | 1 (3×3) | 6 | 2400 | 220 physical / 2s, range 0.8 | Sturdy, Melee, Slow | **Granite**: +40% HP and +20% physical resistance.<br>**Quake**: Slams shake the ground: they splash, and stun everything around for 0.5s.<br>**Magma Core**: Fists turn molten: fire damage that sets enemies Burning. Melts armor and stops trolls healing.<br>**Landslide**: Rolls into battle 60% faster, and its first slam deals ×3. |

#### Independents

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Dragon | 600 | 200 | 1 (4×4, air) | 9 | 4200 | 95 fire / 1.6s, range 3, splash 1.8 | Flier, Splash, Sturdy | **Inferno**: +25% damage, and its breath leaves burning ground.<br>**Ancient Scales**: +40% HP and +30% physical resistance.<br>**Elder Blood**: Regenerates 40 HP/s, except while Chilled.<br>**Dread**: Its breath terrifies: everything it scorches is Dazed for 1.5s (deals 10%, takes double). |
| Giant | 350 | 150 | 1 (3×3) | 5 | 3000 | 200 physical / 3.2s, range 6, splash 1.8 | Splash, Sturdy, Slow, Ranged | **Earthshaker**: Boulders briefly stun everything they land on.<br>**Thick Hide**: +40% HP and +25% physical resistance.<br>**Rockslide**: Bigger rocks, thrown farther: +3 range and a wider blast.<br>**Frost Giant**: Boulders of ice: frost damage that Chills where they land and freezes anything Wet or already chilled. |

### Counter web — Decided (direction), Open (numbers)

Rock-paper-scissors is the main balance goal. Every unit should be strong against some things and clearly weak against
others, and no army should be a safe default. Knight + archer spam in particular must have several direct answers.

Lethality: fights are meant to be short. A Knight mirror resolves in about 25–30 s; most mixed fights end in 10–45 s.

- **Grunts** die to any single non-goblin hit (10 HP) but stab very fast (8 damage every 0.25 s). Archers and anything
  that hits often stop them; a mob that reaches soft or slow units shreds them. Feral Frenzy and Party Time make them
  much deadlier. Scrap Armor (20 HP plus a shield that blocks the first hit) takes two arrows per goblin, which turns
  them into chaff that soaks big hitters. Oil Bombs leave oil where they fall.
- **Skirmishers** are goblin archers: 10 cheap, fragile bodies with short bows (range 3.5) that hit ground and air.
  Unupgraded they're chaff and the goblins' first answer to fliers. Upgrades make them problem solvers: Ambush (can't be
  targeted until they shoot), Barbed Arrows, Improvised Bombs (fire grenades on first contact and every 6 s, which burn
  friend and foe).
- **Knights** are the tank: the most effective HP per supply, low damage per supply. Arrows bounce off them. Fire,
  Ogres, Trolls and grenades answer them; Warded Plate answers the elemental answers.
- **Elven Archers** are steady single-target arrows: they pick off swarms and Griffons, and lose to armor, Giant Bats and
  anything big. Skyhunters (hunt fliers first, +2 range vs them) turns them into flier hunters; Volley trades 2 range
  for rate of fire.
- **Giant Bats** fly over the front line and hunt ranged, caster and siege units first (×2 damage to them). They can only
  hit the ground, so Griffons, Air Elementals, Skirmishers and other anti-air swat them.
- **Trolls** are the goblins' early bruisers: two big bodies with mild regeneration that stops while Burning. Berserk
  (faster while unhurt, ramping damage on one target) makes them specialists against big targets.
- **Fire** (Fire Elemental, Improvised Bombs, Fire Arrows, Magma Core) ignores physical armor and stops the Troll's
  regeneration (until Thick Blood).
- **Air Elemental** is the dedicated anti-air (×1.5 vs fliers, chain lightning). With Eye of the Storm it is a total
  counter to fliers: Wisps, Bats and Griffons simply die. It resists lightning (60%) but isn't immune, so Air mirrors end.
- The **Ballista** is a single-target sniper (no splash, even fully upgraded) that hunts the biggest unit: Ogre, Giant,
  elementals, Dragon. Swarms and raiders beat it. **Splash** (Ogre, Fire Elemental, Giant, Pikemen) shreds swarms.
  **Wolf Riders** throw javelins from just outside melee (range 2.5) and run down archers and siege. Water and Air
  Elementals are a combo pair.
- **Frost Elemental** is single-target control: chill, then freeze; physical allies shatter frozen enemies for ×2. Fire
  melts it (−60% fire resistance). **Stone Golem** is the elementals' plain front line: one huge body (3×3, size
  1.25) that is immune to lightning, hard to burn, worn away by water, and easy for swarms to surround.
- **Skirmishers** (the goblin Skirmishers, Wolf Riders, Griffon Riders) shoot or throw from just outside melee. There are fewer pure melee units than
  before, and more short-range attacks, so the fight has a front line, a skirmish line and a back line.
- **Pikemen** are the Wardens' answer to rushes: a pike line with short sweeping splash and ×1.75 damage to cavalry
  and large units, so goblins, wolves, ogres, trolls and golems run onto it. Pike Wall hurts every melee attacker (each
  goblin stab costs a goblin, and it is the one thing on the ground that punishes Giant Bats). Archers, fire, fliers and
  the Troll's Boulder Toss beat it.

**Measured on the previous roster** (before the Oct 2026 goblin rework: Goblin Horde, Sappers, Alchemist and Bat
Riders, with the Troll as an independent), so the Greenskin row is out of date. Re-run with
`npm run experiments -- G`. Faction armies at about 1000 supply, towers on, sides alternated (12 seeds; win rate of
the row army). First number:
no upgrades. Second: one cheap upgrade on key units (Knights Shield Wall; Longbow Volley or Halberdiers Pike Wall; Horde
Frenzy, Sappers Big Kegs; Air Thunderhead, Water Tidal Surge; Frost Blizzard, Fire Controlled Burn; Troll Berserk, Giant
Earthshaker).

| Army | vs Greenskin | vs Storm | vs Frost/Fire | vs Independents |
|---|---|---|---|---|
| Wardens, archers (2 Knights, 3 Longbow, Ballista, Cleric) | 58% / 25% | 100% / 83% | 67% / 100% | 100% / 100% |
| Wardens, pikes (2 Knights, 2 Longbow, Halberdiers, Ballista, Cleric) | 100% / 75% | 100% / 0% | 25% / 25% | 100% / 100% |
| Greenskin (3 Horde, Wolves, 2 Sappers, Bats, Alchemist) | — | 0% / 0% | 0% / 0% | 100% / 100% |
| Storm (Water, 2 Air, Golem, Wisps) | 100% / 100% | — | 25% / 42% | 100% / 100% |
| Frost/Fire (Fire, Frost, Golem, Air, Wisps) | 100% / 100% | 83% / 17% | — | 100% / 100% |

Measured after Wolf Riders got javelins and the Stone Golem became one huge model, all at level 1. The Wardens are on
top without upgrades, and its two builds are a real choice of counterpunch: pikes answer Greenskins, archers answer
Elementals. Elementals beat Greenskins. Fights last 8–45 s. With one upgrade each, the Storm army edges ahead, which is
the first thing to look at once upgrades get tuned. Upgrades and veterancy haven't been tuned; expect balance to move a
lot.

One-unit-type fights (the Counters tab, `npm run matrix`) still over-reward fliers, because most ground units can't hit them at all.

### Roles

Role tags (`role:*`) say what a unit is *for*. They show on hover in the recruit list and in the Codex. The current
roles are Sturdy, Swarm, Fast, Slow, Sniper, Ranged, Melee, Splash, Anti-air, Anti-large, Flier, Support, Healer, Combo,
Regenerates, Glass cannon, Raider and Skirmisher. They live in `src/data/roles.ts`.

## 5. Unlocks — Decided (values open)

- Units with `unlockCost: 0` (Grunts, Knights, Elven Archers) are available from the start. Every other unit costs a
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
anyone an edge. Both sides are offered the same unit, so each can guess what the other might build. The player must choose before the first Fight. The AI chooses at random
when the match starts, and tries its discounted unit more often while planning. The enemy's choice is shown from round 2: a small % badge on the
discounted unit beside its health bar (dimmed if not unlocked yet), or a "+50 supply" note. Your own discount wears
the same badge.

## 5b. Upgrades — Decided (values open)

- Every unit has **four upgrades**. Each is a one-time purchase per match that changes **every squad** of that unit,
  including squads placed in earlier rounds.
- **Flat prices by order:** a unit's upgrades cost **200 / 400 / 600 / 800** in the order you buy them, whatever the unit
  (`RULES.upgradeCosts`). Each step makes the unit a deeper, more expensive specialist. The price is the same for
  Grunts and a Dragon, so upgrading a unit you field a lot of is better value.
- **Specialists, not jacks of all trades.** Roughly: two upgrades set the unit's main paths, one deepens a path, and one
  opens a new direction. Pairs are designed to multiply each other, so the later, pricier buys stay tempting:
  - Grunts *Scrap Armor* + Ogre *Thick Skull* (armored grunts soak the hits the ogre passes on); Ogre *Warboss* near
    grunts (faster, harder stabs, and a fresh grunt every 5 s)
  - Grunts *Oil Bombs* + Skirmisher *Improvised Bombs* (fallen goblins' oil goes up in flames, on both sides)
  - Troll *Berserk* + *Thick Blood* (regenerating back to full HP brings back the faster attacks)
  - Wolf Riders *Flankers* + *Bloodthirst* (each kill re-arms the ×3 charge bite)
  - Ballista *Chain Harpoons* + *Repeater* (chill → freeze → shatter for ×2)
  - Air Elemental *Thunderhead* + *Overcharge* (whole lines stunned); Water *Tsunami* next to Air (mass Conduct)
  - Frost Elemental *Blizzard* + *Cold Snap* (mass freezing); Cleric *Blessing* + *Battle Hymn*
- **Counterpunch upgrades.** Several upgrades answer a specific answer: Knights *Warded Plate* (vs elementals), Troll
  *Thick Blood* (regenerates while burning), Troll *Boulder Toss* (vs Pike Wall), Ballista *Reinforced Frame* (vs
  raiders), Wisps *Flicker* (vs arrows), Grunts *Scrap Armor* (vs archers), Skirmishers *Ambush* (vs archers), Cleric *Purify* (vs statuses), Golem *Magma Core* (vs trolls and armor).
- **Warden upgrades stay plain**: armor, damage, range, rate of fire, more bodies. The elementals' and goblins'
  upgrades are where the combos live.
- **Surfaces come from upgrades.** Inferno, Wildfire, Oil Bombs, Tidal Surge and Permafrost are the only things
  that put surfaces on the field. Everything else uses statuses.
- Data: an upgrade can apply stat mods (`value × mult + add` to hp, speed, size, spacing, squadSize, damage, cooldown,
  range, splash or chainCount). It can replace the attack's element, targets, targeting, delivery or preferred targets
  (`prefers`); add bonus damage (`bonusVs`), bonus range (`rangeVs`) and on-hit effects; limit who its on-hit statuses land on (`onHitAffects`,
  e.g. Controlled Burn: enemies only, so no friendly fire); add or replace traits; and add resistances, status
  immunities and tags. Upgraded units are computed per side, so each army fights with its own upgrades.
- Bought upgrades show as ★ next to the unit in the shop. The enemy's upgrades are visible too.
- **Buying:** the sidebar's Upgrades tab lists every unlocked unit with its upgrades as one-click buttons (name, price,
  what it does), plus tower levels. The tab shows how many upgrades you can afford right now.

## 5c. Veterancy — Decided (values open)

Placing a squad well, so it deals a lot of damage without being destroyed, earns it experience, and experience lets you
make it stronger.

- **XP** is damage dealt to enemies plus healing done, added up over every battle the squad fights (stored on the
  placed squad). Squads keep their XP between rounds. Leveling doesn't depend on whether the squad survived.
- **Unlocking a level.** Total XP of 1,200 / 4,000 / 9,000 / 16,000 unlocks level 2 / 3 / 4 / 5 (`RULES.levelXp`). Each
  step needs more XP than the last. In a typical battle the MVP deals about 2,000, second place about 1,200 and third
  about 800, so one good fight usually unlocks a level for the MVP, often for second place, and only sometimes for
  third. Bigger late-game armies get there faster.
- **One level at a time.** A squad holds at most one unpaid level: while a level is waiting, its XP stops at that
  level's threshold and the rest is lost (`capXp`). So a squad can't bank levels and be promoted several times in a row.
- **Promoting.** An unlocked level does nothing until you pay for it. At deployment, a squad with a level waiting shows
  a gold chevron above it. Click the squad, use its card, or use the Promotions list in the Upgrades tab. Each
  promotion costs half the unit's base price (`promotePrice`), a reward for the work of earning it. Undo reverses it.
- **Effect:** a level-N squad has N× the base HP, attack damage, healing, regeneration and trait damage (on-death,
  periodic, retaliation, on-kill). Speed, range, cooldowns, statuses and surfaces don't change. Upgrades apply first,
  then the level.
- **Round damage ignores levels.** The damage a winner deals at the end of the round still uses the unit's base cost ×
  fraction alive, so a veteran isn't worth more HP damage than a fresh squad.
- Promoted squads show a gold `LvN` tag on their footprint during deployment and in the report, and one gold ring per
  level on each model in battle. Enemy levels are visible.
- Code: `src/sim/levels.ts` (`earnedLevel`, `levelDef`), XP is awarded in `applyRound` (`src/game/match.ts`), and the
  battle builds each squad at its `level`. The Counters tab, the matrix and balance tests run everything at level 1.

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
targets burning, steam scalds, and more upgrades (Wildfire, Oil Bombs, Permafrost) put surfaces down.
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
  - `summon`: new models of a unit join the source's squad for this battle (Warboss). They fight and earn the squad
    XP, but don't count among its survivors for round damage

  A new mechanic is added once as a new effect or trait type, and from then on every unit can use it.
- **Traits:**
  - `aura`: buffs units that match a selector within a radius
  - `onDeath`: effects when a model dies
  - `regen`, optionally stopped while a status is on the unit (`suppressedBy`; Burning stops the Troll)
  - `periodic`: effects every N seconds (the Cleric's heal). Area statuses and blasts around the unit reach both
    layers. With `atTarget` the effects land on its current target while in range, and the first is ready at once
    (Improvised Bombs, Shriek)
  - `retaliate`: effects applied to an enemy that hits this unit (Glacial Heart)
  - `charge`: the first attack of the battle deals ×N damage (Wolf Riders, Lance Charge, Dive Attack)
  - `onKill`: effects at the killer when one of its attacks kills an enemy, and optionally `recharge` to re-arm its charge
    (Wolf Bloodthirst re-arms the bite)
  - `shield`: each model ignores its first N hits in a battle, including damage over time (Scrap Armor, Veterans)
  - `ambush`: can't be targeted except for N seconds after its own attacks; splash and area effects still hit it
    (Skirmishers Ambush)
  - `ramp`: each hit in a row on the same target deals +X% more, up to a cap (Troll Berserk)
  - `unhurt`: attacks faster while at full HP (Troll Berserk)
  - `sprint`: moves faster for the first N seconds of a battle (Giant Bats Leather Wings)
  - `lifesteal`: heals for a share of the damage its attacks deal to enemies (Bloodsuckers)
  - `meatShield`: when hit by an enemy attack, a chance that a nearby ally matching a selector (the smallest first)
    dies in its place (Ogre Thick Skull)
- **Tags** use `category:value`, for example `faction:goblin`, `race:goblin`, `class:caster`, `size:large` and
  `element:fire`.
- **Selectors** are the single way to say "these units": side (ally/enemy/any), tag, any-of tags, lacks tag, layer. They
  are used today by auras and `bonusVs`. Factions and upgrades will use them too.

## 8. Factions — Decided (roster), Open (bonuses)

| Faction | Identity | Strengths | Weaknesses |
|---|---|---|---|
| **Goblins** (goblin, troll, ogre) | numbers, speed, chaos with heart | swarms, raiders, short bows that also hit fliers, bats that hunt archers, regenerating trolls, oil and fire, the ogre warboss | goblins die to any hit, ogres and trolls take extra fire damage |
| **Wardens** (human) | discipline and anti-everything; **the strongest and most straightforward faction** | armor, range, anti-air, anti-large, healing, plain stat upgrades | few elemental tools, slow siege |
| **Elementals** | elemental combos; **harder to use**, with hard weaknesses and some total counters (Air vs fliers, Golem vs lightning) | big splash, Wet + lightning, freezing, stuns | slow ground bodies, weak to the opposite element |
| **Independents** | big, unique monsters | Dragon, Giant (boulders) | expensive unlocks, no faction synergies |

**Still open:** faction bonuses for staying in-faction. The plan is to build them from army modifiers based on tags: a
condition that counts squads by tag, plus a stat change applied through a selector. Examples:
- "4+ `faction:goblin` squads → goblin units +15% speed"
- "3+ elemental squads → statuses last 50% longer"

Faction weaknesses already work through resistances.

## 9. AI — Decided (approach)

The AI plans by simulation. At the start of each deployment it generates candidate plans: purchases and placements
(with rotation and placement styles), and sometimes an upgrade for a unit it already fields or a tower level. It
often promotes veterans that have earned a level (each about 60% of the time, if it can afford it), and simulates them
at their new level. It
simulates each plan against the player's army from last round, including the player's upgrades and tower levels. It
keeps the best by: win (±1000) + surviving value difference + 50% of the money spent on one-time purchases (unlocks,
upgrades, tower levels, promotions). Difficulty sets the number of
candidates and the time budget: Easy is 3 candidates plus random noise, Normal 12, Hard 30.

Because the AI only uses the simulator, it handles any unit you design without new code.

**Open:**
- Predict the player's next additions instead of planning only against their last army.
- Plan unlocks over several rounds.
- Learn placement (flanking, tower snipes) instead of using templates.

**Parked (owner's plan, Oct 2026; keep the current AI for now):** difficulty as personality, not just search effort.
- **Easy:** slowly builds a nice symmetric board with an even mix of big, small, air, ground, ranged, melee and so on,
  but doesn't directly counter units until it has taken significant damage from them. It leaves temporary gaps (no
  chaff, no chaff clear, not enough damage, no anti-air) that the player can exploit.
- **Medium:** builds a structured board and picks counters earlier. It's deliberate about getting a mix of chaff, tank,
  damage and anti-air early, instead of going several rounds without remembering to add chaff.
- **Hard:** a structured board plus a couple of powerful tempo options on top of the counter matrix: rushing undefended
  towers with wolves, sudden massive air investments, pushing very hard on one side. Perhaps it simulates two rounds
  out, so it at least has a plan for the counterpunch.

The campaign outline (docs/CAMPAIGN.md) casts these as commanders: the goblin Boss plays like Easy, the Tinker like Hard.

## 10. Tabs and tools — Decided

The tabs, in order: **Play** (the default: the full game against the AI, every unit available), **Story**, **Codex**,
**Counters**. The site opens on Play.

| Tool | What it's for |
|---|---|
| **Battle report** | After each battle the field resets to deployment positions. The top three damage dealers on each side get gold, silver and bronze medals on the field and an MVP board in the sidebar. Hover any squad: every squad it fought gets a label on the field ("dealt X" / "took Y"). The sidebar shows damage dealt, kills, damage taken, friendly fire, healing, and breakdowns (dealt through mechanism; taken by source, element and reaction) |
| **Replay** | Rerun the exact battle; it is deterministic |
| **How to play** | A five-page walkthrough for new players (header button; opens on the Play tab). The site stores nothing, so it shows on every visit to Play; Skip closes it. The AI defaults to Easy |
| **Story** | The Compact and the three campaigns (docs/CAMPAIGN.md), listed as coming soon. Data in `src/data/campaign.ts` |
| **Codex** | The rulebook, written for a brand-new player: the Compact, rounds and HP, ground and air, Keeps, friendly fire, unlocks, upgrades, veterans, every role, element, status, surface and reaction. Every topic has an anchor (`#codex/<topic>`). Numbers come from the data files |
| **Counters** | "I'm getting wrecked by X, what do I build?" Pick an enemy unit; every other unit fights it at equal supply (one-unit armies, level 1, no upgrades, no Keeps) in a Web Worker, sorted into Build these / Even fights / Don't send these, with plain-word reasons read from the data (`src/game/counters.ts`). Upgrades are out of scope. Cached per session; `#counters/<unit>` links to one unit |
| `npm run matrix` | Every unit against every unit, one-unit armies, as a win-rate matrix in the terminal |

### Codex links — Decided

Game screens don't explain rules; they link to the Codex. Role chips, elements, layers ("hits ground + air"),
resistances, and keywords inside unit and upgrade descriptions (Burning, Wet, fliers, splash, Keeps, ...) are links
(`src/ui/codexLinks.tsx`, which lists the keywords; first mention only). Buttons (like the upgrade buy buttons) stay
plain text. A test checks that every link target exists. When adding a status, surface, role or rule section, give it a
Codex entry and, if players will meet the word in descriptions, a keyword.

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
- Veterans (level 2+) have a gold ring per level around each model and a gold `LvN` tag on their deployment footprint.
  A squad ready for promotion gets a pulsing gold chevron above it.

## 11. Architecture — Decided

```
src/sim/     deterministic simulation: fixed 50 ms tick, seeded RNG, no DOM
src/data/    content: units, towers, elements and reactions, rules
src/game/    match flow, placement, unlocks, AI, one-unit matchups (lab) and counter reasons
src/render/  canvas drawing
src/ui/      React views
```

- **Determinism is load-bearing.** The same armies with the same seed and the same data always produce the same battle.
  Replays, the AI, the Counters tab and tests all depend on this. Playback speed never changes the outcome; the renderer interpolates models and projectiles between the last two ticks so motion stays smooth at any speed.
- The roster lives in `src/data/units.ts`. There is no in-app editor: unit changes are made in code, by request.
- The app is fully static (GitHub Pages): no storage, no network calls, no analytics.

## 12. Roadmap

Rough priority order. Everything is open to reshuffling.

1. **Balance pass** using the matrix, the experiments script and battle reports. A first rock-paper-scissors pass is done (section 4, counter
   web): Knights became low-damage tanks, Longbowmen (now Elven Archers) became anti-swarm and anti-air volleys, and all units move a third
   faster. Still open: in one-unit-type fights, fliers (Griffons, Wisps, Air Elementals) dominate because most
   ground units can't hit them. Decide whether that's an artifact of one-unit armies or a real problem. Upgrades (four per unit since Oct 2026) haven't been tuned.
2. **Faction bonuses** (section 8).
3. **Campaigns** (docs/CAMPAIGN.md): mission framework, then the Wardens campaign. Parked until stored progress is
   decided: saving the player's winning board from a campaign finale as the Drill Book's last page.
4. **Mixed armies and upgrades in the experiments script**, to compare upgrade A vs B and test combo pairs.
5. **Reinforcement cards / specialists:** a choice at the start of a round, as data-driven modifiers.
6. **Spells:** one-shot effects placed during deployment, using the same effect vocabulary.
7. **Pathfinding and formations:** move around obstacles, and keep squads together.
8. **AI improvements** (section 9).
9. **More elements** (Earth, Poison), only if the complexity budget allows (section 6).
10. **Multiplayer:** much later. Determinism makes lockstep networking feasible.
