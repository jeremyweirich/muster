// Every word of the story campaigns in one Markdown page, for editing the copy for consistency and tone:
//   npm run -s copy-doc > docs/COPY.md
// Per mission: what it teaches (from docs/CAMPAIGN.md), the Take the Field screen (briefing, Drill Book page and its
// pencil note, objective), the lines between rounds, the debrief on a win (with its pencil note), the hints on a loss,
// and the commendation. Lines from scripted rounds are found by playing the mission's reference plans. Edits made to
// the page go back into src/data/campaign.ts by hand (or ask Claude); then regenerate.
import { CAMPAIGNS, CAST, type Line, type MissionDef } from "../src/data/campaign";
import { runMission } from "../src/game/missionRun";

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

const out: string[] = [];
out.push("# Common Ground: the story copy");
out.push("");
out.push(
  "Every word the story campaigns show, mission by mission, for editing for consistency and tone. Generated from `src/data/campaign.ts` by `npm run -s copy-doc > docs/COPY.md`: edit here, then the changes go back into `campaign.ts` (ask Claude) and this page is regenerated. The voices are in `docs/VISION.md`.",
);
out.push("");
out.push("## The campaigns (Story tab)");
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

console.log(out.join("\n"));
