# Common Ground: campaign plan (Nov 2026)

Status: **Wardens missions 1–3 are built and playable** (the Story tab). The rest is a plan. Inputs: `docs/VISION.md`
(the story, which wins on tone), DESIGN.md (mechanics) and the roster as it stands in `src/data/units.ts`. This is
about the order in which the game, its mechanics and its factions are introduced. Names in *italics* are placeholders.

## 1. The big idea: each campaign teaches one layer

Three campaigns of 8 missions each, played in order. Each one ends by exploiting the next faction's weakness, and each
faction's campaign teaches a different layer of the game:

| Campaign | Voice | Teaches | Finale edge |
|---|---|---|---|
| **1. Wardens: The Drill Book** | proud of being boring | **The basics.** Placement, rounds, reading the enemy, towers, unlocks, upgrades, air, veterancy. Almost no elements | the pike line beats the goblins |
| **2. Goblins: The Tinker's Odds** | chaos with heart | **Tempo and chaos.** Flanks, tower raids, chaff, statuses, the first surfaces, friendly fire, risk and reward | oil plus the elementals' own fire beats the elementals |
| **3. Elementals: We Burn** | careful, not arrogant | **Precision.** Reactions, combos, surfaces, positioning as care | the storm field beats the shield wall |
| Epilogue (Wardens) | | `spacing`: "Against storms, spread out" | tied standings |

This keeps the complexity budget honest. The Wardens campaign barely touches elements, which fits a faction with plain
stat upgrades, so a new player learns the basics before anything starts to react. The only status in it is Dazed from
a fallen Keep.

**Two balance targets, kept apart.** The campaign's edges come from authored kits and enemies. Skirmish balance is per
unit at equal supply (`docs/BALANCE.md`) and doesn't follow the triangle. A mission is tuned by simulating its
authored armies (a test per mission, §6), not by bending the open roster.

### Rules that apply to all three

- **HP grows within a campaign and resets at the next one.** HP is the knob for match length. Income stays standard,
  so the economy the player learns is the one they'll use in skirmish. Target lengths are what matter; HP values get
  calibrated by playing the missions.

  | Mission | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
  |---|---|---|---|---|---|---|---|---|
  | HP per player | one battle | 60 | 100 | 140 | 180 | 240 | 300 | 400 |
  | Target length | 1 round | ~3 | ~4 | ~4 | ~5 | ~5 | ~6 | 6–9 |

  Later campaigns could end higher (Goblins at 450, Elementals at 500) so each finale feels bigger than the last.
  Per-side HP is also available as a lever, for example a weaker enemy in mission 2.
- **No army carries over between missions.** Every Field match is a new match under the Compact. That avoids the
  veterancy snowball and needs no saved state. Progress is the *book*: each mission adds a page, and a page makes a
  unit or mechanic available in later missions.
- **Progress is stored, and missions are played in order** (owner, Nov 2, 2026). This browser remembers which
  missions were won and which commendations earned (`localStorage`, `src/ui/progress.ts`), and nothing else. A
  mission opens once the one before it is won; each shows a victory banner and a commendation star, empty until
  earned, so there's always something left to finish. The Story page has Reset all progress. Armies still never carry
  over between missions.
- **Authored enemies, then the AI.** The planner won't reliably produce a story beat, so early missions use scripted
  rounds (fixed squads and placements per round). Later ones use the AI limited to a themed pool. The commanders map
  onto the difficulty personalities that are parked in DESIGN.md §9 (today's Easy, Normal and Hard differ only in
  search effort):
  - **the Boss = Easy.** Builds an even mix and doesn't counter until it's taken real damage. Goblins don't change
    plans until it hurts.
  - **the Marshal (as enemy) = Normal.** A structured board with early counters. It plays by the book, which makes it
    predictable, and the goblins exploit that.
  - **the Tinker = Hard.** Tempo plays: tower rushes, a sudden air investment, overloading one flank.
  - The elementals are Normal, but precise.
- **Tutorial text is in-world.** Wardens: Drill Book pages. Goblins: the Tinker's notebook, with wrong odds and
  crossings-out. Elementals: *the Litany*, the elders' list of whom you must not burn. Each mission opens with a
  briefing (the dispute, a few lines from the cast) and one page, and closes with a short debrief. A lost mission's
  debrief gives one hint, read from what the player fielded. The campaign could later replace the three-page How to
  Play.
- **Each mission adds about one mechanic, at most one player unit and at most one enemy unit.** Every mission has a
  scripted **punch**: a round where the enemy does something the player's current army can't handle. The new
  mechanic or unit is the counterpunch.
- **Optional commendations** (one per mission, e.g. "no Keep falls") give replay value without gating anything. The
  debrief says whether you earned it, and the mission list keeps the star.
- **Game screens still don't explain rules.** Briefings and pages tell the story and give the drill; keywords in them
  link to the Codex like everywhere else.

## 2. Campaign 1, Wardens: The Drill Book

**Story.** It's the start of the Field season. A newly appointed Marshal (player, they/them) inherits the post and the
Drill Book: four hundred years of formations, one page per lesson. The goblin Boss has a season's worth of grievances
to settle, and they escalate from a goat to the whole border. *Sergeant Dunmor* (dwarf): "Boring wins. Write that
down." *Archivist Ithiel* (elf) notes how long each page has gone unchanged. The goblin Boss commands the enemy all
campaign, and SHOUTS. The Tinker shows up halfway, which seeds Campaign 2.

**Arc.** The Marshal trusts the book, then learns that the book can grow. Mission 7 revives a page nobody has turned to
in centuries. Mission 8's last page is the first one the Marshal writes. The owner loves the idea of **generating it from the
player's own winning board**, drawn as a drill-book diagram, but it's **parked** until stored progress is decided (§5).
Until then, the page can be generated and shown at the end of the finale, without being kept.

**Roster.** Everything the campaign needs is built: the six Warden units and the six goblins (Grunts, Skirmishers,
Wolf Riders, Troll, Ogre Brute, Giant Bats). Skirmishers are goblin archers that hit air (decided), so Griffons
(mission 6) aren't a win button in missions 6–8 and the pike-line finale can land.

| # | Mission | Dispute | New for the player | Warden unit | Goblin unit | HP |
|---|---|---|---|---|---|---|
| 1 | Hands Off | a goat | placement, Fight, the hands-off rule | Knights, Crossbowmen | Grunts | 1 battle |
| 2 | The Appeal | the goat, appealed | rounds, locked squads, reading their last army, HP | | Skirmishers | 60 |
| 3 | Two Keeps | a rude drawing on a Keep | towers, collapse Daze, flanks, tower levels | | Wolf Riders | 100 |
| 4 | Under the Bridge | the bridge toll | unlocks, big units, regeneration | Ballista | Troll | 140 |
| 5 | Plain Steel | the wheelbarrow patent | upgrades, yours and theirs | Cleric | the Tinker's gadgets | 180 |
| 6 | Look Up | who owns the sky | the air layer | Griffon Riders | Giant Bats | 240 |
| 7 | Old Grumm | an old grudge | veterancy, promotions | Dwarven Pikemen | Ogre Brute (veteran) | 300 |
| 8 | The Marches | the border itself | the full Compact: opening offer, blind from round 1 | (all) | (all) | 400 |

### 1. Hands Off (built)
- **Dispute.** A goat wandered across the border at Millbrook. Both sides claim it.
- **Page 1, the Compact.** "Choose your champions. Place them. When the horn sounds, no hand may touch the Field."
  Under it, the first drill: *Steel in front. Arrows behind.*
- **Kit.** 400 supply, Knights (200) and Crossbowmen (100), both unlocked. No Keeps, no upgrades, no opening offer.
  **The goblin army is already placed and visible** ("the challenger deploys first"), the only time the player gets a
  full look before Fight.
- **Enemy.** Three Grunt mobs (300 supply), left, center and right.
- **Punch.** The mobs charge. Crossbowmen alone get swarmed (`RELATIONS`: "a swarm soaks the bolts and reaches
  them"). Knights are "a wall the mob runs onto", and Crossbowmen behind them shoot in peace.
- **Checked by simulation** (`tests/campaign.test.tsx`): any army with a Knight squad wins, from almost any
  placement; three or four Crossbowmen lose. Knights placed in front of the Crossbowmen bring every crossbowman home.
- **Commendation.** *Steel in Front*: win with Crossbowmen on the Field and lose none of them.
- **Teaches.** Steel in front, arrows behind. Then the horn sounds and you let go.
- **Debrief.** Sergeant: "Boring wins. Write that down." The Boss files an appeal (mission 2).

### 2. The Appeal (built)
- **Dispute.** The goblins appeal the goat. Under the Compact a loss can be appealed once, as a longer match: rounds
  and HP, explained in-world.
- **Page 2, What Is Placed Stays Placed.** "You will see what they fielded, never what they will add." Drill: *Read
  their last army. Guess their answer. Add yours.*
- **Kit.** 400 supply, then the standard income; Knights and Crossbowmen. **HP 70 for the player, 90 for the Boss**
  (per-side HP: the reactive path has room to lose a round). No Keeps, no upgrades, veterancy off. Map: Millbrook
  Ford, a pond in the middle (the Archivist mentions it). Round 1 is blind, for the first time.
- **Enemy.** Round 1: four Grunt mobs. Round 2: two Grunt mobs in front of three Skirmisher squads, on **the flank the
  player's army leaves thin** (the side away from its cost-weighted center; the Boss reads what you fielded).
  Round 3: three more Grunt mobs in the center. Nothing after.
- **Punch.** The archers shoot from behind the goblin screen on the empty flank (Skirmishers beat Crossbowmen: "too
  many bodies for a few bolts").
- **Checked by simulation:** a player who loses round 2, reads it and puts steel on the flanks wins in four rounds
  (26 HP left); one who guesses and covers both flanks in round 2 wins every round (the commendation). Never adding
  after round 1, adding only bows, and all bows lose.
- **Commendation.** *Guess Right*: win every round of the appeal.
- **Debrief hints.** Never added after round 1 ("supply you don't spend doesn't fight"); no Knights; otherwise the
  thin-flank lesson.

### 3. Two Keeps (built)
- **Dispute.** A goblin painted something rude on the West Keep. ("IT'S A GOOD LIKENESS.")
- **Page 3, Two Keeps.** "Every Field has two Keeps. If one falls, the whole army loses its nerve." Drill: *Guard the
  flanks, or build the walls higher.*
- **Kit.** 400 supply, Knights and Crossbowmen, HP 100 each, **Keeps on**, veterancy off. Unit upgrades stay off, so
  the sidebar's second tab is just **Keeps** (levels for sale). Map: Long Grass, tall grass on both flanks (the
  Sergeant: "Goblins like long grass").
- **Enemy.** The Boss's Wolf Riders have *Tower Raiders* (shown as a ★ on his wolves: a first look at enemy
  upgrades). Round 1: three Grunt mobs and Skirmishers. Rounds 2 and 3: one Wolf Rider squad on the player's thin
  flank each time, while Grunts and Skirmishers join the center. Round 4: a last few goblins.
- **Punch.** The wolves come through the long grass (hidden from the bows) and go for that flank's Keep; when it falls
  the whole army is Dazed and the center collapses.
- **Checked by simulation:** steel beside the Keeps wins, and so do Keep levels with a Knight squad on a flank, and
  buying levels and guarding the flank after the first raid. Bows and levels with no new steel lose, and so does all
  bows. **What the tuning found:** a level-1 Keep only delays a Tower Raiders squad, so levels buy time and steel
  ends raids. The hints say so.
- **Commendation.** *Not One Stone*: win without losing a Keep (Knights beside both Keeps from round 1 earn it).

### 4. Under the Bridge
- **Dispute.** The goblins have adopted the troll under the toll bridge and claim its toll.
- **Page 4.** "The armory holds more than the book's first pages. Each new engine costs the Treasury once per Field."
- **Punch.** A Troll walks through Knights: its Berserk rage builds through the armor ("the rage builds through the
  armor") and it regenerates between hits.
- **Teaches.** Unlocks are a one-time cost per match. The Ballista hunts the biggest target, and big things need
  specialists. A light seed: Burning stops the troll healing (Crossbowmen *Fire Bolts* comes in mission 5).

### 5. Plain Steel
- **Dispute.** The Tinker (first appearance) accuses the Wardens of stealing the wheelbarrow. Archivist: "We have had
  wheelbarrows for four hundred and twelve years."
- **Page 5.** "A drill improves every squad that knows it, even those already on the Field."
- **Punch.** The Tinker's gadgets: *Scrap Armor* Grunts (each blocks the first hit it takes, so every big bolt is
  wasted on one) and a Troll with *Thick Blood* (it heals even while Burning). The Tinker announces odds for each
  one, all wrong.
- **Teaches.** Upgrades apply to every squad, including locked ones. You can see the enemy's upgrades.
  Counter-upgrades: *Repeaters* (many small bolts, the Wardens' chaff clear) against armored Grunts. The Cleric heals
  at base, but its prayers (*Blessing*, *Battle Hymn*) are what make it shine, so it's the unit that sells upgrades.

### 6. Look Up
- **Dispute.** "The Compact draws borders on the ground. The goblins have noticed."
- **Page 6.** "Knights cannot strike what flies. Know which of your champions can."
- **Punch.** Giant Bats fly over the line and eat the Crossbowmen.
- **Teaches.** Two layers. Crossbowmen, Ballista and Griffons hit air; Knights, Pikemen and Trolls don't. *Skyhunters*
  is the counter-upgrade. Griffons are fast and good against bats, but weak against massed bolts and Skirmishers.

### 7. Old Grumm
- **Dispute.** Thirty years ago, at a Field match, Old Grumm ate the Sergeant's helmet.
- **Page 7.** The pikes page. Archivist: "No one has turned to it in two hundred years. There was nothing large
  enough to need it."
- **Punch.** Grumm, a Lv3 Ogre Brute with *Warboss* (calls a grunt every 5 s and drives the goblins around him),
  plus Wolf Riders. Grumm is the player's first look at a veteran.
- **Teaches.** Veterancy: squads that deal damage earn levels, and you pay to promote them. The answer to a legend is
  a cheap specialist: Dwarven Pikemen (×3.5 against large units and cavalry, *Pike Wall* against melee). Seed for
  Campaign 2: Pike Wall makes stabbing goblins kill themselves.

### 8. The Marches
- **Dispute.** The season final. The Boss stakes the whole border.
- **Page 8.** The full Compact: the opening offer, both sides blind from round 1, everything available.
- **Enemy, in two phases.** First the Boss (Easy): bigger and more. Ogres, Trolls, Wolves and Grunts throw themselves
  onto the pike line and lose. After about two lost rounds the Tinker takes over (Hard): a sudden bat swarm, a double
  Keep raid, Skirmishers that don't touch the pikes. The Boss keeps shouting "NO. BIGGER."
- **Teaches.** The whole counter web at once: punch, counterpunch, and a counter to the counter.
- **Ending.** The pike line wins, and the Boss had no answer to it. The Tinker *did* have ideas, but nobody listened.
  The Marshal writes page 9 in their own hand, drawn from the player's board (parked, §5).

## 3. Campaign 2, Goblins: The Tinker's Odds

**Story.** The player commands as the Boss, with the Tinker advising. Act 1 (missions 1–4) is revenge on the Wardens.
In Act 2 (missions 5–8) the goblins, full of themselves, challenge the Elementals. The Tinker wants elemental fire for
the forge ("Fire's also free"). The elementals are shown from outside as aloof snobs. HP resets to the low end of the
curve.

**The goblin "X" against the pike line.** Don't go through it. Go around it (Keeps), over it (Bats) or shoot from
outside it (Skirmishers, a rock-throwing Troll). The rigid, predictable Wardens AI (Normal, playing by the book) becomes
the thing to exploit. "Lads, they had pointy sticks and we had nothing. So I made a bigger thing": the bigger thing is
the Troll's fourth upgrade, ***Boulder Toss***: it throws rocks from 3 tiles instead of punching, so it never touches
the pikes. It's built as a **placeholder**, like Skirmishers *Skyshot*; the owner deferred both slots until after the
campaign, so expect them to change.

**The fire arc.** The Tinker's line is split across three missions: "Fire's hot." / "Fire's also free." / "Point it
at THEM." Goblins who go out in a blaze get cheered, not mourned.

| # | Mission | Opponent | New for the player | Goblin unit / upgrade |
|---|---|---|---|---|
| 1 | Pointy Sticks | the Marshal (Wardens M8 replayed) | win by toppling a Keep, not by beating the army | Grunts, Wolves, Troll, Ogre |
| 2 | A Bigger Thing | Marshal | shoot, don't stab: short range against Pike Wall | Skirmishers, Troll *Boulder Toss* |
| 3 | The Gang | Marshal | chaff and screening; numbers absorb the losses | Grunt *Party Time*, Ogre *Warboss* and *Thick Skull* |
| 4 | Both Keeps | Marshal | tempo: a double Keep raid against a rigid army; first statuses you wield (Dazed) | Giant Bats (*Shriek*), Wolf Riders *Tower Raiders* |
| 5 | Snobs | elementals | statuses from the receiving end; splash punishes clumps; anti-air against Cloudlings and flying Air Elementals | Skirmishers *Skyshot*; maybe hired Bog Toad Riders (below) |
| 6 | Fire's Hot | elementals | your own fire burns your own gang (friendly fire) | Skirmisher *Improvised Bombs* |
| 7 | Fire's Free | elementals | the first surface: dead grunts leave oil; Oiled → Ignite | Grunt *Oil Bombs* |
| 8 | Point It at Them | elementals (fire-heavy) | steer *their* fire: oil under their line, their fireballs light it | everything |

Notes:
- **Mission 1** replays the Wardens finale from the losing side, as `docs/VISION.md` suggests. A head-on win is near
  impossible, but **the win condition is a fallen Keep**, so the first goblin lesson is the goblin way to win. The
  Boss watches the replay and points at things.
- **Mission 4** is the revenge payoff. Both Keeps fall, the Warden army is Dazed, and the gang pours in. The Marshal:
  "That isn't in the book." The Archivist starts writing.
- **Mission 5, a suggestion:** independents exist to cover a faction's holes (DESIGN.md §8), and the goblins' worst
  hole is the air. The Bog Toad Riders (the owner's favorite) could be hired for this mission: their tongues hit
  fliers, and *Gulp* Snares one so melee can reach it. That teaches independents in-story.
- **Mission 8** works because statuses and surfaces are neutral: the elementals' own Burning and *Wildfire* hurt
  elementals. In the replay, a young fire elemental's fireball sets off the oil under its own friends. That shot opens
  Campaign 3.
- **Risk and reward**: the Tinker gives odds on every upgrade (always wrong). Upgrades that cost the goblins
  something (Scrap Armor's slowdown, Improvised Bombs' friendly fire, Oil Bombs only paying out on death, Ogre
  *Thick Skull* killing a nearby goblin instead) are the material.

### What the goblin campaign still needs

Every unit and upgrade it uses is built. What's left:

- **Raids have to swing fights.** "Win by raiding" needs a fallen Keep to decide a round. Since the plan was written,
  Keeps got levels worth 2,000 HP each, a 4 s collapse Daze and Wolf Riders *Tower Raiders*; whether a raid now swings
  a close fight in practice is unchecked. Missions 1 and 4 should be simulated early.
- **Friendly fire has to be readable.** The battle report counts it per squad; the field probably needs a clearer
  "that was your own fire" cue for the fire arc.
- **A "topple a Keep" win condition** in the mission framework (goblin mission 1).

## 4. Campaign 3, Elementals: We Burn

**Story.** The protagonist is a young fire elemental, *Ember*, who after the goblin finale is afraid of burning its
neighbors. An elder: "We are not complicated because we are clever. We are complicated because we burn." Act 1 is the
rematch with the goblins: learning care. Act 2 is the challenge to the Wardens. Positioning, the hardest skill in the
game, becomes an act of care.

| # | Mission | Opponent | New for the player |
|---|---|---|---|
| 1 | We Burned Our Own | goblins (G8 replayed) | friendly fire seen from the inside; objective: win a round with low friendly fire (the battle report already tracks it) |
| 2 | Room to Breathe | goblins | positioning: fire at the back with gaps, a body in front; `spacing` |
| 3 | Controlled Burn | goblins | **Controlled Burn as character growth**: an upgrade that turns care into a skill (`onHitAffects: "enemies"`) |
| 4 | Water and Fire | goblins | first reactions: Douse, Steam; water puts out goblin oil fires; healing (*Wellspring*) |
| 5 | The Wall | Marshal | resistances: *Warded Plate* shrugs elements; Frost → Freeze → Shatter needs a physical partner |
| 6 | Wet Ground | Marshal | the combo pair: Wet + lightning = Conduct; chain lightning in tight ranks |
| 7 | The Field Is a Weapon | Marshal | surfaces you choose: *Tidal Surge* puddles, electrified water spreading, keeping your own units out |
| 8 | The Storm | Marshal (tight shield wall) | the full combo field on a shield wall: hard to do, the most beautiful thing on the board |

**Epilogue (playable, Wardens).** *Against Storms, Spread Out.* A short mission with one new Warden drill that grants
`spacing`, which no unit uses today. Then the scoreboard scene: "Same time next season?" The Goblin says yes at once,
the Warden checks the calendar, the Elemental pauses, then says yes.

### What the story needs from the elementals

The October suggestions were written against an older roster and are superseded by the per-unit balance pass. What
still holds, as requirements for the missions rather than for skirmish balance:

- **The friendly-fire cost has to be visible at base.** Ember's fear only works if unupgraded fire visibly burns
  neighbors. Today it does: the Fire Elemental's splash and Burning catch allies, and *Controlled Burn* ("its flames
  only catch on enemies") is the turning point. Keep it that way.
- **The Storm has to beat a shield wall** in an authored mission 8: Water and Air (Wet + lightning = Conduct) against
  clumped Knights, with *Warded Plate* as the Marshal's counterpunch, which forces a second answer. Check it by
  simulating the mission's armies, like Wardens mission 1.
- **A front line for a careful faction.** The Water Elemental (Sturdy) and the Stone Golem (Sturdy, Melee) are it.
  Mission 2 ("a body in front") depends on one of them holding long enough for the shooters.
- **Frost as "the careful one"** is still a nice story direction: chill and freeze as protection that holds enemies
  away from allies (*Hoarfrost*), rather than only a setup for Shatter.
- **Wardens epilogue drill.** "Against storms, spread out" fits as a **faction doctrine** (DESIGN.md §8 faction
  bonuses, not built yet). Wardens doctrines could literally be drill pages: pick one per match. That gives faction
  bonuses a story and an interface.
- **Independents** are cast in §9: each is introduced by one mission, on a map that makes it the natural hire.

### Final reflection

- The structure holds up because each faction's weakness is the flip side of its strength, which `docs/VISION.md` already
  states: the Wardens are rigid, the goblins are reckless with fire and numbers, the elementals are dangerous to each
  other. Each campaign's lessons come out of that, not out of a checklist.
- **The biggest risk is the elementals**, because their campaign depends on combos landing in authored fights. Their
  missions should be simulated early, even though their campaign comes last.

## 5. Parked ideas

These ideas are kept on purpose. Don't drop them when the plan changes.

- **The player's winning board becomes the Drill Book's last page** (Wardens mission 8). Record the player's army from
  the finale's deciding round and draw it as a formation diagram: "Page 9, in the Marshal's hand." The owner called it
  "genius". Story progress is stored now, so the page could be kept alongside it, and later campaigns could refer back
  to it (for example the goblin campaign opening against *your* page-9 army, replaying the player's real finale
  instead of an authored one). Check with the owner before storing more than progress.

## 6. The mission framework

A mission is data: a `MissionDef` in `src/data/campaign.ts`, attached to its entry in `CAMPAIGNS`. The match is the
ordinary match with the mission's setup, played in the same `PlayView` (its `mission` prop), so placement, battles,
the report and replays all work unchanged. The sim is untouched.

| Field | What it sets |
|---|---|
| `supply` | the player's supply in round 1 (later rounds get the standard income) |
| `units` | the player's units, unlocked and free; `shop` lists more the player may unlock (mission 4 on) |
| `hp` | each side's HP; absent means **one battle decides it**, and the HP bars and damage tally are hidden |
| `towers`, `upgrades` | whether the Keeps stand and whether the Upgrades tab exists. With Keeps but no upgrades, the tab is just **Keeps** (mission 3) |
| `veterancy` | whether squads earn XP (off until mission 7) |
| `map` | the map (`src/data/terrain.ts`); absent: the open field |
| `enemy.units` | the enemy's unlocks, shown like the AI's |
| `enemy.rounds` | squads added each round, in field coordinates (the enemy deploys at the top). A round can be a function of what the enemy saw (`seen`: the player's squads from earlier rounds), e.g. `onFlank(thinFlank(seen), …)` puts squads on the flank the player left thin |
| `enemy.upgrades` | upgrades the enemy has from the start, shown as ★ like the AI's |
| `enemy.revealed` | round 1's squads are placed and visible before the player deploys |
| `briefing`, `page` | lines from the cast, then the Drill Book page (a title, its text and an optional drill diagram) |
| `objective` | one line in the sidebar while deploying |
| `win`, `hints` | the debrief: lines on a win; on a loss, the first hint whose condition matches what the player fielded |
| `commendation` | a name, how to earn it, and a check against every battle of the match (`results`) |
| `reference` | plans that must win, must lose, and must earn the commendation: per round, squads to add, or squads plus Keep levels to buy |

`src/game/mission.ts` builds the match (`newMissionMatch`), the enemy's scripted turn (`missionPlan`) and the outcome
(`missionOutcome`: won, and the commendation). `tests/campaign.test.tsx` checks every mission's data (squads in the
enemy zone, no overlaps, units that exist) and plays its **reference armies**: a mission lists armies that should win
and armies that should lose, and the test fights them. That's how a mission's punch and counterpunch stay true when
units are rebalanced.

The Story tab (`#story`) lists the campaigns, and a playable mission opens at `#story/<mission id>`: the briefing,
then the Field, then the debrief with Try again and Next. The tab stays mounted once opened, like Play, so a Codex
link mid-mission doesn't lose it.

### Making a mission (the recipe used for missions 1–3)

1. **Story first.** Read `docs/VISION.md` and this mission's entry above: the dispute, the page, the punch and the
   counterpunch, the commendation. Check the punch against `RELATIONS` in `src/data/balance.ts` (who beats whom, and
   why): the lesson has to be true in the sim, not just in the story.
2. **Write the `MissionDef`** in `src/data/campaign.ts` (copy the closest mission) and set `play:` on its entry in
   `CAMPAIGNS`. Enemy squads use field tiles; the enemy deploys in rows 0–6 (a squad's `y` is its top row, so a
   4×2 Grunt mob fits at `y` 0–5). Keep each round's squads clear of earlier rounds' squads, on both flanks if a round
   uses `onFlank`. `thinFlank(seen)` and `onFlank(flank, specs)` (write specs for the West; they're mirrored for
   the East) make the Boss answer what the player fielded.
3. **Draft player plans** of three kinds: sensible, reactive (loses the punch round, then adapts) and careless (all
   bows, never adds, ignores the lesson). Plans must spend what a player really has: the mission's `supply` in round 1,
   then the standard income (+400, +500, +600, …); Keep levels cost 100 / 200 / 400 / 800 each.
4. **Play them:** `npm run mission -- <id> '<plan json>'` plays one plan round by round (W/L, battle length, damage,
   Keeps lost, HP, and the debrief hint on a loss); with no plan it plays the mission's reference plans. Iterate on
   the enemy's rounds and on per-side HP until the shape is right: the careless plans lose, the sensible ones win,
   the reactive one wins with some HP to spare, the commendation is reachable, and a match runs about the target
   number of rounds. Lessons from 1–3:
   - The punch needs to *land*: if the scripted unit doesn't do the thing (wolves chasing the nearest squad instead of
     a Keep), give the enemy the upgrade that makes it (`enemy.upgrades`, Tower Raiders) rather than hoping.
   - Rounds after the script ends are free wins for the player (the enemy adds nothing), so keep the script going
     until the target length, or a careless plan wins late.
   - A map can make or break a punch (the raid lands on Long Grass, not on the open field).
5. **Keep the clearest plans as `reference`** (`wins`, `loses`, `commended`), only those with a clear margin, so a
   small rebalance doesn't flip them; comment what each one does. `npm test` then fights them on every change.
6. **Text:** briefing (3–5 lines, the cast's voices from VISION.md), page and drill, objective, win lines (seed the
   next mission), hints from specific to general (the last has no `when`). A new speaker needs a `CAST` entry and a
   face in `src/ui/Portraits.tsx`.
7. **Check it on screen** (Playwright, CLAUDE.md "Verifying UI changes"; the debug panel's "Open every story mission"
   skips the earlier ones), then update this file's mission entry with what the tuning found.

Not built yet (each arrives with the mission that needs it): AI enemies limited to a pool (the Boss, the Tinker), a
"topple a Keep" win condition, a two-phase enemy (mission 8), and `npm run playtest -- --mission N`.

## 7. Plan of attack

1. ~~**Goblin roster rework**~~ **Done (Oct 2026).**
2. ~~**Mission framework**~~ **Done (Nov 2026)** (§6).
3. ~~**Missions 1–3**~~ **Built (Nov 2, 2026).** Next: the owner playtests them as onboarding.
4. Missions 4–8, then the replay-opener tech for Goblin mission 1 (an authored version of the Wardens finale, played
   from the other side, since nothing is stored between missions).
5. Goblin campaign. Simulate the elementals' authored fights at the same time, then build their campaign.

## 8. Owner decisions

- Skirmishers are goblin archers that hit air. *Boulder Toss* exists as a placeholder until after the campaign.
- **Pikemen arrive in mission 7** (left to Claude): one new unit per mission, and the player learns the pikes before
  the finale leans on them.
- **The goblin player is the Boss**, with the Tinker advising.
- **Independents** (Nov 2, 2026): a mission has to show the player when and how to use each one, and in play they're
  there to add map-to-map variety. The rest was left to Claude (§9).
- **Story is the left-most tab and where the site opens**, with a "Play the full game now" shortcut at the very top
  for impatient players. Progress is stored and missions are played in order (§1).
- **Terrain** (Nov 2, 2026): new ground conditions for map variety, and a first step toward spells cast on no-man's
  land between rounds (spells themselves are out of scope for now). Units and the AI don't plan around terrain.

## 9. Independents and maps

Each independent is introduced by one mission, on a map whose ground or enemy makes it the natural hire. The mission
puts it in the shop (`shop`, at the independents' unlock price), and the briefing says what hole it fills, so the
player learns *when* to reach for it, not just that it exists. After that it's in every later mission's shop, and maps
keep the matches different from each other. Plan (checked by simulation when each mission is built):

| Independent | Hole it fills | Introduced in | Map and why |
|---|---|---|---|
| **Giant** | splash artillery: the Wardens have none | Wardens 8, *The Marches* | a rocky border pass. The Boss throws swarms at the pike line, and the Marshal hires outside the book for the first time: the book can grow |
| **Bog Toad Riders** | anti-air and anti-medium for the goblins | Goblins 5, *Snobs* | a marsh of ponds and rough ground. Cloudlings and a flying Air Elemental own the sky until the toads pull them down (*Gulp*) |
| **Dragon** | the late-game flier | Elementals 7, *The Field Is a Weapon* | Long Grass: the Wardens' crossbows hide in it from every ground shooter, but fliers see into grass, and the Dragon's breath splashes |

Terrain itself (rocks, ponds, rough ground, tall grass) is in DESIGN.md; missions name their map (`map`), and skirmish
matches draw one at random.
