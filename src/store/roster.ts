import { useSyncExternalStore } from "react";
import { DEFAULT_UNITS } from "../data/units";
import type { UnitDef } from "../sim/types";

// The roster always starts from src/data/units.ts. Edits in the Units tab are
// experiments: they apply to Play, the sandbox and the lab until the page reloads.
// To keep a unit, copy its JSON (Export) or describe the change and commit it to units.ts.
let units: UnitDef[] = structuredClone(DEFAULT_UNITS);
const listeners = new Set<() => void>();

export const roster = {
  get: () => units,
  set(next: UnitDef[]) {
    units = next;
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
