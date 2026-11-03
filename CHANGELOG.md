# Common Ground changelog

The big changes, newest first. Version numbers match the one in the game's corner (vN is the Nth commit), so you can
tell which build you played. Every small fix is in the [commit history](https://github.com/jeremyweirich/muster/commits/main).

## 2 November 2026 (v58–v79)

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
  unit has a written job and a list of who it should beat and why, checked by a balance harness.
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
