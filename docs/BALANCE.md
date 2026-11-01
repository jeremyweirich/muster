The fastest route to a working design is to make balance something you can measure. Write the relationships down as targets, express every unit in the same cost-normalized terms, and run automated equal-cost fights so each tweak gives you a number back.

1. Write the relationship table in words before choosing numbers

Before setting any stats, decide what the knight is for and what it must lose to:

Role: frontline damage sponge with short range that wins by reaching the enemy and staying alive.
Beats: light melee and chaff that walks into it, short-range DPS units, and backline units once it reaches them.
Loses to: high single-target or anti-armor DPS (Marksman/Arclight-style), kiting units with long range, and possibly air if it can’t hit air.
Neutral: other frontliners, where the fight is mostly decided by support.

Every number you pick afterward has to satisfy this table. When a playtest goes wrong, you check it against the table rather than against your gut.

2. One knob for health versus damage: “self-TTK”

Define self-TTK = HP ÷ own DPS, which is how long a unit takes to kill a copy of itself. This single ratio captures most of a unit’s role:

Role	Self-TTK (starting band)
Glass cannon / backline	4–8 s
Baseline line unit	8–12 s
Frontline tank (knight)	15–25 s
Pure wall / giant	30 s+

Tie these bands to how long you want combat to last. If a typical round’s fight runs about 40–60 seconds, a reasonable target is for the knight to survive roughly 30–50% of the fight under focused fire. That is long enough for the backline behind it to get real value, but short enough that it isn’t still standing at the end of every round.

3. Make everything comparable through cost

Compare units at equal cost, never one against one. For a group of units, its fighting strength is roughly:

Strength ≈ (total HP) × (total DPS)

This is Lanchester’s square law. It means that at equal cost, two units with the same HP × DPS product are roughly even in a flat, open slugfest. That gives you a baseline from which to measure everything that isn’t a raw stat:

Closing time. This is the knight’s real tax. If it has to cross distance d at speed v while the enemy outranges it, it takes about enemy DPS × (d/v) damage before it fights back. This term is usually what decides the knight’s matchups. Calculate it explicitly for every ranged matchup.
Overkill. Big, slow hits are wasted on small targets. This is why sledgehammer-style units can struggle against swarms unless they have splash damage.
Damage multipliers and armor. These are how you create hard counters without breaking the cost baseline.
Targeting rules and splash. These matter more than raw stats in large fights.

Here is a quick sanity check. Say a knight costs 200, has 4000 HP and 200 DPS, so its self-TTK is 20 seconds. It faces two ranged squads costing 100 each, with 1000 HP and 150 DPS apiece. On paper the knight wins: 4000 × 200 = 800k against 2000 × 300 = 600k. But if it needs 8 seconds to close the distance, it eats 2400 damage first, and now it loses. That outcome may be exactly what you want, but you should be choosing it on purpose.

4. Numeric targets for the relationship table

Pick tolerance bands and hold every matchup to them:

Mirror match: 50% win rate. If it isn’t, your simulator or randomness is biased.
Soft counter: the winner wins about 60–70% of the time, or keeps 20–40% of its cost alive.
Hard counter: the winner wins at 2–3× cost efficiency. For example, 100 supply of the counter beats 200–300 supply of the target.
Nothing should hard-counter everything, and every unit needs at least one hard counter.

Measure value retained: the cost of surviving units divided by starting cost. It is much more informative than win/loss because it tells you how much one side won by.

5. Benchmarks to automate

Build a headless sim harness that runs these fights in batches and writes the results to a spreadsheet. Run it after every stat change:

Equal-cost matchup matrix. Run every unit against every unit, many times each, with randomized formations. Record win rate and value retained. This is your main dashboard.
Scale test. Run the same matchups at 1×, 2×, and 4× cost. Swarm units and splash units scale very differently, so a knight that is fine at 200 supply may collapse at 800.
Closing-distance test. Have the knight start at various distances from ranged units and plot outcome against distance. You want a clear crossover point. Past that range the ranged unit wins, inside it the knight wins.
Composition test. Run knight plus a support unit against a counter plus a support unit. Frontliners are mostly judged by what they enable, not by solo fights.
Sensitivity test. Nudge each stat by ±10%. If a single 10% change flips a hard win into a hard loss, the matchup is brittle and players will feel it as swingy.
Upgrade and tech curve. Rerun the matrix at each upgrade level, since many balance problems only show up in the late game.
Nash check. Treat the matrix as a payoff table and solve for the equilibrium mix of units. If the solution puts weight on only two or three units, the rest are dominated. A healthy roster puts weight on many units.
6. Order of operations
Lock a neutral baseline unit at value 1.0 first, then define the knight relative to it.
Use the knight as your second anchor, since frontliners define what everything else must handle.
Add units one at a time and rerun the full matrix with each addition.
Only after the sim matrix looks right, run human playtests and track pick rate and win rate when picked. Humans find positional abuse that sims miss.