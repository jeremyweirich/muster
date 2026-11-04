# Common Ground: the story copy

Every word the story campaigns show, mission by mission, for editing for consistency and tone. Generated from `src/data/campaign.ts` by `npm run -s copy-doc > docs/COPY.md`: edit here, then the changes go back into `campaign.ts` (ask Claude) and this page is regenerated. The voices are in `docs/VISION.md`.

## The campaigns (Story tab)

- **The Drill Book:** A nervous new Marshal, a sergeant who has never read the book, and an archivist who has never left it.
- **The Tinker's Notebook:** "They had pointy sticks and we had nothing. So I made a bigger thing." *(not built yet)*
- **We Burn:** "We're not being rude. We're standing over here so you don't catch fire." *(not built yet)*

---

## The Drill Book, mission 1: Hands Off

**Teaches** (design note, not shown): Placing, then letting go: Knights in front, Crossbowmen behind. Crossbowmen alone get swarmed by a mob.

**On the Story list:** A goat has wandered across the border at Millbrook. Settle it on the Field.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** Is that the goat? It's much smaller than the literature suggests! There's also a precedent involving a turnip, if we have an hour.
- **Sergeant Dunmor:** We don't. Knights in front, Crossbowmen behind them, so the mob has something to run into. When the horn goes, hands in your pockets. Book says so.
- **Archivist Ithiel:** It says "no hand may touch the Field." It doesn't mention pockets.
- **Sergeant Dunmor:** Well, that's where I keep mine.
- **Marshal:** Sorry, so once it starts, what do I do?
- **Sergeant Dunmor:** Nothing. Best part of the job.
- **The Boss:** IT'S OUR GOAT. WE HAVE THREE MOBS OF WITNESSES.
- **Archivist Ithiel:** The challenger deploys first, so you can study their army for as long as you like. I certainly intend to!

Drill Book page, **Page 1: The Compact**:

> "Choose your units. Place them. When the horn sounds, no hand may touch the Field."

*Pencil note: Knights in front, Crossbowmen behind. Surely there's more to it? Ask whether pockets are required.*

**Objective:** Win the battle.

### During the match

*(one battle, no lines)*

### Debrief after a win

- **Sergeant Dunmor:** Everybody back? Good, less paperwork. Boring wins. Book says so.
- **Archivist Ithiel:** It doesn't, actually! I'd remember.
- **Sergeant Dunmor:** Well, it should.
- **The Boss:** YOU BEAT THREE MOBS. WE HAVE MORE MOBS. WE'RE APPEALING.
- **Marshal:** Can they do that?
- **Archivist Ithiel:** Oh, I very much hope so!

*Pencil note: "Boring wins" (Sgt.). Not in the book, says Ithiel. Sgt. says it should be.*

### Hints after a loss (the first that matches)

- When `!fielded(c,"knights")`: **Sergeant Dunmor:** Crossbowmen only get so many shots, and there were more goblins than shots. A mob needs something to run into. Put Knights in front.
- When otherwise: **Sergeant Dunmor:** They got round your Knights. Put them where the goblins are heading, between the mob and your Crossbowmen.

### Commendation

**Knights in Front:** Win with Crossbowmen on the Field, and lose none of them.

---

## The Drill Book, mission 2: The Appeal

**Teaches** (design note, not shown): Rounds and HP: what is placed stays placed. You see their last army, never what they will add, so read it and answer (they hit the flank you left thin).

**On the Story list:** The goblins appeal the goat. Under the Compact, an appeal is a longer match.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** They've appealed! Under the Compact, a loss can be appealed once, as a longer match. I've only ever read about one of these!
- **Marshal:** How much longer?
- **Sergeant Dunmor:** Rounds. Each round you add units, and whatever you've already placed stays put. After each battle, the survivors take a bite out of the other side's HP. First to zero loses.
- **The Boss:** WE CAME BACK WITH MORE. THEN WE COME BACK WITH MORE AFTER THAT. THAT'S WHAT ROUNDS ARE.
- **Archivist Ithiel:** According to the map, Millbrook Ford is a shallow crossing.
- **Sergeant Dunmor:** It's been a pond for sixty years. Nobody's walking through that.
- **Archivist Ithiel:** The map is wrong? How wonderful!

Drill Book page, **Page 2: What Is Placed Stays Placed**:

> "You will see what the other side has fielded, but never what they will add."

*Pencil note: So I look at their last army and guess? Is guessing allowed? Asked Sgt. He said "Everyone guesses." That doesn't help.*

**Objective:** Bring the Boss's HP to zero before yours runs out.

### During the match

- Round 2: **The Boss:** THAT WAS THE SHORT VERSION.
- Round 3: **Sergeant Dunmor:** See where they put those Skirmishers? On the side we left thin. Goblins always check.

### Debrief after a win

- **Archivist Ithiel:** The appeal is dismissed, and the goat has eaten it! I can't find a precedent!
- **The Boss:** THAT WAS OUR ONLY COPY.
- **Marshal:** Does that count as a ruling?
- **Archivist Ithiel:** I have no idea. Isn't that marvelous?
- **Sergeant Dunmor:** It's a goat. Who's got lunch?

*Pencil note: Millbrook Ford is a pond (Sgt.). The map is older than the pond (Ithiel, thrilled). Look at the thin side of your own army first.*

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** You stopped adding units after round 1. Supply in your pocket doesn't fight, and they kept coming.
- When `!fielded(c,"knights")`: **Sergeant Dunmor:** No Knights, so nothing stopped the mob reaching your Crossbowmen. Put Knights in front.
- When otherwise: **Sergeant Dunmor:** Their Skirmishers hid behind Grunts, on the flank we left thin. Next time, put Knights on that flank with Crossbowmen behind them, or get there before they do.

### Commendation

**Guess Right:** Win every round of the appeal.

---

## The Drill Book, mission 3: Two Keeps

**Teaches** (design note, not shown): Keeps: when one falls, the whole army is Dazed. Guard the flanks with Knights; Keep levels only buy time.

**On the Story list:** Someone has painted something rude on the West Keep.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** A goblin has painted something on the West Keep! I've seen this sort of thing in marginalia, but never at this scale.
- **Sergeant Dunmor:** It's rude.
- **Marshal:** Is that supposed to be me?
- **The Boss:** IT'S A GOOD LIKENESS.
- **Archivist Ithiel:** Each side has two Keeps. They don't fight, and they don't count toward winning a battle, but you very much want to hold on to them. Page 3 is quite firm!
- **Sergeant Dunmor:** Lose one and everyone stands around blinking. And the grass on the flanks is long this year. Goblins hide in it.
- **Archivist Ithiel:** The book doesn't mention grass at all!
- **Sergeant Dunmor:** Goblins don't read it either.

Drill Book page, **Page 3: Two Keeps**:

> "If a Keep falls, the whole army is Dazed. A Keep can be built higher."

*Pencil note: Book says buy levels (Keeps tab). Sgt. says put Knights beside the Keeps. Which? Does anyone know? Do both?*

**Objective:** Win the match.

### During the match

- Round 2: **The Boss:** NICE KEEPS. BE A SHAME.
- Round 3: **Archivist Ithiel:** Wolf Riders! See the star beside them? That's an upgrade, Tower Raiders, so they go straight for Keeps. Volume Four calls this "an unsporting tendency"!

### Debrief after a win

- **Sergeant Dunmor:** Told you about the grass.
- **Archivist Ithiel:** You did! I went and stood in it. May I add it to the book?
- **Sergeant Dunmor:** Thought it was already in there.
- **Archivist Ithiel:** The painting has been scrubbed off the West Keep. Mostly. I kept a sketch.
- **Marshal:** Please don't keep a sketch.
- **The Boss:** SCRUB ALL YOU LIKE. WE'RE GETTING THE TROLL.

*Pencil note: Keep levels buy time (book). Knights stop the wolves (Sgt.). Long grass hides wolves (Sgt., and now Ithiel, who has some in his hair).*

### Hints after a loss (the first that matches)

- When `!fielded(c,"knights")`: **Sergeant Dunmor:** No Knights on the Field, so nothing stopped the mob or the wolves. Buy some Knights.
- When `keepFell(c)&&c.towerLevels.every(l=>l===0)`: **Sergeant Dunmor:** The wolves pulled down a Keep and the whole army was Dazed. Put Knights beside the Keeps. A level costs 100 and slows the wolves down, too.
- When otherwise: **Archivist Ithiel:** Page 3 says higher walls help, and they do, for a while! It seems the wolves just take longer. Knights beside the Keeps are what actually stop them.

### Commendation

**Both Keeps Standing:** Win without losing a Keep.

---

## The Drill Book, mission 4: The Troll

**Teaches** (design note, not shown): Ballistae and depth: trolls beat a Knight line, so put Ballistae behind Knights, and keep the Knights at the back so the trolls come to them through the slow ground under the bolts.

**On the Story list:** The goblins have got hold of a troll. Several, in fact.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** A troll! I have three volumes on trolls, and I can finally see if they got the knees right.
- **Sergeant Dunmor:** Knees are the last thing you'll notice. They go through Knights like a boot through a hedge. Every blow in a row lands harder, and they heal while they fight.
- **The Boss:** WE GOT TROLLS. AND ENOUGH SKIRMISHERS FOR EVERY KNIGHT YOU OWN.
- **Marshal:** What do we do about a troll?
- **Sergeant Dunmor:** Ballista. Big, slow, and goes for the biggest thing it can see. Put Knights in front, or a mob will wreck it. Book says so.
- **Archivist Ithiel:** It actually does, for once! Page 4! How did you know?
- **Sergeant Dunmor:** Stood in front of one once. And they've ploughed the middle of the Field. Anything on foot crosses it at half speed, trolls included.

Drill Book page, **Page 4: Ballistae**:

> "Ballistae deal double damage to large units. Ballistae need Knights in front of them."

*Pencil note: Ploughed ground: half speed on foot. Theirs and ours. In front, but how far in front? Sgt. says don't be in a hurry.*

**Objective:** Win the match.

### During the match

- Round 2: **The Boss:** HERE COME THE TROLLS.
- Round 3: **Archivist Ithiel:** An actual troll! Volume One has the knees completely wrong! Oh, and it's healing. It's still healing. Look at that!

### Debrief after a win

- **Sergeant Dunmor:** Big, slow, and it worked. That's what I like in a plan.
- **Archivist Ithiel:** The trolls have gone home, and I've drawn the correct knees.
- **Marshal:** Is that going in the book?
- **Archivist Ithiel:** It had better be!
- **The Boss:** FINE. YOU WANT TO PLAY CLEVER? MEET THE TINKER.

*Pencil note: Trolls get worse the longer they keep hitting something (Sgt.). Knights waited at the back and met them in the mud. For knees, see Ithiel's drawing.*

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** You stopped adding units after round 1. The trolls didn't stop.
- When `!fielded(c,"ballista")`: **Sergeant Dunmor:** Knights against trolls is a fair fight, and they brought more trolls. Ballistae go for the biggest thing on the Field.
- When `!fielded(c,"knights")`: **Sergeant Dunmor:** Nothing stood in front of the Ballistae, and a mob that reaches a Ballista wrecks it. Knights in front.
- When `c.army.some(sq=>sq.defId==="knights"&&sq.y<24)`: **Sergeant Dunmor:** Your Knights marched out to meet them, and the Skirmishers shot them on the way. Keep them at the back. The trolls will come to you, slowly, through the mud.
- When otherwise: **Sergeant Dunmor:** The trolls still got through. Add Ballistae every round, behind your Knights, and leave the trolls to them.

### Commendation

**In No Hurry:** Win with every Knight squad in your back two rows.

---

## The Drill Book, mission 5: The Wheelbarrow

**Teaches** (design note, not shown): Upgrades, yours and theirs: the enemy's upgrades show as stars, and the answer is an upgrade of your own (Repeaters), which reaches every squad already on the Field.

**On the Story list:** A goblin Tinker accuses the Wardens of stealing the wheelbarrow.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** We've been accused of theft! A goblin says we stole the wheelbarrow. We've had wheelbarrows for four hundred and twelve years. I brought the records!
- **The Tinker:** Four hundred and twelve years, and it still has one wheel! Nobody who invented that would have stopped there. So you must have stolen it.
- **Marshal:** Is that an argument?
- **Archivist Ithiel:** It's a very good one!
- **The Tinker:** I'll have a look at your army, then I'll pick my upgrades. It's called thinking! It's free, you should try it!
- **Sergeant Dunmor:** Our squads get better all at once sometimes, even the ones already out there. Never knew why.
- **Archivist Ithiel:** That's Page 5! Those are upgrades, and someone has to buy them!
- **Sergeant Dunmor:** Ah. That explains the invoices.

Drill Book page, **Page 5: Upgrades**:

> "An upgrade improves every squad of that unit, even those already on the Field. Enemy upgrades show as a star beside the unit."

*Pencil note: Check for stars, then pick an upgrade that answers them. Does Sgt. know he's been paying for these? He does now.*

**Objective:** Win the match.

### During the match

- Round 2: **The Tinker:** Just a small change this round! You'll notice!
- Round 3: **Archivist Ithiel:** That star is Scrap Armor. It stops one hit per Grunt! So one big hit is wasted, but lots of small hits... oh, what a lovely problem!
- Round 3: **The Tinker:** Thick Blood on the trolls! I considered something flashier, but it wouldn't have been as annoying.

### Debrief after a win

- **Sergeant Dunmor:** The right upgrade. Forty years, I thought they just turned up like that some seasons.
- **The Tinker:** You picked the right upgrade! Most people don't look. Can I see one up close?
- **Archivist Ithiel:** The wheelbarrow stays with us. The Tinker has asked to borrow it.
- **Marshal:** Should we let them?
- **Sergeant Dunmor:** It's a wheelbarrow.
- **The Boss:** ENOUGH THINKING. WE'RE TAKING THE BRIDGE.

*Pencil note: Sgt. has been buying upgrades for forty years without knowing it. Wheelbarrow: is one wheel a problem? Nobody here has ever asked.*

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** They kept adding squads and you stopped. That's the whole story.
- When `!fielded(c,"knights")`: **Sergeant Dunmor:** The mob ran straight onto your Crossbowmen. Put Knights in front.
- When `Object.keys(c.upgrades).length===0`: **Archivist Ithiel:** Every Grunt shrugged off its first hit, and we never answered! Open the Upgrades tab. An upgrade reaches every squad already on the Field.
- When `!c.upgrades.crossbowmen?.includes("repeaters")`: **Archivist Ithiel:** Scrap Armor stops one hit per Grunt, so a heavy bolt is wasted on it. Repeaters fire lots of small bolts, and the armor only stops the first!
- When otherwise: **Sergeant Dunmor:** Close. Buy the upgrade the round you see the star, and keep adding Knights in front of your Crossbowmen.

### Commendation

**Right Upgrade:** Once their armor shows, win every round after it.

---

## The Drill Book, mission 6: Under the Bridge

**Teaches** (design note, not shown): Clerics: hold the one way across with Knights, and keep them standing with Clerics behind them. The river rules out flanking.

**On the Story list:** The goblins have put a toll on the bridge at Hob's Crossing.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** The river at Hob's Crossing runs right across the Field, and there's only one bridge. The goblins have put a toll on it!
- **The Boss:** THE BRIDGE IS OURS NOW. SO IS THE TOLL. EXACT CHANGE ONLY.
- **Sergeant Dunmor:** One way across, and it's wide. Put Knights on our end of it and they'll have to come through them.
- **Marshal:** Won't the Knights get worn down?
- **Sergeant Dunmor:** They would. That's what Clerics are for. They stand behind the Knights and patch them up.
- **Archivist Ithiel:** Page 6! It's mostly hymns, but the healing is very well described.

Drill Book page, **Page 6: Clerics**:

> "Clerics heal the units around them. They don't fight, so keep them behind the line."

*Pencil note: One bridge, so they all come the same way. Knights on it, Clerics behind. Ithiel has marked his favorite hymns.*

**Objective:** Win the match.

### During the match

- Round 2: **The Boss:** TOLL'S GONE UP.
- Round 3: **Sergeant Dunmor:** They'll keep coming over that bridge. Keep Knights on it, Clerics behind them, and get those Clerics praying faster.

### Debrief after a win

- **Sergeant Dunmor:** Nobody crossed. That's the job.
- **Archivist Ithiel:** The toll is abolished! I kept a receipt.
- **Marshal:** Did we pay it?
- **Sergeant Dunmor:** No.
- **The Boss:** THE GROUND'S FULL ANYWAY. WE'LL USE THE SKY.

*Pencil note: Knights on the bridge, Clerics behind them. Nobody crosses. Ithiel kept a receipt for a toll we never paid.*

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** You stopped adding units after round 1. They kept coming over that bridge.
- When `!fielded(c,"knights")`: **Sergeant Dunmor:** Nothing held the bridge, so they walked straight over it. Put Knights on it.
- When `!fielded(c,"cleric")`: **Archivist Ithiel:** The Knights held the bridge until they wore out! Clerics behind them would have kept them standing.
- When `!c.upgrades.cleric?.includes("constant_prayer")`: **Archivist Ithiel:** The Clerics couldn't keep up! One big prayer every five seconds, and the bridge never stops. Constant Prayer heals a little every second. It's on the Upgrades tab!
- When otherwise: **Sergeant Dunmor:** Close. Add Knights on the bridge and Clerics behind them, every round, and Ballistae when the trolls come.

### Commendation

**Nobody Crosses:** Win every round.

---

## The Drill Book, mission 7: Look Up

**Teaches** (design note, not shown): The air: Knights can't hit what flies. Know which units can (Crossbowmen, Ballistae, Griffon Riders).

**On the Story list:** The Compact draws borders on the ground. The goblins have noticed.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** A point of law! The Compact draws the Field's borders on the ground and says nothing about the air above it. I've read that clause a hundred times and never once looked up.
- **The Boss:** YOU DREW A LINE ON THE GROUND. WE'RE GOING OVER IT. THAT'S NOT CHEATING, THAT'S READING.
- **Archivist Ithiel:** He's right!
- **Sergeant Dunmor:** Bats. Big ones, with goblins on. They go over your Knights and come down on whoever's behind them. The Mire won't slow them down, either.
- **Marshal:** What can hit them?
- **Archivist Ithiel:** Page 7 has a list! Griffon Riders are on it. The griffon is described here as noble and gentle-natured.
- **Sergeant Dunmor:** They bite.

Drill Book page, **Page 7: Fliers**:

> "Knights cannot hit what flies. Crossbowmen, Ballistae and Griffon Riders can."

*Pencil note: Griffons bite (Sgt.). Book says gentle-natured. Ithiel would like to check. Please don't let him check.*

**Objective:** Win the match.

### During the match

- Round 2: **The Boss:** YOU MIGHT WANT TO LOOK UP.
- Round 3: **Archivist Ithiel:** Giant Bats! Actual ones, and with Savage Claws! Did you see how they fold their wings before they land on the Crossbowmen? Volume Two gets that completely wrong!
- Round 5: **Sergeant Dunmor:** More Skirmishers, and they shoot fliers. Don't send your Griffon Riders in alone.

### Debrief after a win

- **Sergeant Dunmor:** Sore neck, but everyone looked up. That'll do.
- **Archivist Ithiel:** It's ruled: the sky over the Field belongs to the Field. The bats have gone home. And griffons do bite.
- **Marshal:** You checked?
- **Archivist Ithiel:** I've amended the entry!
- **The Boss:** FINE. I'M CALLING GRUMM.
- **Sergeant Dunmor:** ...Grumm?

*Pencil note: Griffons bite (confirmed, Ithiel, left hand). Crossbowmen do half damage to fliers until you buy Skyhunters.*

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Marshal:** I kept my supply for later, and there wasn't a later. Add units every round.
- When `!c.army.some(sq=>sq.round>1&&(sq.defId==="crossbowmen"||sq.defId==="griffon_riders"))`: **Sergeant Dunmor:** Knights can't reach the bats, and the bats know it. Put Crossbowmen or Griffon Riders where they come down.
- When `c.army.filter(sq=>sq.defId==="ballista").length>c.army.filter(sq=>sq.defId==="crossbowmen").length`: **Sergeant Dunmor:** Bats land on Ballistae. A Ballista can hit fliers, but it's slow about it. Crossbowmen behind your Knights do it faster.
- When otherwise: **Archivist Ithiel:** The bats went over the line and landed on the Crossbowmen! Crossbowmen do half damage to fliers unless you buy Skyhunters. It's on the Upgrades tab.

### Commendation

**Air Cover:** Win with Griffon Riders on the Field.

---

## The Drill Book, mission 8: Old Grumm

**Teaches** (design note, not shown): Veterancy: squads that live earn levels. Promote them, and put Dwarven Pikemen where the biggest enemy walks.

**On the Story list:** Thirty years ago, an ogre ate the Sergeant's helmet.

### Take the Field screen

Briefing:

- **Sergeant Dunmor:** Thirty years ago, Grumm ate my helmet. I was nearly still in it. Nothing you can do about an ogre that size. Book says so.
- **The Boss:** GRUMM REMEMBERS YOUR SERGEANT. SAYS THE HELMET NEEDED SALT.
- **Archivist Ithiel:** Page 8 is entirely about large things! Dwarven Pikemen, with very long pikes. Nobody's opened it in two hundred years!
- **Sergeant Dunmor:** ...There's a page.
- **Marshal:** Are you all right?
- **Sergeant Dunmor:** Thirty years.
- **Sergeant Dunmor:** Right. Squads that live through a battle get better at this. A gold ▲ means one has a level waiting. Promote it for half its price. That part I do know.

Drill Book page, **Page 8: The Pike Line**:

> "Dwarven Pikemen do extra damage to large units. Put them where large units walk."

*Pencil note: Sgt. asked me to read this page to him. Twice.*

**Objective:** Win the match.

### During the match

- Round 2: **The Boss:** GRUMM'S WARMED UP.
- Round 3: **Sergeant Dunmor:** That's him. Hasn't changed. Put your Pikemen where he's walking, and promote anything with a gold ▲.
- Round 4: **Archivist Ithiel:** The entry says "broad in the swing"! That doesn't really cover it, does it?
- Round 5: **The Boss:** ONE GRUMM WAS A COURTESY.

### Debrief after a win

- **Sergeant Dunmor:** Got my helmet back. It's been chewed.
- **Archivist Ithiel:** I've copied the pike page out fresh, since the old ink had faded. It only says "large," though. What was he actually like, up close?
- **Sergeant Dunmor:** Give me that page. I'll tell you what's wrong with it.
- **Marshal:** You're going to read it?
- **Sergeant Dunmor:** Just that page.
- **The Boss:** RIGHT. THE WHOLE BORDER. EVERYTHING WE'VE GOT, ALL AT ONCE. COUNT THEM IF YOU CAN.

*Pencil note: Grumm's swing takes two or three at once (Sgt., dictating to Ithiel). Sgt. checked the page afterward. He's reading it.*

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Sergeant Dunmor:** You stopped adding units after round 1. Grumm didn't stop.
- When `c.army.every(sq=>(sq.level??1)===1)`: **Sergeant Dunmor:** You had veterans waiting and never promoted one. When you see a gold ▲, promote it. Half a squad's price buys a whole squad's worth.
- When otherwise: **Sergeant Dunmor:** Grumm walked through us. Keep promoting, put your Pikemen where he walks, and keep Crossbowmen behind them to finish him.

### Commendation

**Page Eight:** Win with a promoted squad of Dwarven Pikemen on the Field.

---

## The Drill Book, mission 9: The Marches

**Teaches** (design note, not shown): The full Compact: deploy blind from round 1, and use everything from the book at once.

**On the Story list:** The season final. The Boss stakes the whole border.

### Take the Field screen

Briefing:

- **Archivist Ithiel:** The season final! The Boss has staked the whole border, from the Toll Bridge to the hills. I've brought a hat.
- **The Boss:** EVERYTHING. ALL OF IT. AND THE GOAT.
- **Marshal:** Full Compact rules, page 9. Nobody sees the other army before the horn. I've read it three times.
- **Sergeant Dunmor:** Page 3. If a Keep falls, the whole army is Dazed. I looked it up.
- **Archivist Ithiel:** You looked it up?
- **Sergeant Dunmor:** Griffons?
- **Archivist Ithiel:** Bite. I can show you the hand.
- **The Tinker:** If the Boss loses twice, it's my turn. I've watched what you field all season, so I know exactly which upgrades I want.
- **Archivist Ithiel:** A Giant from the hills has offered to hire on, and the book doesn't cover that!
- **Sergeant Dunmor:** Book says hire anything that big.
- **Archivist Ithiel:** It absolutely does not!
- **Marshal:** Hire it if we need it. We'll write it in.

Drill Book page, **Page 9: The Full Compact**:

> "Every commander chooses, every commander places, and no one sees the other's army before the horn."

*Pencil note: Knights in front, Crossbowmen behind. Watch the sky and the Keeps. Promote. I think I can do this. There's a blank page at the back.*

**Objective:** Win the season final.

### During the match

- Round 2: **Archivist Ithiel:** The histories never mention the noise!
- Round 3 (scripted: when depends on how the match goes). **The Tinker:** My turn! Bats, with Shriek. I checked your army first, so you're going to hate this.
- Round 4 (scripted: when depends on how the match goes). **The Tinker:** Tower Raiders, on both flanks. You'd have answered one raid, so I sent two.
- Round 5 (scripted: when depends on how the match goes). **The Boss:** NO. MORE.

### Debrief after a win

- **The Tinker:** Your wheelbarrow's outside. It has two wheels now. You're welcome.
- **Sergeant Dunmor:** It's better.
- **Archivist Ithiel:** It isn't in the book!
- **Marshal:** It could be.
- **Sergeant Dunmor:** Boring wins. Book says so.
- **Archivist Ithiel:** It doesn't, as I've told you every... oh. Oh! Page 10! In ink!
- **Marshal:** It kept coming up.
- **Sergeant Dunmor:** Told you it was in there.
- **The Boss:** ...SAME TIME NEXT SEASON?

Then a page of the book, **Page 10, in the Marshal's hand, in ink**: "Boring wins." Below it, what we fielded at the Marches, and what held.

### Hints after a loss (the first that matches)

- When `c.army.every(sq=>sq.round===1)`: **Marshal:** We stopped adding after round 1. I know better than that.
- When `!c.army.some(sq=>["knights","pikemen"].includes(sq.defId))`: **Sergeant Dunmor:** Nothing in front of your Crossbowmen. The Boss sent his biggest units, and they walked straight in. Put Knights or Pikemen in front.
- When `!c.army.some(sq=>["crossbowmen","griffon_riders"].includes(sq.defId))`: **Archivist Ithiel:** The Tinker's bats came over the line, and nothing of ours could reach them! Crossbowmen and Griffon Riders can.
- When `c.results.some(r=>Object.values(r.stats).some(s=>s.structure&&s.side===0&&s.alive===0))`: **Sergeant Dunmor:** The Tinker hit both Keeps at once, and the whole army was Dazed. Put Knights beside the Keeps, or buy a level on each, before it comes.
- When otherwise: **Marshal:** All right. Knights in front, Crossbowmen behind, watch the sky, guard the Keeps, promote the veterans. Again.

### Commendation

**Boring Wins:** Win the final with only Knights and Crossbowmen.
