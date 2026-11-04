# Common Ground — Design Document

(The repo and package are still called `muster`, the game's working title.)

Status: living document, written after the first playable prototype. Every number here is a starting point to tune, not
a final value. Sections marked **Decided** are settled direction. Sections marked **Open** still need a decision. Values
in code are the source of truth; this document explains what they are for.

## 1. Pitch

The story, themes and faction voices are in `docs/VISION.md`; the campaign plan is in `docs/CAMPAIGN.md`.

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
 ├─ Income: supply += 200 + 100·N from round 2 (unspent supply carries over); round 1's income is the opening
 ├─ Opening (round 1 only): one of three two-unit packs, unlocked and placed, + 200 supply; or 700 supply (section 5)
 ├─ Deployment (simultaneous, blind)
 │    ├─ see the enemy army as it stood last round, plus their unlocks, upgrades and tower levels
 │    ├─ unlock units (one-time cost per match)
 │    ├─ buy upgrades (four per unit; 200 / 400 / 600 / 800 in the order bought, whatever the unit)
 │    ├─ upgrade towers (100 / 200 / 400 / 800)
 │    ├─ promote veterans that earned a level (half unit cost per level; section 5c)
 │    ├─ buy squads, place and rotate them in your zone (a banner over the field says what's being placed; Esc or
 │    │  Done stops, and so does running out of supply for another squad)
 │    ├─ squads from earlier rounds are locked in place
 │    └─ Undo (Ctrl+Z) reverses purchases one at a time; fighting without spending asks for confirmation
 ├─ Battle (automatic, deterministic, up to 120 s; always starts at 1× playback, which is real time)
 │    └─ once one side can't hurt the other's army, playback runs 10× faster to the end (battlePlayer.ts)
 └─ Resolution
      ├─ loser takes damage = Σ over the winner's surviving squads of (cost × fraction alive × 0.08 + 4)
      ├─ time-out: each side takes damage from the other's survivors
      ├─ shown, not explained: the battle's last frame stays up while each surviving squad flies its damage to the
      │  other side's HP bar, smallest first (DamageTally.tsx), with no caption. Keeps fly nothing, because they
      │  don't count. Any key, click or tap skips it
      ├─ every squad gains XP = damage dealt + healing done; enough XP unlocks a level (section 5c)
      ├─ every unit is restored for the next round (armies are permanent; battles are not)
      └─ battle report and replay
Match ends when a player reaches 0 HP (start: 400).
```

Rules live in `src/data/rules.ts`: income, HP, damage formula, time limit, field size, friendly fire, locking, unlocks
and towers.

## 3. Battlefield — Decided

- **48 × 27 tiles**, a 16:9 field shaped like a landscape screen. Armies face each other across the short axis, so
  the front is wide and there's room to flank. Each side deploys in its back 7 rows. The 13 rows in the middle are
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
  portrait, touch devices get a "turn your phone sideways" screen on every tab, including Story where the site opens,
  with a full-screen + landscape-lock button (works on Android; iOS has to rotate by hand) and a "play in portrait
  anyway" escape that lasts the visit and stacks the field above the sidebar.
- **Phone layout (short landscape screens, `COMPACT_QUERY` in `MobileDeploy.tsx`).** Desktop is unchanged. Height is
  what phones lack, so the field takes the full height and the sidebar takes the width left over; the health bars and
  round move to the top of the sidebar in one row. While deploying, nothing needs scrolling:
  - The sidebar is a **rail**: supply, **↶ Undo** and Fight in one row; the units you've **unlocked** (one column, two
    when it's wide or you own more than four; a gold dot means an upgrade is affordable); when a veteran has earned a
    level, a glowing gold **Promote N veterans · cheaper than a new squad** button (promotions are the cheapest way to
    grow, so the rail pushes them); a row with **＋ Unlock a unit** and **Keeps**; while placing, a caption plus Rotate,
    Sell and Done/Cancel; the enemy's unlocks; and **☰** (AI difficulty, Restart).
  - **Sheets** draw over the field. Most cover exactly **no-man's land**, which is always empty while deploying, so both
    deploy zones stay in view. Tapping a unit in the rail starts placing it and opens its sheet: a one-line stat summary
    and its four upgrades as cards with Buy buttons. The description gets as many lines as the sheet has room for
    (none on the smallest phones), and **Details** opens the full Codex card over the whole field. Unlock (a picker
    with the full card for the unit you tap), the round-1 opening and Details cover the whole field.
  - No hover on touch, so **taps inspect**: an enemy squad, an enemy unlock or one of your earlier squads opens its
    sheet (your veterans' sheet has the Promote button), and a Keep opens the Keeps sheet. A tap on a squad placed this
    round picks it up, as on desktop. Battle and the report keep the regular sidebar.

### Terrain and maps — Decided (values open)

Ground conditions for map-to-map variety, and a first step toward spells (cast on no-man's land between rounds;
spells themselves are out of scope for now). Data in `src/data/terrain.ts`, the sim in
`src/sim/terrain.ts`.

| Terrain | Effect (ground units only; fliers ignore all terrain) |
|---|---|
| **Rocks**, **Pond** | Can't be crossed. A unit walks straight at its target as always; when its step would enter one, it slides along the edge instead (head-on, it goes round on the side its target is on; dead behind, odd and even models split). Anything pushed into one is pushed back out to the edge. A pond can be a **river**: it runs off one side of the field, and a unit whose target is across it always slides along the bank toward the open end and round it, never into the corner at the field's edge |
| **Bridge** | Scenery: the river drawn under a wide plank deck where it can be crossed. Nothing in the sim |
| **Rough ground** | Half speed while on it |
| **Tall grass** | Hides a unit standing in it from ground shooters (attacks longer than 2.5 tiles), until 2 s after its own last attack. Melee, fliers' attacks, splash and chain lightning still find it. Drawn at half opacity while hidden |

- **Units don't plan around terrain** (owner): no pathfinding, no avoiding rough ground, no seeking grass. They do what
  they always do, and the ground changes how it plays out. The AI planner simulates its plans on the real map (it
  passes the terrain to the battles it tries), but its code knows nothing about terrain.
- **Patches** are circles or horizontal capsules (rocks, ponds; `len` makes a capsule) or ellipses (rough ground,
  grass) in tiles, and lie only in no-man's land. Rough ground and grass are looked up on a half-tile grid; obstacles are
  a short list of capsules (a circle is a capsule of length 0).
- **No pockets** (owner): units must never get stuck. Obstacles are convex, and a test keeps every two of them, and every
  obstacle and the field's edges, at least the biggest ground unit's width apart. A river is the one obstacle that may
  run off the field, on one side only. With no terrain the
  sim takes none of these paths (the bench fingerprint is unchanged).
- **Maps** (`MAPS`): Open Field, Millbrook Ford (a pond between two rough patches), Standing Stones (scattered rocks),
  Long Grass (grass on both flanks, a rock in the middle), The Mire (a wide band of rough ground with two ponds), Broken
  Hills (grass in the middle, rocks and rough ground off-center), The Furrows (a ploughed band of rough ground right
  across the middle), Toll Bridge (a river right across the field, with one wide bridge in the middle third) and Border
  Pass (rocks either side of the middle, scree on the flanks); the Furrows, Toll Bridge and Border Pass were made for
  story missions 4, 5 and 9 and are in the skirmish draw too. Every map is **point-symmetric** (turned 180° it's the
  same), so both sides face the same ground and a PvP guest's turned-round view needs nothing special. A test checks
  this and the no-man's-land rule.
- **Which map:** a skirmish draws one from the match seed (`pickMap`, its own random stream, so the opening packs don't
  change), so both PvP browsers get the same; Spectate too. Story missions name theirs (`map`). The map's name shows
  under the round number and links to the Codex's Terrain entries.
- The balance harness, Counters and the Units showcases stay on the open field: terrain is variety, not a balance input.

### Towers — Decided (values open)

Each side has two Keeps (West and East) near the back of its zone, 2 rows in from the back edge
(`RULES.towerInset`), spaced apart horizontally and mirrored for the opponent. Squads can stand behind them.

| Tower | Layer | Base HP | Weapon |
|---|---|---|---|
| Keep (×2) | ground | 150 | none |

- **Unupgraded towers are fragile.** Almost any squad that reaches one kills it in a second or two.
- **Tower upgrades.** Each tower is upgraded separately. Levels cost 100 / 200 / 400 / 800, and each adds +2,000 HP,
  so HP grows in a straight line while the price doubles. The first level is the big one: it
  turns a Keep any squad can topple in a second into one a raid has to work at, so if you go all in on one side, a
  pack of grunts on the other can't take your Keep for free.
- **Showing levels.** An upgraded Keep wears the same gold marks as a veteran squad: an `LvN` tag on its footprint
  while deploying and in the report, and a gold level number on its token in battle. The enemy's levels are bought
  in secret, so a new enemy level first shows when the battle starts.
- **Collapse.** When a tower falls, **its owner's entire army is Dazed**: it deals 10% damage and takes double damage.
  The Daze lasts **4 s at level 0, 0.5 s less per level** (minimum 2 s), in sim time, which is also what you see at 1× playback.
- Towers don't move and don't count toward winning the round. A side loses when its *army* is gone.
- **Why:** a single strong deathball in the center leaves the flanks open. A cheap raider that slips through and snipes a
  tower can swing the main fight. Tower levels are the counter-investment: you pay supply for insurance instead of army.
- Both Keeps are ground structures with no weapons, so any army can reach them and they never shoot back. Wolf Riders
  can buy *Tower Raiders* to pick out a Keep whenever they pass near one; placed on a flank, that is a tower raid.

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
| `speed` | speed points, mostly between 5 and 20; tiles/s = points × 0.1 (`RULES.speedScale`), so 10 = 1 tile/s |
| `spacing` | extra distance kept from allies **while advancing**; ranks close once fighting. Reduces splash damage taken |
| `resist` | per element: 0.3 = takes 30% less, -0.35 = takes 35% more. No unit is immune to an element: an element's own creatures resist it mildly (0.3) |
| `toughness` | flat: every hit it takes is this much lower, after resistance, but `RULES.toughnessFloor` (a quarter) always gets through. Damage over time ignores it. Only the Dragon's *Ancient Scales* gives it |
| `immuneStatuses` | statuses that never apply (no unit uses this today; see `resist`) |
| `attack` | damage, element, cooldown, range, targets, targeting, delivery, splash, chain, `bonusVs`, `rangeVs` (extra range against matching targets), `prefers` (pick out matching enemies first, among those nearby), `selfDestruct` (dies after its first attack), `windup` (seconds of aiming after each reload before the shot; cooldown mods scale it too), `onHit` effects |
| `traits` | aura, onDeath, regen, periodic, retaliate, charge, onKill |
| `upgrades` | four upgrades per unit (section 5b); prices are global (`RULES.upgradeCosts`) |
| `tags` | `category:value` labels used by selectors, including `faction:*` and `role:*` |
| `structure` | towers only: anchored and not counted toward winning |

**Behavior.** Each model picks a target among the layers it can hit: the nearest, unless a preference applies (highest HP, lowest HP, towers first, or enemies matching `prefers`). **Preferences are local**: they only choose among enemies within attack range + `RULES.preferReach` (2 tiles). Of the enemies in front of it, a unit takes the one it prefers; it never crosses the field for one. Raiders reach the back line by speed, by flying, or by being placed on a flank. Then it
walks until it is in range, and attacks. While walking, units look round for a better target about once a second. **Once attacking** (target in range), a unit keeps its target until it dies, hides or gets out of range; units with no attack keep looking round. A `windup` unit (the Ballista) aims for its windup after every reload, and only while its target is in range; a target that leaves range resets the aim. Its sustained rate is cooldown + windup. Units with no attack (the Cleric) walk with the nearest ground ally that fights at close range (attack range ≤ `RULES.escortMeleeRange`, 2.5: the line, where the hits land), or the nearest armed ally if there is none, and stop `RULES.escortGap` (2 tiles) short of it: just behind the line, out of the melee, still close enough to heal it. Models push each other apart; heavier models get pushed less, and towers never move. Enemies block each other fully, but allies only nudge each other (`RULES.allyPush` = 0.15), so units behind a front line can squeeze through to reach the fight. There is no pathfinding yet. Each tick, models act in a freshly shuffled (seeded) order, so neither side always strikes first, and a squad’s short last row stands at the back of its footprint for both sides.

**Damage pipeline:**
`attack damage × aura buffs × attacker status (Dazed) → reactions with the target's statuses (Conduct ×2, Shatter ×2, …) → bonusVs → target resist → target status (Dazed ×2) → toughness (hits only: a flat cut, but a quarter always gets through)`

### Roster (generated by `npm run roster-table`)

There are three factions of six units each, plus three independents. They're listed in complexity order everywhere
(recruit list, Counters, this table): Wardens, Goblins, Elementals. Factions are currently tags and groupings in the
recruit list; faction bonuses come later (section 8).


#### Wardens

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Knights | 200 | 100 | 4 (4×1) | 12 | 600 | 40 physical / 1s, range 0.6 | Sturdy, Melee | **Shield Wall**: +25% HP and +20% physical resistance.<br>**Lance Charge**: 30% faster, and the first strike deals ×4 damage.<br>**Warded Plate**: +50% resistance to fire, frost, lightning and water.<br>**Veterans**: +30% damage, and each knight blocks the first hit it takes. |
| Crossbowmen | 100 | 100 | 3 (3×1) | 8 | 220 | 85 physical / 3s, range 7 | Ranged, Anti-air | **Longshot**: +3 range.<br>**Fire Bolts**: Fire damage, +25%, that ignites Oiled targets.<br>**Repeaters**: Shoot 2.5× as fast for 60% damage per bolt.<br>**Skyhunters**: Full damage to fliers (not half), picking them out first, with +2 range against them. |
| Ballista | 100 | 100 | 1 (2×2) | 5 | 250 | 260 physical / 2.5s + 1.25s windup, range 11 | Sniper, Anti-large, Anti-air, Slow | **Heavy Bolts**: +50% damage.<br>**Repeater**: Fires twice as fast for 60% damage per bolt.<br>**Chain Harpoons**: Bolts Chill. A second hit freezes; the next shatters for double.<br>**Reinforced Frame**: +100% HP and +30% physical resistance. |
| Griffon Riders | 200 | 100 | 3 (3×2, air) | 18 | 360 | 45 physical / 1s, range 2 | Flier, Fast, Skirmisher | **Dive Attack**: The first strike deals ×4 damage.<br>**Armored Saddles**: +40% HP and +20% physical resistance.<br>**Sky Patrol**: Pick out nearby fliers first, with ×1.75 damage to them.<br>**Giant Slayers**: ×2.5 damage to large and huge units, and pick them out when near. |
| Cleric | 100 | 100 | 2 (2×1) | 8 | 400 | none | Healer, Support | **Sanctuary**: A second prayer heals 50 every 2s, in a much wider circle.<br>**Blessing**: Allies nearby deal +30% damage.<br>**Purify**: Every 1.5s, clears all statuses from nearby allies.<br>**Battle Hymn**: Allies nearby attack 30% faster and move 25% faster. |
| Dwarven Pikemen | 200 | 100 | 6 (4×2) | 9 | 300 | 36 physical / 1.2s, range 1.5 | Anti-large, Swarm, Melee | **Pike Wall**: Melee attackers take 40 damage back on every hit.<br>**Long Pikes**: +1 range, so the back rank fights too.<br>**Heavy Halberds**: +40% damage, and every blow sweeps a wide arc.<br>**Drilled Ranks**: +3 dwarves per squad. |

#### Goblins

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Grunts | 100 | 100 | 16 (4×2) | 20 | 40 | 8 physical / 0.6s, range 0.4 | Swarm, Fast, Melee, Glass cannon | **Scrap Armor**: +20 HP, and each goblin blocks the first hit it takes. 15% slower.<br>**Feral Frenzy**: Run 30% faster and stab 40% faster.<br>**Party Time**: +8 goblins per squad.<br>**Oil Bombs**: Goblins spill oil where they die. Oil slows; fire makes it burning ground. |
| Skirmishers | 100 | 100 | 12 (4×2) | 16 | 30 | 12 physical / 1.2s, range 3.5 | Skirmisher, Anti-air, Swarm | **Ambush**: Can't be targeted except for 2s after each shot. Splash still hits.<br>**Barbed Arrows**: +60% damage.<br>**Improvised Bombs**: One fire grenade per squad: a wide blast that sets all in it Burning.<br>**Skyshot**: Hunt fliers first, with ×1.5 damage to them. |
| Wolf Riders | 200 | 100 | 4 (2×2) | 24 | 540 | 45 physical / 1s, range 2.5 | Fast, Raider, Skirmisher | **Dire Wolves**: +50% HP and +20% damage.<br>**Tower Raiders**: 15% faster, and pick out a Keep over the army when one is near.<br>**Flankers**: Pick out nearby archers, casters and siege, with ×1.5 damage to them.<br>**Bloodthirst**: Every kill readies another ×5 charge javelin. |
| Troll | 200 | 100 | 2 (2×1) | 10 | 1250 | 90 physical / 1.3s, range 0.6 | Anti-large, Sturdy, Regenerates, Melee | **Thick Blood**: Regenerates an additional 20 HP/s, even while Burning.<br>**Gorge**: Each hit heals it.<br>**Rock Skin**: +40% HP.<br>**Boulder Toss**: Throws rocks from 3 tiles away instead of punching. |
| Ogre Brute | 300 | 100 | 1 (2×2) | 7 | 2200 | 200 physical / 1.8s, range 0.7, splash 1.1 | Sturdy, Splash, Slow, Melee | **Thick Skull**: +40% HP, no fire weakness. 40% of hits kill a nearby goblin instead.<br>**Rampage**: Swings 50% faster and moves 30% faster.<br>**Wrecking Swing**: +0.8 splash radius and +20% damage.<br>**Warboss**: Nearby goblins hit 25% harder and faster. Calls a grunt every 5s. |
| Giant Bats | 200 | 100 | 4 (2×2, air) | 20 | 280 | 45 physical / 1s, range 0.6 | Flier, Fast, Raider | **Leather Wings**: +35% physical resistance, and 40% faster for the first 3s.<br>**Shriek**: On diving in, then every 10s: enemies around its target are Dazed for 3s.<br>**Bloodsuckers**: Heal for 40% of the damage they deal, and latch onto fliers too.<br>**Savage Claws**: +15% HP and +60% damage. |

#### Elementals

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Fire Elemental | 200 | 100 | 4 (2×2) | 7 | 180 | 45 fire / 3s, range 7, splash 1.3 | Splash, Ranged, Slow | **Controlled Burn**: +20% damage, and its flames only catch on enemies.<br>**Meteor**: +4 range, +50% damage and a wider blast, but fires 30% slower.<br>**Wildfire**: Fireballs leave burning ground, which burns allies too.<br>**Living Inferno**: Burns enemies within 1.5 tiles (10/s). Melee attackers catch fire. |
| Water Elemental | 300 | 100 | 1 (2×2) | 6 | 2400 | 60 water / 2s, range 4, splash 1.2 | Sturdy, Combo | **Glacial Heart**: +40% HP. Attackers are Chilled; hit it twice and they freeze.<br>**Tidal Surge**: +60% damage, +3 range, and hits leave puddles.<br>**Wellspring**: Heals nearby allies 40 every 2s.<br>**Tsunami**: +1 splash radius and +25% damage. |
| Air Elemental | 200 | 100 | 2 (2×1) | 10 | 400 | 50 lightning / 1.2s, range 4, chain ×2 | Ranged, Anti-air, Combo | **Thunderhead**: Lightning jumps 3 more times and hits 20% harder.<br>**Tempest**: +40% HP and attacks 40% faster.<br>**Eye of the Storm**: ×2 damage to fliers (×3 in all), and picks them out first.<br>**Take Flight**: Becomes a flier, 40% faster, floating over ground hazards. |
| Cloudlings | 100 | 100 | 14 (3×2, air) | 19 | 40 | 8 physical / 1.8s, range 2 | Swarm, Flier, Fast | **Downpour**: Hails 20% faster. Rains on its first target, then every 6s: soaks it Wet, leaves a puddle.<br>**Thunderstorm**: Calls lightning on its first target, then every 10s. ×2 vs Wet; shatters Frozen.<br>**Overcast**: +6 clouds per squad.<br>**Freezing Rain**: +40% damage, as frost that ignores armor and freezes Wet targets. |
| Frost Elemental | 200 | 100 | 3 (3×1) | 8 | 300 | 60 frost / 1.5s, range 7 | Anti-large, Ranged, Anti-air | **Chilling Bolts**: Bolts Chill. The next frost hit on a Chilled target freezes it.<br>**Cold Snap**: Shoots 50% faster.<br>**Hoarfrost**: Every 2s, enemies within 2.5 tiles are Chilled.<br>**Glacial Reach**: +4 range, −25% damage. Picks out archers, casters and siege first. |
| Stone Golem | 300 | 100 | 1 (3×3) | 9 | 3600 | 300 physical / 1.8s, range 0.8 | Sturdy, Melee, Slow | **Granite**: +40% HP and +20% physical resistance.<br>**Quake**: Slams splash and stun everything around for 0.5s.<br>**Magma Core**: Fire damage that sets enemies Burning.<br>**Landslide**: 60% faster, and its first slam deals ×3. |

#### Independents

| Unit | Cost | Unlock | Squad | Speed | HP | Attack | Roles | Upgrades |
|---|---|---|---|---|---|---|---|---|
| Dragon | 600 | 200 | 1 (4×4, air) | 9 | 4200 | 130 fire / 1.6s, range 3, splash 1.8 | Flier, Splash, Sturdy | **Inferno**: +25% damage, and its breath leaves burning ground.<br>**Ancient Scales**: Toughness 15: every hit it takes is 15 lower, so arrows and claws barely scratch it.<br>**Elder Blood**: Regenerates 40 HP/s, except while Chilled.<br>**Dread**: Everything its breath hits is Dazed for 1.5s. |
| Giant | 400 | 200 | 1 (3×3) | 5 | 2600 | 120 physical / 2.4s, range 6, splash 1.8 | Splash, Sturdy, Slow, Ranged | **Earthshaker**: Boulders briefly stun everything they land on.<br>**Thick Hide**: +40% HP and +25% physical resistance.<br>**Rockslide**: +3 range and a wider blast.<br>**Frost Giant**: Frost boulders that Chill, and freeze Wet or Chilled targets. |
| Bog Toad Riders | 200 | 200 | 3 (3×2) | 16 | 380 | 85 physical / 2.2s, range 5 | Skirmisher, Anti-air, Fast | **Fat Toads**: +40% damage.<br>**Spit Bile**: Spit instead of lick: every hit splashes a small area, for 40% less damage.<br>**Gulp**: Every lick sticks: the target is Snared for 2s.<br>**Long Tongues**: +2 range. |

### Balance — Decided (approach), Open (targets and numbers)

Balance follows `docs/BALANCE.md`, with Mechabellum as the reference game (`docs/MECHABELLUM.md`). `docs/BALANCE-PLAN.md` maps our units onto it and sets out the order of work.

- **Units, not factions.** Units are balanced against each other at equal supply. Factions are identity (and, later,
  bonuses), not a balance target. The story's faction triangle (`docs/VISION.md`) comes from campaign missions with
  authored armies, not from the skirmish numbers.
- **Roles.** Every unit has a place in the Mechabellum cycle (chaff soaks carries, chaff clear kills chaff, carries
  kill chaff clear and everything bigger) or around it (tank, diver, utility, late-game), and a size class read from its
  `size:*` tag: small = light, medium = medium, large = giant, huge = titan. The damage profile decides what a unit is
  efficient against: splash and many small hits against light, big single hits against medium, ramping damage against
  giants and titans.
- **Intent first, as data.** `src/data/balance.ts` holds each unit's role, its Mechabellum analogue and a self-TTK
  band (HP ÷ own DPS per model), plus `RELATIONS`: who beats whom, one line per pair, each with the reason in words.
  Every upgrade has an **intent**: what it is for, the role it moves the unit into (if any) and the matchups it should
  flip. The harness grades the numbers against the intent. When a number and the intent disagree, fix the number; when
  the intent turns out wrong, change it there first. The owner signed off the approach and left the table to Claude to
  refine.
- **Fight shape: like Mechabellum, not one blob.** Fights should run about 40–60 s, and they should get there through
  space and movement, not extra HP, so placement matters: what stands in front, how deep the line is, which flank
  meets which. Each side deploys in 7 rows with 13 rows of no-man's-land between them, so nothing starts in range of
  anything. Units are slow (`RULES.speedScale` 0.1: 10 speed points is 1 tile/s). `npm run balance -- density` measures time to
  first contact, fight length and the share of each army fighting at once. Self-TTK bands stay Mechabellum's
  (`FIGHT_SCALE` = 1).
- **The closing tax is real.** Slower approaches give shooters many free shots, so melee units, divers and chaff get
  their value from toughness, speed or numbers. Pikes have reach (1.5) to fight two ranks deep. Ramping units (Troll,
  Frost Elemental) build up on one target, and like every unit they stay on it once attacking.
- **Anchors.** Crossbowmen are the neutral baseline (value 1.0); Knights are the second anchor.
- **Tolerances** (`TOLERANCE` in `src/data/balance.ts`): a mirror is 50%; a soft counter wins at least 60% at equal
  supply; a hard counter beats twice its own supply of the target; nothing hard-counters more than half the roster;
  every unit has at least one hard counter.
- **Harness:** `npm run balance -- <mode>` (`scripts/balance.ts`). Level 1, no Keeps, sides alternated, formations
  randomized, both sides at the same supply (`equalCostCounts` in `src/game/lab.ts` picks the squad counts).

| Mode | Benchmark (docs/BALANCE.md §5) |
|---|---|
| `stats` | Self-TTK, HP and DPS per 100 supply, Lanchester value (HP × DPS per supply) against the baseline. No fights |
| `coverage` | Units per role against the reference template, anti-air per role, and static checks on the target table |
| `mirror` | Side-bias test: each unit against its own reflection, which should be 50% |
| `matrix` | Every unit against every unit: win rate, value margin, fight time and the Nash mix. `--scale 1,2,4` for the scale test, `--csv <file>` for a spreadsheet. `npm run matrix` is a shortcut |
| `check` | Grades the matrix against `src/data/balance.ts`: side bias in true mirrors, relations that hold, upgrade intents that hold, unplanned hard counters, and each unit's hard counters |
| `targets <unit…>` | The quick loop while tuning: only the relations and upgrade intents that involve these units |
| `density [armies]` | Fight shape: time to first contact, fight length, share of each army fighting at once, timeouts (mirrored probe armies) |
| `distance <a> <b>` | Closing-distance test: a starts d tiles from b, to find the crossover |
| `fight <a> <b>` | Composition test with mixed armies, e.g. `"knights*2,cleric" "frost_elemental*3,cleric"`, optional `--upsA` / `--upsB` |
| `sensitivity <unit>` | ±10% on HP, damage, attack rate, range and speed; lists matchups that flip |
| `upgrades <unit>` | The unit's row with each upgrade, all four, and at each veterancy level (paying for the promotions) |

### Roles

Role tags (`role:*`) say what a unit is *for*. They show on hover in the recruit list and in the Codex. The current
roles are Sturdy, Swarm, Fast, Slow, Sniper, Ranged, Melee, Splash, Anti-air, Anti-large, Flier, Support, Healer, Combo,
Regenerates, Glass cannon, Raider and Skirmisher. They live in `src/data/roles.ts`.

## 5. Unlocks — Decided (values open)

- **Nothing is unlocked when a match starts.** Every unit costs a one-time unlock per match, paid from supply, before its
  first squad: 100 for faction units, 200 for independents. The opening pack unlocks two for free.
- **Purpose:** to tax a perfect counter-pick and reward sticking with what you already have. Sticking with your units in
  turn makes you easier to read, which is the intended trade-off.
- Each player sees which units the opponent has unlocked.
- The AI counts unlock prices in its budget and values a fresh unlock at 50% of its price beyond the current round.

**Open:** whether unlock costs should scale with the round.

### Opening offer — Decided (values open)

A small, fair bit of variety at the start of each match, and round 1's income. Both sides are offered the same three
**packs**, drawn from a pool of every pair of faction units, from any factions (`src/data/openings.ts`), and each
player takes one, or the war chest. Independents stay out, since a pack prices its two unlocks at 100 each. Packs
limited to one faction are for the campaign.

- **A pack:** two units, both unlocked, with exactly 400 supply of their squads (`RULES.openingPackValue`; unlock prices
  don't count) placed for you, plus 200 supply to spend (`RULES.openingPackSupply`). For example Knights + 2 Crossbowmen,
  2 Grunts + 2 Skirmishers, or Wolf Riders + 2 Cloudlings. Each pair that can make exactly 400 is in the pool once, with
  the counts that split the 400 most evenly (120 packs today). Pack squads can be moved in round 1 but not sold, since
  they were free.
- **War chest:** 700 supply (`RULES.openingFlat`) and nothing unlocked. A pack is worth 600 plus two unlocks (200), so once
  the war chest pays for two unlocks of its own it ends up 100 behind: a mild price for choosing your units freely.

Every pack is the same value, so the offer changes how a match starts, not who is ahead. Both sides see the same packs,
so each can guess what the other might start with. The player must choose before the first Fight; nothing can be
bought before that. The AI picks one of the three packs at random when the match starts, never the war chest, so its opening is easier to read. The enemy's pack stays hidden during round 1 (its
squads and unlocks show from round 2, as everything else does), and from round 2 a note beside its unlocks says what it
opened with.

## 5b. Upgrades — Decided (values open)

- Every unit has **four upgrades**. Each is a one-time purchase per match that changes **every squad** of that unit,
  including squads placed in earlier rounds.
- **Flat prices by order:** a unit's upgrades cost **200 / 400 / 600 / 800** in the order you buy them, whatever the unit
  (`RULES.upgradeCosts`). Each step makes the unit a deeper, more expensive specialist. The price is the same for
  Grunts and a Dragon, so upgrading a unit you field a lot of is better value.
- **Each upgrade has a written intent** in `src/data/balance.ts`: what it is for, the role it moves the unit into (if any), and which matchups it should flip. `npm run balance -- check` grades the matchups. Write the intent first, then the numbers.
- **Specialists, not jacks of all trades.** Roughly: two upgrades set the unit's main paths, one deepens a path, and one
  opens a new direction. Pairs are designed to multiply each other, so the later, pricier buys stay tempting:
  - Grunts *Scrap Armor* + Ogre *Thick Skull* (armored grunts soak the hits the ogre passes on); Ogre *Warboss* near
    grunts (faster, harder stabs, and a fresh grunt every 5 s)
  - Grunts *Oil Bombs* + Skirmisher *Improvised Bombs* (fallen goblins' oil goes up in flames, on both sides)
  - The Troll's built-in Berserk + *Thick Blood* (regenerating back to full HP brings back the faster attacks), or + *Gorge* (the deeper the rage, the more each hit heals)
  - Wolf Riders *Flankers* + *Bloodthirst* (each kill re-arms the ×5 charge javelin)
  - Ballista *Chain Harpoons* + *Repeater* (chill → freeze → shatter for ×2)
  - Air Elemental *Take Flight* + *Thunderhead* (chain lightning from out of reach); Water *Tsunami* next to Air (mass
    Conduct)
  - Cloudlings *Downpour* + *Thunderstorm* (soak, then Conduct) or *Downpour* + *Freezing Rain* (soak, then freeze for
    physical allies to Shatter)
  - Frost Elemental *Chilling Bolts* + *Cold Snap* or *Hoarfrost* (chill, then freeze); Cleric *Blessing* + *Battle Hymn*
- **Counterpunch upgrades.** Several upgrades answer a specific answer: Knights *Warded Plate* (vs elementals), Troll
  *Thick Blood* (regenerates while burning), Troll *Boulder Toss* (vs Pike Wall), Ballista *Reinforced Frame* (vs
  raiders), Air Elemental *Take Flight* (vs pikes and Knights), Cloudlings *Freezing Rain* (vs armor), Frost Elemental
  *Glacial Reach* (vs shooters), Grunts *Scrap Armor* (vs big single hits), Skirmishers *Ambush* (vs shooters), Cleric *Purify* (vs statuses), Golem *Magma Core* (vs trolls and armor).
- **Warden upgrades stay plain**: armor, damage, range, rate of fire, more bodies. The elementals' and goblins'
  upgrades are where the combos live.
- **Surfaces come from upgrades.** Inferno, Wildfire, Oil Bombs, Tidal Surge and Downpour are the only things
  that put surfaces on the field. Everything else uses statuses.
- Data: an upgrade can apply stat mods (`value × mult + add` to hp, speed, size, spacing, squadSize, damage, cooldown,
  range, splash or chainCount). It can replace the unit's layer (`layer`, Take Flight) and the attack's element, targets, targeting, delivery or preferred targets
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
- **Unlocking a level.** Total XP of 2,000 / 9,000 / 27,400 / 70,300 unlocks level 2 / 3 / 4 / 5 (`RULES.levelXp`).
  Leveling should feel great but happen rarely, and each level should be much harder than the last. The table comes
  from two knobs, `veterancyXp(base, growth)`:
  - **base** (2,000) is the XP for level 2. In a typical battle the MVP deals about 2,000, so the first level takes
    one great fight or two good ones.
  - **growth** (1.75) is how many more fights each later level takes than the one before. Because a level-N squad deals
    N× damage, it also earns N× XP, so step k is also scaled by k to cancel that. Without that factor, every level
    would take about the same number of fights. In
    fights at a fresh squad's strength the steps now cost 1, 1.75, 3.1 and 5.4. Bigger late-game armies still get
    there faster.
- **One level at a time.** A squad holds at most one unpaid level: while a level is waiting, its XP stops at that
  level's threshold and the rest is lost (`capXp`). So a squad can't bank levels and be promoted several times in a row.
- **Promoting.** An unlocked level does nothing until you pay for it. At deployment, a squad with a level waiting shows
  a gold chevron above it. Click the squad, use its card, or use the Promotions list in the Upgrades tab. Each
  promotion costs half the unit's base price (`promotePrice`), a reward for the work of earning it. Undo reverses it.
  **Promote all** works per unit type: when more than one squad of a unit has a level waiting, a Promote all button sits
  next to that unit's card Promote button and leads that unit's group in the Promotions list. It promotes only that
  unit's squads, in order while supply lasts, and one undo reverses the lot.
- **Effect:** a level-N squad has N× the base HP, attack damage, healing, regeneration and trait damage (on-death,
  periodic, retaliation, on-kill). Speed, range, cooldowns, statuses and surfaces don't change. Upgrades apply first,
  then the level.
- **Round damage ignores levels.** The damage a winner deals at the end of the round still uses the unit's base cost ×
  fraction alive, so a veteran isn't worth more HP damage than a fresh squad.
- Promoted squads show a gold `LvN` tag on their footprint during deployment and in the report, and a small gold level
  number on each model in battle. Enemy levels are visible.
- Code: `src/sim/levels.ts` (`earnedLevel`, `levelDef`), XP is awarded in `applyRound` (`src/game/match.ts`), and the
  battle builds each squad at its `level`. The Counters tab and the balance matrix run everything at level 1; `npm run balance -- upgrades <unit>` tests each level, paying for the promotions.

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
  - Water on Burning → **Douse**
- *Surface reactions:* element × surface → new surface. Examples:
  - Lightning on Puddle → **Electrified Water**, which spreads through the connected puddle
  - Frost on Puddle → **Ice**
  - Water on Fire → **Steam**, which blocks ranged targeting and scalds whoever stands in it (6 fire per tick)
  - Fire or Lightning on Oil → **Fire**, which spreads
- **Fire just burns** (owner's call): fire doesn't boil puddles, melt ice, thaw Frozen or Chilled units, or dry off
  Wet ones, and frost doesn't snuff Burning. Only water puts fire out, so elemental armies don't undo their own combos
  (fire thawing what frost froze, frost putting out what fire lit).

**Dial setting:** keep the system simple: no new statuses, surfaces or elements without the owner. Within that,
lightning sparks oil and shatters ice, Ignite leaves targets burning, steam scalds, and a few upgrades (Wildfire, Oil
Bombs, Downpour) put surfaces down.
- Placing a surface onto another counts as its element hitting it, so a puddle poured onto fire becomes steam.

### Friendly fire — Decided

- Main attack damage and splash damage **only hit enemies**.
- Statuses, surfaces and reactions are **neutral**: they hit both sides, and surfaces belong to no one. A Fire Mage's
  burning ground hurts your own knights, and the enemy's Stormcaller can electrify the puddle your Tidecaller made.
- An effect can override this with `affects: enemies | allies | all`. Tower collapse, for example, targets only allies.

The full current tables are shown in-game in the **Codex** tab.

### Complexity budget — Decided

New units should **not** add new surfaces or statuses by default. Prefer reusing Wet, Burning, Chilled/Frozen, Shocked,
Oiled, Dazed and Snared. Surfaces belong behind upgrades (section 5b). Adding a new element (Earth, Poison) is a
deliberate, separate decision.

**Snared** (the owner's idea): held in place, and a Snared **flier can be hit by attacks that only reach the
ground**, so swords, claws and pikes can reach it. It's elementless, and only the Bog Toad Riders' *Gulp* applies it.
The rule is one exception in the targeting check (`grounded` on the status); fliers stay in the air layer, so nothing
about movement or collisions changes.

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
    (Shriek, Thunderstorm). With `once` it fires a single time per battle. With `perSquad` the squad
    shares one timer, so only one model uses it (Improvised Bombs: one grenade per squad). There is no player-facing
    name for these yet; descriptions say "every N s" or "once"
  - `retaliate`: effects applied to an enemy that hits this unit (Glacial Heart)
  - `charge`: the first attack of the battle deals ×N damage (Wolf Riders, Lance Charge, Dive Attack)
  - `onKill`: effects at the killer when one of its attacks kills an enemy, and optionally `recharge` to re-arm its charge
    (Wolf Bloodthirst re-arms the bite)
  - `shield`: each model ignores its first N hits in a battle, including damage over time (Scrap Armor, Veterans)
  - `ambush`: can't be targeted except for N seconds after its own attacks; splash and area effects still hit it
    (Skirmishers Ambush)
  - `ramp`: each hit in a row on the same target deals +X% more, up to a cap (Troll Berserk, Frost Elemental)
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
| **Wardens** (human, dwarf, halfling) | discipline; **the most straightforward faction** | armor, range, anti-air, anti-large, healing, plain stat upgrades | few elemental tools, slow siege |
| **Goblins** (goblin, troll, ogre) | numbers, speed, chaos with heart | swarms, raiders, short bows that also hit fliers, bats that hunt archers, regenerating trolls, oil and fire, the ogre warboss | goblins die to most hits, ogres and trolls take extra fire damage |
| **Elementals** | elemental combos; **the most complex to play** | big splash, Wet + lightning, freezing, stuns, a flying storm swarm | fragile shooters that need a front line, slow ground bodies, weak to the opposite element |
| **Independents** | odd creatures and hired bands that **any faction can use to cover its holes**; they can be a little weird | Giant: splash artillery (the Wardens have no splash, the goblins no range). Bog Toad Riders: the anti-medium the goblins and elementals lack, and real anti-air for the goblins (Spit Bile: a chaff clear that isn't large; Gulp: pulls fliers down for melee). Dragon: the late-game flier | they cost more to unlock and are less cost-efficient than a faction's own answer (Crossbowmen beat the Toad Riders); no faction synergies |

**Still open:** faction bonuses for staying in-faction. The plan is to build them from army modifiers based on tags: a
condition that counts squads by tag, plus a stat change applied through a selector. Examples:
- "4+ `faction:goblin` squads → goblin units +15% speed"
- "3+ elemental squads → statuses last 50% longer"

Faction weaknesses already work through resistances.

## 9. AI — Decided (approach)

The AI plans by simulation, in a Web Worker (`src/game/ai.worker.ts`) that starts when deployment starts, so the page
stays responsive while the player builds. Fight never blocks: pressed before the AI is done, it waits ("The enemy is
still deciding…") and starts the moment the plan arrives.

It generates candidate plans: purchases and placements (with rotation and placement styles), and sometimes an upgrade
for a unit it already fields or a tower level. It often promotes veterans that have earned a level (each about 60% of
the time, if it can afford it), and simulates them at their new level. It simulates each plan against **the armies the
player might field**, including the player's upgrades and tower levels:
- in round 1, before the player has shown anything: each of the three opening packs the player was offered;
- after that: the player's army from last round, and (Normal and Hard) that army plus a round's income spent on units
  the player already uses, so it plans for the player's answer, not only their last army.

It scores plans in what a round really costs: the **HP damage** each side would take from the other's survivors
(the real round-damage rule; armies are restored afterwards), averaged over the scenarios, plus 50% of the money spent
on one-time purchases (unlocks, upgrades, tower levels, promotions), counted in HP. Difficulty sets the search:
- **Easy:** 3 random plans, 0.4 s, plus random noise.
- **Normal:** 12 random plans, 2 s.
- **Hard:** 6 s, split into time-boxed phases so no stage starves the rest: screen every affordable unit type alone
  against the player (up to 30% of the time; a counter found by simulation, not looked up), random plans built around
  the best few types (to 55%), local search tweaking its best plans (to 85%: swap, add or drop a squad, or place them
  again), then re-score the top 5 over two more battle seeds before picking, so a lucky simulation doesn't decide the
  round. In the browser Hard runs up to 4 of these searches at once, one per spare core, with different search seeds
  against the same armies, and plays the best plan. In 40 full AI-vs-AI matches it beat the previous Hard 28 to 12.
  What was tried and dropped is in `docs/SIMULATION.md`.

Because the AI only uses the simulator, it handles any unit you design without new code.

**Open:**
- Plan unlocks over several rounds.
- Learn placement (flanking, tower snipes) instead of using templates.

**Parked (owner's plan; keep the current AI for now):** difficulty as personality, not just search effort.
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

The tabs, in order: **Story** (the campaigns), **Play** (the full game against the AI, every unit available), **PvP**,
**Units**, **Codex**, **Counters**, **Spectate**. The site opens on Story (new players start with the first
mission), and the first thing on it is **Play the full game now**, for players who'd rather skip the story. A
PvP link (`?join=…`) still opens on Play. Play stays mounted behind the other tabs (a Codex
link mid-game keeps the match), but its field doesn't draw while hidden, so a battle waits until you come back. Story
and Spectate stay mounted the same way once opened. A mission is a second board, so only the board on screen listens
to the keyboard.

The shop states the usual unlock price once (the unlock sheet's title on phones, a line above the shop on desktop) and
marks only units whose price differs (the independents), so tiles have room for names.

| Tool | What it's for |
|---|---|
| **Battle report** | After each battle (and the survivors' damage flying to the HP bars, which a click, a key or Skip cuts short) the field resets to deployment positions. The top three damage dealers on each side get gold, silver and bronze medals on the field and an MVP board in the sidebar. Hover any squad: every squad it fought gets a label on the field ("dealt X" / "took Y"). The sidebar shows damage dealt, kills, damage taken, friendly fire, healing, and breakdowns (dealt through mechanism; taken by source, element and reaction) |
| **Replay** | Rerun the exact battle; it is deterministic |
| **PvP** | Play a friend by link. The tab has one button, **Create a match link**; then it shows the link with Copy (and Share on phones) and waits. The friend's link opens straight on Play, and the host moves to Play as soon as the friend joins (or earlier, to deploy while waiting). During a match the tab offers Back to the board and Leave match. Each round both players deploy, then both browsers run the same battle. A player who pressed Fight can take it back ("Not ready") until the friend presses it too. The address carries the player's seat, so a reload resumes the match. How it works and how to set up the relay: `docs/MULTIPLAYER.md` |
| **How to play** | A three-page walkthrough, a line or two each in large type, so new players start fast: build then watch, survivors hit HP, counter what you see (header button; it also opens when Story's Play the full game now is pressed, or when a link lands on `#play`). Upgrades, veterans and Keeps are left to the Codex. Skip closes it. The AI defaults to Easy |
| **Hard streak** | A vanity counter: matches won in a row against the AI on Hard (every round on Hard, as for the love letter), and the best run, kept in `localStorage` (`src/ui/progress.ts`). A finished Hard match won adds one, lost ends the run; other difficulties and abandoned matches don't count. Shown beside Restart once there's a best, and under the result when a Hard match ends. Story's Reset leaves it alone |
| **Love letter** | An easter egg: winning a match against the AI with it on Hard every round shows a popup ("This game is a love letter to Mechabellum. If you liked this game, you'll love the real thing.") with a link to Mechabellum's Steam page (`src/ui/LoveLetter.tsx`). It shows once ever: the browser remembers it (its own `localStorage` key, so a story reset doesn't bring it back; once per visit where storage is blocked). Changing the AI difficulty mid-deployment replans that round, so switching to Hard in round 1 still counts |
| **Units** | Browse the roster: pick a unit for its card (stats, effects, upgrades) and a small looping fight that shows it doing its thing, with the unit haloed in gold. Each fight is curated in `src/data/showcases.ts` (who it fights and a one-line caption) and runs in a small left-vs-right arena (`src/game/showcase.ts`). "Try it" on an upgrade restarts the fight with it. A test checks the featured side wins every showcase at level 1 with no upgrades. `#units/<unit>` links to one unit; Codex unit chips, Counters rows and the Play unit card link there |
| **Story** | The Compact and the three campaigns (docs/CAMPAIGN.md). Playable missions open at `#story/<mission>`: a briefing (the cast's lines, each a portrait beside a parchment speech bubble, Wardens on the left and goblins on the right, `src/ui/Portraits.tsx`; then a Drill Book page with its rule, its formation drawn and the Marshal's pencil note), then the ordinary Play board with the mission's setup (its supply, units, HP, Keeps on or off, a scripted enemy, an objective line above the shop, and the cast's lines between rounds), then a debrief in the sidebar (lines and a pencil note on a win, a hint read from your army on a loss, the commendation; after a win **Next mission** comes first, then Play again, and a quiet link back to the campaigns). Dialogue is read a line at a time (click or Continue; Skip shows the rest). One-battle missions hide the HP bars. **Progress is stored** in this browser (`src/ui/progress.ts`): missions open in order, each once the one before is won (a lock says which to win first); every mission shows a victory banner and, if it has one, a commendation star, each an empty dashed slot until earned, and each campaign counts both. Reset all progress (with a confirm step) sits at the bottom. The debug panel can open every mission for the visit. Data in `src/data/campaign.ts`, match setup in `src/game/mission.ts`, the framework in docs/CAMPAIGN.md §6. The Wardens campaign (missions 1–9) is built |
| **Codex** | The rulebook, written for a brand-new player: the Compact, rounds and HP, ground and air, Keeps, friendly fire, unlocks, upgrades, veterans, every role, element, status, surface and reaction. Every topic has an anchor (`#codex/<topic>`). Numbers come from the data files |
| **Counters** | "I'm getting wrecked by X, what do I build?" Pick an enemy unit; every other unit fights it at equal supply (one-unit armies, level 1, no upgrades, no Keeps) in a Web Worker, sorted into Build these / Even fights / Don't send these, with plain-word reasons read from the data (`src/game/counters.ts`). Upgrades are out of scope. Cached per session; `#counters/<unit>` links to one unit |
| **Spectate** | Watch the AI play itself (`#spectate`, `src/ui/SpectateView.tsx`, logic in `src/game/spectate.ts`): a whole match, Blue at the bottom and Red at the top, each side's difficulty set apart (Hard by default), for watching unit interactions. Both sides take an opening pack. Each round's battle is fought headless as soon as both have planned, and the next round is planned while it plays (never more than one round ahead), so watching doesn't wait. Every round starts at 1×, as in Play. The sidebar logs what each side bought, shows the result with MVPs and every squad's stats, and lists past rounds to watch again. Auto-advance counts down 3, 2, 1 after a battle (on the field and the Next round button); New match sits beside Next round. Hovering a unit shows its card. **Copy round** copies the battle's exact setup (armies, upgrades, Keep levels, seed) as JSON, to reproduce it in a script. Once opened it stays mounted, like Play, so a Codex link doesn't lose the match |
| **Debug panel** | Click the version in the header's corner (a quiet pill with a hover state, so players can find it; `#debug`, `src/ui/DebugView.tsx`). First, **Report a bug**: a new GitHub issue with the version, browser and screen filled in (it opens only when clicked, and the player can edit it). Then a switch that opens every story mission for the visit (for testing), and **Performance test**: about a minute of fixed armies (the simulator alone, then the deploy screen and three battles on this device's field, played as Play plays them), reported as plain text with Copy and Share. That is how numbers come off a phone: the owner runs it there and pastes the report back; the site still sends nothing. |
| `npm run bench` | Simulator benchmark: time per battle and a fingerprint of every outcome (`docs/SIMULATION.md`) |
| `npm run ai-duel` | Full AI-vs-AI matches, the current planner against a saved baseline, to judge an AI change (`docs/SIMULATION.md`) |
| `npm run balance` | The balance harness (section 4, Balance): stats, coverage, the equal-supply matrix, checks against the targets, and the closing-distance, composition, sensitivity and upgrade tests |

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

- Team color (blue = you, red = enemy) marks ownership everywhere: unit outlines, the facing notch, arrow fletching,
  javelin grips, the rims of boulders, orbs and shards, and beam glows.
- Each shooter has its own projectile art (`look.projectile` on the unit; `src/render/combat.ts`): arrows (Skirmishers),
  crossbow bolts (Crossbowmen, Ballista), javelins (Wolf Riders, Griffon Riders), boulders (Giant, Troll), hail
  (Cloudlings). Without one, the element decides: fireball, water blob, ice shard or spark. An upgrade that changes the
  element keeps the shape and adds that element's glow, trail and embers (Fire Bolts, Frost Giant, Freezing Rain).
- Lobbed shots (boulders, fireballs, water) fly in an arc over a ground shadow; bolts and shards fly nearly flat.
- Beams: lightning crackles and forks; fire (the Dragon) pours out as a widening cone of flame.
- Impacts throw particles in the element's style: embers, droplets, ice glints, sparks or dust. Splash hits flash,
  single-target shots spark where they land, and deaths burst into bits of the unit's color. All of this is
  renderer-only and never touches the sim.
- Size marks *how hard*: projectile size and beam thickness scale with damage per hit.
- Melee units lunge on attack and leave a slash arc on the target; ranged units recoil. A ramping hitter's slash (the
  Troll's) grows bigger and hotter with each hit in a row on the same target: a red-orange glow, then a second ring,
  more debris. A unit attacking faster at full HP (`unhurt`, the Troll) has a faint red pulse under it while the
  bonus is on.
- A unit winding up a shot (Ballista) shows a dashed sight line in its team color to its target, firming up as the
  shot comes.
- A unit with an aura that summons (Ogre *Warboss*) pulses its aura as it calls: a faint red wash over the radius and a
  ring sweeping out to its edge, so the buff's reach shows.
- The field's pixel buffer matches its size on screen, up to 2× the CSS size (`MAX_DPR` in `FieldCanvas.tsx`): a 3×
  phone paints 2.25× fewer pixels and looks the same. The background (grass plus the phase's zones, grid, midline and
  vignette) is cached in an offscreen canvas and repainted if the browser blanks it (a GPU reset under memory
  pressure); plain grass is filled underneath every frame, so a blanked cache never turns the field black or leaves
  trails.
- Unit tokens are stamped from a sprite atlas (`draw.ts`, "unit sprites"): body, shading, outline and icon are drawn
  once per unit look, so a plain token costs one image copy plus its facing notch. Triangles turn with their facing,
  so theirs are cached at 48 headings; frost and veteran numbers sit between body and icon, so those take two stamps.
  The atlas is rebuilt after a GPU reset, like the background.
- Fliers hover above a shadow at their real position and bob gently. Winged fliers (Griffons, Bats, Dragon) flap
  wings; elemental fliers (Cloudlings, a flying Air Elemental) glow instead.
- Every unit has a vector icon (`src/render/icons.ts`), drawn on its token and in the shop.
- Veterans (level 2+) show their level as a small gold number on the bottom-right corner of each model, and a gold
  `LvN` tag on their deployment footprint. Upgraded Keeps show theirs the same way, from level 1 (`shownLevel`).
  (Not stars: ★ already means a bought upgrade.)
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
- The app is static (GitHub Pages): no analytics, and the only things stored are story progress and the love letter's flag, in `localStorage`. Single-player makes no network calls. PvP (section 10, Play a
  friend) talks only to the owner's relay, and only after a player starts or joins a match.

## 12. Roadmap

Rough priority order. Everything is open to reshuffling.

1. **Balance** following `docs/BALANCE.md` (section 4, Balance; open items in `docs/BALANCE-PLAN.md`): veterancy's
   value (the Ballista parks behind chaff), fliers in one-unit fights, hard counters for Crossbowmen, Frost and Toad
   Riders, mixed-army tests. Then human playtests (pick rate, win rate when picked).
2. **Faction bonuses** (section 8).
3. **Campaigns** (docs/CAMPAIGN.md): the Wardens campaign is built; next, the owner's structural changes and
   playtest, then the goblin campaign. Keeping the finale's page 9 is parked (CAMPAIGN.md §5).
4. **Combo pairs in the harness**: compare upgrade pairs inside mixed armies (`npm run balance -- fight` takes `--upsA`).
5. **Reinforcement cards / specialists:** a choice at the start of a round, as data-driven modifiers.
6. **Spells:** one-shot effects placed during deployment, using the same effect vocabulary. The owner's plan: cast
   between rounds on no-man's land. Terrain patches (section 3) are the first step: a spell could add one.
7. **Pathfinding and formations:** move around obstacles, and keep squads together.
8. **AI improvements** (section 9).
9. **More elements** (Earth, Poison), only if the complexity budget allows (section 6).
10. **Multiplayer:** play a friend by link is built (`docs/MULTIPLAYER.md`). Ideas: hash-then-reveal turns, spectators,
    emotes, a turn timer.
