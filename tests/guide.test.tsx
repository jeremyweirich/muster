import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROLES } from "../src/data/roles";
import { DEFAULT_UNITS } from "../src/data/units";
import { strengths, weaknesses } from "../src/game/counters";
import { CodexView } from "../src/ui/CodexView";
import { KEYWORDS, Linked } from "../src/ui/codexLinks";
import { CountersView } from "../src/ui/CountersView";
import { UnitInfo } from "../src/ui/UnitInfo";

const byId = (id: string) => DEFAULT_UNITS.find((u) => u.id === id)!;
const codex = renderToStaticMarkup(<CodexView />);
const hasEntry = (topic: string) => codex.includes(`id="codex-${topic}"`);
const linkedTopics = (html: string) => [...html.matchAll(/href="#codex\/([^"]+)"/g)].map((m) => m[1]);

describe("codex links", () => {
  it("has an entry for every keyword and role", () => {
    for (const [, topic] of KEYWORDS) expect(hasEntry(topic), topic).toBe(true);
    for (const id of Object.keys(ROLES)) expect(hasEntry(`role-${id}`), id).toBe(true);
  });

  it("every link on a unit card and in the codex itself has a target", () => {
    const html = codex + DEFAULT_UNITS.map((u) => renderToStaticMarkup(<UnitInfo def={u} />)).join("");
    for (const topic of new Set(linkedTopics(html))) expect(hasEntry(topic), topic).toBe(true);
  });

  it("every counter reason links to an entry", () => {
    for (const a of DEFAULT_UNITS)
      for (const b of DEFAULT_UNITS)
        for (const r of [...strengths(a, b), ...weaknesses(a, b)]) if (r.topic) expect(hasEntry(r.topic), `${a.id} vs ${b.id}: ${r.text}`).toBe(true);
  });

  it("links the first mention of each keyword only", () => {
    const html = renderToStaticMarkup(<Linked text="Burning ground burns. Fliers ignore fliers." />);
    expect(linkedTopics(html)).toEqual(["surface-fire", "status-burning", "role-flier"]);
  });

  it("the counters page renders before a unit is picked", () => {
    expect(renderToStaticMarkup(<CountersView />)).toContain("Pick the enemy unit");
  });
});

describe("counter reasons", () => {
  const texts = (rs: { text: string }[]) => rs.map((r) => r.text);

  it("anti-air against fliers, and ground-only units that can't answer them", () => {
    expect(texts(strengths(byId("longbowmen"), byId("bat_riders")))).toContain("Shoots down fliers");
    expect(texts(weaknesses(byId("knights"), byId("bat_riders")))).toContain("Can't hit fliers");
  });

  it("bonus damage and splash", () => {
    expect(texts(strengths(byId("halberdiers"), byId("ogre_brute"))).some((t) => t.startsWith("×1.75 damage"))).toBe(true);
    expect(texts(strengths(byId("ogre_brute"), byId("goblin_horde")))).toContain("Splash hits the whole swarm");
    expect(texts(weaknesses(byId("goblin_horde"), byId("ogre_brute")))).toContain("Its splash shreds swarms");
  });

  it("fliers against units that can't hit air", () => {
    expect(texts(strengths(byId("griffon_riders"), byId("knights")))).toContain("Flies, and Knights can't hit air");
  });
});
