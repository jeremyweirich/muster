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
 ├─ Deployment (simultaneous, blind)
 │    ├─ see the enemy army as it stood last round, plus their unlocks, upgrades and tower levels
 │    ├─ unlock units (one-time cost per match)
 │    ├─ buy upgrades (one-time per unit; the first costs the unit price, the second double)
 │    ├─ upgrade towers (100 / 200 / 400 / 800)
 │    ├─ buy squads, place and rotate them in your zone
 │    ├─ squads from earlier rounds are locked in place
 │    └─ Undo (Ctrl+Z) reverses purchases one at a time; fighting without spending asks for confirmation
 ├─ Battle (automatic, deterministic, up to 90 s; always starts at 1× speed)
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

Each side has two towers near the back of its zone, 2 rows in from the back edge (`RULES.towerInset`), spaced apart
horizontally and mirrored for the opponent. Squads can stand behind them:

| Tower | Layer | Base HP | Weapon |
|---|---|---|---|
| Keep | ground | 150 | light crossbow: 15 physical / 1 s, range 6, hits ground and air |
| Sky Spire | air | 120 | none; only anti-air can reach it |

- **Unupgraded towers are fragile.** Almost any squad that reaches one kills it in a second or two.
- **Tower upgrades.** Each tower is upgraded separately. Levels cost 100 / 200 / 400 / 800, and each adds +300 HP, so HP
  grows in a straight line while the price doubles.
- **Collapse.** When a tower falls, **its owner's entire army is Dazed**: it deals 10% damage and takes double damage.
  The Daze lasts **8 s at level 0, 1 s less per level** (minimum 4 s).
- Towers don't move and don't count toward winning the round. A side loses when its *army* is gone.
- **Why:** a single strong deathball in the center leaves the flanks open. A cheap raider that slips through and snipes a
  tower can swing the main fight. Tower levels are the counter-investment: you pay supply for insurance instead of army.
- The ground Keep can be reached by any army. The flying Spire can only be reached by anti-air, which gives fliers and
  archers a strategic job beyond fighting units. Wolf Riders can buy *Tower Raiders* to go straight for towers.

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
| `traits` | aura, onDeath, regen, periodic, retaliate, charge |
| `upgrades` | two upgrades per unit (section 5b) |
| `upgradeCost` | price of the first upgrade bought (default: unit cost); the second costs double |
| `tags` | `category:value` labels used by selectors, including `faction:*` and `role:*` |
| `structure` | towers only: anchored and not counted toward winning |

**Behavior.** Each model picks a target (nearest, highest HP, lowest HP, towers first, or enemies matching `prefers` first, among layers it can hit),
walks until it is in range, and attacks. Units with no attack follow the nearest armed ally. Models push each other apart; heavier models
get pushed less, and towers never move. There is no pathfinding yet.

**Damage pipeline:**
`attack damage × aura buffs × attacker status (Dazed) → reactions with the target's statuses (Conduct ×2, Shatter ×2, …) → bonusVs → target resist → target status (Dazed ×2)`

### Roster (generated by `npm run roster-table`)

There are three factions plus independents. Factions are currently tags and groupings in the recruit list; faction
bonuses come later (section 8).

#### Greenskins

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Goblin Horde | 100 | 0 | 16 (4×2) | 15 | 10 | 8 physical / 0.25s, range 0.4 | Swarm, Fast, Melee, Glass cannon | **Frenzy**: Run 30% faster and stab 40% faster.<br>**Bigger Mob**: +8 goblins per squad: more bodies to soak the hits, more knives in the fight. |
| Wolf Riders | 150 | 50 | 4 (2×2) | 20 | 320 | 45 physical / 1s, range 0.5 | Fast, Raider, Melee | **Dire Wolves**: Bigger wolves: +50% HP, +20% damage.<br>**Tower Raiders**: Ignore the army and go straight for the enemy's towers. |
| Goblin Alchemist | 100 | 50 | 3 (3×1) | 11 | 100 | 18 physical / 2s, range 5, splash 1.2 | Combo, Ranged | **Oil Slick**: Flasks leave oil on the ground. It slows, and fire races through it.<br>**Firebombs**: Flasks burst into flame: fire damage ×2, igniting oiled targets. |
| Goblin Sappers | 100 | 50 | 6 (3×2) | 16 | 50 | 140 fire / 1s, range 0.3, splash 1.4 | Splash, Fast, Glass cannon | **Volatile Powder**: Kegs also go off when a sapper is killed, so cutting them down up close still hurts.<br>**Big Kegs**: +50% blast damage and a wider blast. |
| Bat Riders | 200 | 100 | 4 (2×2, air) | 20 | 240 | 45 physical / 1s, range 0.6 | Flier, Fast, Raider | **Shriek**: Each hit Dazes the target for 2s: it deals 10% damage and takes double.<br>**Colony**: +2 bats per squad. |
| Ogre Brute | 250 | 100 | 1 (2×2) | 7 | 2400 | 200 physical / 2s, range 0.7, splash 1.1 | Sturdy, Splash, Slow, Melee | **Thick Skull**: +40% HP and no more fire weakness.<br>**Rampage**: Swings 50% faster and moves 30% faster. |

#### Kingdom

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Knights | 200 | 0 | 4 (4×1) | 10 | 700 | 55 physical / 1s, range 0.6 | Sturdy, Melee | **Shield Wall**: +25% HP and +20% physical resistance.<br>**Lance Charge**: 30% faster, and the first strike deals ×4 damage. |
| Longbowmen | 100 | 0 | 6 (3×2) | 8 | 100 | 20 physical / 1.5s, range 8 | Ranged, Anti-air | **Longshot**: +3 range.<br>**Fire Arrows**: Arrows burn: fire damage +25%, ignites oiled targets, melts ice. |
| Ballista | 150 | 75 | 1 (2×2) | 5 | 320 | 340 physical / 3.5s, range 10 | Sniper, Anti-large, Anti-air, Slow | **Heavy Bolts**: +40% damage, and bolts splash.<br>**Repeater**: Fires twice as fast for 60% damage per bolt. |
| Griffon Riders | 200 | 100 | 3 (3×2, air) | 18 | 400 | 55 physical / 1s, range 0.8 | Flier, Fast, Raider | **Dive Attack**: The first strike deals ×4 damage.<br>**Armored Saddles**: +40% HP and +20% physical resistance. |
| Cleric | 150 | 75 | 2 (2×1) | 8 | 220 | none | Healer, Support | **Sanctuary**: Heals 70 in a wider circle.<br>**Blessing**: Allies nearby deal +20% damage. |

#### Elementals

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Fire Elemental | 250 | 100 | 1 (2×2) | 7 | 1100 | 145 fire / 2.5s, range 7, splash 2 | Splash, Ranged, Slow | **Controlled Burn**: Its flames only catch on enemies, so it can fight right beside your army. +20% damage.<br>**Meteor**: Artillery: +4 range, +50% damage and a wider blast, but fires 30% slower. |
| Water Elemental | 250 | 100 | 1 (2×2) | 6 | 1800 | 60 water / 2s, range 4, splash 1.2 | Sturdy, Combo | **Glacial Heart**: +40% HP. Enemies that hit it are chilled; hit it twice and they freeze.<br>**Tidal Surge**: +60% damage, +3 range, and hits leave puddles. |
| Air Elemental | 200 | 100 | 2 (2×1, air) | 14 | 350 | 45 lightning / 2s, range 5, chain ×2 | Flier, Anti-air, Combo | **Thunderhead**: Lightning jumps 3 more times and hits 20% harder.<br>**Tempest**: +40% HP and attacks 40% faster. |
| Wisps | 100 | 50 | 10 (3×2, air) | 16 | 45 | 12 lightning / 1.4s, range 2 | Swarm, Flier, Fast | **Kindling**: Each wisp bursts into flame when destroyed.<br>**Brighter Swarm**: +6 wisps per squad. |

#### Independents

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Dragon | 600 | 200 | 1 (4×4, air) | 9 | 4200 | 95 fire / 1.6s, range 3, splash 1.8 | Flier, Splash, Sturdy | **Inferno**: +25% damage, and its breath leaves burning ground.<br>**Ancient Scales**: +40% HP and +30% physical resistance. |
| Troll | 200 | 75 | 2 (2×1) | 10 | 1000 | 90 physical / 1.3s, range 0.6 | Sturdy, Regenerates, Melee | **Rock Skin**: +30% physical resistance, and fire only hurts it a little extra.<br>**Berserk**: Attacks 65% faster and regenerates even quicker. |
| Giant | 350 | 150 | 1 (3×3) | 5 | 3000 | 200 physical / 3.2s, range 6, splash 1.8 | Splash, Sturdy, Slow, Ranged | **Earthshaker**: Boulders briefly stun everything they land on.<br>**Thick Hide**: +40% HP and +25% physical resistance. |

### Counter web — Decided (direction), Open (numbers)

Rock-paper-scissors is the main balance goal. Every unit should be strong against some things and clearly weak against
others, and no army should be a safe default. Knight + Longbow spam in particular must have several direct answers.

Lethality: fights are meant to be short. A Knight mirror resolves in about 25–30 s; most mixed fights end in 10–45 s.

- **Goblin Horde** dies to any single non-goblin hit (10 HP) but stabs very fast (8 damage every 0.25 s). Archers and
  anything that hits often stop it; a horde that reaches soft or slow units shreds them. Frenzy and Bigger Mob make it
  much deadlier.
- **Knights** are the tank: the most effective HP per supply, low damage per supply. Arrows bounce off them. Fire,
  Sappers, Ogres and Trolls answer them.
- **Longbowmen** are steady single-target arrows: they pick off swarms and Griffons, and lose to armor, Bat Riders and
  anything big.
- **Goblin Sappers** run in and blow up (fire, splash), one blast each. They delete clumped Knights and big units, but
  archers can pop them on the way in.
- **Bat Riders** fly over the front line and hunt ranged, caster and siege units first (×2 damage to them). They can
  only hit the ground, so Griffons, Air Elementals and other anti-air swat them.
- **Fire** (Fire Elemental, Sappers, Firebombs, Fire Arrows) ignores physical armor and stops the Troll's regeneration.
- **Air Elemental** is the dedicated anti-air (×1.5 vs fliers, chain lightning).
- The **Ballista** hunts large units (Ogre, Giant, elementals, Dragon). **Splash** (Ogre, Fire Elemental, Giant,
  Alchemist) shreds swarms. **Wolf Riders** run down archers and siege. Water and Air Elementals are a combo pair.

Army-level results at 1000 supply each, towers on (8 seeds, `autoPlace` positions):

| Army | vs Knight + Longbow | vs Fire line | vs Bats + Sappers |
|---|---|---|---|
| Knight + Longbow (3 Knights, 4 Longbow) | ~40% (mirror) | 0% | ~5% |
| Fire line (2 Knights, 2 Fire Elementals, 1 Longbow) | 100% | — | 0% |
| Goblin flood (4 Horde, 2 Sappers, 2 Bats) | ~70% | 100% | ~50% (time-outs) |
| Bats + Sappers (3 Bats, 4 Sappers) | ~95% | 100% | — |
| Anti-air line (2 Knights, 2 Air Elementals, 2 Longbow) | 0% | ~15% | 100% |

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

**Open:** whether starting unlocks should be random or drafted per match (as with Mechabellum's starting units), and
whether unlock costs should scale with the round.

## 5b. Upgrades — Decided (values open)

- Every unit has **two upgrades**. Each is a one-time purchase per match that changes **every squad** of that unit,
  including squads placed in earlier rounds.
- **Price depends on order:** whichever you buy first costs about the unit's price (`upgradeCost`, which defaults to
  `cost`). The second costs **double**. Both are meant to be strong, and the choice of which to take first should matter.
- **Upgrades should add personality**, not just numbers. Good upgrades change how a unit plays. Examples:
  - Goblins *Bigger Mob* (more bodies) or *Frenzy* (much faster)
  - Water Elemental *Glacial Heart* (freeze whoever hits it) or *Tidal Surge* (more damage and range, plus puddles)
  - Wolf Riders *Tower Raiders* (ignore the army and go for towers)
- **Surfaces come from upgrades.** Inferno, Oil Slick and Tidal Surge are the only things that put
  surfaces on the field. Everything else uses statuses.
- Data: an upgrade can apply stat mods (`value × mult + add` to hp, speed, size, spacing, squadSize, damage, cooldown,
  range, splash or chainCount). It can replace the attack's element, targets or targeting; add on-hit effects; limit
  who its on-hit statuses land on (`onHitAffects`, e.g. Controlled Burn: enemies only, so no friendly fire); add or
  replace traits; add resistances; and add tags. Upgraded units are computed per side, so each army fights with its own
  upgrades.
- Bought upgrades show as ★ next to the unit in the shop. The enemy's upgrades are visible too.
- **Buying:** the sidebar's Upgrades tab lists every unlocked unit with both upgrades as one-click buttons (name, price,
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
  - Physical on Frozen → **Shatter**, ×2
  - Fire on Oiled → **Ignite**, +60 fire
  - Fire on Wet → **Evaporate**
  - Water on Burning → **Douse**
- *Surface reactions:* element × surface → new surface. Examples:
  - Lightning on Puddle → **Electrified Water**, which spreads through the connected puddle
  - Frost on Puddle → **Ice**
  - Fire on Puddle → **Steam**, which blocks ranged targeting
  - Fire on Oil → **Fire**, which spreads
  - Fire on Ice → **Puddle**
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

  A new mechanic is added once as a new effect or trait type, and from then on every unit can use it.
- **Traits:**
  - `aura`: buffs units that match a selector within a radius
  - `onDeath`: effects when a model dies
  - `regen`, optionally stopped while a status is on the unit (`suppressedBy`; Burning stops the Troll)
  - `periodic`: effects every N seconds (the Cleric's heal)
  - `retaliate`: effects applied to an enemy that hits this unit (Glacial Heart)
  - `charge`: the first attack of the battle deals ×N damage (Wolf Riders, Lance Charge, Dive Attack)
- **Tags** use `category:value`, for example `faction:greenskin`, `race:goblin`, `class:caster`, `size:large` and
  `element:fire`.
- **Selectors** are the single way to say "these units": side (ally/enemy/any), tag, any-of tags, lacks tag, layer. They
  are used today by auras and `bonusVs`. Factions and upgrades will use them too.

## 8. Factions — Decided (roster), Open (bonuses)

| Faction | Identity | Strengths | Weaknesses |
|---|---|---|---|
| **Greenskins** (goblin, ogre) | numbers, speed, things that explode | swarms, raiders, bats that hunt archers, sappers that blow up armor, oil into fire | goblins die to any hit, ogres take extra fire damage |
| **Kingdom** (human) | discipline and anti-everything | armor, range, anti-air, anti-large, healing | few elemental tools, slow siege |
| **Elementals** | elemental combos | big splash, Wet + lightning, freezing | slow ground bodies, weak to the opposite element |
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
  wings; elemental fliers (Wisps, Air Elemental) and the Sky Spire glow instead.
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
  Replays, the AI, the lab and tests all depend on this. Playback speed never changes the outcome.
- The roster lives in `src/data/units.ts`. The in-app editor is a session-only sandbox; edits reset on reload. Unit changes
  are made in code, by request.
- The app is fully static (GitHub Pages): no storage, no network calls, no analytics. Commit units by exporting them and
  pasting into `src/data/units.ts`.

## 12. Roadmap

Rough priority order. Everything is open to reshuffling.

1. **Balance pass** using the lab and battle reports. A first rock-paper-scissors pass is done (section 4, counter
   web): Knights became low-damage tanks, Longbowmen became anti-swarm and anti-air volleys, and all units move a third
   faster. Still open: in one-unit-type lab fights, fliers (Griffons, Wisps, Air Elementals) dominate because most
   ground units can't hit them. Decide whether that's a lab artifact or a real problem. Upgrades haven't been retuned.
2. **Faction bonuses** (section 8).
3. **Reaction editor** in-app, so statuses, surfaces and reactions can be iterated like units.
4. **Lab with upgrades and mixed armies**, to compare upgrade A vs B and test combo pairs.
5. **Reinforcement cards / specialists:** a choice at the start of a round, as data-driven modifiers.
6. **Spells:** one-shot effects placed during deployment, using the same effect vocabulary.
7. **Pathfinding and formations:** move around obstacles, and keep squads together.
8. **AI improvements** (section 9).
9. **More elements** (Earth, Poison), only if the complexity budget allows (section 6).
10. **Multiplayer:** much later. Determinism makes lockstep networking feasible.
