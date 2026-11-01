// The opening offer (DESIGN.md §5): in round 1 both sides are offered the same three packs, drawn from this pool,
// or flat supply instead (RULES.openingFlat). A pack is two units, already unlocked, with squads worth exactly
// RULES.openingPackValue (unlock prices don't count), placed for you, plus RULES.openingPackSupply to spend.
// Each pair is a working start: something to stand in front, something to do the damage. A test checks the sums.

export interface OpeningPack {
  units: { id: string; count: number }[];
}

export const OPENING_PACKS: OpeningPack[] = [
  { units: [{ id: "knights", count: 1 }, { id: "crossbowmen", count: 2 }] },
  { units: [{ id: "knights", count: 1 }, { id: "cleric", count: 1 }] },
  { units: [{ id: "knights", count: 1 }, { id: "griffon_riders", count: 1 }] },
  { units: [{ id: "pikemen", count: 1 }, { id: "ballista", count: 2 }] },
  { units: [{ id: "grunts", count: 2 }, { id: "skirmishers", count: 2 }] },
  { units: [{ id: "wolf_riders", count: 1 }, { id: "pikemen", count: 1 }] },
  { units: [{ id: "troll", count: 1 }, { id: "grunts", count: 2 }] },
  { units: [{ id: "ogre_brute", count: 1 }, { id: "skirmishers", count: 1 }] },
  { units: [{ id: "giant_bats", count: 1 }, { id: "grunts", count: 2 }] },
  { units: [{ id: "stone_golem", count: 1 }, { id: "cloudlings", count: 1 }] },
  { units: [{ id: "fire_elemental", count: 1 }, { id: "cloudlings", count: 2 }] },
  { units: [{ id: "air_elemental", count: 1 }, { id: "frost_elemental", count: 1 }] },
  { units: [{ id: "water_elemental", count: 1 }, { id: "crossbowmen", count: 1 }] },
];
