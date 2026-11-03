# Common Ground: campaign plan (Nov 2026)

Status: **the Wardens campaign is built and playable** (missions 1–8, the Story tab; Nov 2, 2026). The goblin and
elemental campaigns are a plan. Inputs: `docs/VISION.md`
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
player's own winning board**, drawn as a drill-book diagram. Built as shown, not kept: the finale's debrief draws it;
keeping it is parked (§5).

**Roster.** Everything the campaign needs is built: the six Warden units and the six goblins (Grunts, Skirmishers,
Wolf Riders, Troll, Ogre Brute, Giant Bats). Skirmishers are goblin archers that hit air (decided), so Griffons
(mission 6) aren't a win button in missions 6–8 and the pike-line finale can land.

| # | Mission | Dispute | New for the player | Warden unit | Goblin unit | HP |
|---|---|---|---|---|---|---|
| 1 | Hands Off | a goat | placement, Fight, the hands-off rule | Knights, Crossbowmen | Grunts | 1 battle |
| 2 | The Appeal | the goat, appealed | rounds, locked squads, reading their last army, HP | | Skirmishers | 70 / 90 |
| 3 | Two Keeps | a rude drawing on a Keep | towers, collapse Daze, flanks, tower levels | | Wolf Riders | 100 |
| 4 | Under the Bridge | the bridge toll | unlocks, big units, regeneration | Ballista | Troll | 160 / 140 |
| 5 | Plain Steel | the wheelbarrow patent | upgrades, yours and theirs | Cleric | the Tinker's gadgets | 180 / 200 |
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

### 4. Under the Bridge (built)
- **Dispute.** The goblins have adopted the troll under the toll bridge at Hob's Crossing, and claim its toll.
- **Page 4, The Armory.** "The armory holds more than the book's first pages. Each new engine costs the Treasury once
  per Field." Drill: *Big things need engines. Engines need steel in front.*
- **Kit.** 400 supply, Knights and Crossbowmen; the **Ballista in the shop** (the first unlock: 100 once, then 100 a
  squad). **HP 160 for the player, 140 for the Boss.** Keeps on, Keeps tab only, veterancy off. Map: **Toll Bridge**
  (new): a pond either side of the middle, so the middle is the short way across.
- **Enemy.** Round 1: three Grunt mobs and Skirmishers. Rounds 2 and 3: three troll squads each. Round 4: three more and
  two mobs on the flanks. Rounds 5 and 6: four troll squads each, so the script never runs dry.
- **Punch.** The trolls beat a Knight line ("the rage builds through the armor").
- **Checked by simulation:** Ballistae behind steel win, whether bought in round 1, the round the trolls show, or the
  round after (99–136 HP left, 4–5 rounds). Steel and bows only, Ballistae with no new steel in front, all bows and
  never adding lose. **What the tuning found:** two troll squads mixed into the mob changed nothing (the Boss's own
  Grunts soak the hits, and "grunts beat trolls"); the punch needed three, and a fifth and sixth round, or steel alone
  won late. A Ballista bought in round 1 loses that round (one bolt, one goblin), which the debrief explains.
- **Commendation.** *Bridge Held*: win with Ballistae on the Field and lose none of them in the last battle.
- **Debrief.** The troll goes back under the bridge and charges the goblins too. The Boss: "I'M TELLING THE TINKER."

### 5. Plain Steel (built)
- **Dispute.** The Tinker (first appearance, and the enemy commander) accuses the Wardens of stealing the wheelbarrow.
  Archivist: "We have had wheelbarrows for four hundred and twelve years."
- **Page 5, Drills.** "A drill improves every squad that knows it, even those already on the Field." Drill: *Read
  their stars. Answer with a drill.*
- **Kit.** 400 supply, Knights and Crossbowmen; Ballista and **Cleric** in the shop. HP 180 / 200. Keeps on,
  **upgrades on**, veterancy off. Map: Standing Stones.
- **Enemy.** Gadgets arrive by round (`EnemyTurn.upgrades`): round 2 adds two mobs and archers and gives **every**
  Grunt *Scrap Armor*, including those placed in round 1; round 3 brings trolls with *Thick Blood*; then trolls and
  mobs to round 6. The Tinker gives wrong odds in the briefing.
- **Punch.** Armored mobs shrug off the first bolt each, and the player loses round 2.
- **Checked by simulation:** any plan with *Repeaters* wins, bought before round 1, in round 2 or after the armor shows
  (59–129 HP left, 5 rounds), and Repeaters followed by two Clerics behind the line wins with 80. The same supply spent
  on more Crossbowmen or Ballistae instead loses, and so does the wrong drill (Knights' *Veterans*). **What the tuning
  found:** at first no Cleric plan could win: Clerics cost 200, walked into the melee and died, and healing can't
  outpace an armored swarm. The campaign balance pass (§10) made them cheap, keeps them behind the line and gave the
  line a damage aura.
- **Commendation.** *Well Drilled*: once their armor shows, win every round after it.
- **Debrief.** "Boring, repeated quickly, wins faster." The Boss: "NOBODY OWNS THE SKY."

### 6. Look Up (built)
- **Dispute.** "The Compact draws borders on the ground. The goblins have noticed."
- **Page 6, Look Up.** "Knights cannot strike what flies. Know which of your champions can." Drill: *Bows under the
  sky. Wings against wings.*
- **Kit.** 400 supply, Knights and Crossbowmen; Ballista, Cleric and **Griffon Riders** in the shop. HP 240 each.
  Upgrades on. Map: The Mire (it slows anything on foot, nothing with wings).
- **Enemy.** Round 1: mobs, a troll, Skirmishers. Round 2: **four squads of Giant Bats**. Then more bats, Skirmishers
  from round 4 (they shoot fliers), trolls, to round 7.
- **Punch.** The bats fly over the line and land on the bows and engines.
- **Checked by simulation** (after the balance pass, §10): *Skyhunters* bows win (150 HP left, 5 rounds), bows with
  Griffons alongside win (144), and a Griffon-led plan wins (78). Plain bows (half damage to fliers without
  *Skyhunters*), steel alone and Ballistae (the bats land on them) lose. **What the tuning found:** before the pass,
  Crossbowmen shot down any flier at full strength, so the bats needed *Savage Claws* and four squads, and then nothing
  but more bows could win; no Griffon-led plan did.
- **Commendation.** *Wings Against Wings*: win with Griffon Riders on the Field.
- **Debrief.** "Looking up is boring too." The Boss: "I'M CALLING GRUMM." Sergeant: "...Grumm?"

### 7. Old Grumm (built)
- **Dispute.** Thirty years ago, at a Field match, Old Grumm ate the Sergeant's helmet.
- **Page 7, The Pike Line.** "Against the largest, the longest. Hold them at the point." Drill: *Pikes where the big
  ones walk. Promote what lives.* The Archivist: no one has turned to it in two hundred years.
- **Kit.** 400 supply, Knights and Crossbowmen; Ballista, Cleric, Griffons and **Dwarven Pikemen** in the shop. HP 300
  each. Upgrades on, **veterancy on**. Map: Broken Hills.
- **Enemy.** Round 2 brings **Grumm, a level-3 Ogre Brute with *Warboss*** (`SquadSpec`'s fifth element is a level).
  Then wolves, trolls and more ogres, to round 7.
- **Punch.** Grumm walks off the Field alive in round 2, whatever the player brings.
- **Checked by simulation:** plans that promote their veterans win (191–244 HP left, 7 rounds); the same pike plan
  that puts that supply into fresh squads instead of promotions loses. **What the tuning found:** at ×3.5 the pikes
  won with 109 HP left against Knights' 244, because Grumm's cleave kills two or three dwarves a swing. At ×4.5 (the
  balance pass, §10) the pike plan wins with 211; plain Knights and bows still do well (244).
- **Commendation.** *Old Page, New Ink*: win with a promoted squad of Dwarven Pikemen on the Field.
- **Debrief.** The Sergeant gets the helmet back, chewed. The Boss stakes the whole border.

### 8. The Marches (built)
- **Dispute.** The season final. The Boss stakes the whole border ("AND THE GOAT").
- **Page 8, The Full Compact.** "Every commander chooses, every commander places, and no one sees the other's army
  before the horn." Drill: *Every page at once.*
- **Kit.** **The opening offer** (`opening`, packs named by their units): Knights and Crossbowmen, Crossbowmen and
  Pikemen, Knights and Pikemen, or the war chest. Nothing else is free; the whole Warden armory and **the Giant** (the
  first independent, 200 to unlock) are in the shop. HP 400 each. Keeps, upgrades and veterancy on. Map: **Border
  Pass** (new). Blind from round 1.
- **Enemy, in two phases**, scripted rather than the AI so the story beats land and the tests can fight it. The Boss
  sends his biggest (trolls, ogres, wolves, mobs) until he has lost two battles (`ScriptContext.winners`); then the
  Tinker takes over: **three squads of bats with *Shriek***, then **Tower Raiders wolves on both flanks**, then bats
  and *Ambush* Skirmishers, and the last wave repeats. Waves are fitted around the goblins already on the Field
  (`fit`). The Tinker and the Boss speak in the sidebar on the rounds they change plan (`EnemyTurn.line`).
- **Checked by simulation** (after the balance pass, §10): the pike line wins (327 HP left, 7 rounds), and so do pikes
  with levels on both Keeps (280) and Knights and bows (218). Never adding, all bows and a Ballista park lose. Everyone loses the round the bats
  arrive, and the double raid takes both Keeps even with a level on each (as in mission 3, levels only buy time).
  **What the tuning found:** a Tinker wave much bigger than the round's income flattens every plan, because each wave
  stays on the Field; and *Pike Wall* answers the bats on its own, since they claw in melee. The Giant pays off from
  behind the pike line (a plan buying it in round 4 wins with 168 HP left); the first Giant plans lost only because
  they left it exposed.
- **Commendation.** *Boring Wins*: win the final with only the two units your opening pack gave you.
- **Ending.** "...SAME TIME NEXT SEASON?" On a win the debrief draws the player's own board as **Page 9, in the
  Marshal's hand** (`lastPage`: ranks by depth, front rank first). It's shown, not kept (§5).

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
  "genius". **The page is drawn and shown** in the finale's debrief (`lastPage`, `boardDiagram` in
  `src/ui/Mission.tsx`), from the player's army as it fought the last battle; it isn't kept. Story progress is stored
  now, so the page could be kept alongside it, and later campaigns could refer back
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
| `opening` | round 1 offers these packs (each named by its two units) or the war chest, as a skirmish does (mission 8) |
| `hp` | each side's HP; absent means **one battle decides it**, and the HP bars and damage tally are hidden |
| `towers`, `upgrades` | whether the Keeps stand and whether the Upgrades tab exists. With Keeps but no upgrades, the tab is just **Keeps** (mission 3) |
| `veterancy` | whether squads earn XP (off until mission 7) |
| `map` | the map (`src/data/terrain.ts`); absent: the open field |
| `enemy.units` | the enemy's unlocks, shown like the AI's |
| `enemy.rounds` | squads added each round, in field coordinates (the enemy deploys at the top); a squad's fifth element is its level (Grumm). A round can instead be `{ squads, upgrades, line }`: upgrades it buys that round (mission 5's gadgets) and a line someone says in the sidebar while the player deploys. A round can be a function of the `ScriptContext`: what the enemy saw (`seen`: the player's squads from earlier rounds), who won each battle (`winners`, `lost`) and its own army (`own`), e.g. `onFlank(thinFlank(seen), …)` puts squads on the flank the player left thin, and `fit(own, …)` moves squads to free spots when the layout depends on how the match went (mission 8's two phases) |
| `enemy.upgrades` | upgrades the enemy has from the start, shown as ★ like the AI's |
| `enemy.revealed` | round 1's squads are placed and visible before the player deploys |
| `briefing`, `page` | lines from the cast, then the Drill Book page (a title, its text and an optional drill diagram) |
| `objective` | one line in the sidebar while deploying |
| `win`, `hints` | the debrief: lines on a win; on a loss, the first hint whose condition matches what the player fielded |
| `commendation` | a name, how to earn it, and a check against every battle of the match (`results`) |
| `lastPage` | on a win, the debrief draws the player's board as a page of the book (mission 8's page 9) |
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

### Making a mission (the recipe used for missions 1–8)

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

   Lessons from 4–8:
   - Every squad the enemy adds fights in every later battle, so one extra squad early swings the whole match, and a
     wave much bigger than the round's income flattens every plan. Grow the script about as fast as the income.
   - Check the punch in a mixed fight, not just in `RELATIONS`: the Boss's own Grunts soaked hits meant for his trolls
     (mission 4), and Crossbowmen shot down two bat squads without trouble (mission 6).
   - Count the supply carefully: a plan that overspends looks like a win until the runner reports it. Promotions spend
     only what's left, so a plan that spends everything never promotes.
   - When the new unit is a valid but not the best answer in the sim, say so in the mission entry and let the
     commendation ask for it, rather than bending the open roster (missions 5–8).
   - For quick iteration, a scratch script can import `MISSIONS` and `runMission` and try many plans and enemy variants
     at once; paste the winner into `campaign.ts`.
5. **Keep the clearest plans as `reference`** (`wins`, `loses`, `commended`), only those with a clear margin, so a
   small rebalance doesn't flip them; comment what each one does. `npm test` then fights them on every change.
6. **Text:** briefing (3–5 lines, the cast's voices from VISION.md), page and drill, objective, win lines (seed the
   next mission), hints from specific to general (the last has no `when`). A new speaker needs a `CAST` entry and a
   face in `src/ui/Portraits.tsx`.
7. **Check it on screen** (Playwright, CLAUDE.md "Verifying UI changes"; the debug panel's "Open every story mission"
   skips the earlier ones), then update this file's mission entry with what the tuning found.

Not built yet (each arrives with the mission that needs it): AI enemies limited to a pool (the Boss, the Tinker; the
Wardens campaign scripts every enemy, mission 8's two phases included), a "topple a Keep" win condition, and
`npm run playtest -- --mission N`.

## 7. Plan of attack

1. ~~**Goblin roster rework**~~ **Done (Oct 2026).**
2. ~~**Mission framework**~~ **Done (Nov 2026)** (§6).
3. ~~**Missions 1–3**~~ **Built (Nov 2, 2026).**
4. ~~**Missions 4–8**~~ **Built (Nov 2, 2026).** Next: the owner playtests them, then the replay-opener tech for Goblin
   mission 1 (an authored version of the Wardens finale, played from the other side, since nothing is stored between
   missions).
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
| **Giant** | splash artillery: the Wardens have none | Wardens 8, *The Marches* (built: in the shop, on Border Pass) | a rocky border pass, where the Marshal hires outside the book for the first time: the book can grow. A Giant behind the pike line wins the finale |
| **Bog Toad Riders** | anti-air and anti-medium for the goblins | Goblins 5, *Snobs* | a marsh of ponds and rough ground. Cloudlings and a flying Air Elemental own the sky until the toads pull them down (*Gulp*) |
| **Dragon** | the late-game flier | Elementals 7, *The Field Is a Weapon* | Long Grass: the Wardens' crossbows hide in it from every ground shooter, but fliers see into grass, and the Dragon's breath splashes |

Terrain itself (rocks, ponds, rough ground, tall grass) is in DESIGN.md; missions name their map (`map`), and skirmish
matches draw one at random.

## 10. The campaign as balance tests (Nov 2, 2026)

The owner's call after the Wardens campaign: missions that are hard to design are a sign the balance needs adjusting,
and the missions' authored battles matter more than one-unit matchups. Each mission's reference plans are integration
tests, and the unit a mission introduces should have a plan that wins it.

`npm run mission -- all` plays every reference plan (about 10 s) and flags any that no longer do what they're meant
to; run it before and after changing units. The first pass, from what missions 5–8 showed:

| Change | Why (the mission that showed it) |
|---|---|
| Clerics stand 2 tiles behind the line they follow (`RULES.escortGap`), not in it | They walked into the melee and died within seconds (5) |
| Cleric: 100 supply (was 200), 400 HP (was 300), and a +25% damage aura; *Blessing* raises it to +50% (was +35%) | Healing can't outpace an armored swarm; a Cleric pair cost a round's worth of fighters and couldn't win the map (5) |
| Crossbowmen deal half damage to fliers; *Skyhunters* restores full damage | They were everyone's anti-air at full strength, so more bows beat every flier and every flier answer (6, 8) |
| Griffon Riders: ×1.5 against medium units | They're the anti-medium flier, but Crossbowmen out-damaged them 2:1 against medium targets (6) |
| Pikemen: ×4.5 against large units and cavalry (was ×3.5) | Knights did the pike page's job better than the pikes (7, 8) |
| Mission 6's round-2 bats lost *Savage Claws* | Sized for the old Crossbowmen; with bows needing *Skyhunters*, four plain squads are enough |
