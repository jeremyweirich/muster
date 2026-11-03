import { describe, expect, it } from "vitest";
import { RULES } from "../src/data/rules";
import { MAPS, mapTerrain } from "../src/data/terrain";
import { DEFAULT_UNITS } from "../src/data/units";
import { defMap } from "../src/game/army";
import { newMatch } from "../src/game/match";
import { Battle } from "../src/sim/battle";
import { isObstacle, Terrain, type TerrainPatch } from "../src/sim/terrain";
import type { PlacedSquad } from "../src/sim/types";

const defs = defMap(DEFAULT_UNITS);
// the biggest ground unit's width, and a little room
const MIN_GAP = 2 * Math.max(...DEFAULT_UNITS.filter((u) => u.layer === "ground").map((u) => u.size)) + 0.5;
const sq = (defId: string, x: number, y: number, uid = `${defId}-${x}-${y}`): PlacedSquad => ({ uid, defId, x, y, round: 1 });

describe("maps", () => {
  it("start with the open field, and have unique ids", () => {
    expect(MAPS[0].terrain).toEqual([]);
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(MAPS.length);
  });

  for (const map of MAPS) {
    it(`${map.name}: terrain only in no-man's land, the same from both sides`, () => {
      for (const p of map.terrain) {
        const ry = p.ry ?? p.r;
        expect(p.y - ry, `${p.kind} at ${p.x},${p.y}`).toBeGreaterThanOrEqual(RULES.deployDepth);
        expect(p.y + ry, `${p.kind} at ${p.x},${p.y}`).toBeLessThanOrEqual(RULES.fieldH - RULES.deployDepth);
        if (isObstacle(p.kind)) expect(p.ry === undefined || p.ry === p.r, "obstacles are circles or capsules").toBe(true);
        else if (p.kind !== "rough" && p.kind !== "grass") {
          expect(p.x - p.r).toBeGreaterThanOrEqual(0);
          expect(p.x + p.r).toBeLessThanOrEqual(RULES.fieldW);
        }
        // turned 180° about the center, every patch lands on a patch of the same kind and size
        const twin = map.terrain.find((q) => q.kind === p.kind && q.r === p.r && q.ry === p.ry && q.len === p.len && Math.abs(q.x - (RULES.fieldW - p.x)) < 1e-9 && Math.abs(q.y - (RULES.fieldH - p.y)) < 1e-9);
        expect(twin, `${p.kind} at ${p.x},${p.y} has no twin`).toBeDefined();
      }
    });

    // Obstacles are convex (circles and capsules), and they stay far enough apart, and far enough from the field's
    // edges, that the biggest ground unit fits between any two: no pockets to get stuck in. A river may run off one
    // side of the field (units on its bank head for the open end).
    it(`${map.name}: no pockets between obstacles, or between an obstacle and the edge`, () => {
      const t = new Terrain(map.terrain, RULES.fieldW, RULES.fieldH);
      for (const [i, a] of t.obstacles.entries()) {
        const offW = a.x0 - a.r <= 0;
        const offE = a.x1 + a.r >= RULES.fieldW;
        expect(offW && offE, "a river can't block the whole field").toBe(false);
        if (!offW) expect(a.x0 - a.r, `obstacle at ${a.x0},${a.y} vs the west edge`).toBeGreaterThanOrEqual(MIN_GAP);
        if (!offE) expect(RULES.fieldW - a.x1 - a.r, `obstacle at ${a.x1},${a.y} vs the east edge`).toBeGreaterThanOrEqual(MIN_GAP);
        for (const b of t.obstacles.slice(i + 1)) {
          // the gap between two capsules on horizontal segments
          const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
          const gap = Math.hypot(dx, a.y - b.y) - a.r - b.r;
          expect(gap, `obstacles at ${a.x0},${a.y} and ${b.x0},${b.y}`).toBeGreaterThanOrEqual(MIN_GAP);
        }
      }
    });
  }

  it("each match draws a map from its seed, so both PvP browsers get the same one", () => {
    const seen = new Set<string | undefined>();
    for (let seed = 1; seed <= 60; seed++) {
      expect(newMatch(DEFAULT_UNITS, seed).map).toBe(newMatch(DEFAULT_UNITS, seed).map);
      seen.add(newMatch(DEFAULT_UNITS, seed).map);
    }
    expect(seen.size).toBe(MAPS.length);
  });
});

describe("terrain in battle", () => {
  it("ground units walk round a pond to reach what's behind it, and never stand in it", () => {
    const pond: TerrainPatch[] = [{ kind: "pond", x: 24, y: 13.5, r: 2.5 }];
    // a knight squad straight below the pond, a ballista straight above it
    const b = new Battle(defs, [[sq("knights", 22, 20)], [sq("ballista", 23, 5)]], { seed: 3, towers: false, terrain: pond });
    while (!b.over) {
      b.step();
      for (const m of b.models) if (m.alive) expect(Math.hypot(m.x - 24, m.y - 13.5)).toBeGreaterThan(2.5 + m.def.size - 0.05);
    }
    expect(b.timedOut).toBe(false);
    expect(b.winner).toBe(0);
  });

  it("a river sends ground units along its bank to the bridge, never into the corner at the field's edge", () => {
    const river = mapTerrain("toll-bridge");
    const t = new Terrain(river, RULES.fieldW, RULES.fieldH);
    // Knights on the far west, a ballista straight across the river from them
    const b = new Battle(defs, [[sq("knights", 2, 20)], [sq("ballista", 2, 5)]], { seed: 1, towers: false, terrain: river });
    let crossed = false;
    while (!b.over) {
      b.step();
      for (const m of b.models) {
        if (!m.alive || m.def.id !== "knights") continue;
        for (const o of t.obstacles) {
          const px = Math.min(Math.max(m.x, o.x0), o.x1);
          expect(Math.hypot(m.x - px, m.y - o.y)).toBeGreaterThan(o.r + m.def.size - 0.05);
        }
        if (m.y < 12) crossed = true;
      }
    }
    expect(crossed, "the knights crossed by the bridge").toBe(true);
    expect(b.winner).toBe(0);
  });

  it("rough ground halves a ground unit's speed, and fliers don't care", () => {
    const rough: TerrainPatch[] = [{ kind: "rough", x: 24, y: 13.5, r: 30, ry: 30 }];
    const travelled = (defId: string, terrain?: TerrainPatch[]) => {
      const b = new Battle(defs, [[sq(defId, 22, 22)], [sq("ballista", 23, 1)]], { seed: 1, towers: false, terrain });
      const y0 = Math.min(...b.models.filter((m) => m.side === 0).map((m) => m.y));
      for (let i = 0; i < 40; i++) b.step();
      return y0 - Math.min(...b.models.filter((m) => m.side === 0).map((m) => m.y));
    };
    expect(travelled("knights", rough) / travelled("knights")).toBeCloseTo(0.5, 1);
    expect(travelled("griffon_riders", rough)).toBeCloseTo(travelled("griffon_riders"), 5);
  });

  it("tall grass hides ground units from ground shooters until they attack, but not from fliers", () => {
    // knights inside a grass patch, crossbowmen in range of them but outside it
    const grass: TerrainPatch[] = [{ kind: "grass", x: 24, y: 10, r: 4, ry: 3 }];
    const bowDamage = (terrain?: TerrainPatch[]) => {
      const b = new Battle(defs, [[sq("crossbowmen", 22, 16, "bows")], [sq("knights", 22, 9)]], { seed: 2, towers: false, terrain });
      for (let i = 0; i < 30; i++) b.step();
      return b.result().stats.bows.dealt;
    };
    expect(bowDamage()).toBeGreaterThan(0);
    expect(bowDamage(grass)).toBe(0);
    const b = new Battle(defs, [[sq("griffon_riders", 22, 16)], [sq("knights", 22, 9)]], { seed: 2, towers: false, terrain: grass });
    b.step();
    expect(b.models.some((m) => m.side === 1 && b.hiddenInGrass(m))).toBe(true);
    expect(b.models.some((m) => m.side === 0 && b.hiddenInGrass(m))).toBe(false); // fliers are never hidden
  });

  it("an unknown or missing map is the open field", () => {
    expect(mapTerrain(undefined)).toEqual([]);
    expect(mapTerrain("nowhere")).toEqual([]);
  });
});
