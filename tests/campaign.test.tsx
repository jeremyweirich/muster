import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAST, MISSIONS, planTurn, type MissionDef, type Plan } from "../src/data/campaign";
import { DEFAULT_UNITS } from "../src/data/units";
import { defMap } from "../src/game/army";
import { runMission } from "../src/game/missionRun";
import { CodexView } from "../src/ui/CodexView";
import { boardDiagram, Briefing, Debrief } from "../src/ui/Mission";

const defs = defMap(DEFAULT_UNITS);

// The mission as the game plays it (src/game/missionRun.ts), with no move a real player couldn't make: both sides'
// squads fit their zones without overlapping, the player never overspends, and the enemy fields only its units.
function play(m: MissionDef, plan: Plan) {
  const run = runMission(m, plan, defs);
  expect(run.problems).toEqual([]);
  return run;
}

describe("story missions", () => {
  it("has at least one playable mission, with unique ids", () => {
    expect(MISSIONS.length).toBeGreaterThan(0);
    expect(new Set(MISSIONS.map((m) => m.def.id)).size).toBe(MISSIONS.length);
  });

  for (const { def: m } of MISSIONS) {
    describe(m.id, () => {
      it("uses real units, a real cast and a hint for every loss", () => {
        for (const id of [...m.units, ...(m.shop ?? []), ...m.enemy.units]) expect(defs.has(id), id).toBe(true);
        for (const rank of m.page.diagram ?? []) for (const id of rank) expect(defs.has(id), id).toBe(true);
        for (const [unitId, ids] of Object.entries(m.enemy.upgrades ?? {})) for (const id of ids) expect(defs.get(unitId)?.upgrades?.some((u) => u.id === id), `${unitId} ${id}`).toBe(true);
        for (const l of [...m.briefing, ...m.win, ...m.hints.map((h) => h.line)]) expect(CAST[l.who]).toBeDefined();
        expect(m.hints.some((h) => !h.when), "a loss always gets a hint").toBe(true);
        for (const plan of [...m.reference.wins, ...m.reference.loses])
          for (const round of plan) for (const [unitId, id] of planTurn(round).upgrades ?? []) expect(defs.get(unitId)?.upgrades?.some((u) => u.id === id), `${unitId} ${id}`).toBe(true);
      });

      // whole matches, several per mission: CI runs several times slower than a desktop
      it("the armies that should win do, and the ones that should lose do", { timeout: 60_000 }, () => {
        m.reference.wins.forEach((plan, i) => expect(play(m, plan).won, `wins[${i}]`).toBe(true));
        m.reference.loses.forEach((plan, i) => expect(play(m, plan).won, `loses[${i}]`).toBe(false));
        if (m.reference.commended) expect(play(m, m.reference.commended).commended).toBe(true);
      });

      it("a lost mission's debrief has a hint", { timeout: 30_000 }, () => {
        expect(play(m, m.reference.loses[0]).hint).not.toBeNull();
      });
    });
  }

  it("a finale's debrief draws the winning board as the book's last page", { timeout: 30_000 }, () => {
    for (const { def: m } of MISSIONS.filter((e) => e.def.lastPage)) {
      const run = play(m, m.reference.wins[0]);
      const html = renderToStaticMarkup(<Debrief def={m} outcome={run} army={run.state.armies[0]} onRetry={() => {}} onLeave={() => {}} />);
      expect(html).toContain(m.lastPage!.title.replace(/'/g, "&#x27;"));
      const ranks = boardDiagram(run.state.armies[0]);
      expect(ranks.flat().sort()).toEqual(run.state.armies[0].map((sq) => sq.defId).sort());
    }
  });

  it("every Codex link in a briefing has a target", () => {
    const codex = renderToStaticMarkup(<CodexView />);
    for (const entry of MISSIONS) {
      const html = renderToStaticMarkup(<Briefing entry={entry} onStart={() => {}} onBack={() => {}} />);
      for (const [, topic] of html.matchAll(/href="#codex\/([^"]+)"/g)) expect(codex, topic).toContain(`id="codex-${topic}"`);
    }
  });
});
