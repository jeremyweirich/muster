// Terrain kinds and the maps they make (DESIGN.md §3, "Terrain"). Terrain lies only in no-man's land, and every
// map is point-symmetric (turned 180° it's the same), so both sides face the same ground and a PvP guest's
// turned-round view needs no special case. A test checks both. Skirmish matches draw a map at random; story
// missions name theirs. Spells cast on no-man's land may one day add patches the same way.

import type { TerrainKind, TerrainPatch } from "../sim/terrain";

export interface TerrainInfo {
  name: string;
  rule: string; // player-facing, for the Codex
  moveMult?: number; // ground units on it move this much slower
}

export const TERRAIN: Record<TerrainKind, TerrainInfo> = {
  rocks: { name: "Rocks", rule: "Ground units can't cross rocks: they walk round them. Fliers pass over." },
  pond: { name: "Pond", rule: "Deep water. Ground units can't cross it: they walk round. Fliers pass over." },
  rough: { name: "Rough ground", rule: "Ground units cross it at half speed. Fliers aren't slowed.", moveMult: 0.5 },
  bridge: { name: "Bridge", rule: "The way across a river for ground units. Fliers cross anywhere." },
  grass: {
    name: "Tall grass",
    rule: "Hides ground units from ground shooters. A unit in it can be shot only for 2 s after it attacks. Melee, fliers' attacks and splash still find it.",
  },
};

// how long a unit in tall grass stays visible to shooters after it attacks
export const GRASS_REVEAL = 2;

export interface MapDef {
  id: string;
  name: string;
  terrain: TerrainPatch[];
}

// Each patch with its 180° twin, through the field's center (48 × 27 tiles: 24, 13.5).
function twin(...patches: TerrainPatch[]): TerrainPatch[] {
  return patches.flatMap((p) => (p.x === 24 && p.y === 13.5 ? [p] : [p, { ...p, x: 48 - p.x, y: 27 - p.y }]));
}

export const MAPS: MapDef[] = [
  { id: "open-field", name: "Open Field", terrain: [] },
  {
    id: "millbrook-ford",
    name: "Millbrook Ford",
    terrain: twin({ kind: "pond", x: 24, y: 13.5, r: 2.4 }, { kind: "rough", x: 15, y: 13.5, r: 5, ry: 2.6 }),
  },
  {
    id: "standing-stones",
    name: "Standing Stones",
    terrain: twin(
      { kind: "rocks", x: 9, y: 11, r: 1.2 },
      { kind: "rocks", x: 19, y: 13.5, r: 1 },
      { kind: "rocks", x: 24, y: 10, r: 0.9 },
      { kind: "rocks", x: 34, y: 9.5, r: 1.1 },
    ),
  },
  {
    id: "long-grass",
    name: "Long Grass",
    terrain: twin({ kind: "grass", x: 9, y: 13.5, r: 6, ry: 3.6 }, { kind: "rocks", x: 24, y: 13.5, r: 1 }),
  },
  {
    id: "the-mire",
    name: "The Mire",
    terrain: twin({ kind: "rough", x: 24, y: 13.5, r: 11, ry: 3.4 }, { kind: "pond", x: 13, y: 10.6, r: 1.6 }),
  },
  {
    id: "broken-hills",
    name: "Broken Hills",
    terrain: twin(
      { kind: "grass", x: 24, y: 13.5, r: 4.5, ry: 2.4 },
      { kind: "rocks", x: 14, y: 12.5, r: 1.3 },
      { kind: "rough", x: 37, y: 11, r: 4, ry: 2.2 },
    ),
  },
  {
    // a river right across the field, and one wide bridge in the middle third: the only way over on foot
    id: "toll-bridge",
    name: "Toll Bridge",
    terrain: twin({ kind: "pond", x: 4.2, y: 13.5, r: 1.6, len: 10.2 }, { kind: "bridge", x: 24, y: 13.5, r: 8, ry: 2.6 }),
  },
  {
    // a ploughed band right across the middle: anything on foot wades through it at half speed
    id: "the-furrows",
    name: "The Furrows",
    terrain: twin({ kind: "rough", x: 24, y: 13.5, r: 60, ry: 2.6 }),
  },
  {
    // the pass through the border hills: rocks either side of the middle and scree on the flanks
    id: "border-pass",
    name: "Border Pass",
    terrain: twin(
      { kind: "rocks", x: 18, y: 12.5, r: 1.6 },
      { kind: "rocks", x: 7, y: 11, r: 1.2 },
      { kind: "rough", x: 40, y: 12, r: 4, ry: 2 },
    ),
  },
];

export const MAP_BY_ID = new Map(MAPS.map((m) => [m.id, m]));

// A map's terrain; an unknown or missing id is the open field.
export function mapTerrain(id: string | undefined): TerrainPatch[] {
  return (id && MAP_BY_ID.get(id)?.terrain) || [];
}
