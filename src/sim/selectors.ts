import type { Selector, Side, UnitDef } from "./types";

// Does a unit (of `def`, on `side`) match a selector evaluated from the point
// of view of `fromSide`? fromSide = null means "neutral" (side filters pass).
export function matches(sel: Selector, def: UnitDef, side: Side, fromSide: Side | null): boolean {
  if (sel.side && sel.side !== "any" && fromSide !== null) {
    const ally = side === fromSide;
    if (sel.side === "ally" && !ally) return false;
    if (sel.side === "enemy" && ally) return false;
  }
  if (sel.layer && def.layer !== sel.layer) return false;
  if (sel.hasTag && !def.tags.includes(sel.hasTag)) return false;
  if (sel.hasAnyTag && !sel.hasAnyTag.some((t) => def.tags.includes(t))) return false;
  if (sel.lacksTag && def.tags.includes(sel.lacksTag)) return false;
  return true;
}

// Player-facing text: tags lose their category ("class:ranged" reads as "ranged").
export function describeSelector(sel: Selector): string {
  const tag = (t: string) => t.slice(t.indexOf(":") + 1);
  const parts: string[] = [];
  if (sel.side && sel.side !== "any") parts.push(sel.side === "ally" ? "allied" : "enemy");
  if (sel.layer) parts.push(sel.layer);
  if (sel.hasTag) parts.push(tag(sel.hasTag));
  if (sel.hasAnyTag?.length) parts.push(sel.hasAnyTag.map(tag).join(" / "));
  if (sel.lacksTag) parts.push(`not ${tag(sel.lacksTag)}`);
  return parts.length ? parts.join(" ") + " units" : "all units";
}
