# Common Ground: the story copy

Every word the story campaigns show, mission by mission, for editing for consistency and tone. Generated from `src/data/campaign.ts` by `npm run copy-doc > docs/COPY.md`: edit here, then the changes go back into `campaign.ts` (ask Claude) and this page is regenerated. The voices are in `docs/VISION.md`.

## The campaigns (Story tab)

- **The Drill Book:** A new Marshal, a four-hundred-year-old book of formations, and a goblin Boss with a season's worth of grievances.
- **The Tinker's Odds:** “Lads, they had pointy sticks and we had nothing. So I made a bigger thing.” *(not built yet)*
- **We Burn:** “We are not complicated because we are clever. We are complicated because we burn.” *(not built yet)*

---

## The Drill Book, mission 1: Hands Off

**Teaches** (design note, not shown): Placing, then letting go: steel in front, arrows behind. Crossbowmen alone get swarmed by a mob.

**On the Story list:** A goat has wandered across the border at Millbrook. Settle it on the Field.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** Marshal. Welcome to your first Field. Today's dispute concerns a goat.
- **Sergeant Dunmor:** Wandered over at Millbrook on Tuesday. The goblins say it's theirs. The goat hasn't said.
- **The Boss:** IT'S OUR GOAT.
- **Archivist Ithiel:** The challenger deploys first, and they have: you may study their army as long as you like. The book has a page for this. It has been the same page for four hundred years.

Drill Book page, **Page 1: The Compact**:

> “Choose your champions. Place them. When the horn sounds, no hand may touch the Field.”
>
> *Steel in front. Arrows behind.*

**Objective** (also the sidebar's line while deploying): Win the battle. Three mobs of Grunts are waiting, and you have 400 supply of Knights and Crossbowmen.

**Kit line** (built from the mission's setup): Your champions: Knights, Crossbowmen. One battle decides it.

### During the match

*(the enemy says nothing)*

### Debrief after a win

- **Sergeant Dunmor:** Boring wins. Write that down.
- **Archivist Ithiel:** Written. The goat goes home to Millbrook.
- **The Boss:** THAT WASN'T FAIR. WE'RE APPEALING.

### Hints after a loss (the first that matches)

- When `!fielded(c,"knights")`: **Sergeant Dunmor:** Bolts hit hard, but there were more goblins than bolts. A mob needs something to run onto. Steel in front.
- When otherwise: **Sergeant Dunmor:** They got round the steel. Put the Knights where the goblins will run: between them and the bows.

### Commendation

**Steel in Front:** Win with Crossbowmen on the Field, and lose none of them.

---

## The Drill Book, mission 2: The Appeal

**Teaches** (design note, not shown): Rounds and HP: what is placed stays placed. You see their last army, never what they will add, so read it and answer (they hit the flank you left thin).

**On the Story list:** The goblins appeal the goat. Under the Compact, an appeal is a longer match.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** The goblins have appealed the goat. Under the Compact a loss may be appealed once, as a longer match.
- **Sergeant Dunmor:** Rounds, Marshal. Each round you add champions, and whatever you've placed stays where it is. After every battle the survivors take a bite out of the other side's standing. First side to run out loses.
- **The Boss:** BEST OF... LOTS.
- **Archivist Ithiel:** They've moved the Field to Millbrook Ford. There is a pond in the middle. I'd not plan on anyone walking through it.

Drill Book page, **Page 2: What Is Placed Stays Placed**:

> “You will see what they fielded, never what they will add.”
>
> *Read their last army. Guess their answer. Add yours.*

**Objective** (also the sidebar's line while deploying): Bring the Boss's HP to nothing before yours runs out. Your squads stay on the Field, and every round brings more supply to add.

**Kit line** (built from the mission's setup): Your champions: Knights, Crossbowmen. You start with 70 HP, The Boss with 90.

### During the match

*(the enemy says nothing)*

### Debrief after a win

- **Sergeant Dunmor:** Boring wins. Twice now.
- **Archivist Ithiel:** The appeal is dismissed. The goat has eaten the appeal.
- **The Boss:** THAT WAS OUR ONLY COPY.

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will.
- When `!fielded(c,"knights")`: **Sergeant Dunmor:** Bolts alone again. A mob needs steel to run onto.
- When otherwise: **Sergeant Dunmor:** Their archers hid behind a goblin screen, on the flank we'd left thin. You saw them there. Next time, put steel on that flank and bows behind it, or guess it before they do.

### Commendation

**Guess Right:** Win every round of the appeal.

---

## The Drill Book, mission 3: Two Keeps

**Teaches** (design note, not shown): Keeps: when one falls, the whole army is Dazed. Guard the flanks with steel; Keep levels only buy time.

**On the Story list:** Someone has painted something rude on the West Keep.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** Marshal, a goblin has painted something on the West Keep.
- **Sergeant Dunmor:** It's rude.
- **The Boss:** IT'S A GOOD LIKENESS.
- **Archivist Ithiel:** Every Field has two Keeps a side. They don't fight, and they don't count toward winning a battle. But if one falls, the whole army loses its nerve.
- **Sergeant Dunmor:** And the grass on the flanks is long this year. Goblins like long grass.

Drill Book page, **Page 3: Two Keeps**:

> “Every Field has two Keeps. If one falls, the whole army loses its nerve.”
>
> *Guard the flanks, or build the walls higher.*

**Objective** (also the sidebar's line while deploying): Win the match, and mind your Keeps: a fallen Keep Dazes your whole army. You can buy Keep levels under Keeps.

**Kit line** (built from the mission's setup): Your champions: Knights, Crossbowmen. Each side starts with 100 HP.

### During the match

*(the enemy says nothing)*

### Debrief after a win

- **Sergeant Dunmor:** Boring wins. Write that down. Again.
- **Archivist Ithiel:** The painting has been scrubbed off the West Keep. Mostly.
- **The Boss:** FINE. WE'RE GETTING THE TROLL.

### Hints after a loss (the first that matches)

- When `!fielded(c,"knights")`: **Sergeant Dunmor:** Bolts alone again. A mob needs steel to run onto.
- When `keepFell(c)&&c.towerLevels.every(l=>l===0)`: **Sergeant Dunmor:** Their wolves went round us and pulled down a Keep, and the whole line lost its nerve. Put steel beside the Keeps. A level on one costs 100 and makes a raid work for it.
- When otherwise: **Sergeant Dunmor:** They got to the Keeps anyway. Walls only buy time: put steel beside them, where the wolves come in.

### Commendation

**Not One Stone:** Win without losing a Keep.

---

## The Drill Book, mission 4: Under the Bridge

**Teaches** (design note, not shown): Unlocks and big units: trolls beat a Knight line, so buy an engine from the armory (the Ballista) and put steel in front of it.

**On the Story list:** The goblins have adopted the troll under the toll bridge. And its toll.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** Marshal, there is a troll under the toll bridge at Hob's Crossing. It has lived there longer than the bridge has.
- **Sergeant Dunmor:** The goblins have adopted it. They've also adopted the toll.
- **The Boss:** HE'S FAMILY NOW. FAMILY GETS PAID.
- **Sergeant Dunmor:** Trolls go through Knights like a boot through a hedge. Every blow in a row lands harder, and they heal while they fight.
- **Archivist Ithiel:** The river is deep on both sides of the bridge, so the Field's short way across is the middle. And the armory holds the Ballista. It costs the Treasury once per Field; after that, a squad is only a squad.

Drill Book page, **Page 4: The Armory**:

> “The armory holds more than the book's first pages. Each new engine costs the Treasury once per Field.”
>
> *Big things need engines. Engines need steel in front.*

**Objective** (also the sidebar's line while deploying): Win the match. The Boss has trolls. The Ballista waits in the shop: unlock it once this match (100), then buy squads as usual.

**Kit line** (built from the mission's setup): Your champions: Knights, Crossbowmen. In the armory: Ballista (unlock 100). You start with 160 HP, The Boss with 140.

### During the match

*(the enemy says nothing)*

### Debrief after a win

- **Sergeant Dunmor:** Boring wins. Big, slow, boring wins bigger.
- **Archivist Ithiel:** The troll has gone back under the bridge. It has agreed to charge the goblins as well.
- **The Boss:** THAT'S NOT FAMILY BEHAVIOR. I'M TELLING THE TINKER.

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will.
- When `!fielded(c,"knights")`: **Sergeant Dunmor:** Bolts alone again. A mob needs steel to run onto.
- When `!fielded(c,"ballista")`: **Sergeant Dunmor:** Steel against trolls is a fair fight, and they brought more trolls than we brought steel. The Ballista hunts the biggest thing on the Field: unlock it in the shop.
- When `c.army.filter(sq=>sq.defId==="knights").length<2`: **Sergeant Dunmor:** The Ballistae had nothing in front of them, and a mob that reaches an engine wrecks it. Steel in front, engines behind.
- When otherwise: **Sergeant Dunmor:** The trolls got through anyway. Add Ballistae every round, behind the Knights, and leave the trolls to them.

### Commendation

**Bridge Held:** Win with Ballistae on the Field, and lose none of them in the last battle.

---

## The Drill Book, mission 5: Plain Steel

**Teaches** (design note, not shown): Upgrades, yours and theirs: the enemy's gadgets show as stars, and the answer is a drill of your own (Repeaters), which reaches every squad already on the Field.

**On the Story list:** A goblin Tinker accuses the Wardens of stealing the wheelbarrow.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** Marshal, we have been accused of theft. A goblin Tinker says we stole the wheelbarrow.
- **The Tinker:** THE wheelbarrow. One wheel, two handles. I drew it first.
- **Archivist Ithiel:** We have had wheelbarrows for four hundred and twelve years.
- **Sergeant Dunmor:** This one tinkers, Marshal. Whatever the goblins bring today will have been improved, and every improvement shows: a star by the unit, once the horn sounds.
- **The Tinker:** Scrap Armor! Nine chances in ten it stops a bolt. Or ten in nine. Something in nine.
- **Archivist Ithiel:** The book answers in kind. A drill improves every squad that knows it, even those already on the Field.

Drill Book page, **Page 5: Drills**:

> “A drill improves every squad that knows it, even those already on the Field.”
>
> *Read their stars. Answer with a drill.*

**Objective** (also the sidebar's line while deploying): Win the match. Upgrades are open: a drill changes every squad of that unit, even ones already placed. The Tinker's upgrades show as ★.

**Kit line** (built from the mission's setup): Your champions: Knights, Crossbowmen. In the armory: Ballista (unlock 100), Cleric (unlock 100). You start with 180 HP, The Tinker with 160.

### During the match

*(the enemy says nothing)*

### Debrief after a win

- **Sergeant Dunmor:** Boring wins. Boring, repeated quickly, wins faster.
- **The Tinker:** The odds were good on that one. Very good. I'll redo the sums.
- **Archivist Ithiel:** The wheelbarrow stays with us. The Tinker has asked to borrow it.
- **The Boss:** FORGET THE GROUND. NOBODY OWNS THE SKY.

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will.
- When `!fielded(c,"knights")`: **Sergeant Dunmor:** Bolts alone again. A mob needs steel to run onto.
- When `Object.keys(c.upgrades).length===0`: **Sergeant Dunmor:** Every goblin in that mob shrugged off the first bolt it took. We fought new gadgets with old drills. Buy a drill under Upgrades: it reaches every squad on the Field.
- When `!c.upgrades.crossbowmen?.includes("repeaters")`: **Sergeant Dunmor:** The right drill matters. Their armor stops one hit per goblin, so a heavy bolt is wasted on it. Repeaters shoot many small bolts: the armor only stops the first.
- When otherwise: **Sergeant Dunmor:** Close. Buy the drill the round you see their stars, and keep adding steel in front of the bows.

### Commendation

**Well Drilled:** Once their armor shows, win every round after it.

---

## The Drill Book, mission 6: Look Up

**Teaches** (design note, not shown): The air: Knights can't strike what flies. Know which champions can (bows, Griffon Riders).

**On the Story list:** The Compact draws borders on the ground. The goblins have noticed.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** Marshal, a point of law. The Compact draws the Field's borders on the ground.
- **Sergeant Dunmor:** And the goblins have noticed it says nothing about above it.
- **The Boss:** WHO OWNS THE SKY? NOBODY. SO IT'S OURS.
- **Sergeant Dunmor:** Bats, Marshal. Big ones, with goblins on. They fly over the line and go for whoever's standing behind it.
- **Archivist Ithiel:** The book is calm about this. Knights cannot strike what flies; Crossbowmen and Ballistae can, and Griffon Riders fly themselves. The Mire slows anyone on foot. It slows nothing with wings.

Drill Book page, **Page 6: Look Up**:

> “Knights cannot strike what flies. Know which of your champions can.”
>
> *Bows under the sky. Wings against wings.*

**Objective** (also the sidebar's line while deploying): Win the match. The Boss has taken to the air, and Knights can't hit fliers. Crossbowmen, Ballistae and Griffon Riders can.

**Kit line** (built from the mission's setup): Your champions: Knights, Crossbowmen. In the armory: Ballista (unlock 100), Cleric (unlock 100), Griffon Riders (unlock 100). Each side starts with 240 HP.

### During the match

*(the enemy says nothing)*

### Debrief after a win

- **Sergeant Dunmor:** Boring wins. Looking up is boring too. Write that down.
- **Archivist Ithiel:** Ruled: the sky over the Field belongs to the Field. The bats have gone home.
- **The Boss:** FINE. I'M CALLING GRUMM.
- **Sergeant Dunmor:** ...Grumm?

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will.
- When `!c.army.some(sq=>sq.round>1&&(sq.defId==="crossbowmen"||sq.defId==="griffon_riders"))`: **Sergeant Dunmor:** Knights can't hit what flies, and the bats knew it. Crossbowmen can, and so can Griffon Riders: put them where the bats come down.
- When `c.army.filter(sq=>sq.defId==="ballista").length>c.army.filter(sq=>sq.defId==="crossbowmen").length`: **Sergeant Dunmor:** Bats land on engines. A Ballista hits fliers, but slowly: Crossbowmen behind the steel shoot them down faster.
- When otherwise: **Sergeant Dunmor:** The bats went over the line and landed on the bows. More bows, Marshal, and Skyhunters picks out the fliers first.

### Commendation

**Wings Against Wings:** Win with Griffon Riders on the Field.

---

## The Drill Book, mission 7: Old Grumm

**Teaches** (design note, not shown): Veterancy: squads that live earn levels. Promote them, and put the longest weapons (pikes) where the biggest enemy walks.

**On the Story list:** Thirty years ago, an ogre ate the Sergeant's helmet.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** Marshal, the Boss has named a champion: Old Grumm.
- **Sergeant Dunmor:** Thirty years ago, at a Field match, Grumm ate my helmet. I was nearly still in it.
- **The Boss:** GRUMM'S BEEN FIGHTING SINCE BEFORE YOU WERE BORN. HE'S GOOD AT IT NOW.
- **Archivist Ithiel:** Squads that fight well learn from it, and Grumm has learned a great deal. Ours can too: when a squad has a level waiting, you may promote it, for half its price.
- **Archivist Ithiel:** And there is a page in the book no one has turned to in two hundred years. There was nothing large enough to need it.
- **Sergeant Dunmor:** The pikes. Dwarven Pikemen, Marshal: long sticks for large problems.

Drill Book page, **Page 7: The Pike Line**:

> “Against the largest, the longest. Hold them at the point.”
>
> *Pikes where the big ones walk. Promote what lives.*

**Objective** (also the sidebar's line while deploying): Win the match. Squads now earn experience: one with a level waiting shows a gold ▲, and promoting it costs half its price.

**Kit line** (built from the mission's setup): Your champions: Knights, Crossbowmen. In the armory: Ballista (unlock 100), Cleric (unlock 100), Griffon Riders (unlock 100), Dwarven Pikemen (unlock 100). Each side starts with 300 HP.

### During the match

*(the enemy says nothing)*

### Debrief after a win

- **Sergeant Dunmor:** Boring wins. And I've got my helmet back. It's been chewed.
- **Archivist Ithiel:** The pike page has been copied out fresh. The old ink had faded.
- **The Boss:** RIGHT. THAT'S IT. THE WHOLE BORDER. EVERYTHING. NEXT TIME.

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will.
- When `c.army.every(sq=>(sq.level??1)===1)`: **Sergeant Dunmor:** Squads that live through a battle learn from it. We had veterans waiting and never promoted one. When you see the gold ▲, promote: half a squad's price buys a whole squad's worth.
- When otherwise: **Sergeant Dunmor:** Grumm walked through us. Keep promoting, put the pikes where he walks, and keep bows behind them to finish him.

### Commendation

**Old Page, New Ink:** Win with a promoted squad of Dwarven Pikemen on the Field.

---

## The Drill Book, mission 8: The Marches

**Teaches** (design note, not shown): The full Compact: choose an opening, deploy blind from round 1, and use every page of the book at once.

**On the Story list:** The season final. The Boss stakes the whole border.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** Marshal, the season final. The Boss has staked the whole border: the Marches, from the Toll Bridge to the hills.
- **The Boss:** EVERYTHING. ALL OF IT. AND THE GOAT.
- **Sergeant Dunmor:** Full Compact rules today. Nobody sees the other army before the horn. The Treasury offers an opening, and the whole armory is ours to unlock.
- **The Tinker:** And if the Boss loses twice, it's my turn. I've been working on something. Several somethings.
- **Archivist Ithiel:** Every page of the book applies. A Giant from the hills has offered to hire on, which the book doesn't cover. And there is one blank page at the back. It has been blank for four hundred years.

Drill Book page, **Page 8: The Full Compact**:

> “Every commander chooses, every commander places, and no one sees the other's army before the horn.”
>
> *Every page at once.*

**Objective** (also the sidebar's line while deploying): Win the season final. Round 1 offers three Warden packs or the war chest, the whole armory is open, and the goblins stay hidden until the horn.

**Kit line** (built from the mission's setup): Round 1 offers three packs (Knights and Crossbowmen; Crossbowmen and Dwarven Pikemen; Knights and Dwarven Pikemen) or the war chest. In the armory: Knights (unlock 100), Crossbowmen (unlock 100), Ballista (unlock 100), Griffon Riders (unlock 100), Cleric (unlock 100), Dwarven Pikemen (unlock 100), Giant (unlock 200). Each side starts with 400 HP.

### During the match

- Round 3–5 (scripted: when depends on how the match goes). **The Tinker:** My turn! Bats. Four chances in five they work. I counted twice, and got two answers.
- Round 4–6 (scripted: when depends on how the match goes). **The Tinker:** Both Keeps at once. Nobody does both Keeps at once. That's what makes it work.
- Round 5 (scripted: when depends on how the match goes). **The Boss:** NO. BIGGER.

### Debrief after a win

- **Sergeant Dunmor:** Boring wins. A whole border's worth of boring.
- **The Tinker:** I had ideas. Good ones. Nobody listened.
- **The Boss:** ...SAME TIME NEXT SEASON?
- **Archivist Ithiel:** The Marshal has written on the blank page. In ink.

Then a page of the book, **Page 9, in the Marshal's hand**: What we fielded at the Marches, and what held.

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** Supply you don't spend doesn't fight, Marshal. Add champions every round: the goblins certainly will.
- When `!c.army.some(sq=>["knights","pikemen"].includes(sq.defId))`: **Sergeant Dunmor:** Nothing in front of the bows, Marshal. The Boss sent his biggest, and they walked straight in. Steel in front.
- When `!c.army.some(sq=>["crossbowmen","griffon_riders"].includes(sq.defId))`: **Sergeant Dunmor:** The Tinker's bats came over the line, and nothing of ours could reach them. Bows under the sky.
- When `c.results.some(r=>Object.values(r.stats).some(s=>s.structure&&s.side===0&&s.alive===0))`: **Sergeant Dunmor:** The Tinker went for both Keeps at once, and the line lost its nerve. Steel beside the Keeps, or a level on each, before it comes.
- When otherwise: **Sergeant Dunmor:** Every page at once, Marshal: steel in front, bows behind, eyes up, Keeps guarded, veterans promoted.

### Commendation

**Boring Wins:** Win the final with only the two units your opening pack gave you.
