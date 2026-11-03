import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROLES } from "../src/data/roles";
import { SHOWCASES } from "../src/data/showcases";
import { DEFAULT_UNITS } from "../src/data/units";
import { strengths, weaknesses } from "../src/game/counters";
import { ARENA, showcaseBattle } from "../src/game/showcase";
import { CodexView } from "../src/ui/CodexView";
import { KEYWORDS, Linked } from "../src/ui/codexLinks";
import { CountersView } from "../src/ui/CountersView";
import { UnitInfo } from "../src/ui/UnitInfo";
import { UnitsView } from "../src/ui/UnitsView";

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

describe("units tab", () => {
  it("every unit has a showcase fight, and the featured side wins it", () => {
    for (const u of DEFAULT_UNITS) {
      expect(SHOWCASES[u.id], u.id).toBeDefined();
      for (const seed of [1, 2, 3]) {
        const b = showcaseBattle(DEFAULT_UNITS, u.id, [], seed);
        b.run();
        expect(b.winner, `${u.id} seed ${seed}`).toBe(0);
      }
    }
  });

  it("every showcase starts inside the arena, even a crowd too tall for one column", () => {
    const saved = SHOWCASES.giant;
    const inside = (id: string) => {
      const b = showcaseBattle(DEFAULT_UNITS, id);
      for (const m of b.models) {
        expect(m.x >= 0 && m.x <= ARENA.fieldW && m.y >= 0 && m.y <= ARENA.fieldH, `${id}: ${m.def.id} at ${m.x}, ${m.y}`).toBe(true);
      }
    };
    try {
      SHOWCASES.giant = { vs: Array(7).fill("grunts"), caption: "" };
      inside("giant");
    } finally {
      SHOWCASES.giant = saved;
    }
    for (const id of Object.keys(SHOWCASES)) inside(id);
  });

  it("every unit link has a page", () => {
    const html = [codex, renderToStaticMarkup(<UnitInfo def={byId("knights")} link />), renderToStaticMarkup(<UnitsView topic="cleric" />)].join("");
    const linked = [...html.matchAll(/href="#units\/([^"]+)"/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThan(0);
    for (const id of new Set(linked)) expect(DEFAULT_UNITS.some((u) => u.id === id), id).toBe(true);
  });

  it("opens the linked unit", () => {
    expect(renderToStaticMarkup(<UnitsView topic="cleric" />)).toContain("behind it wins");
  });
});

describe("counter reasons", () => {
  const texts = (rs: { text: string }[]) => rs.map((r) => r.text);

  it("anti-air against fliers, and ground-only units that can't answer them", () => {
    expect(texts(strengths(byId("crossbowmen"), byId("giant_bats")))).toContain("Shoots down fliers");
    expect(texts(weaknesses(byId("knights"), byId("giant_bats")))).toContain("Can't hit fliers");
  });

  it("bonus damage and splash", () => {
    expect(texts(strengths(byId("pikemen"), byId("ogre_brute"))).some((t) => t.startsWith("×4.5 damage"))).toBe(true);
    expect(texts(strengths(byId("ogre_brute"), byId("grunts")))).toContain("Splash hits the whole swarm");
    expect(texts(weaknesses(byId("grunts"), byId("ogre_brute")))).toContain("Its splash shreds swarms");
  });

  it("fliers against units that can't hit air", () => {
    expect(texts(strengths(byId("griffon_riders"), byId("knights")))).toContain("Flies, and Knights can't hit air");
  });
});
