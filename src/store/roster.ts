import { useSyncExternalStore } from "react";
import { DEFAULT_UNITS } from "../data/units";
import type { UnitDef } from "../sim/types";

// The unit roster lives in the browser while you iterate. Export it as JSON to
// keep it (or commit it to src/data/units.ts).
// Bumped whenever the default roster changes shape (v3: factions, upgrades, speed points)
const KEY = "muster.roster.v3";

function load(): UnitDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    // storage unavailable or corrupt: fall back to defaults
  }
  return structuredClone(DEFAULT_UNITS);
}

let units: UnitDef[] = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(units));
  } catch {
    // ignore: the roster still works for this session
  }
}

export const roster = {
  get: () => units,
  set(next: UnitDef[]) {
    units = next;
    save();
    listeners.forEach((l) => l());
  },
  upsert(def: UnitDef, previousId?: string) {
    const id = previousId ?? def.id;
    const i = units.findIndex((u) => u.id === id);
    roster.set(i >= 0 ? units.map((u, j) => (j === i ? def : u)) : [...units, def]);
  },
  remove(id: string) {
    roster.set(units.filter((u) => u.id !== id));
  },
  reset() {
    roster.set(structuredClone(DEFAULT_UNITS));
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useRoster(): UnitDef[] {
  return useSyncExternalStore(roster.subscribe, roster.get);
}

export function validateRoster(data: unknown): UnitDef[] {
  if (!Array.isArray(data)) throw new Error("Expected an array of units");
  for (const u of data) {
    if (typeof u?.id !== "string" || typeof u?.name !== "string" || typeof u?.cost !== "number") {
      throw new Error("Each unit needs at least an id, name and cost");
    }
    u.tags ??= [];
    u.footprint ??= { w: 2, h: 2 };
    u.look ??= { shape: "circle", color: "#cccccc" };
  }
  return data as UnitDef[];
}
