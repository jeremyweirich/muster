# Mechabellum Unit Reference — Roles, Matchups, Benchmarks

Patch basis: Mechabellum 2.0 era (Nov 2026). 33 competitive units, plus Centurion (new in 2.0, no matchup data yet).
Matchup data comes from the official wiki's Good/Bad Against lists, cross-referenced in both directions.
A pair is listed if either unit's page states it. The rest is community knowledge. Techs can flip any matchup.

---

## 1. Role framework

Core cycle: **Chaff → beats → Carries → beat → Chaff Clear → beats → Chaff**

Second axis is **target size**:

| Damage profile | Efficient against |
|---|---|
| Splash / many small hits / multi-target | Light swarms (chaff) |
| Big single hits | Medium units |
| Ramping damage / %HP / snipers | Giants and titans |

Supply tiers: 100 / 200 / 300 / 400 / 500 / 800

---

## 2. Role counts

| Role | Mechabellum now (33) | Early-access launch roster (16) | Suggested for your v1 (~16) |
|---|---|---|---|
| Chaff | 3 | 3 | 2–3 |
| Chaff Clear | 10 | 4 | 4 |
| Anti-Medium | 4 | 0 | 1–2 |
| Anti-Giant Carry | 4 | 4 | 3–4 |
| Tank / Frontline | 5 | 3 | 3 (knight is one) |
| Utility | 2 | 1 | 1 |
| Late-game Power | 5 | 1 | 1 |
| **Air units (subset)** | 7 | 3 | 2–3 |

Early-access launch roster: Vulcan, Fortress, Marksman, Melting Point, Rhino, Wasp, Mustang, Steel Ball,
Fang, Crawler, Overlord, Stormcaller, Sledgehammer, Hacker, Arclight, Phoenix.

Observations:
- Chaff Clear grew the most (4 → 10). Answers to chaff are needed at every range and cost tier, and for air.
- Anti-Medium went from 0 → 4 (Vortex, Void Eye, Scorpion, Phantom Ray). These were added later as answers to medium tanks like Sledgehammer.
- True chaff stayed at 3. You only need a few, but everything else must respect them.

---

## 3. Units by role

W/L = number of listed wins / losses. A low or zero loss count usually means a **data gap**, not that the unit is OP.

### Chaff (3)
| Unit | Cost | Air? | Hits air | Beats | Loses to | W/L |
|---|---|---|---|---|---|---|
| Crawler | 100 | Ground | No | Marksman, Melting Point, Steel Ball, Sandworm | Hound, Tarantula, Wraith, Vulcan, Fire Badger, Arclight, Mustang | 4/7 |
| Fang | 100 | Ground | Yes | Marksman, Melting Point, Steel Ball, Sandworm, Phoenix | Hound, Tarantula, Wraith, Stormcaller, Arclight, Mustang | 5/6 |
| Wasp | 200 | Air | Yes | Abyss, Phoenix, Marksman | Wraith, Mustang | 3/2 |

### Chaff Clear (10)
| Unit | Cost | Air? | Hits air | Beats | Loses to | W/L |
|---|---|---|---|---|---|---|
| Arclight | 100 | Ground | No | Crawler, Fang, Mustang | War Factory, Rhino, Fortress, Marksman | 3/4 |
| Hound | 100 | Ground | No | Crawler, Fang | Void Eye, Sledgehammer, Scorpion, Wraith, Raiden, Tarantula, Vortex | 2/7 |
| Mustang | 200 | Ground | Yes | Crawler, Fang, Wasp, Void Eye, Phoenix | Tarantula, Sledgehammer, Rhino, Arclight | 5/4 |
| Stormcaller | 200 | Ground | No | Tarantula, Scorpion, Fang | Sledgehammer | 3/1 |
| Fire Badger | 200 | Ground | No | Crawler | Vortex, Scorpion, Sandworm, Mountain, Phantom Ray, War Factory, Rhino, Fortress | 1/8 |
| Tarantula | 200 | Ground | Tech | Crawler, Fang, Hound, Mustang | Void Eye, Sabertooth, Stormcaller, Phoenix, Hacker, Fortress, Overlord, Mountain, Sandworm, War Factory, Phantom Ray, Rhino | 4/12 |
| Typhoon | 300 | Ground | Yes | (reworked S8: frontline chaff clear + AA, little data) | Scorpion | 0/1 |
| Wraith | 300 | Air | Yes | Crawler, Fang, Hound, Wasp | Marksman, Phantom Ray, Farseer, Melting Point, Overlord | 4/5 |
| Vulcan | 400 | Ground | No | Crawler | Sandworm, Mountain, Death Knell, Rhino, Fortress | 1/5 |
| Raiden | 400 | Air | Yes | Vortex, Void Eye, Hound, Phantom Ray, Sledgehammer | Marksman | 5/1 |

### Anti-Medium (4)
| Unit | Cost | Air? | Hits air | Beats | Loses to | W/L |
|---|---|---|---|---|---|---|
| Vortex | 100 | Ground | No | Hound, Sledgehammer, Steel Ball, Fire Badger | Sabertooth, Raiden, Fortress, Mountain | 4/4 |
| Void Eye | 100 | Ground | Tech | Hound, Sabertooth, Steel Ball, Tarantula, Sledgehammer | Marksman, Phoenix, Mustang, Raiden | 5/4 |
| Scorpion | 300 | Ground | No | Sledgehammer, Fire Badger, Steel Ball, Typhoon, Hound | Marksman, Stormcaller, Phoenix, Hacker, Overlord, Abyss, Fortress | 5/7 |
| Phantom Ray | 200 | Air | Yes | Tarantula, Sabertooth, Fire Badger, Sledgehammer, Wraith | Marksman, Phoenix, Farseer, Raiden, Overlord, Abyss | 5/6 |

### Anti-Giant Carry (4)
| Unit | Cost | Air? | Hits air | Beats | Loses to | W/L |
|---|---|---|---|---|---|---|
| Marksman | 100 | Ground | Yes | Void Eye, Wraith, Phantom Ray, Scorpion, Arclight, Phoenix, Melting Point, Raiden, Overlord | Crawler, Fang, Wasp, Sandworm, Fortress, Rhino | 9/6 |
| Steel Ball | 200 | Ground | No | Rhino (plus tanks/giants generally) | Crawler, Fang, Vortex, Void Eye, Scorpion | 1/5 |
| Phoenix | 200 | Air | Yes | Void Eye, Tarantula, Scorpion, Phantom Ray, Rhino | Fang, Wasp, Mustang, Marksman | 5/4 |
| Melting Point | 400 | Ground | Yes | Mountain, Death Knell, Abyss, Wraith, Overlord, Fortress, Rhino | Crawler, Fang, Sledgehammer, Marksman | 7/4 |

### Tank / Frontline (5) — knight lives here
| Unit | Cost | Air? | Hits air | Beats | Loses to | W/L |
|---|---|---|---|---|---|---|
| **Sledgehammer** | 200 | Ground | No | Hound, Mustang, Stormcaller, Melting Point | Vortex, Void Eye, Scorpion, Sandworm, Phantom Ray, Mountain, War Factory, Death Knell, Hacker, Fortress, Raiden, Overlord, Rhino | 4/13 |
| Rhino | 200 | Ground | No | Arclight, Marksman, Sledgehammer, Tarantula, Fire Badger, Mustang, Vulcan | Steel Ball, Sabertooth, Phoenix, Hacker, Melting Point, Fortress | 7/6 |
| Sabertooth | 200 | Ground | No | Vortex, Tarantula, Rhino | Void Eye, War Factory, Phantom Ray, Fortress | 3/4 |
| Fortress | 400 | Ground | Tech | Vortex, Sandworm, Tarantula, Arclight, Sabertooth, Fire Badger, Sledgehammer, Scorpion, Vulcan, Marksman, Rhino | Melting Point, Abyss, Mountain, Death Knell, War Factory | 11/5 |
| Sandworm | 400 | Ground | Tech | Marksman, Sledgehammer, Fire Badger, Tarantula, Vulcan | Crawler, Fang, Fortress, War Factory, Mountain | 5/5 |

### Utility (2)
| Unit | Cost | Air? | Hits air | Beats | Loses to | W/L |
|---|---|---|---|---|---|---|
| Hacker | 200 | Ground | ? | Tarantula, Scorpion, Sledgehammer, Rhino | (no data — likely chaff) | 4/0 |
| Farseer | 300 | Ground | Yes | Wraith, Phantom Ray, Abyss | War Factory | 3/1 |

### Late-game Power (5)
| Unit | Cost | Air? | Hits air | Beats | Loses to | W/L |
|---|---|---|---|---|---|---|
| Overlord | 500 | Air | Yes | War Factory, Tarantula, Scorpion, Phantom Ray, Wraith, Sledgehammer | Death Knell, Melting Point, Marksman | 6/3 |
| Mountain | 800 | Ground | Tech | Sledgehammer, Fire Badger, Tarantula, Vulcan, Fortress, Sandworm, Vortex, War Factory | Melting Point, Abyss | 8/2 |
| War Factory | 800 | Ground | No | Arclight, Sabertooth, Tarantula, Fire Badger, Sledgehammer, Farseer, Fortress, Sandworm | Overlord, Mountain, Abyss | 8/3 |
| Death Knell | 800 | Ground | Yes | Sledgehammer, Fortress, Vulcan, Overlord | Melting Point | 4/1 |
| Abyss | 800 | Air | Yes | Scorpion, Fortress, War Factory, Mountain, Phantom Ray | Wasp, Farseer, Melting Point | 5/3 |

### New in 2.0
| Unit | Notes |
|---|---|
| Centurion | Mode-switcher: long-range precision rifle → dual rifles (mid-range) or armored melee mode. No matchup data yet. |

---

## 4. Self-TTK benchmarks (level 1 base stats, wiki)

Self-TTK = HP / (ATK / attack interval × weapons firing). It does not depend on squad size.
It ignores splash, armor, ramping damage, and closing time.

| Unit | Role | Cost | HP | ATK | Interval (s) | Range (m) | Weapons firing | DPS | **Self-TTK (s)** |
|---|---|---|---|---|---|---|---|---|---|
| Marksman | Anti-Giant | 100 | 1,622 | 2,329 | 3.1 | 140 | 1 | 751 | **2.2** |
| Rhino | Tank (melee) | 200 | 19,297 | 3,560 | 0.9 | 6 | 1 | 3,956 | **4.9** |
| Void Eye | Anti-Medium | 100 | 1,522 | 995 | 3.3 | 100 | 1 | 302 | **5.0** |
| Scorpion | Anti-Medium | 300 | 18,632 | 10,650 | 4.5 | 100 | 1 | 2,367 | **7.9** |
| Vortex | Anti-Medium | 100 | 7,425 | 1,309 | 1.5 | 85 | 1 | 873 | **8.5** |
| Hound | Chaff Clear | 100 | 879 | 246 | 2.4 | 70 | 1 | 103 | **8.6** |
| Phantom Ray | Anti-Medium | 200 | 3,412 | 1,087 | 3.0 | 65 | 1 | 362 | **9.4** |
| Fortress | Tank | 400 | 43,938 | 6,524 | 1.8 | 100 | 1 | 3,624 | **12.1** |
| Sandworm | Tank (diver) | 400 | 48,645 | 9,352 | 2.5 | 60 | 1 | 3,741 | **13.0** |
| War Factory | Late-game | 800 | 113,593 | 7,520 | 1.8 | 100 | 2* | 8,356 | **13.6** |
| Wraith | Chaff Clear | 300 | 14,115 | 381 | 1.6 | 60 | 4 | 953 | **14.8** |
| Tarantula | Chaff Clear | 200 | 14,773 | 496 | 0.6 | 80 | 1 | 827 | **17.9** |
| Mountain | Late-game | 800 | 136,657 | 5,899 | 2.0 | 100 | 2* | 5,899 | **23.2** |
| **Sledgehammer** | **Tank** | 200 | 3,478 | 608 | 4.5 | 95 | 1 | 135 | **25.7** |

\* Assumption. The wiki says War Factory usually has only 2 of its 4 cannons active; Mountain is assumed to be the same.
Wraith always splits fire across 4 targets.
Abyss is left out because its laser hits large targets many times per sweep, which makes its nominal 69s meaningless.
Death Knell is left out because its damage ramps.

Takeaways for the knight:
- **Sledgehammer is the tankiest unit relative to its own damage (~26s).** A Sledgehammer-like knight belongs at roughly 20–26s.
- Sledgehammer is **mid-range (95m), not melee.** If your knight is melee, Rhino is the other reference: fast (16 m/s), huge HP (19k at 200 cost), and a *low* self-TTK (4.9s). Melee units pay for zero range with very high DPS and speed, because they eat damage while closing.
- Range trades inversely with self-TTK. The longest-range unit (Marksman, 140m) is the glassiest at 2.2s.
- Anti-medium specialists cluster at 5–10s. They kill tanks fast but die fast.

---

## 5. Suggested self-TTK bands for your roster (tune these)

| Role | Min (s) | Max (s) | Mechabellum reference points |
|---|---|---|---|
| Chaff | 3 | 10 | (per-squad; Hound 8.6 as a weak-chaff reference) |
| Chaff Clear | 8 | 18 | Hound 8.6, Wraith 14.8, Tarantula 17.9 |
| Anti-Medium | 5 | 10 | Void Eye 5.0, Scorpion 7.9, Vortex 8.5, Phantom Ray 9.4 |
| Anti-Giant Carry | 2 | 6 | Marksman 2.2 |
| Tank (ranged) | 12 | 26 | Fortress 12.1, Sandworm 13.0, Sledgehammer 25.7 |
| Tank (melee/diver) | 4 | 13 | Rhino 4.9, Sandworm 13.0 (burrow) |
| Late-game | 13 | 25 | War Factory 13.6, Mountain 23.2 |

---

## 6. Knight design targets (Sledgehammer analogue)

Role: Tank / Frontline (secondary: anti-light). Self-TTK target: 20–26s if mid-range, 5–10s plus high speed if melee.

Should BEAT (mirrors Sledgehammer):
- [ ] Light chaff clear (Hound-type)
- [ ] Fast low-damage skirmishers (Mustang-type)
- [ ] Artillery that can't escape it (Stormcaller-type)
- [ ] Slow ramping anti-giant carries it can reach (Melting Point-type)

Should LOSE TO:
- [ ] Cheap ranged anti-medium (Void Eye / Vortex-type), the 100-cost answer
- [ ] Splash anti-medium-pack (Scorpion-type), which punishes clumped knights
- [ ] Diver / burrower that bypasses it (Sandworm-type)
- [ ] Tech disruption (Hacker-type)
- [ ] Every giant/titan at equal cost
- [ ] At least one air unit it can't shoot (Raiden / Overlord / Phantom Ray-type)

---

## 7. Your roster template

| Unit | Role | Air? | Cost | HP | ATK | Interval | Weapons | Range | Speed | DPS = ATK/Int×W | Self-TTK = HP/DPS | In band? | Beats | Loses to |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Knight (example) | Tank | Ground | 200 | 4000 | 400 | 2.0 | 1 | 30 | 8 | 200 | 20.0 | Yes (12–26) | | |
| | | | | | | | | | | | | | | |
| | | | | | | | | | | | | | | |

Roster health checks:
- [ ] Every unit has ≥1 listed win and ≥1 listed loss
- [ ] Every role has an answer that can shoot air
- [ ] No unit's wins are a superset of another same-cost unit's wins (dominance)
- [ ] Matchups are antisymmetric (if A beats B, B doesn't beat A)
- [ ] Chaff Clear count ≥ Chaff count + 1

---

Sources:
- Mechabellum Wiki: https://mbwiki.dreamhaven.com/units/ (unit pages for stats and Good/Bad Against)
- Early-access unit list: https://www.gamepressure.com/newsroom/list-of-all-units-in-mechabellum/z0563b
- Role framework: https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and
- Typhoon rework (Season 8): https://pressreleases.triplepointpr.com/?p=28434
- Centurion (2.0): https://allthings.how/?p=226607