# Common Ground: campaign outline (draft, Oct 2026)

The game is now called **Common Ground** (the repo stays `muster`). The Kingdom faction is now the **Wardens**.

Status: **proposal**. Inputs: `PROMPT.md` (narrative), `UNIT_NOTES.md` (goblin rework, AI difficulty), DESIGN.md and
`docs/PLAYTEST-2026-10.md`. No balancing or playtesting yet. This is about the order in which the game, its mechanics
and its factions are introduced. Names in *italics* are placeholders.

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

### Rules that apply to all three

- **HP grows within a campaign and resets at the next one.** HP is the knob for match length. Income stays standard,
  so the economy the player learns is the one they'll use in skirmish. Target lengths are what matter; HP values get
  calibrated later with `npm run playtest`.

  | Mission | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
  |---|---|---|---|---|---|---|---|---|
  | HP per player | one battle | 60 | 100 | 140 | 180 | 240 | 300 | 400 |
  | Target length | 1 round | ~3 | ~4 | ~4 | ~5 | ~5 | ~6 | 6–9 |

  Later campaigns could end higher (Goblins at 450, Elementals at 500) so each finale feels bigger than the last.
  Per-side HP is also available as a lever, for example a weaker enemy in mission 2.
- **No army carries over between missions.** Every Field match is a new match under the Compact. That avoids the
  veterancy snowball (playtest §2.1) and needs no saved state. Progress is the *book*: each mission adds a page, and a
  page makes a unit or mechanic available in later missions.
- **No storage** (invariant, decided). The mission list is fully open, with a recommended order and a "start here".
  There's no locked progression to save.
- **Authored enemies, then the AI.** Playtest §2.8: the planner won't reliably produce a story beat. Early missions use
  scripted rounds (fixed purchases and placements). Later ones use the AI limited to a themed pool. Commander
  personalities map onto the difficulty notes in `UNIT_NOTES.md`:
  - **the Boss = Easy.** Builds an even mix and doesn't counter until it's taken real damage. Goblins don't change
    plans until it hurts.
  - **the Marshal (as enemy) = Medium.** A structured board with early counters. It plays by the book, which makes it
    predictable, and the goblins exploit that.
  - **the Tinker = Hard.** Tempo plays: tower rushes, a sudden air investment, overloading one flank.
  - The elementals are Medium, but precise.
- **Tutorial text is in-world.** Wardens: Drill Book pages. Goblins: the Tinker's notebook, with wrong odds and
  crossings-out. Elementals: *the Litany*, the elders' list of whom you must not burn. Each mission opens with one
  page and closes with a one-line debrief. The campaign could replace the five-page How to Play.
- **Each mission adds about one mechanic, at most one player unit and at most one enemy unit.** Every mission has a
  scripted **punch**: a round where the enemy does something the player's current army can't handle. The new
  mechanic or unit is the counterpunch.
- **Optional commendations** (one per mission, e.g. "no Keep falls") give replay value without gating anything.

## 2. Campaign 1, Wardens: The Drill Book

**Story.** It's the start of the Field season. A newly appointed Marshal (player, they/them) inherits the post and the
Drill Book: four hundred years of formations, one page per lesson. The goblin Boss has a season's worth of grievances
to settle, and they escalate from a goat to the whole border. *Sergeant Dunmor* (dwarf): "Boring wins. Write that
down." *Archivist Ithiel* (elf) notes how long each page has gone unchanged. The goblin Boss commands the enemy all
campaign. The Tinker shows up halfway, which seeds Campaign 2.

**Arc.** The Marshal trusts the book, then learns that the book can grow. Mission 7 revives a page nobody has turned to
in centuries. Mission 8's last page is the first one the Marshal writes. The owner loves the idea of **generating it from the
player's own winning board**, drawn as a drill-book diagram, but it's **parked** until stored progress is decided (§5).
Until then, the page can be generated and shown at the end of the finale, without being kept.

**Roster needed.** The goblin rework in `UNIT_NOTES.md` (Grunts, Skirmishers, Wolf Riders, Troll, Ogre Brute, Giant
Bats) plus the six Warden units. **Decided: Skirmishers are goblin archers and can hit air.** Without them, Griffons
(mission 6) would be a win button in missions 6–8 and the pike-line finale wouldn't land. This also satisfies playtest
rule #1.

| # | Mission | Dispute | New for the player | Warden unit | Goblin unit | HP |
|---|---|---|---|---|---|---|
| 1 | Hands Off | a goat | placement, Fight, the hands-off rule | Knights, Longbows | Grunts | 1 battle |
| 2 | The Appeal | the goat, appealed | rounds, locked squads, reading their last army, HP | | Skirmishers | 60 |
| 3 | Two Keeps | a rude drawing on a Keep | towers, collapse Daze, flanks, tower levels | | Wolf Riders | 100 |
| 4 | Under the Bridge | the bridge toll | unlocks, big units, regeneration | Ballista | Troll | 140 |
| 5 | Plain Steel | the wheelbarrow patent | upgrades, yours and theirs | Cleric | the Tinker's gadgets | 180 |
| 6 | Look Up | who owns the sky | the air layer | Griffon Riders | Giant Bats | 240 |
| 7 | Old Grumm | an old grudge | veterancy, promotions | Halberdiers | Ogre Brute (veteran) | 300 |
| 8 | The Marches | the border itself | the full Compact: opening offer, blind from round 1 | (all) | (all) | 400 |

### 1. Hands Off
- **Dispute.** A goat wandered across the border at Millbrook. Both sides claim it.
- **Page 1 (the Compact).** "Choose your champions. Place them. When the horn sounds, no hand may touch the Field."
- **Kit.** A fixed 400 supply, Knights and Longbows. **The goblin army is already placed and visible** ("the
  challenger deploys first"), the only time the player gets a full look.
- **Punch.** Three Grunt mobs charge. Longbows one-shot grunts; Knights hold the charge.
- **Teaches.** Steel in front, arrows behind. Then the horn sounds and you let go.
- Sergeant: "Boring wins. Write that down."

### 2. The Appeal
- **Dispute.** The goblins appeal the goat. Under the Compact a loss can be appealed once, as a longer match: rounds
  and HP, explained in-world.
- **Page 2.** "What is placed stays placed. You will see what they fielded, never what they will add."
- **Punch.** Round 1 is all grunts. In round 2 the Boss adds Skirmishers on whichever flank your locked line left
  thin, shooting from behind a grunt screen.
- **Teaches.** Armies persist and lock. Read their last army, guess their answer, add yours. Unspent supply carries
  over. Winning margins become HP damage.

### 3. Two Keeps
- **Dispute.** A goblin painted something rude on the West Keep.
- **Page 3.** "Every Field has two Keeps. If one falls, the whole army loses its nerve."
- **Punch.** Round 2: Wolf Riders run around the line and topple a Keep. The whole army is Dazed and the main fight
  collapses.
- **Teaches.** Towers, collapse Daze, covering flanks. Tower levels are insurance against raids.
- **Commendation.** No Keep falls.

### 4. Under the Bridge
- **Dispute.** The goblins have adopted the troll under the toll bridge and claim its toll.
- **Page 4.** "The armory holds more than the book's first pages. Each new engine costs the Treasury once per Field."
- **Punch.** A Troll walks through Knights and regenerates between hits.
- **Teaches.** Unlocks are a one-time cost per match. The Ballista hunts the biggest target, and big things need
  specialists. A light seed: Burning stops the troll healing (Fire Arrows comes in mission 5).

### 5. Plain Steel
- **Dispute.** The Tinker (first appearance) accuses the Wardens of stealing the wheelbarrow. Archivist: "We have had
  wheelbarrows for four hundred and twelve years."
- **Page 5.** "A drill improves every squad that knows it, even those already on the Field."
- **Punch.** The Tinker's gadgets: Scrap Armor Grunts take two arrows, and Troll Berserk. The Tinker announces odds for
  each one, all wrong.
- **Teaches.** Upgrades apply to every squad, including locked ones. You can see the enemy's upgrades. Counter-upgrades
  (Volley against armored grunts). The Cleric is nearly nothing without its prayers, so it's the unit that sells
  upgrades.

### 6. Look Up
- **Dispute.** "The Compact draws borders on the ground. The goblins have noticed."
- **Page 6.** "Knights cannot strike what flies. Know which of your champions can."
- **Punch.** Giant Bats fly over the line and eat the Longbows.
- **Teaches.** Two layers. Longbows, Ballista and Griffons hit air; Knights, Halberdiers and Trolls don't. Skyhunters
  is the counter-upgrade. Griffons are fast and good against bats, but weak against massed arrows and skirmishers.

### 7. Old Grumm
- **Dispute.** Thirty years ago, at a Field match, Old Grumm ate the Sergeant's helmet.
- **Page 7.** The pikes page. Archivist: "No one has turned to it in two hundred years. There was nothing large
  enough to need it."
- **Punch.** Grumm, a Lv3 Ogre Warboss summoning grunts, plus Wolf Riders. Grumm is the player's first look at a
  veteran.
- **Teaches.** Veterancy: squads that deal damage earn levels, and you pay to promote them. The answer to a legend is
  a cheap specialist: Halberdiers (×1.75 vs large and cavalry, Pike Wall against melee). Seed for Campaign 2: Pike Wall
  makes stabbing goblins kill themselves.

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
outside it (Skirmisher archers, a rock-throwing Troll). The rigid, predictable Wardens AI (Medium, playing by the book) becomes the
thing to exploit. "Lads, they had pointy sticks and we had nothing. So I made a bigger thing": the bigger thing is the
Troll's deferred fourth upgrade, ***Boulder Toss***. The troll throws rocks from about 3 tiles instead of punching, so
it never touches the pikes. That's another short-range attack, which the owner wants. Alternative: a new goblin siege
unit. The upgrade is cheaper and fits the four-upgrade model.

**The fire arc.** The Tinker's line is split across three missions: "Fire's hot." / "Fire's also free." / "Point it
at THEM." Goblins who go out in a blaze get cheered, not mourned.

| # | Mission | Opponent | New for the player | Goblin unit / upgrade |
|---|---|---|---|---|
| 1 | Pointy Sticks | the Marshal (Wardens M8 replayed) | win by toppling a Keep, not by beating the army | Grunts, Wolves, Troll, Ogre |
| 2 | A Bigger Thing | Marshal | shoot, don't stab: short range against Pike Wall | Skirmishers, Troll *Boulder Toss* |
| 3 | The Gang | Marshal | chaff and screening; numbers absorb the losses | Grunt *Party Time*, Ogre Warboss summons and Thick Skull |
| 4 | Both Keeps | Marshal | tempo: a double Keep raid against a rigid army; first statuses you wield (Dazed) | Giant Bats (*Shriek*) |
| 5 | Snobs | elementals | statuses from the receiving end; splash punishes clumps; anti-air against Wisps and Air | Skirmisher archers turn to the sky |
| 6 | Fire's Hot | elementals | your own fire burns your own gang (friendly fire) | Skirmisher *Improvised Bombs* |
| 7 | Fire's Free | elementals | the first surface: dead grunts leave oil; Oiled → Ignite | Grunt *Oil Bombs* |
| 8 | Point It at Them | elementals (fire-heavy) | steer *their* fire: oil under their line, their fireballs light it | everything |

Notes:
- **Mission 1** replays the Wardens finale from the losing side, as `PROMPT.md` suggests. A head-on win is near
  impossible, but **the win condition is a fallen Keep**, so the first goblin lesson is the goblin way to win. The
  Boss watches the replay and points at things.
- **Mission 4** is the revenge payoff. Both Keeps fall, the Warden army is Dazed, and the gang pours in. The Marshal:
  "That isn't in the book." The Archivist starts writing.
- **Mission 8** works because statuses and surfaces are neutral: the elementals' own Burning and Wildfire hurt
  elementals. In the replay, a young fire elemental's fireball sets off the oil under its own friends. That shot opens
  Campaign 3.
- **Risk and reward**: the Tinker gives odds on every upgrade (always wrong). Upgrades that cost the goblins
  something (Scrap Armor's slowdown, Improvised Bombs' friendly fire, Oil Bombs only paying out on death) are the
  material.

### Reflection after two campaigns

The Wardens campaign was easy to design because the basics already exist and come in a natural order. Each goblin unit
is also a clean punch for one Warden answer. The goblin campaign was easy on story, harder on mechanics:

- **It depends on unbuilt pieces:** Skirmishers, Oil Bombs, Improvised Bombs, Boulder Toss, Party Time, and the reworked
  Ogre and Bats. Most of Act 2 rests on Oil Bombs working well. That's a surface from an upgrade, so it's inside the
  complexity budget.
- **It relies on towers mattering more than they do today.** Playtest §2.9: Keeps mostly fall once the army is already
  losing. "Win by raiding" needs raids to swing fights. That's tuning, not a redesign, but it has to be done.
- **The fire arc requires friendly fire to be readable.** The battle report already counts friendly fire; the field
  probably needs a clearer "that was your own fire" cue.
- **Goblin anti-air is settled** (Skirmisher archers), so anti-air isn't the Tinker's invention against the
  elementals. The fire arc takes that role, and it's the stronger story anyway.

It was still fairly easy, so here is the elemental structure.

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
| 4 | Water and Fire | goblins | first reactions: Douse, Evaporate, Steam; water puts out goblin oil fires; healing (Wellspring) |
| 5 | The Wall | Marshal | resistances: Warded Plate shrugs elements; Frost → Freeze → Shatter needs a physical partner |
| 6 | Wet Ground | Marshal | the combo pair: Wet + lightning = Conduct; chain lightning in tight ranks |
| 7 | The Field Is a Weapon | Marshal | surfaces you choose: Tidal Surge puddles, electrified water spreading, keeping your own units out |
| 8 | The Storm | Marshal (tight shield wall) | the full combo field on a shield wall: hard to do, the most beautiful thing on the board |

**Epilogue (playable, Wardens).** *Against Storms, Spread Out.* A short mission with one new Warden drill that grants
`spacing`, which no unit uses today. Then the scoreboard scene: "Same time next season?" The Goblin says yes at once,
the Warden checks the calendar, the Elemental pauses, then says yes. This unlocks skirmish with the full roster, the
opening offer and the three AI difficulties.

### Elemental redesign needed for the story (suggestions)

- **The friendly-fire cost has to be visible at base.** Ember's fear only works if unupgraded fire visibly burns
  neighbors. Controlled Burn then becomes the turning point, not a stat line.
- **The Storm has to beat a shield wall.** Playtest §3: Elementals lose 0% to the Wardens today. Water is too weak to be
  worth fielding and Conduct isn't strong enough. Make Water + Air the headline pair: Water worth fielding at base,
  Conduct strong against clumped targets. Wardens' Warded Plate stays the counterpunch, so the mission-8 AI should buy
  it and force a second answer.
- **A cheap front line** (playtest §7). A careful faction needs something to stand in front. Stone Golem is weak at
  base; fold in some of Granite, or add a cheaper body.
- **Frost** is the weakest unit tested. One story-friendly direction: "the careful one". Chill and freeze as
  protection that holds enemies away from allies, rather than a setup for shatter.
- **Wardens epilogue drill.** "Against storms, spread out" fits as a **faction doctrine** (DESIGN §8 faction bonuses,
  not built yet). Wardens doctrines could literally be drill pages: pick one per match. That gives faction bonuses a
  story and an interface.
- **Independents** (Giant, Dragon) aren't used. The Troll is already moving to the goblins. The Dragon could appear as
  the Compact's referee in cutscenes, or get cut.

### Final reflection

- The structure holds up because each faction's weakness is the flip side of its strength, which `PROMPT.md` already
  states: the Wardens are rigid, the goblins are reckless with fire and numbers, the elementals are dangerous to each
  other. Each campaign's lessons come out of that, not out of a checklist.
- **Two balance targets, kept apart** (playtest §3): campaign edges come from authored kits and enemies. Skirmish
  balance aims for the tied standings of the epilogue. The campaign doesn't need the open roster to be lopsided.
- **The biggest risk is the elementals**, because their campaign depends on combos that don't work well enough today.
  Their redesign should start early, even though their campaign comes last.

## 5. Parked ideas

These ideas are kept on purpose. Don't drop them when the plan changes.

- **The player's winning board becomes the Drill Book's last page** (Wardens mission 8). Record the player's army from
  the finale's deciding round and draw it as a formation diagram: "Page 9, in the Marshal's hand." The owner called it
  "genius" but doesn't want to work out stored progress yet. The site stores nothing, so the page can only be shown
  at the end of that session's finale. Keeping it, and letting later campaigns refer back to it (for example the
  goblin campaign opening against *your* page-9 army), needs a storage decision first. The same storage would also
  let the goblin opener replay the player's real finale instead of an authored one.

## 6. Plan of attack

1. **Owner decisions** (§7).
2. **Goblin roster rework** per `UNIT_NOTES.md`, plus the Warden tweaks (Knights Veterans → shield, Longbow Skyhunters
   and Longshot). Campaign 1 needs every goblin unit.
3. **Mission framework.** A `MissionDef` in `src/data/campaign.ts`: per-side HP, unit and upgrade pools, towers,
   veterancy and opening on or off, a win condition (standard or "topple a Keep"), and an enemy plan: scripted rounds,
   then the AI limited to a pool with a personality. Also a briefing and debrief view with the book page, and a
   mission list in the Story tab, which already lists the campaigns from `src/data/campaign.ts` (no storage). The sim
   stays untouched; this is match setup plus UI. Add `npm run playtest -- --mission N` so missions can be tested
   headlessly.
4. **Build missions 1–3 first** and playtest them as onboarding. If they work, they can replace How to Play.
5. Missions 4–8, then the replay-opener tech for Goblin mission 1 (an authored version of the Wardens finale, played
   from the other side, since nothing is stored between missions).
6. Goblin campaign. Start the elemental redesign at the same time, then build the elemental campaign.

## 7. Open questions for the owner

Decided: Skirmishers are goblin archers that hit air; the mission list is open with no stored progress.

1. **Halberdiers in mission 7 or 8?** Mission 7 gives the player a mission to learn pikes before the finale
   (recommended). Mission 8 is more dramatic but untested.
2. **The bigger thing:** a Troll upgrade (*Boulder Toss*) or a new goblin siege unit?
3. **Who the goblin player is:** the Boss (recommended, with the Tinker advising), or a new goblin?
4. **The Dragon and the Giant:** cameo, referee or cut?
