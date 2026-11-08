# Common Ground: campaigns

Status: **the Wardens campaign is built and playable** (missions 1–9, the Story tab), with the owner's copy pass in
(`docs/COPY.md`). The goblin and elemental campaigns are a plan. Inputs: `docs/VISION.md`
(the story, which wins on tone), DESIGN.md (mechanics) and the roster as it stands in `src/data/units.ts`. This is
about the order in which the game, its mechanics and its factions are introduced. Names in *italics* are placeholders.

## 1. The big idea: each campaign teaches one layer

Three campaigns of 8 missions each, played in order. Each one ends by exploiting the next faction's weakness, and each
faction's campaign teaches a different layer of the game:

| Campaign | Voice | Teaches | Finale edge |
|---|---|---|---|
| **1. Wardens: The Drill Book** | the book against the real world | **The basics.** Placement, rounds, reading the enemy, towers, unlocks, upgrades, air, veterancy. Almost no elements | the pike line beats the goblins |
| **2. Goblins: *The Tinker's Notebook*** | smart, sarcastic, chaos with heart | **Tempo and chaos.** Flanks, tower raids, chaff, statuses, the first surfaces, friendly fire, risk and reward | oil plus the elementals' own fire beats the elementals |
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

  | Mission | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
  |---|---|---|---|---|---|---|---|---|---|
  | HP per player | one battle | 70 | 100 | 200 | 180 | 260 | 240 | 300 | 400 |
  | Target length | 1 round | ~3 | ~4 | ~4 | ~4–5 | ~3–4 | ~4–5 | ~5 | 5–7 |

  Later campaigns could end higher (Goblins at 450, Elementals at 500) so each finale feels bigger than the last.
  Per-side HP is also available as a lever, for example a weaker enemy in mission 2.
- **No unlock prices in the campaign.** Unlocking costs too much in a mission's small battles, makes missions hard to
  tune, and makes every mission start the same way. Every unit the player has met so far is available, free, from the
  start, and each mission adds at most one (`units`). Players of the full game learn unlocks there. (`shop` and
  `opening` still exist in `MissionDef` for later campaigns; no Wardens mission uses them.)
- **Starting supply grows through a campaign** (400, 500, 600, … 1200 in missions 1–9), so round 1 has more than one
  sensible opening. Income after round 1 stays standard.
- **No army carries over between missions.** Every Field match is a new match under the Compact. That avoids the
  veterancy snowball and needs no saved state. Progress is the *book*: each mission adds a page, and a page makes a
  unit or mechanic available in later missions.
- **Progress is stored, and missions are played in order.** This browser remembers which
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
- **Tutorial text is in-world.** Wardens: Drill Book pages, with the Marshal's pencil notes in the margins. Goblins: the
  Tinker's notebook, with crossings-out and improved versions. Elementals: *the Litany*, the elders' list of whom you
  must not burn. Each mission opens with a briefing (the dispute, a few lines from the cast) and one page, and closes
  with a short debrief. Dialogue is read a line at a time (click or Continue; Skip shows the rest). A lost mission's
  debrief gives one hint, read from what the player fielded; a won one offers the next mission first. The campaign could
  later replace the three-page How to Play.
- **Each mission adds about one mechanic, at most one player unit and at most one enemy unit.** Every mission has a
  scripted **punch**: a round where the enemy does something the player's current army can't handle. The new
  mechanic or unit is the counterpunch.
- **Optional commendations** (one per mission, e.g. "no Keep falls") give replay value without gating anything. The
  debrief says whether you earned it, and the mission list keeps the star.
- **Game screens still don't explain rules.** Briefings and pages tell the story and give the rule; keywords in them
  link to the Codex like everywhere else.
- **Copy doesn't repeat the screen.** No kit lines, objectives are just the goal, and a rule appears once per screen.
  Use one game term per concept (`docs/VISION.md`).

## 2. Campaign 1, Wardens: The Drill Book

**Story.** It's the start of the Field season. A newly appointed, nervous Marshal (player, they/them, speaks out loud)
inherits the post and the Drill Book: four hundred years of formations, one page per lesson. The goblin Boss has a
season's worth of grievances to settle, and they escalate from a goat to the whole border. *Sergeant Dunmor* (dwarf) has
never read the book and knows the real world completely; he's old, confident and lazy, and anything he has learned from
experience he assumes is in the book ("Book says so"). *Archivist Ithiel* (elf) knows the book completely and has never
seen the real world, and is delighted to finally be outside. The goblin Boss commands the enemy all campaign, SHOUTS,
and wants to swarm the player with numbers. The Tinker shows up halfway and carefully picks upgrades, which seeds
Campaign 2.

**Arc.** Dunmor and Ithiel learn from each other, and the Marshal writes it down in pencil. Dunmor finds out what the
book says (mission 5 explains the invoices; mission 8 reveals a page on ogres he never knew about), and Ithiel finds out
what the world is like (the pond on his map, the grass, the troll's knees, griffons that bite). In the finale they swap:
Dunmor quotes page 3 and Ithiel offers the griffon bite as evidence. Mission 9's last page is the first one the Marshal
writes in ink. It says "Boring wins," which finally makes the book say what Dunmor always claimed it did. Below that, the
owner loves the idea of **generating the page from the player's own winning board**, drawn as a Drill Book diagram. Built
as shown, not kept: the finale's debrief draws it; keeping it is parked (§5).

**Running thread: the wheelbarrow.** The Tinker borrows it in mission 5 and returns it in mission 9 with a second wheel.
It's better, and it isn't in the book, which is the first hint that the book can change.

**Roster.** Everything the campaign needs is built: the six Warden units and the six goblins (Grunts, Skirmishers,
Wolf Riders, Troll, Ogre Brute, Giant Bats). Skirmishers are goblin archers that hit air (decided), so Griffons
(mission 7) aren't a win button in missions 7–9 and the pike-line finale can land.

| # | Mission | Dispute | New for the player | Warden unit | Goblin unit | HP |
|---|---|---|---|---|---|---|
| 1 | Hands Off | a goat | placement, Fight, the hands-off rule | Knights, Crossbowmen | Grunts | 1 battle |
| 2 | The Appeal | the goat, appealed | rounds, locked squads, reading their last army, HP | | Skirmishers | 70 / 110 |
| 3 | Two Keeps | a rude drawing on a Keep | towers, collapse Daze, flanks, tower levels | | Wolf Riders | 100 / 200 |
| 4 | The Troll | a troll | big units, regeneration, slow ground, depth | Ballista | Troll | 200 / 180 |
| 5 | The Wheelbarrow | the wheelbarrow patent | upgrades, yours and theirs | | the Tinker's upgrades | 180 / 200 |
| 6 | Under the Bridge | the bridge toll | healing, holding a crossing | Cleric | | 260 |
| 7 | Look Up | who owns the sky | the air layer | Griffon Riders | Giant Bats | 240 |
| 8 | Old Grumm | an old grudge | veterancy, promotions | Dwarven Pikemen | Ogre Brute (veteran) | 300 |
| 9 | The Marches | the border itself | the full Compact: everything at once, blind from round 1 | Giant | (all) | 400 |

### 1. Hands Off (built)
- **Dispute.** A goat wandered across the border at Millbrook. Both sides claim it.
- **Page 1, the Compact.** "Choose your units. Place them. When the horn sounds, no hand may touch the Field." The
  Marshal's pencil note: *Knights in front, Crossbowmen behind. Surely there's more to it?*
- **Kit.** 400 supply, Knights (200) and Crossbowmen (100), both unlocked. No Keeps, no upgrades, no opening offer.
  **The goblin army is already placed and visible** ("the challenger deploys first"), the only time the player gets a
  full look before Fight.
- **Enemy.** Three Grunt mobs (300 supply), left, center and right.
- **Punch.** The mobs charge. Crossbowmen alone get swarmed (`RELATIONS`: "a swarm soaks the bolts and reaches
  them"). Knights are "a wall the mob runs onto", and Crossbowmen behind them shoot in peace.
- **Checked by simulation** (`tests/campaign.test.tsx`): any army with a Knight squad wins, from almost any
  placement; three or four Crossbowmen lose. Knights placed in front of the Crossbowmen bring every crossbowman home.
- **Commendation.** *Knights in Front*: win with Crossbowmen on the Field and lose none of them.
- **Teaches.** Knights in front, Crossbowmen behind. Then the horn sounds and you let go.
- **Debrief.** Sergeant: "Boring wins. Book says so." The Archivist says it doesn't. The Boss files an appeal (mission 2).

### 2. The Appeal (built)
- **Dispute.** The goblins appeal the goat. Under the Compact a loss can be appealed once, as a longer match: rounds
  and HP, explained in-world.
- **Page 2, What Is Placed Stays Placed.** "You will see what the other side has fielded, but never what they will add."
- **Kit.** 500 supply, then the standard income; Knights and Crossbowmen. **HP 70 for the player, 110 for the Boss**
  (per-side HP: the reactive path has room to lose a round). No Keeps, no upgrades, veterancy off. Map: Millbrook
  Ford, a pond in the middle (the Archivist's map says shallow crossing; the Sergeant knows better). Round 1 is blind,
  for the first time.
- **Enemy.** Round 1: four Grunt mobs in the middle (the flanks stay clear for round 2). Round 2: two Grunt mobs in
  front of three Skirmisher squads, on **the flank the
  player's army leaves thin** (the side away from its cost-weighted center; the Boss reads what you fielded).
  Round 3: three more Grunt mobs in the center. Nothing after.
- **Punch.** The archers shoot from behind the goblin screen on the empty flank (Skirmishers beat Crossbowmen: "too
  many bodies for a few bolts").
- **Checked by simulation:** round 1 has several good openings (two Knights and a Crossbowman, or one Knight and two or
  three Crossbowmen). A player who loses round 2, reads it and puts Knights on the flanks wins; one who guesses and
  covers both flanks in round 2 wins every round (the commendation). Never adding after round 1, adding only
  Crossbowmen, and all Crossbowmen lose.
- **Commendation.** *Guess Right*: win every round of the appeal.
- **Debrief hints.** Never added after round 1 ("Supply in your pocket doesn't fight"); no Knights; otherwise the
  thin-flank lesson.

### 3. Two Keeps (built)
- **Dispute.** A goblin painted something rude on the West Keep. ("IT'S A GOOD LIKENESS.")
- **Page 3, Two Keeps.** "If a Keep falls, the whole army is Dazed. A Keep can be built higher."
- **Kit.** 600 supply, Knights and Crossbowmen, **HP 100 for the player, 200 for the Boss**, **Keeps on**, veterancy off. Unit upgrades stay off, so
  the sidebar's second tab is just **Keeps** (levels for sale). Map: Long Grass, tall grass on both flanks (the
  Sergeant: "Goblins hide in it." The Archivist: the book doesn't mention grass at all).
- **Enemy.** The Boss's Wolf Riders have *Tower Raiders* (shown as a ★ on his wolves: a first look at enemy
  upgrades). Round 1: three Grunt mobs and Skirmishers. Rounds 2 and 3: one Wolf Rider squad on the player's thin
  flank each time, while Grunts and Skirmishers join the center. Round 4: a last few goblins.
- **Punch.** The wolves come through the long grass (hidden from the Crossbowmen) and go for that flank's Keep; when it
  falls the whole army is Dazed and the center collapses.
- **Checked by simulation:** Knights beside the Keeps win, and so do Keep levels with a Knight squad on a flank, and
  buying levels and guarding the flank after the first raid. Crossbowmen and levels with no new Knights lose, and so
  does all Crossbowmen. **Design notes:** a level-1 Keep only delays a Tower Raiders squad, so levels buy time and
  Knights end raids. The hints say so. Every squad stays on the Field, so the wolves pile up on the thin flank; a raid
  big enough to cost a sensible plan its round makes the commendation impossible, so the raid takes Keeps from careless
  plans and costs sensible ones a Keep, not the round.
- **Commendation.** *Both Keeps Standing*: win without losing a Keep (Knights beside both Keeps from round 1 earn it).

### 4. The Troll (built)
- **Dispute.** The goblins have got hold of a troll. Several, in fact.
- **Page 4, Ballistae.** "Ballistae deal double damage to large units. Ballistae need Knights in front of them." The
  pencil note wonders how far in front.
- **Kit.** 700 supply; Knights, Crossbowmen and the **Ballista**. **HP 200 for the player, 180 for the Boss.** Keeps on,
  Keeps tab only, veterancy off. Map: **The Furrows**, a ploughed band right across the middle: anything on foot crosses
  it at half speed.
- **Enemy.** Round 1: a wall of five Skirmisher squads and two mobs. Round 2: four troll squads. Round 3: two trolls and
  two Skirmisher squads. Rounds 4–6: five, six, then five trolls.
- **Punch.** Knights marched to the front get shot by the Skirmishers on the way, and the trolls beat a Knight line
  ("the rage builds through the armor").
- **The secret:** Knights at the very back. They reach the mud as the trolls do, while the Ballistae shoot the trolls
  crossing it. The briefing only hints ("In front. How far in front?"); the hint after a loss says it outright.
- **Checked by simulation:** Knights at the back with Ballistae win in four rounds, from round 1 or with the Ballistae
  a round later. Knights at the front of the zone, Knights and Crossbowmen without Ballistae, all Crossbowmen, a
  Ballista park with nothing in front, and never adding lose. **Design note:** placed squads stay, so a round-1 charge
  can't be undone in the same match; no recovery plan wins. The lesson lands on Try again.
- **Commendation.** *In No Hurry*: win with every Knight squad in your back two rows.
- **Debrief.** The trolls go home, the Archivist has drawn the correct knees, and the Boss sends for the Tinker.

### 5. The Wheelbarrow (built)
- **Dispute.** The Tinker (first appearance, and the enemy commander) accuses the Wardens of stealing the wheelbarrow.
  Archivist: "We've had wheelbarrows for four hundred and twelve years." Tinker: and it still has one wheel, so whoever
  invented it can't be you.
- **Page 5, Upgrades.** "An upgrade improves every squad of that unit, even those already on the Field. Enemy upgrades
  show as a star beside the unit."
- **Kit.** 800 supply; Knights, Crossbowmen and Ballistae. **No Clerics yet:** Knights and Clerics beat most goblin
  chaff on their own (the owner won an earlier version with them and no upgrades), so they come in the next mission.
  **HP 180 for the player, 200 for the Tinker.** Keeps on, **upgrades on**, veterancy off. Map: Standing Stones.
- **Enemy.** Round 1: five mobs and two Skirmisher squads. Upgrades arrive by round (`EnemyTurn.upgrades`): round 2
  adds two mobs and archers and gives **every** Grunt *Scrap Armor*, including those placed in round 1 (an armored
  goblin wears gray plates until a hit knocks them off); round 3 brings two trolls with *Thick Blood* (the Tinker says
  so); round 4 sends mobs down both flanks; then trolls to round 6. The Tinker says in the briefing that they look at
  your army before picking upgrades.
- **Punch.** Armored mobs shrug off the first bolt each, and the player loses round 2.
- **Checked by simulation:** *Repeaters* win, bought before round 1, in round 2 or after the armor shows (4–5 rounds),
  and so does Knights' *Shield Wall*. The same supply spent on more Crossbowmen, more Knights or Ballistae loses, and so
  do Knights in front and bows behind spread wide with no upgrades, and the wrong upgrade (Knights' *Veterans*).
- **Commendation.** *Right Upgrade*: once their armor shows, win every round after it (adding Knights for round 4's
  flank mobs earns it).
- **Debrief.** Dunmor learns he's been buying upgrades for forty years. The Tinker borrows the wheelbarrow. The Boss:
  "ENOUGH THINKING. WE'RE TAKING THE BRIDGE."

### 6. Under the Bridge (built)
- **Dispute.** The goblins have put a toll on the bridge at Hob's Crossing.
- **Page 6, Clerics.** "Clerics heal the units around them. They don't fight, so keep them behind the line."
- **Kit.** 900 supply; Knights, Crossbowmen, Ballistae and the **Cleric**. **HP 260 each.**
  Keeps and upgrades on, veterancy off. Map: **Toll Bridge**, a river right across the Field with one wide bridge in
  the middle third. Nothing on foot can flank.
- **Enemy.** Grunt mobs pour over the bridge with Skirmishers behind them, then trolls from round 3. Mostly swarms, so
  Ballistae (one bolt, one goblin) don't replace the Clerics.
- **Punch.** Knights holding the bridge wear down and break without healing, and a Cleric's big prayer every 5s
  can't keep up: prayers don't stack, and every Knight stands in the same place.
- **Checked by simulation:** Knights on the bridge with Clerics behind them and *Constant Prayer* (a prayer every
  second) win, bought before round 1 (every round won) or in round 2; Ballistae for round 5's trolls. Knights' *Shield
  Wall* instead of Clerics also holds the bridge (both keep the Knights standing). Clerics without *Constant Prayer*,
  no Clerics (Crossbowmen, Ballistae, or last mission's *Repeaters* instead), all Crossbowmen and never adding lose.
  Round 6's five trolls finish any plan still going, so a good plan wins by round 4 or 5.
- **Commendation.** *Nobody Crosses*: win every round.
- **Debrief.** The toll is abolished (the Archivist kept a receipt). The Boss: "THE GROUND'S FULL ANYWAY. WE'LL USE
  THE SKY."

### 7. Look Up (built)
- **Dispute.** "The Compact draws borders on the ground. The goblins have noticed."
- **Page 7, Fliers.** "Knights cannot hit what flies. Crossbowmen, Ballistae and Griffon Riders can."
- **Kit.** 1000 supply; every unit so far and the **Griffon Riders**. HP 240 each. Upgrades on. Map: The Mire (it
  slows anything on foot, nothing with wings).
- **Enemy.** Round 1: mobs, two trolls, Skirmishers. Round 2: **four squads of Giant Bats**, diving over the line. Then
  more bats every round, Skirmishers from round 4 (they shoot fliers), trolls, to round 7. Each round is fitted around
  the goblins already on the Field (`fit`).
- **Punch.** The bats dive over the line and land on the Crossbowmen and Ballistae.
- **Checked by simulation:** *Skyhunters* Crossbowmen win, bought on the Sergeant's warning or once the bats show, and
  so do Griffon Riders (from round 1 with *Sky Patrol*, or once the bats show). Plain Crossbowmen (half damage to fliers
  without *Skyhunters*), Clerics healing plain bows through it, Knights alone and Ballistae (the bats land on them)
  lose. **Design notes:** the mission depends on Crossbowmen being weak against fliers until *Skyhunters*. Since the
  bats' opening dive (25% less physical damage on the way in, claws that reach the Griffons) the Boss's bats carry no
  upgrade: with *Savage Claws* as well, even *Skyhunters* and the Griffons lost.
- **Commendation.** *Air Cover*: win with Griffon Riders on the Field.
- **Debrief.** The sky over the Field belongs to the Field, and griffons do bite (the Archivist checked). The Boss:
  "FINE. I'M CALLING GRUMM." Sergeant: "...Grumm?"

### 8. Old Grumm (built)
- **Dispute.** Thirty years ago, at a Field match, Old Grumm ate the Sergeant's helmet.
- **Page 8, The Pike Line.** "Dwarven Pikemen do extra damage to large units. Put them where large units walk." The
  Sergeant says nothing can be done about an ogre that size, book says so. The Archivist: page 8 is entirely about large
  things, and no one has turned to it in two hundred years. Sergeant: "...There's a page."
- **Kit.** 1100 supply; every unit so far and the **Dwarven Pikemen**. HP 300 each. Upgrades on, **veterancy on**. Map:
  Broken Hills.
- **Enemy.** Round 1: mobs, two trolls and wolves. Round 2 brings **Grumm, a level-3 Ogre Brute with *Warboss***
  (`SquadSpec`'s fifth element is a level). Then wolves, trolls and more ogres, to round 7, fitted around the goblins
  already there.
- **Punch.** Grumm walks off the Field alive in round 2, unless Pikemen are already waiting for him.
- **Checked by simulation,** with a player who promotes every veteran first and then buys squads: Pikemen from round 1
  or 2, and Knights and bows, all win when their veterans are promoted; the same plans putting that supply into fresh
  squads instead lose. **Design note:** Grumm's cleave kills two or three dwarves a swing, which is why the Pikemen
  need ×4.5 against large units to make the pike page worth reading.
- **Commendation.** *Page Eight*: win with a promoted squad of Dwarven Pikemen on the Field.
- **Debrief.** The Sergeant gets the helmet back, chewed, and reads his first page so he can say what's wrong with it. The
  Boss stakes the whole border.

### 9. The Marches (built)
- **Dispute.** The season final. The Boss stakes the whole border ("AND THE GOAT").
- **Page 9, The Full Compact.** "Every commander chooses, every commander places, and no one sees the other's army
  before the horn."
- **Kit.** 1200 supply; every Warden unit and **the Giant** (the first independent). HP 400 each. Keeps, upgrades and
  veterancy on. Map: **Border Pass**. Blind from round 1.
- **Enemy, in two phases**, scripted rather than the AI so the story beats land and the tests can fight it. The Boss
  sends his biggest (trolls, ogres, wolves, mobs) until he has lost two battles (`ScriptContext.winners`); then the
  Tinker takes over: **four squads of bats with *Shriek***, then **Tower Raiders wolves on both flanks**, then bats
  and *Ambush* Skirmishers, and the last wave repeats. Waves are fitted around the goblins already on the Field
  (`fit`). The Tinker and the Boss speak in the sidebar on the rounds they change plan (`EnemyTurn.line`).
- **Checked by simulation,** with a player who promotes every veteran first: the pike line wins, with or without a
  level on each Keep, and so do Knights and Crossbowmen alone. Never adding, all Crossbowmen, a Ballista park and the
  pike line without promotions lose. All Crossbowmen loses its first three rounds to the Boss, so the Tinker never
  comes; the wolves in the Boss's fourth and fifth waves only meet plans like that, and keep it from winning late.
  **Design notes:** a Tinker wave much bigger than the round's income flattens every plan, because each wave stays on
  the Field; *Pike Wall* answers the bats on its own, since they claw in melee.
- **Commendation.** *Boring Wins*: win the final with only Knights and Crossbowmen.
- **Ending.** The wheelbarrow comes back with two wheels. Sergeant: "Boring wins. Book says so." The Archivist starts to
  object, then finds it on page 10. "...SAME TIME NEXT SEASON?" On a win the debrief draws **Page 10, in the Marshal's
  hand, in ink**: the handwritten line "Boring wins." above the player's own board (`lastPage`: ranks by depth, front
  rank first). It's shown, not kept (§5).

## 3. Campaign 2, Goblins: *The Tinker's Notebook*

**Story.** The player commands as the Boss, with the Tinker advising. Act 1 (missions 1–4) is revenge on the Wardens.
In Act 2 (missions 5–8) the goblins, full of themselves, challenge the Elementals. The Tinker wants elemental fire for
the forge ("Fire's also free"). The elementals are shown from outside as aloof snobs. HP resets to the low end of the
curve. **This is where the goblins' personalities get developed**; the Wardens campaign keeps them focused on numbers and
upgrades (`docs/VISION.md`).

**The goblin "X" against the pike line.** Don't go through it. Go around it (Keeps), over it (Bats) or shoot from
outside it (Skirmishers, a Troll with a tree). The rigid, predictable Wardens AI (Normal, playing by the book) becomes
the thing to exploit. "They had pointy sticks and we had nothing. So I made a bigger thing": the bigger thing is
the Troll's ***Uprooted Tree***: +1 range, so a Pike Wall can't hit it back, and a little splash. Against Pikemen with
*Pike Wall* it turns a 0% fight into an even one; plain Pikemen still win.

**The fire arc.** The Tinker's line is split across three missions: "Fire's hot." / "Fire's also free." / "Point it
at THEM." Goblins who go out in a blaze get cheered, not mourned.

| # | Mission | Opponent | New for the player | Goblin unit / upgrade |
|---|---|---|---|---|
| 1 | Pointy Sticks | the Marshal (Wardens M8 replayed) | win by toppling a Keep, not by beating the army | Grunts, Wolves, Troll, Ogre |
| 2 | A Bigger Thing | Marshal | shoot, don't stab: short range against Pike Wall | Skirmishers, Troll *Uprooted Tree* |
| 3 | The Gang | Marshal | chaff and screening; numbers absorb the losses | Grunt *Party Time*, Ogre *Warboss* and *Thick Skull* |
| 4 | Both Keeps | Marshal | tempo: a double Keep raid against a rigid army; first statuses you wield (Dazed) | Giant Bats (*Shriek*), Wolf Riders *Tower Raiders* |
| 5 | Snobs | elementals | statuses from the receiving end; splash punishes clumps; anti-air against Cloudlings and flying Air Elementals | Giant Bats *Bloodsuckers* (no dive, hunt fliers); maybe hired Bog Toad Riders (below) |
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
- **Risk and reward**: the Tinker is cheerfully honest about what each upgrade costs ("It's slower now. Look how much
  slower."), and the notebook's crossings-out show what was tried first. Upgrades that cost the goblins
  something (Scrap Armor's slowdown, Improvised Bombs' friendly fire, Oil Bombs only paying out on death, Ogre
  *Thick Skull* killing a nearby goblin instead) are the material.

### What the goblin campaign still needs

Every unit and upgrade it uses is built. What's left:

- **Raids have to swing fights.** "Win by raiding" needs a fallen Keep to decide a round. With Keep levels worth 2,000
  HP each, a 4 s collapse Daze and Wolf Riders *Tower Raiders*, whether a raid swings a close fight in practice is
  unchecked. Missions 1 and 4 should be simulated early.
- **Friendly fire has to be readable.** The battle report counts it per squad; the field probably needs a clearer
  "that was your own fire" cue for the fire arc.
- **A "topple a Keep" win condition** in the mission framework (goblin mission 1).

## 4. Campaign 3, Elementals: We Burn

**Story.** The protagonist is a young fire elemental, *Ember*, who after the goblin finale is afraid of burning its
neighbors. An elder: "We're not being rude. We're standing over here so you don't catch fire." Act 1 is the
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

**Epilogue (playable, Wardens).** *Against Storms, Spread Out.* A short mission with one new Warden upgrade that grants
`spacing`, written as a new Drill Book page. Then the scoreboard scene: "Same time next season?" The Goblin says yes at
once, the Warden checks the calendar, the Elemental pauses, then says yes.

### What the story needs from the elementals

Requirements for the missions, rather than for skirmish balance:

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
- **Wardens epilogue page.** "Against storms, spread out" fits as a **faction doctrine** (DESIGN.md §8 faction
  bonuses, not built yet). Wardens doctrines could literally be Drill Book pages: pick one per match. That gives faction
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

- **The player's winning board becomes the Drill Book's last page** (Wardens mission 9). Record the player's army from
  the finale's deciding round and draw it as a formation diagram: "Page 10, in the Marshal's hand." The owner called it
  "genius". **The page is drawn and shown** in the finale's debrief (`lastPage`, `boardDiagram` in
  `src/ui/Mission.tsx`), from the player's army as it fought the last battle; it isn't kept. Story progress is stored
  now, so the page could be kept alongside it, and later campaigns could refer back
  to it (for example the goblin campaign opening against *your* page-10 army, replaying the player's real finale
  instead of an authored one). Check with the owner before storing more than progress.
- **Briefing length.** Wardens briefings run 7–8 lines, and the finale runs 12. They're read a line at a time now; leave
  them as written unless the owner asks for cuts.

## 6. The mission framework

A mission is data: a `MissionDef` in `src/data/campaign.ts`, attached to its entry in `CAMPAIGNS`. The match is the
ordinary match with the mission's setup, played in the same `PlayView` (its `mission` prop), so placement, battles,
the report and replays all work unchanged. The sim is untouched.

| Field | What it sets |
|---|---|
| `supply` | the player's supply in round 1 (later rounds get the standard income) |
| `units` | the player's units, unlocked and free: every unit met so far, and at most one new one. `shop` lists units to unlock at the usual price (no Wardens mission uses it) |
| `opening` | round 1 offers these packs (each named by its two units) or the war chest, as a skirmish does (no Wardens mission uses it) |
| `hp` | each side's HP; absent means **one battle decides it**, and the HP bars and damage tally are hidden |
| `towers`, `upgrades` | whether the Keeps stand and whether the Upgrades tab exists. With Keeps but no upgrades, the tab is just **Keeps** (mission 3) |
| `veterancy` | whether squads earn XP (off until mission 8) |
| `map` | the map (`src/data/terrain.ts`); absent: the open field |
| `enemy.units` | the enemy's unlocks, shown like the AI's |
| `enemy.rounds` | squads added each round, in field coordinates (the enemy deploys at the top); a squad's fifth element is its level (Grumm). A round can instead be `{ squads, upgrades, line }`: upgrades it buys that round (mission 5's upgrades) and a line the enemy says in the sidebar while the player deploys. A round can be a function of the `ScriptContext`: what the enemy saw (`seen`: the player's squads from earlier rounds), who won each battle (`winners`, `lost`) and its own army (`own`), e.g. `onFlank(thinFlank(seen), …)` puts squads on the flank the player left thin, and `fit(own, …)` moves squads to free spots when the layout depends on how the match went (mission 9's two phases); `fitted([...])` fits every round of a long script that way (missions 7 and 8) |
| `enemy.upgrades` | upgrades the enemy has from the start, shown as ★ like the AI's |
| `enemy.revealed` | round 1's squads are placed and visible before the player deploys |
| `briefing`, `page` | lines from the cast, then the Drill Book page: a title, the rule, an optional diagram and the Marshal's pencil note (`note`) |
| `objective` | one line in the sidebar while deploying: just the goal |
| `roundLines` | lines said in the sidebar while the player deploys a given round, by anyone in the cast; shown beside the script's own `EnemyTurn.line` |
| `win`, `winNote`, `hints` | the debrief: lines on a win and the Marshal's pencil note; on a loss, the first hint whose condition matches what the player fielded |
| `commendation` | a name, how to earn it, and a check against every battle of the match (`results`) |
| `lastPage` | on a win, the debrief draws the player's board as a page of the book, under a line in the Marshal's hand (`handwritten`; mission 9's page 10) |
| `reference` | plans that must win, must lose, and must earn the commendation: per round, squads to add, or `{ squads, keeps, upgrades, promote, opening }` (`PlanTurn`). Shop units unlock on first use, at their price; `promote` promotes every squad with a level waiting, with what's left |

`src/game/mission.ts` builds the match (`newMissionMatch`), the enemy's scripted turn (`missionPlan`) and the outcome
(`missionOutcome`: won, and the commendation). `src/game/missionRun.ts` plays a plan against the script the way the
game does, and reports anything a real player couldn't do (overspending, misplacing, units the mission doesn't
offer); `tests/campaign.test.tsx` and `npm run mission` both use it. The test checks every mission's data (squads in the
enemy zone, no overlaps, units that exist) and plays its **reference armies**: a mission lists armies that should win
and armies that should lose, and the test fights them. That's how a mission's punch and counterpunch stay true when
units are rebalanced.

The Story tab (`#story`) lists the campaigns, and a playable mission opens at `#story/<mission id>`: the briefing,
then the Field, then the debrief with Try again and Next. The tab stays mounted once opened, like Play, so a Codex
link mid-mission doesn't lose it.

**The copy in one place:** `docs/COPY.md` lists every mission's text (briefing, Drill Book page, objective, between-round
lines, debrief, hints, commendation) with what it teaches, and the rest of the player-facing text (Story intro, How
to play, units, Codex). It's generated: `npm run -s copy-doc > docs/COPY.md`. The owner edits it for consistency and
tone; the edits go back into the source (`src/data/campaign.ts` for the missions), then regenerate.

### Making a mission

1. **Story first.** Read `docs/VISION.md` and this mission's entry above: the dispute, the page, the punch and the
   counterpunch, the commendation. Check the punch against `RELATIONS` in `src/data/balance.ts` (who beats whom, and
   why): the lesson has to be true in the sim, not just in the story.
2. **Write the `MissionDef`** in `src/data/campaign.ts` (copy the closest mission) and set `play:` on its entry in
   `CAMPAIGNS`. Enemy squads use field tiles; the enemy deploys in rows 0–6 (a squad's `y` is its top row, so a
   4×2 Grunt mob fits at `y` 0–5). Keep each round's squads clear of earlier rounds' squads, on both flanks if a round
   uses `onFlank`. `thinFlank(seen)` and `onFlank(flank, specs)` (write specs for the West; they're mirrored for
   the East) make the Boss answer what the player fielded.
3. **Draft player plans** of three kinds: sensible, reactive (loses the punch round, then adapts) and careless (all
   Crossbowmen, never adds, ignores the lesson). Plans must spend what a player really has: the mission's `supply` in
   round 1, then the standard income (+400, +500, +600, …); Keep levels cost 100 / 200 / 400 / 800 each.
4. **Play them:** `npm run mission -- <id> '<plan json>'` plays one plan round by round (W/L, battle length, damage,
   Keeps lost, HP, and the debrief hint on a loss); with no plan it plays the mission's reference plans. Iterate on
   the enemy's rounds and on per-side HP until the shape is right: the careless plans lose, the sensible ones win,
   the reactive one wins with some HP to spare, the commendation is reachable, and a match runs about the target
   number of rounds. Lessons from the Wardens campaign:
   - The punch needs to *land*: if the scripted unit doesn't do the thing (wolves chasing the nearest squad instead of
     a Keep), give the enemy the upgrade that makes it (`enemy.upgrades`, Tower Raiders) rather than hoping.
   - Rounds after the script ends are free wins for the player (the enemy adds nothing), so keep the script going
     until the target length, or a careless plan wins late.
   - A map can make or break a punch (the raid lands on Long Grass, not on the open field).
   - Every squad the enemy adds fights in every later battle, so one extra squad early swings the whole match, and a
     wave much bigger than the round's income flattens every plan. Grow the script about as fast as the income.
   - Check the punch in a mixed fight, not just in `RELATIONS`: the Boss's own Grunts soaked hits meant for his trolls
     (mission 4), and Crossbowmen shot down two bat squads without trouble (mission 7).
   - A bigger starting supply needs a bigger opening wave, but not too big: the extra supply is there to open up more
     than one sensible opening, so check that two or three different round-1 armies win it. It also needs bigger later
     waves: the extra army stays on the Field all match, and with the old waves every plan won once the punch passed
     (missions 7–9, raised from 400 to 1000–1200).
   - Placed squads stay, so a mission whose lesson is about round-1 placement can't be recovered in the same match.
     Say so in the mission entry; the lesson then lands on Try again.
   - Count the supply carefully: a plan that overspends looks like a win until the runner reports it. Promotions spend
     only what's left, so a plan that spends everything never promotes, and one that lists too little leaves supply
     unspent. To judge a veterancy lesson fairly, compare a player who promotes every veteran first and then buys
     squads from a list against one who only buys fresh squads, and keep the plans the first one played.
   - Healing outheals small hits: whenever Clerics are offered, check a plan that just adds Clerics. Before prayers
     stopped stacking, they healed plain bows through a bat swarm (mission 7). Now the opposite: where every unit stands
     in one place (a bridge), one prayer every 5s isn't enough and *Constant Prayer* is the answer (mission 6).
   - When the new unit is a valid but not the best answer in the sim, say so in the mission entry and let the
     commendation ask for it, rather than bending the open roster (missions 5–8).
   - For quick iteration, a scratch script can import `MISSIONS` and `runMission` and try many plans and enemy variants
     at once; paste the winner into `campaign.ts`.
5. **Keep the clearest plans as `reference`** (`wins`, `loses`, `commended`), only those with a clear margin, so a
   small rebalance doesn't flip them; comment what each one does. `npm test` then fights them on every change.
6. **Text:** briefing (the cast's voices from VISION.md), page and pencil note, objective (just the goal), between-round
   lines, win lines (seed the next mission), hints from specific to general (the last has no `when`). State each rule
   once per screen, and don't describe what the player can already see. A new speaker needs a `CAST` entry and a
   face in `src/ui/Portraits.tsx`.
7. **Check it on screen** (Playwright, CLAUDE.md "Verifying UI changes"; the debug panel's "Open every story mission"
   skips the earlier ones), then update this file's mission entry: what wins, what loses, and design notes on why
   the mission is shaped the way it is.

Not built yet (each arrives with the mission that needs it): AI enemies limited to a pool (the Boss, the Tinker; the
Wardens campaign scripts every enemy, mission 9's two phases included), a "topple a Keep" win condition, and
`npm run playtest -- --mission N`.

## 7. Next

1. The owner's structural changes to the Wardens campaign, and a playtest.
2. The replay-opener tech for Goblin mission 1 (an authored version of the Wardens finale, played from the other side,
   since nothing is stored between missions).
3. Goblin campaign. Simulate the elementals' authored fights at the same time, then build their campaign.

## 8. Owner decisions

- Skirmishers are goblin archers that hit air. The deferred slots are filled: Skirmishers *Recruiters* and Troll *Uprooted
  Tree* (4 November).
- **Pikemen arrive in mission 8** (left to Claude): one new unit per mission, and the player learns the pikes before
  the finale leans on them.
- **The goblin player is the Boss**, with the Tinker advising.
- **Independents:** a mission has to show the player when and how to use each one, and in play they're
  there to add map-to-map variety. The rest was left to Claude (§9).
- **Story is the left-most tab and where the site opens**, with a "Play the full game now" shortcut at the very top
  for impatient players. Progress is stored and missions are played in order (§1).
- **Terrain:** ground conditions for map variety, and a first step toward spells cast on no-man's land between rounds
  (spells themselves are out of scope for now). Units and the AI don't plan around terrain.
- **Story voices:** Dunmor has never read the book and knows the real world; Ithiel has never seen the real
  world and knows the book. They learn from each other and update the book. The Marshal is nervous and speaks out loud.
  In the Wardens campaign the Boss is about numbers and the Tinker about choosing upgrades; both are smart and sarcastic,
  and their personalities are developed in Campaign 2. Avoid dramatic language, and use plain game terms (`docs/VISION.md`).

## 9. Independents and maps

Each independent is introduced by one mission, on a map whose ground or enemy makes it the natural hire. The mission
puts it in the shop (`shop`, at the independents' unlock price), and the briefing says what hole it fills, so the
player learns *when* to reach for it, not just that it exists. After that it's in every later mission's shop, and maps
keep the matches different from each other. Plan (checked by simulation when each mission is built):

| Independent | Hole it fills | Introduced in | Map and why |
|---|---|---|---|
| **Giant** | splash artillery: the Wardens have none | Wardens 9, *The Marches* (built: in the shop, on Border Pass) | a rocky border pass, where the Marshal hires outside the book for the first time: the book can grow. A Giant behind the pike line wins the finale |
| **Bog Toad Riders** | anti-air and anti-medium for the goblins | Goblins 5, *Snobs* | a marsh of ponds and rough ground. Cloudlings and a flying Air Elemental own the sky until the toads pull them down (*Gulp*) |
| **Dragon** | the late-game flier | Elementals 7, *The Field Is a Weapon* | Long Grass: the Wardens' Crossbowmen hide in it from every ground shooter, but fliers see into grass, and the Dragon's breath splashes |

Terrain itself (rocks, ponds, rough ground, tall grass) is in DESIGN.md; missions name their map (`map`), and skirmish
matches draw one at random.

## 10. The campaign as balance tests

The owner's rule: missions that are hard to design are a sign the balance needs adjusting, and the missions' authored
battles matter more than one-unit matchups. Each mission's reference plans are integration tests, and the unit a
mission introduces should have a plan that wins it.

`npm run mission -- all` plays every reference plan (about 10 s) and flags any that no longer do what they're meant
to; run it before and after changing units. When a rule or unit change flips a plan, decide whether the balance or the
mission is wrong: fix the balance when a mission's lesson stops being true, and retune the mission (HP, a wave) when
only its margins moved. Record what changed in `CHANGELOG.md`.
