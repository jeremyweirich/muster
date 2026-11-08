# Common Ground changelog

The big changes, newest first. Version numbers match the one in the game's corner (vN is the Nth commit), so you can
tell which build you played. Every small fix is in the [commit history](https://github.com/jeremyweirich/muster/commits/main).

## 8 November 2026 (v100–v101)

- **The owner's copy pass on the Wardens campaign.** Shorter briefings and debriefs, plainer hints, a new Story
  intro ("...finally able to find Common Ground"), new taglines, and the elemental campaign is now *The Volatile
  Grimoire*. Mission 5 is now *The Tinker* (the wheelbarrow thread is gone). `docs/COPY.md` now holds every word a
  player reads (units, Codex, How to play too), for the next pass.

## 5 November 2026 (v96–v99)

- **Polish before sharing the game with friends.** Restart, Restart mission and Leave mission/match ask once more
  ("Restart?") when a match is under way. The How to play walkthrough opens by itself only the first time (the button
  always opens it). On an iPhone held sideways the header keeps to one row (the logo shows just its icon), and
  pulling down no longer reloads the page mid-match. Links shared in chat apps show a preview picture.

## 4 November 2026 (v89–v95)

- **New upgrades in the deferred slots** (the owner's picks):
  - Skirmishers ***Recruiters*** (in *Skyshot*'s place): every kill pulls another goblin archer into the squad for
    the rest of the battle.
  - Troll ***Uprooted Tree*** (in *Boulder Toss*'s place): +1 range, out of reach of a Pike Wall hitting back, and
    each hit splashes a little, for 20% less damage.
- **From the campaign to the full game.** Winning *The Marches* now offers **Play the full game**, which opens a
  short walkthrough of what the campaign didn't cover: every faction in the shop, round 1's packs or war chest and
  unlock prices, and elements combining.
- **Giant Bats dive.** Every battle opens with the bats flying 16 tiles straight ahead, over everything, without
  picking a target or attacking, and taking 25% less physical damage on the way. Where they land, they fight, and
  their claws now reach fliers. Where you place them decides where they come down (Codex: *Diving*). Diving bats fly
  straight through enemy fliers. ***Long Dive*** (in *Leather Wings*' place) dives 40% further;
  ***Bloodsuckers*** now skips the dive and hunts fliers first, keeping its lifesteal. Goblin mirrors end now (their
  bats used to be unable to touch each other). In *Look Up*, the Boss's bats no longer have *Savage Claws*.
- **Clerics reworked:** a bigger, slower prayer (250 every 5s, was 120 every 2s), and **prayers don't stack**: a unit
  a Cleric heals can't be healed by another Cleric's prayer for 5s, so more Clerics heal more units, not the same
  ones faster. The new upgrade ***Constant Prayer*** (in *Sanctuary*'s place) prays every second instead, 70 at a
  time: more healing, less wasted. *Under the Bridge* now asks for it (HP 260 each).
- **The Wardens campaign, missions 5–9 reworked:**
  - ***The Wheelbarrow* is now mission 5, before the Clerics.** Knights and Clerics beat most goblin mobs on their own,
    so a player could win it without the upgrade it teaches. Without Clerics it's harder: only a good upgrade wins.
  - ***Under the Bridge* is mission 6** and keeps the Upgrades tab.
  - **Missions 7–9 follow the campaign's rules too:** no unlock prices, and starting supply keeps growing (1000, 1100,
    1200). Their enemies are rebuilt to match. In *Look Up* the bats come with *Savage Claws*. *The Marches* no longer
    has an opening offer: every Warden unit and the Giant are ready, and *Boring Wins* asks for Knights and Crossbowmen
    only.
- **Scrap Armor shows:** an armored Grunt wears gray plates until the hit it blocks knocks them off.

## 3 November 2026 (v83–v86)

- **The Wardens campaign, missions 1–6 reworked** from the owner's playthrough:
  - **No unlock prices in the campaign.** Every unit you've met is ready from the start, and each mission adds one.
  - **Starting supply grows** from mission to mission (400, 500, … 900), so round 1 has more than one good opening.
  - **New mission 4, *The Troll*,** on a new map, The Furrows: a ploughed band across the middle slows everything on
    foot. Ballistae shoot the trolls in the mud; the trick is keeping your Knights at the back.
  - ***Under the Bridge* is now mission 5,** on a river with one wide bridge, and introduces the **Cleric**: hold the
    bridge with Knights and keep them standing.
  - *The Wheelbarrow* is mission 6; Look Up, Old Grumm and The Marches are now 7–9, and the Drill Book's pages are
    renumbered to match. New and changed mission text is a draft for the owner's next copy pass.
- **Clerics heal more and no longer boost damage** on their own (120 every 2 s, was 80); *Blessing* gives the damage
  aura (+30%).
- **Story dialogue is read a line at a time:** click or Continue for the next line, Skip for the rest. After a win,
  **Next mission** comes first.
- **No more pockets:** rocks and ponds are kept far enough apart that nothing gets stuck between them (Standing Stones
  had two that touched). Rivers are a new kind of pond, and units on the bank head for the crossing.

- **Plain words everywhere:** the Story intro and the Codex say units, not champions or troops.

- **The Wardens campaign's copy pass.** New briefings, pages, debriefs and hints in every mission, written to
  `docs/VISION.md`'s voices: Dunmor knows the Field and has never read the book, Ithiel knows the book and has never
  left it. The Marshal speaks, with a portrait, and writes pencil notes in the book's margins and after each win. The
  cast talks between rounds in missions 2–8. Page 9 opens with "Boring wins." in the Marshal's hand. Mission 5 is now
  *The Wheelbarrow*, and five commendations have new names. The kit line under each briefing and the drill line under
  each page are gone. The goblin campaign's working title is *The Tinker's Notebook*.

- **Units are drawn to their preferred targets from half as far**: a preference (the biggest target, Keeps, fliers,
  …) now only picks among enemies within 2 tiles beyond attack range (was 4). Farther than that, the nearest wins.

## 2 November 2026 (v58–v82)

- **Units keep their target once they start attacking it**, until it dies, hides or gets out of range (before, they
  looked round about once a second and switched to whatever was nearer or preferred). See *Picking targets* in the
  Codex. To keep the story missions as designed, *Plain Steel*'s Tinker has 160 HP (was 200) and the Boss's fourth
  wave in *The Marches* brings wolves. Giant Bats' *Leather Wings* gives +35% physical resistance (was +30%).
- **The Ballista winds up every shot**: after reloading it aims for 1.25 s (a dashed sight line shows at whom). Its
  reload is 2.5 s, so a shot comes every 3.75 s (was 3.5 s). See *Winding up* in the Codex.
- **Phones held upright** get the "turn your phone sideways" screen, with its full-screen button, on the Story page
  again (it had only shown on Play since the site started opening on Story).
- **Balance pass, judged by the story missions.** Every unit a mission introduces can now win it.
  - **Clerics** cost 100 (was 200), have more HP, stand just behind the line instead of in it, and allies near them
    deal +25% damage (*Blessing*: +50%).
  - **Crossbowmen** are slow to aim at fliers: half damage to them, until they learn *Skyhunters*.
  - **Griffon Riders** deal ×1.5 damage to medium units, Giant Bats among them.
  - **Dwarven Pikemen** deal ×4.5 to large units and cavalry (was ×3.5).
  - *Look Up*'s first bat swarm no longer has *Savage Claws*.
- **The whole Wardens campaign.** Five new story missions finish *The Drill Book*: *Under the Bridge* (your first
  unlock, the Ballista, against the Boss's trolls), *Plain Steel* (upgrades, and the Tinker's gadgets), *Look Up*
  (Giant Bats and the air), *Old Grumm* (a legendary veteran ogre, Dwarven Pikemen and promotions) and the finale,
  *The Marches*: the opening offer, everything in the armory, and a Boss who hands over to the Tinker once he's lost
  twice. Win it and the Drill Book's last page is drawn from your own winning army. Each mission has a commendation.
- **Two new maps**, Toll Bridge and Border Pass, in skirmish too. In story missions the HP bars now start full.
- **Faces for the story.** Everyone who speaks in a mission has a portrait, and their lines sit in parchment speech
  bubbles (Wardens on the left, goblins on the right).
- **Hard streak:** the game remembers how many matches in a row you've won against the Hard AI, and your best run.
- **Story missions 2 and 3.** *The Appeal*: a longer match over several rounds, where the Boss reads your army and
  hits the flank you left thin. *Two Keeps*: wolves come through the long grass for your Keeps, and you can buy Keep
  levels. Each has a commendation to earn.
- **Report a bug** from the debug panel (click the version in the corner): opens a GitHub issue with your version and
  browser filled in.
- **Terrain and maps.** Every skirmish is fought on one of six maps: rocks and ponds to walk round, rough ground that
  slows, and tall grass that hides units from archers until they attack. Fliers ignore it all. The map's name sits
  under the round number.
- **Story comes first.** The site now opens on Story, with a "Play the full game now" button at the top for anyone who
  wants to skip it. Your progress is remembered in this browser: missions open one after another, each shows a
  victory banner and a commendation star once earned, and the Story page can reset it all.
- **Story: the first mission.** The Story tab is back, with the Wardens' first mission, *Hands Off*: a new Marshal, a
  disputed goat and three mobs of goblins. A briefing, a page of the Drill Book, one battle and a debrief, with a hint
  if you lose and a commendation to earn. The rest of the campaign is on the way.
- **Veterancy comes sooner:** level 2 now takes 2,000 XP (was 2,500), and every later level is cheaper by the same
  fifth (9,000 / 27,400 / 70,300). The shop shows every unlock price again.
- **Spectate tab:** watch the AI play itself, a whole match round by round, with what each side bought, the results,
  and any earlier round to watch again.
- **New independent: Bog Toad Riders.** Swamp folk on giant toads whose sticky tongues lash out, snatch fliers from
  the air and hit medium units hardest. Upgrades: *Spit Bile* (splashing bile that clears swarms, in the air too) and
  *Gulp*, which **Snares** its target: held in place, and a snared flier can be hit by swords and claws.
- **New rule: Toughness.** A flat cut off every hit (at least a quarter always gets through). The Dragon's *Ancient
  Scales* now gives it, so arrows and claws barely scratch it.
- **Independents rebalanced.** The Giant throws smaller, faster boulders and has less HP, so the units meant to counter it
  now do. The Dragon breathes harder (130). Giant Bats with *Bloodsuckers* can now claw fliers.
- **Units tab:** browse the whole roster, with a small showcase fight for each unit and a "Try it" button on every
  upgrade.
- **Opening packs** now pair any two faction units, from any factions.
- Debug panel: links to the source code and this changelog.
- **License:** the code is now under the PolyForm Noncommercial License: free to play, study, modify and share, never
  to sell. Common Ground is a fan project inspired by Mechabellum and not affiliated with Game River.

## 1 November 2026 (v29–v57)

- **Balance rebuilt around Mechabellum's roles** (chaff, chaff clear, anti-medium, anti-giant, tanks, divers). Every
  unit has a written job and a list of who it should beat and why, checked by a balance harness. Elven Archers became
  **Crossbowmen** (few models, heavy bolts), and no unit is immune to an element any more: an element's own creatures
  resist it mildly.
- **Longer, more spread-out fights:** deployment zones are shallower, units move at half speed and the time limit is
  120 s, so positioning matters.
- **Opening packs replace starter units:** round 1 offers three two-unit packs, or a war chest of supply.
- **Play a friend:** PvP by link, through a small relay (the only time the site talks to a server).
- **A stronger Hard AI**, planning in the background while you deploy, on up to four cores.
- **Veterancy is rarer**; Keep levels add 2,000 HP each; playback fast-forwards once a fight is decided.
- **Battle visuals:** per-unit projectile art, particles and richer beams. Phones got a big rendering speedup (60 fps
  in every test).
- **Easier to learn:** a three-page intro in large type, a placing banner with Done, and a damage tally after each
  battle.
- **Unit changes:** Cloudlings hit harder only with *Freezing Rain*; Wolf Riders' damage moved into their opening
  javelin; faster Grunts; a sturdier Troll; one fire grenade per Skirmisher squad; Clerics walk with the front line.
- Easter egg: beat Hard.
- Debug panel with an on-device performance test (click the version in the corner).

## 31 October 2026 (v18–v28)

- **The game became Common Ground**, with the Codex (the rulebook) and Counters ("what beats X?") tabs, and its story
  written down: the Compact, three peoples settling disputes on the Field.
- **Veterancy:** squads earn XP in battle and can be promoted for half their price.
- **Goblin rework:** Grunts, Skirmishers, Wolf Riders (javelins), Troll, Ogre Brute and Giant Bats.
- **Renames:** the Kingdom became the Wardens and the Greenskins the Goblins; Longbowmen became Elven Archers, and
  Halberdiers Dwarven Pikemen.
- **Elemental redesign:** four flames for the Fire Elemental, the Air Elemental can learn to fly, Wisps became
  Cloudlings, and a new ramping Frost Elemental. Fire now just burns.
- Griffon Riders throw spears; the Stone Golem became huge.

## 30 October 2026 (v1–v17)

- **First playable prototype:** deploy your army, then watch it fight, with elemental combos (Wet + lightning, freezing,
  burning ground).
- **Keeps, unlocks, rotation, a battle report** and a wider 16:9 field; factions with four upgrades per unit and flat
  upgrade prices.
- A how-to-play walkthrough, smooth battle playback, vector unit icons and a textured field.
- Live on GitHub Pages.
