// Every word a player reads, in one Markdown page, for editing the copy for consistency and tone:
//   npm run -s copy-doc > docs/COPY.md
// The Story tab; per mission: what it teaches (from docs/CAMPAIGN.md), the Take the Field screen (briefing, Drill Book
// page and its pencil note, objective), the lines between rounds, the debrief on a win (with its pencil note), the
// hints on a loss, and the commendation. Lines from scripted rounds are found by playing the mission's reference plans.
// Then How to play, every unit (description, upgrades, showcase caption), the role chips, the Codex and the letter for
// beating Hard; the screens written in JSX are rendered and turned back into Markdown. Edits made to the page go back
// into the source by hand (or ask Claude); then regenerate.
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CAMPAIGNS, CAST, type Line, type MissionDef } from "../src/data/campaign";
import { FACTIONS, factionOf, rolesOf, ROLES } from "../src/data/roles";
import { SHOWCASES } from "../src/data/showcases";
import { TOWER_DEFS } from "../src/data/towers";
import { DEFAULT_UNITS } from "../src/data/units";
import { runMission } from "../src/game/missionRun";
import { CodexView } from "../src/ui/CodexView";
import { introSteps } from "../src/ui/Intro";
import { LoveLetter } from "../src/ui/LoveLetter";
import { StoryIntro } from "../src/ui/StoryView";

// The one thing each mission is built to teach (design notes, not shown in the game).
const TEACHES: Record<string, string> = {
  "wardens-1": "Placing, then letting go: Knights in front, Crossbowmen behind. Crossbowmen alone get swarmed by a mob.",
  "wardens-2":
    "Rounds and HP: what is placed stays placed. You see their last army, never what they will add, so read it and answer (they hit the flank you left thin).",
  "wardens-3": "Keeps: when one falls, the whole army is Dazed. Guard the flanks with Knights; Keep levels only buy time.",
  "wardens-4":
    "Ballistae and depth: trolls beat a Knight line, so put Ballistae behind Knights, and keep the Knights at the back so the trolls come to them through the slow ground under the bolts.",
  "wardens-5":
    "Upgrades, yours and theirs: the enemy's upgrades show as stars, and the answer is an upgrade of your own (Repeaters), which reaches every squad already on the Field.",
  "wardens-6": "Clerics: hold the one way across with Knights, and keep them standing with Clerics behind them. The river rules out flanking.",
  "wardens-7": "The air: Knights can't hit what flies. Know which units can (Crossbowmen, Ballistae, Griffon Riders).",
  "wardens-8": "Veterancy: squads that live earn levels. Promote them, and put Dwarven Pikemen where the biggest enemy walks.",
  "wardens-9": "The full Compact: deploy blind from round 1, and use everything from the book at once.",
};

const say = (l: Line) => `**${CAST[l.who].name}:** ${l.text}`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// The lines said while the player deploys, by round: the mission's own (roundLines), then the enemy script's.
// Scripted rounds (functions) are found by playing the reference plans.
function roundLines(m: MissionDef): string[] {
  const out: string[] = [];
  for (const [round, line] of Object.entries(m.roundLines ?? {})) out.push(`- Round ${round}: ${say(line)}`);
  m.enemy.rounds.forEach((r, i) => {
    if (typeof r !== "function" && !Array.isArray(r) && r.line) out.push(`- Round ${i + 1}: ${say(r.line)}`);
  });
  const scripted = new Map<string, { line: Line; rounds: Set<number> }>();
  const plans = [...m.reference.wins, ...m.reference.loses, ...(m.reference.commended ? [m.reference.commended] : [])];
  for (const plan of plans) {
    for (const r of runMission(m, plan).rounds) {
      if (!r.line || typeof m.enemy.rounds[Math.min(r.round, m.enemy.rounds.length) - 1] !== "function") continue;
      const k = `${r.line.who}|${r.line.text}`;
      if (!scripted.has(k)) scripted.set(k, { line: r.line, rounds: new Set() });
      scripted.get(k)!.rounds.add(r.round);
    }
  }
  for (const { line, rounds } of scripted.values()) {
    const rs = [...rounds].sort((a, b) => a - b);
    out.push(`- Round ${rs.length > 1 ? `${rs[0]}–${rs[rs.length - 1]}` : rs[0]} (scripted: when depends on how the match goes). ${say(line)}`);
  }
  return out;
}

// A hint's condition, as code: enough to tell which mistake it answers.
function condition(when?: (c: never) => boolean): string {
  if (!when) return "otherwise";
  return "`" + when.toString().replace(/^\(?c\)?\s*=>\s*/, "").replace(/\s+/g, " ") + "`";
}

// A rendered screen as Markdown: headings (h2 → `##`, deeper by `shift`), paragraphs, lists, tables, bold, keys and
// buttons ([like this]). Pictures (svg) and the Codex's contents (nav) are left out; links keep only their words.
function markdown(el: ReactElement, shift = 0): string {
  const html = renderToStaticMarkup(el)
    .replace(/<svg[\s\S]*?<\/svg>/g, "")
    .replace(/<nav[\s\S]*?<\/nav>/g, "")
    .replace(/<\/a><a class="unit-chip"/g, '</a>, <a class="unit-chip"');
  const entity = (s: string) =>
    s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  const out: string[] = [];
  let cur = "";
  let indent = "";
  const lists: { ordered: boolean; n: number }[] = [];
  let row: string[] | null = null;
  let rows = 0;
  const add = (s: string) => (row ? (row[row.length - 1] += s) : (cur += s));
  const flush = () => {
    const t = cur.replace(/\s+/g, " ").trim();
    if (t) out.push(indent + t);
    cur = "";
    indent = "";
  };
  for (const [tok, close, tag] of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>|[^<]+/g)) {
    const opening = !close;
    switch (tag) {
      case undefined:
        add(entity(tok));
        break;
      case "h2":
      case "h3":
      case "h4":
      case "h5":
        flush();
        out.push("");
        if (opening) cur = "#".repeat(Number(tag[1]) + shift) + " ";
        break;
      case "p":
        flush();
        if (!opening && !lists.length) out.push("");
        break;
      case "ul":
      case "ol":
        flush();
        if (opening) lists.push({ ordered: tag === "ol", n: 0 });
        else if ((lists.pop(), !lists.length)) out.push("");
        break;
      case "li":
        flush();
        if (opening) {
          const l = lists[lists.length - 1];
          indent = "  ".repeat(lists.length - 1) + (l?.ordered ? `${++l.n}. ` : "- ");
        }
        break;
      case "table":
        flush();
        if (opening) rows = 0;
        else out.push("");
        break;
      case "tr":
        if (opening) row = [];
        else if (row) {
          out.push(`| ${row.map((c) => c.replace(/\s+/g, " ").trim()).join(" | ")} |`);
          if (++rows === 1) out.push(`|${row.map(() => " --- |").join("")}`);
          row = null;
        }
        break;
      case "td":
      case "th":
        if (opening) row?.push("");
        break;
      case "div":
      case "section":
        flush();
        if (!lists.length) out.push("");
        break;
      case "b":
      case "strong":
        add("**");
        break;
      case "i":
      case "em":
        add("*");
        break;
      case "kbd":
        add("`");
        break;
      case "button":
        add(opening ? " [" : "] ");
        break;
      case "br":
        add(" ");
        break;
    }
  }
  flush();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const out: string[] = [];
out.push("# Common Ground: the copy");
out.push("");
out.push(
  "Every word a player reads, for editing for consistency and tone: the Story tab and its missions, How to play, the units, the Codex. Generated by `npm run -s copy-doc > docs/COPY.md`: edit here, then the changes go back into the source (ask Claude) and this page is regenerated. The voices are in `docs/VISION.md`. Numbers in the Codex and How to play come from the rules, so changing one there means changing the rule.",
);
out.push("");
out.push("Contents: [Story](#story) · the missions · [How to play](#how-to-play) · [Units](#units) · [Role chips](#role-chips) · [Codex](#codex) · [After beating Hard](#after-beating-hard)");
out.push("");
out.push(markdown(createElement(StoryIntro, { onPlayFull: () => {} })));
out.push("");
out.push("The campaigns:");
out.push("");
for (const c of CAMPAIGNS) out.push(`- **${c.title}:** ${c.tagline}${c.missions.length ? "" : " *(not built yet)*"}`);

for (const c of CAMPAIGNS) {
  c.missions.forEach((mi, i) => {
    const m = mi.play;
    if (!m) return;
    out.push("", "---", "", `## ${c.title}, mission ${i + 1}: ${mi.title}`, "");
    out.push(`**Teaches** (design note, not shown): ${TEACHES[m.id] ?? "*(not written yet)*"}`, "");
    out.push(`**On the Story list:** ${mi.teaser}`, "");

    out.push("### Take the Field screen", "");
    out.push("Briefing:", "");
    for (const l of m.briefing) out.push(`- ${say(l)}`);
    out.push("", `Drill Book page, **${m.page.title}**:`, "", `> "${m.page.text}"`);
    if (m.page.note) out.push("", `*Pencil note: ${m.page.note}*`);
    out.push("", `**Objective:** ${m.objective}`, "");

    const lines = roundLines(m);
    out.push("### During the match", "");
    out.push(...(lines.length ? lines : [m.hp ? "*(no lines)*" : "*(one battle, no lines)*"]));

    out.push("", "### Debrief after a win", "");
    for (const l of m.win) out.push(`- ${say(l)}`);
    if (m.winNote) out.push("", `*Pencil note: ${m.winNote}*`);
    if (m.lastPage) {
      const ink = m.lastPage.handwritten ? `"${m.lastPage.handwritten}" Below it, ${lowerFirst(m.lastPage.text)}` : m.lastPage.text;
      out.push("", `Then a page of the book, **${m.lastPage.title}**: ${ink}`);
    }

    out.push("", "### Hints after a loss (the first that matches)", "");
    for (const h of m.hints) out.push(`- When ${condition(h.when)}: ${say(h.line)}`);

    if (m.commendation) out.push("", "### Commendation", "", `**${m.commendation.name}:** ${m.commendation.text}`);
  });
}

out.push("", "---", "", "## How to play", "");
out.push("Shown the first time the site opens on Play, and from the header's How to play button:", "");
for (const s of introSteps(false)) out.push(`### ${s.title}`, "", markdown(createElement("div", null, s.body)), "");
out.push("After the Wardens campaign's finale, a version about what the campaign didn't cover:", "");
for (const s of introSteps(true)) out.push(`### ${s.title}`, "", markdown(createElement("div", null, s.body)), "");

// Squads by name, counted: "3× Grunts, Knights".
const unitName = new Map(DEFAULT_UNITS.map((u) => [u.id, u.name]));
const squads = (ids: string[]) => {
  const n = new Map<string, number>();
  for (const id of ids) n.set(id, (n.get(id) ?? 0) + 1);
  return [...n].map(([id, k]) => `${k > 1 ? `${k}× ` : ""}${unitName.get(id) ?? id}`).join(", ");
};
out.push("---", "", "## Units", "");
out.push("The Units tab and the shop: each unit's roles and one-line description, its four upgrades, and the caption under its showcase fight.");
for (const f of FACTIONS) {
  out.push("", `### ${f.name}`);
  for (const u of DEFAULT_UNITS.filter((d) => factionOf(d.tags) === f.id)) {
    out.push("", `#### ${u.name}`, "", `*${rolesOf(u.tags).map((r) => r.name).join(", ")}*`, "", u.description ?? "*(no description)*", "");
    for (const up of u.upgrades ?? []) out.push(`- **${up.name}:** ${up.description ?? "*(no description)*"}`);
    const sc = SHOWCASES[u.id];
    if (sc) {
      const side = `${sc.squads && sc.squads > 1 ? `${sc.squads}× ` : ""}${u.name}${sc.allies ? ` with ${squads(sc.allies)}` : ""}`;
      out.push("", `Showcase (${side} against ${squads(sc.vs)}): ${sc.caption}`);
    }
  }
}
out.push("", "### Keeps", "");
for (const t of TOWER_DEFS) out.push(`**${t.name}:** ${t.description}`);

out.push("", "---", "", "## Role chips", "");
out.push("The one-line version, on unit cards and in tooltips. The long version is each role's Codex entry.", "");
for (const r of Object.values(ROLES)) out.push(`- **${r.name}:** ${r.description}`);

out.push("", "---", "", markdown(createElement(CodexView, {})));

out.push("", "---", "", "## After beating Hard", "");
out.push(markdown(createElement(LoveLetter, { onClose: () => {} }), 1));

console.log(out.join("\n"));
