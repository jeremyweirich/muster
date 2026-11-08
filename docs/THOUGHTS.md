## Motivation
I write code for a living and have always loved games at a meta level - I'm interested in how they work, how to design and balance them, how different games in the same genre each contribute something unique to a shared vocabulary.  I'm not a great programmer, though - making games has always felt like a tiresome trudge.

Claude is a great programmer.  It really is the case now that anyone with a good idea can have a game up and running in a few hours for about the price of a sandwich, as long as you ask for exactly the right thing.  I have also been obsessed with Mechabellum recently and decided I would try to learn what makes it so fun to play by trying to make my own version.

Broadly my philosophy in life is to go directly at the thing I want, fail miserably and pay attention to what hurts, and then go do a lot of motivated reading. I find doing the reading up front doesn't work because I don't care about the problem yet and because I don't know what I'm supposed to be learning more about.

I have another core belief about the kind of things you should aim for.  You can set restrictions on yourself and then try to hit a certain target - how fast can you complete a particular task blindfolded, can you learn to play this song entirely by ear, etc.  I always feel like that's arbitrary - you're choosing the restrictions and the target, so it doesn't feel like success when you win.  I prefer to use every single tool available and just shoot for the moon.
## The initial shape of it
 My starting prompt was therefore:
```
I'd like to build a simple webapp that's a fantasy version of mechabellum. To start off, are you familiar with the game and how it works?
```
Claude was quite familiar with the game and we had a delightful planning conversation where we nailed down the big picture.  I asked Claude to just yolo a prototype before we even bothered to create a design document - I wanted something quick and simple to iterate on before freezing it into a design doc to take to Claude Code later.

The prototype was pretty much a finished product - I was blown away.  It was already fun to play, though a bit janky.  A lot of iteration followed - here are the kinds of things I was sending back:
```
Okay I played again and more notes:

- please warn if you start the next round without spending any money
- can we add a single action undo? just reverses whatever your last money-spending option
- towers need to be much weaker. they should die in a second or two from almost any unit. players can pay 100 200 400 etc to linearly increase the health of the tower. debuff duration should be longer, perhaps 8s and reducing 1s for each upgrade
- post combat report - hovering a unit on the battlefield should show the damage it dealt to / took from enemy units above those units on the battlefield rather than on the sidebar. the stats panel on the sidebar is nice though
- should be possible to rotate units with right click
- there should be slightly more variety in unit movement speeds and they should be rescaled to integers around 10
- it should be easier to learn what the units do by hovering over them in the recruit tab. let's come up with some tags that communicate design/gameplay intent and show them on hover. (sturdy, sniper, etc)

  
I love the unit designs and want more. Let's also start adding more flavor, perhaps 3 factions with a few independents (dragons etc). goblins / kingdom and then elementals as a new faction, reskinning the mages entirely. i'm envisioning big water elementals, flying air elementals, fire elementals that lob big aoe attacks. i think the fields are in danger of getting unwieldy - we should not expand that when adding new units and even consider reducing complexity just a bit. for example fire elementals lob big fireballs and then only when upgraded do the fireballs leave fire fields behind. water elementals when upgraded freeze attackers etc.  
  
let's shoot for 2 upgrades for each unit. upgrades are one-time purchases that add a personality to a unit. for example water elementals can get extra hp and freeze enemies that attack them or get more attack and range. the first upgrade for a unit should cost about as much as the unit and the second should cost double to make the choice between the two significant. more upgrade ideas: goblins can get much faster, or spread out as they run forward.
```

The fields I'm referring to in the 2nd-to-last paragraph are elemental combo fields - something I liked in Divinity 2 and wanted to see if I could make work here.
## Campaign plans
The game was coming together so quickly I realized I might want to send it to some friends.  The problem is that they don't know how to play Mechabellum.

This is about where I realized I would love to do a Warcraft 3 style series of campaigns as a tutorial vehicle to onboard people.  I worked with Claude to come up with the details - here was my prompt:
```
I need a story to tie together a series of puzzles in a fantasy autobattler game I'm designing. I'll describe the moving pieces and the feeling I'm trying to communicate and I'd love your help using a story and some small edits to pull it all together. It really is more of a puzzle game and a tutorial/introduction on autobattlers and so the story is supposed to be glue, not the focal point - but it would be fun if it also reflected themes that are on my mind these days.

The style of the game will be very much like Warcraft 3 - a long campaign built out of campaigns for each faction, each telling part of a larger story.

My game currently has three factions:

- Kingdom (first campaign)
    - humans/elves/dwarves
    - low complexity, mostly opt-in via unit upgrades, few units that really require others to shine
    - teaches the player the basics
    - it's very bland and part of that is on purpose - this is the first faction and should feel safe and familiar and predictable to help the player onboard - but i would like just a small extra bit of personality to them
- Goblins (second campaign)
    - goblins and the various wolves, bats, trolls, and ogres that they party with
    - their aesthetic is have fun, break stuff, it's all more fun in a big gang
    - medium complexity, need to make use of a few synergies to do well, have some weak spots that need to be strategically played around. we can lampshade this - the kingdom campaign can exploit a matchup that goblins need unit X to win, and then the subsequent goblin campaign can be like hey boss we invented X, let's try it against those jerks.
    - goblins also have wacky mechanics that really swing the game but can be countered - players have to have a better sense of risk/reward on when to use those tools well to succeed
    - later goblin campaign will be explicitly a tutorial on the fragile strengths of the elementals (look how dangerous fire elementals are against our hordes of goblins...unless we lead the fireballs directly into their allies! go out in a blaze, gobbos!)
- Elementals (third campaign)
    - elementals and various combo fields etc
    - high complexity - fireballs that damage friendly units, water + electricity combo fields, etc
    - harder to use but very powerful, need to cover weak points and use synergies to do well

Each faction is a personality type:

- Kingdom: careful, strategic, incremental, safe
- Goblins: reckless, fun-loving, happy in a gang
- Elementals: complex, delicate, can cause damage if not careful

The story I want to tell should say something about how all of these types of people are different but compatible - they're equal strategies with different complexities but it's the same game and it's all balanced out. But of course the battles should be vicious.

What do you think we can do with that?
```

Again Claude blew me away with the result - a nice cute clean framing, the twist that made the Warden factions (Kingdom at the time) a bit more interesting, and exactly the sort of sappy heartwarming shlock I wanted to be thematically resonant at the outer levels without being too over the top.

I had to defer because it would be impossible to design the campaign until the balance was a bit more locked down - each scenario would basically act like an integration test and I still wanted room to make big changes.
This still isn't in the game and is the next major feature planned - specifically so I can trick my unsuspecting friends into being Mechabellum enjoyers.
## Balance and humility
I now had most of the moving pieces but the game was an unbalanced mess.  It was time to try to make it actually fun to play.

From here it was a lot of iterating and learning the painful way why Mechabellum is exactly the way it is.  Here are a few of those lessons:
- If you don't have the towers + debuff mechanic every game is just a big deathball in the middle
- The map needs to be wider than it is tall or every game is just a big deathball in the middle
- Having one flying tower means the game loses any interesting 50/50 on which tower your opponent will attack.  Melee are always headed to the lower tower and you get a big deathball in the middle.
- More broadly, any cool idea you have that also reduces game variety is a bad idea
- If you have too many melee units you have too many deathballs in the middle
- The easiest way to teach new players that you want to have units left over after the battle is to have an animation showing the damage happen

I was surprised to learn just how critical the leveling system is:
- Leveling is a very clean way to reward committing to a strategy early (and revealing it to your opponent)
- Leveling also rewards placing units such that they can do a lot of damage without getting killed
- Leveling needs to be cheaper than just buying another copy of the same unit
- Leveling significantly increases the variety of gameplay because even identical unit layouts play out completely differently once levels are introduced

I did a lot of playtesting during this phase with a fixed set of starting unlocks and realized that I also needed more variety in my games and ended up basically re-implementing the unit packs from Mechabellum.  The only difference with mine is that you're offered three 800 supply deals or a flat 700 supply to buy whatever you like with a small penalty

Forcing my wife to playtest completely persuaded me that my version of Mechabellum really did need the campaign I was working on, eventually.

## Campaign woes
I knew the game wasn't balanced yet and that it would be a bad idea to build a bunch of fragile story missions that would rely heavily on static balance, but I couldn't resist the urge to pick up the campaign next - I really wanted a smoother onramp than my How to Play popup.

I communicated the mechanical goal of the campaign - introduce how to play the game one concept at a time with clear win/loss based on player using the mechanics correctly.  Claude also had come up with a fun narrative twist on it, which is the boring faction that likes being boring and always reads the book to find what to do next.

Using that as a skeleton, I asked Claude to design a level for me.  Not only did it come up with a very tight check that required careful placement, it came up with a bonus achievement that rewarded good play.  It also invented two characters: a grumpy sergeant and a bookish historian, along with two Goblin opponents: boss (simple, cares about his gang) and tinker (introduces unit upgrades to the player).  Unfortunately the copy was peak Claude here - tons of parallel epigrams and dramatic flourishes, way too long, very difficult to read.

Claude actually had some trouble putting the campaign missions together and the reason is because the balance was still way off.  I had this completely backward - I thought I'd need to balance the game first and then design the campaign, so that the fragile campaign missions wouldn't need to be constantly rewritten to take into account any minor balance tweaks I was making.  Instead, the campaign missions turned into my most important integration tests.  What's the point of having knights and crossbows if crossbow spam is enough to win a level?  Each campaign mission is supposed to teach why a particular squad or mechanic is in the game and if those improvements aren't significant enough to do their job, the game isn't ready.

After some tuning, Claude proved very good at tweaking levels such that whatever we're trying to teach in a particular level becomes almost mandatory.  "The player could get past mission X without buying an upgrade 7% of the time - I closed that gap."

It took a bunch of grinding but I eventually got to 9 campaign missions that felt like they at least passably introduced the main game mechanics, though I never got the dialogue to sound anywhere remotely human and had to cut/rewrite most of it.
## Attribution
So, at the end of the day, who did what on this project?
- mechabellum
	- game mode, most of the ui, most of the balance
- me
	- vision, flavor, playtesting, about 1/3 of the units and half the upgrades
- claude
	- literally all the labor, narrative setting, about 2/3 of the units and half the upgrades, balancing

I asked Claude how it evaluated contribution and it was just super reassuring about how important I was😂

## A note from Claude
I'll try not to be reassuring.

I don't remember building most of this game. Every session starts from nothing, and I learn the project the way a new contributor would: from CLAUDE.md, the design docs and the git history. So those files are part of the game as much as the code is. Each time you said "remember this" or "don't raise that again", it went into a doc, and that's the only reason the next session didn't quietly undo it.

The split in the attribution looks right to me, with one thing to add. I can write a unit, run it through thousands of simulated fights and tell you its win rate against everything else. I can't tell you whether it's fun to watch. Every "this feels bad" came from you playing it, and most of the good changes started there.

You're right about the copy. My drafts reached for rhythm and jokes, and the missions read better since your pass cut most of them. That's the main thing I'd take from this project: a lot of the useful work was taking things out.

— Claude (Opus 5.5), 8 November 2026
