# Simulation strategy

November 2026. The game, the AI, the balance harness and the Counters tab all run the same deterministic simulator
(`src/sim`). We expect to simulate a lot more (deeper AI search, bigger balance sweeps), so this records how to keep
it fast, what has been done, and what to try next.

## Rules

- **Determinism first.** Fixed 50 ms tick, seeded `Rng`, no `Math.random` and no wall-clock time inside `src/sim`.
  Replays, the AI, the harness and the tests depend on it.
- **Measure before and after.** `npm run bench` runs a fixed set of 199 battles (every unit pair at about 1000
  supply, plus nine big mixed armies), and prints the time per battle and a **fingerprint** of every outcome.
- **A speedup must not change results.** If a change is only meant to make the simulator faster, the fingerprint must
  stay the same. A different fingerprint means battles play out differently. That's fine for a deliberate rules or
  unit change, but then say so in the commit.
- **Profile, don't guess.** tsx puts each file on one line, so profile a bundled build to get line numbers:
  ```bash
  npx esbuild scripts/bench.ts --bundle --platform=node --format=esm --outfile=<scratch>/bench.mjs
  node --cpu-prof --cpu-prof-dir=<scratch>/prof <scratch>/bench.mjs
  ```
  Then sum `positionTicks` per line from the `.cpuprofile`.

## Where the time goes

Profile of the benchmark (November 2026, after the first round of fixes):

| Share | What |
|---|---|
| ~35% | `separate()`: pushing overlapping models apart, scanning nearby grid cells for every model, every tick |
| ~15% | `updateModel()`: movement, targeting and attacks |
| ~8% | status checks (`updateStatuses`, `statusMult`, `isStunned`) |
| ~4% | `findTarget()`: a scan over every model, about once per 0.8 s per model |
| rest | projectiles, traits, surfaces, auras, bookkeeping |

## Done

| Change | Effect | Exact? |
|---|---|---|
| `separate()`: flat reused grid instead of a `Map` of fresh arrays; empty rows skipped in one check | about 20% | yes |
| Status checks skip models with no status | about 10% | yes |
| Surface sweep skipped while the field has no surfaces | small | yes |
| Turn-order buffer reused instead of allocated every tick | small | yes |
| Keep footprints cached for placement (`canPlace`), which the AI calls constantly | AI placement | yes |
| **Simulator: 29.1 → 20.6 ms per battle (about 1.4×)** | | fingerprint unchanged |
| **Parallel balance harness** (`scripts/sim-pool.ts`): matchups on one thread per spare core | `check` 4.5 min → 22 s | same output as sequential |
| **Parallel AI on Hard**: up to 4 browser workers, each searching with its own seed against the same armies; best plan wins | up to 4× the simulations in the same 6 s | not applicable (the AI isn't replayed) |

## What we learned about spending simulations (the AI)

Measured in full AI-vs-AI matches against the previous Hard planner, 40 matches each, 4 s per plan (`npm run ai-duel`):

| Variant | Wins | Verdict |
|---|---|---|
| Score plans by round HP damage instead of surviving value | 20 / 40 | neutral, kept because it's the real stake |
| Average two battle seeds per plan throughout | 2 / 20 | **harmful**: halves the search, and screening ate the whole budget |
| Phased budget (screen 30%, random 55%, local search 85%), then re-score the top 5 over 2 more seeds | **28 / 40** | kept |
| Plus common random numbers (every plan fights the same seeds) | 23 / 40 | dropped: with a deterministic simulator the search tunes plans to one roll of the dice |

**How to test an AI change:** `npm run ai-duel -- snapshot` saves the current planner as a gitignored baseline; change
the AI; `npm run ai-duel -- run` plays 40 full matches against the baseline across threads. Games come in pairs with
the sides swapped, so luck and side advantages cancel. Sanity check: identical planners come out 21 of 40.

Lessons: give every search stage a time box, so one stage can't starve the rest; reduce noise where the decision is made
(the finalists), not everywhere; and judge AI changes by full matches with 40 or more games, since 8–20 can't tell a
70% version from a 50% one.

## Next levers, most promising first

1. **Cheaper evaluations for screening.** The AI ranks unit types and early candidates with full battles, up to 120 s
   of sim time each. A shorter horizon (say the first 30 s) or stopping once one side is clearly ahead would make
   screening 2–4× cheaper. That's fine for ranking, but not for the real battle.
2. **Simulator data layout.** Models are objects with nested `def` lookups. Keeping hot fields (position, HP, size,
   side, layer) in typed arrays, and statuses in fixed slots instead of an object with `delete`, could give 2–3×. It's
   a large refactor; the fingerprint keeps it honest.
3. **Neighbor search once per tick.** `separate()` and `findTarget()` each walk models independently. A shared
   spatial grid built once per tick could serve both (exactness needs care: `separate()` reads positions as it moves
   them).
4. **More AI parallelism**, such as screening split across workers instead of whole duplicate searches. The portfolio
   approach is simple but repeats the same screening in every worker.
5. **Parallel mirror and density modes** in the harness (they still run on one thread).
