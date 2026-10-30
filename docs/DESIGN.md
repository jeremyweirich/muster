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

## 2. Core loop — Decided

```
Round N
 ├─ Income: supply += 200 + 100·N (unspent supply carries over)
 ├─ Deployment (simultaneous, blind)
 │    ├─ see the enemy army as it stood last round, and the units they have unlocked
 │    ├─ unlock units (one-time cost per match)
 │    ├─ buy squads, place and rotate them in your zone
 │    └─ squads from earlier rounds are locked in place
 ├─ Battle (automatic, deterministic, up to 90 s)
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

- **32 × 32 tiles.** Each side deploys in its back 10 rows. The 12 rows in the middle are no-man's-land.
- **Grid placement.** Each squad has a rectangular footprint in tiles. Footprints can't overlap each other or a tower.
- **Rotation.** Press **R** to swap a footprint's width and height when placing. This only changes how the squad is laid
  out, for example goblins in a wide line or in a column. It does not change facing or behavior.
- **Locking.** Squads placed in earlier rounds can't be moved or sold. Squads placed this round can be moved or sold for
  a full refund.
- **Two layers: ground and air.** Fliers ignore ground surfaces and don't collide with ground units. Only attacks that
  target air can hit them.

### Towers — Decided (values open)

Each side has two towers at the back of its zone, spaced apart horizontally and mirrored for the opponent:

| Tower | Layer | HP | Weapon |
|---|---|---|---|
| Keep | ground | 1200 | light crossbow: 25 physical / 1 s, range 6, hits ground and air |
| Sky Spire | air | 800 | none; only anti-air can reach it |

- Towers don't move and don't count toward winning the round. A side loses when its *army* is gone.
- **Collapse:** when a tower falls, **its owner's entire army is Dazed for 5 s**: it deals 10% damage and takes double
  damage. This sets up the key tension: a single strong deathball in the center leaves the flanks open to tower snipes,
  and a tower snipe in the middle of a fight can swing it.
- The ground Keep can be reached by any army. The flying Spire can only be reached by anti-air, which gives fliers and
  archers a strategic job beyond fighting units.

## 4. Units — Decided (data model), Open (roster)

A unit definition is pure data (`src/sim/types.ts`, `UnitDef`):

| Field | Meaning |
|---|---|
| `cost` | supply per squad |
| `unlockCost` | one-time cost per match before the first purchase; 0 = available from the start |
| `squadSize` | models per purchase (16 goblins, or 1 dragon) |
| `footprint` | deployment tiles, w × h (rotatable) |
| `layer` | ground or air |
| `hp`, `speed`, `size` | per model; size is the collision radius in tiles |
| `resist` | per element: 0.3 = takes 30% less, -0.35 = takes 35% more, 1 = immune |
| `immuneStatuses` | statuses that never apply |
| `attack` | damage, element, cooldown, range, targets, targeting, delivery, splash, chain, `bonusVs`, `onHit` effects |
| `traits` | aura, onDeath, regen, periodic |
| `tags` | `category:value` labels used by selectors |
| `structure` | towers only: anchored and not counted toward winning |

**Behavior.** Each model picks a target (nearest, highest HP or lowest HP, among layers it can hit), walks until it is
in range, and attacks. Units with no attack follow the nearest armed ally. Models push each other apart; heavier models
get pushed less, and towers never move. There is no pathfinding yet.

**Damage pipeline:**
`attack damage × aura buffs × attacker status (Dazed) → reactions with the target's statuses (Conduct ×2, Shatter ×2, …) → bonusVs → target resist → target status (Dazed ×2)`

### Starting roster (generated by `npm run roster-table`)

| Unit | Cost | Unlock | Squad | Footprint | Layer | HP | Attack | Role |
|---|---|---|---|---|---|---|---|---|
| Goblin Horde | 100 | 0 | 16 | 4×2 | ground | 60 | 8 physical / 0.8s, range 0.4 | A screaming mob. Cheap, fast and great at soaking up big hits. |
| Knights | 200 | 0 | 4 | 4×1 | ground | 750 | 60 physical / 1.2s, range 0.6, splash 0.6 | Armored frontline. Shrugs off arrows and swords. |
| Longbowmen | 100 | 0 | 6 | 3×2 | ground | 120 | 24 physical / 1.5s, range 8 | Long-range volleys. Can shoot down fliers. |
| Ballista | 150 | 75 | 1 | 2×2 | ground | 320 | 260 physical / 3.5s, range 10 | Huge bolts that seek out the biggest target. Weak to swarms. |
| Fire Mage | 200 | 100 | 2 | 2×1 | ground | 220 | 55 fire / 2.6s, range 6.5, splash 1.4 | Lobs fireballs that set the ground ablaze. Mind your own troops. |
| Tidecaller | 150 | 75 | 2 | 2×1 | ground | 260 | 18 water / 2.2s, range 6.5, splash 1.6 | Floods the field with water. Weak alone, deadly with lightning or frost. |
| Stormcaller | 200 | 100 | 2 | 2×1 | ground | 200 | 40 lightning / 2.2s, range 6.5, chain ×3 | Chain lightning that leaps between targets. Devastating on wet ground. |
| Frost Witch | 200 | 100 | 2 | 2×1 | ground | 220 | 30 frost / 2.2s, range 6, splash 1.2 | Chilling bolts. Two chills freeze; frozen targets shatter on physical hits. |
| Goblin Alchemist | 100 | 50 | 3 | 3×1 | ground | 100 | 10 physical / 2s, range 5, splash 1.2 | Hurls flasks of oil. Slows enemies and primes them to burn. |
| War Drummer | 100 | 50 | 1 | 1×1 | ground | 300 | none | Goblins nearby attack and move faster. Does not fight. |
| Ogre Brute | 250 | 100 | 1 | 2×2 | ground | 2400 | 150 physical / 2s, range 0.7, splash 1.1 | A huge, slow wall of meat with a cleaving club. Hates fire. |
| Griffon Riders | 200 | 100 | 3 | 3×2 | air | 450 | 50 physical / 1s, range 0.8 | Fast fliers that ignore the ground and its hazards. |
| Dragon | 600 | 200 | 1 | 4×4 | air | 4200 | 80 fire / 1.6s, range 3, splash 1.8 | Breathes fire on everything below. Ballistae are its bane. |

Intended counter web, which the lab should confirm: chaff (goblins) soaks big single hits (ballista, ogre). Splash
(fire mage, ogre) shreds chaff. Ballistae hunt large units (ogre, dragon). Anti-air (longbows, ballista, stormcaller)
answers fliers. Elemental casters are weak alone and strong in pairs.

## 5. Unlocks — Decided (values open)

- Units with `unlockCost: 0` (Goblin Horde, Knights, Longbowmen) are available from the start. Every other unit costs a
  one-time unlock per match, paid from supply, before its first squad.
- **Purpose:** to tax a perfect counter-pick and reward sticking with what you already have. Sticking with your units in
  turn makes you easier to read, which is the intended trade-off.
- Each player sees which units the opponent has unlocked.
- The AI counts unlock prices in its budget and values a fresh unlock at 50% of its price beyond the current round.

**Open:** whether starting unlocks should be random or drafted per match (as with Mechabellum's starting units), and
whether unlock costs should scale with the round.

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
  - `regen`
  - `periodic`: effects every N seconds
- **Tags** use `category:value`, for example `faction:greenskin`, `race:goblin`, `class:caster`, `size:large` and
  `element:fire`.
- **Selectors** are the single way to say "these units": side (ally/enemy/any), tag, any-of tags, lacks tag, layer. They
  are used today by auras and `bonusVs`. Factions and upgrades will use them too.

## 8. Factions — Open (planned, designed for)

Factions will reward staying within a faction and come with built-in weaknesses. They will be built entirely from
existing pieces:

- **Army modifiers:** a condition based on counting squads by tag, plus a stat change applied through a selector.
  Example: "4+ `faction:greenskin` squads → greenskin units get +15% HP".
- **Weaknesses** use resistances, for example ogres taking more fire damage.

Sketches:

| Faction | Leans on | Weak to |
|---|---|---|
| Greenskins (orc, goblin, ogre) | oil, fire, swarms | frost, splash |
| Elves | water, nature, poison fields | physical burst |
| Dwarves | earth, forge-fire, resistances | being slow, kiting |
| Kingdom (human) | physical, holy; most resistant to field effects | weakest at combos |
| Undead | frost, shadow; immune to poison | fire, holy |

## 9. AI — Decided (approach)

The AI plans by simulation. At the start of each deployment it generates candidate purchases and placements (with
rotation and placement styles) and simulates each one against the player's army from last round, towers included. It
keeps the best by: win (±1000) + surviving value difference + future value of unlocks. Difficulty sets the number of
candidates and the time budget: Easy is 3 candidates plus random noise, Normal 12, Hard 30.

Because the AI only uses the simulator, it handles any unit you design without new code.

**Open:**
- Predict the player's next additions instead of planning only against their last army.
- Plan unlocks over several rounds.
- Learn placement (flanking, tower snipes) instead of using templates.

## 10. Tools — Decided

| Tool | What it's for |
|---|---|
| **Unit editor** | Every field, live; raw JSON view; Export/Import of the whole roster |
| **Sandbox** | Watch a unit fight another at equal supply, or run 10 headless sims |
| **Balance Lab** | Every unit against every unit at equal supply, in a Web Worker. One-unit-type armies undervalue combo units |
| **Battle report** | After each battle: the field resets to deployment positions. Hover or click any squad for damage dealt, kills, damage taken, friendly fire, and breakdowns (dealt through mechanism; taken by source, element and reaction) |
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
- The roster is stored in the browser under `localStorage["muster.roster.v2"]`. Commit units by exporting them and
  pasting into `src/data/units.ts`.

## 12. Roadmap

Rough priority order. Everything is open to reshuffling.

1. **Balance pass** using the lab and battle reports: Longbowmen and Griffons currently overperform.
2. **Reaction editor** in-app, so statuses, surfaces and reactions can be iterated like units.
3. **Progression:** unit levels and per-unit tech upgrades, built on modifiers.
4. **Factions:** army modifiers based on tags (section 8).
5. **More elements:** Earth (mud, walls) and Poison (clouds, which explode when they meet fire).
6. **Reinforcement cards / specialists:** a choice at the start of a round, as data-driven modifiers.
7. **Spells:** one-shot effects placed during deployment, using the same effect vocabulary.
8. **Pathfinding and formations:** move around obstacles, and keep squads together.
9. **AI improvements** (section 9).
10. **Multiplayer:** much later. Determinism makes lockstep networking feasible.
