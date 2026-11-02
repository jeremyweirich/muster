# Balance method

How Common Ground is balanced. The fastest route to a working design is to make balance something we can measure:
write the relationships down as targets, express every unit in the same cost-normalized terms, and run automated
equal-cost fights so each tweak gives a number back. The targets live in `src/data/balance.ts`, the harness is
`npm run balance` (`scripts/balance.ts`), and `docs/BALANCE-PLAN.md` has where things stand. Mechabellum is the
reference game (`docs/MECHABELLUM.md`).

## 1. Write the relationship table in words before choosing numbers

Before setting any stats, decide what a unit is for and what it must lose to. For the Knights, our anchor:

- **Role:** frontline damage sponge with short range that wins by reaching the enemy and staying alive.
- **Beats:** light melee and chaff that walks into it, short-range DPS units, and backline units once it reaches them.
- **Loses to:** high single-target or anti-armor DPS (Marksman/Arclight-style), kiting units with long range, and
  possibly air if it can't hit air.
- **Neutral:** other frontliners, where the fight is mostly decided by support.

Every number picked afterward has to satisfy this table. When a playtest goes wrong, check it against the table, not
against your gut.

## 2. One knob for health versus damage: self-TTK

Self-TTK = HP ÷ own DPS: how long a unit takes to kill a copy of itself. This single ratio captures most of a unit's
role:

| Role | Self-TTK (starting band) |
|---|---|
| Glass cannon / backline | 4–8 s |
| Baseline line unit | 8–12 s |
| Frontline tank (Knights) | 15–25 s |
| Pure wall / giant | 30 s+ |

Tie these bands to how long combat should last. If a typical fight runs about 40–60 seconds, a reasonable target is
for the Knights to survive roughly 30–50% of the fight under focused fire: long enough for the backline behind them to
get real value, short enough that they aren't still standing at the end of every round.

## 3. Make everything comparable through cost

Compare units at equal cost, never one against one. For a group of units, fighting strength is roughly:

**Strength ≈ (total HP) × (total DPS)**

This is Lanchester's square law. At equal cost, two units with the same HP × DPS product are roughly even in a flat,
open slugfest. That gives a baseline from which to measure everything that isn't a raw stat:

- **Closing time.** This is a melee unit's real tax. If it has to cross distance d at speed v while the enemy
  outranges it, it takes about enemy DPS × (d/v) damage before it fights back. This term usually decides a melee
  unit's matchups, so calculate it explicitly for every ranged matchup.
- **Overkill.** Big, slow hits are wasted on small targets. This is why heavy hitters struggle against swarms unless
  they have splash.
- **Damage multipliers and armor.** These create hard counters without breaking the cost baseline.
- **Targeting rules and splash.** These matter more than raw stats in large fights.

A quick sanity check: say a Knight squad costs 200, has 4000 HP and 200 DPS, so its self-TTK is 20 s. It faces two
ranged squads costing 100 each, with 1000 HP and 150 DPS apiece. On paper the Knights win: 4000 × 200 = 800k against
2000 × 300 = 600k. But if they need 8 seconds to close the distance, they eat 2400 damage first, and now they lose.
That outcome may be exactly what we want, but it should be chosen on purpose.

## 4. Numeric targets for the relationship table

Pick tolerance bands and hold every matchup to them:

- **Mirror match:** 50% win rate. If it isn't, the simulator or the randomness is biased.
- **Soft counter:** the winner wins about 60–70% of the time, or keeps 20–40% of its cost alive.
- **Hard counter:** the winner wins at 2–3× cost efficiency. For example, 100 supply of the counter beats 200–300
  supply of the target.
- Nothing should hard-counter everything, and every unit needs at least one hard counter.

Measure **value retained**, the cost of surviving units divided by starting cost. It is much more informative than
win/loss because it says how much one side won by.

## 5. Benchmarks to automate

A headless harness runs these fights in batches after every stat change (`npm run balance -- <mode>`):

- **Equal-cost matchup matrix.** Every unit against every unit, many times each, with randomized formations. Record
  win rate and value retained. This is the main dashboard.
- **Scale test.** The same matchups at 1×, 2× and 4× cost. Swarm and splash units scale very differently, so a unit
  that is fine at 200 supply may collapse at 800.
- **Closing-distance test.** Start a melee unit at various distances from ranged units and plot outcome against
  distance. There should be a clear crossover point: past it the ranged unit wins, inside it the melee unit wins.
- **Composition test.** A frontliner plus a support unit against a counter plus a support unit. Frontliners are mostly
  judged by what they enable, not by solo fights.
- **Sensitivity test.** Nudge each stat by ±10%. If a single 10% change flips a hard win into a hard loss, the matchup
  is brittle and players will feel it as swingy.
- **Upgrade and tech curve.** Rerun the matrix at each upgrade level, since many balance problems only show up in the
  late game.
- **Nash check.** Treat the matrix as a payoff table and solve for the equilibrium mix of units. If the solution puts
  weight on only two or three units, the rest are dominated. A healthy roster puts weight on many units.

## 6. Order of operations

1. Lock a neutral baseline unit at value 1.0 first, then define the Knights relative to it.
2. Use the Knights as the second anchor, since frontliners define what everything else must handle.
3. Add units one at a time and rerun the full matrix with each addition.
4. Only after the sim matrix looks right, run human playtests and track pick rate and win rate when picked. Humans
   find positional abuse that sims miss.
