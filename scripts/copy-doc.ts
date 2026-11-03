// Every word of the story campaigns in one Markdown page, for editing the copy for consistency and tone:
//   npm run copy-doc > docs/COPY.md
// Per mission: what it teaches (from docs/CAMPAIGN.md), the Take the Field screen (briefing, Drill Book page,
// objective, kit line), the enemy's lines as it deploys, the debrief on a win, the hints on a loss, and the
// commendation. Lines from scripted rounds are found by playing the mission's reference plans. Edits made to the
// page go back into src/data/campaign.ts by hand (or ask Claude); then regenerate.
import { CAMPAIGNS, CAST, type Line, type MissionDef } from "../src/data/campaign";
import { DEFAULT_UNITS } from "../src/data/units";
import { unlockPrice } from "../src/game/army";
import { runMission } from "../src/game/missionRun";

// The one thing each mission is built to teach (design notes, not shown in the game).
const TEACHES: Record<string, string> = {
  "wardens-1": "Placing, then letting go: steel in front, arrows behind. Crossbowmen alone get swarmed by a mob.",
  "wardens-2":
    "Rounds and HP: what is placed stays placed. You see their last army, never what they will add, so read it and answer (they hit the flank you left thin).",
  "wardens-3": "Keeps: when one falls, the whole army is Dazed. Guard the flanks with steel; Keep levels only buy time.",
  "wardens-4": "Unlocks and big units: trolls beat a Knight line, so buy an engine from the armory (the Ballista) and put steel in front of it.",
  "wardens-5": "Upgrades, yours and theirs: the enemy's gadgets show as stars, and the answer is a drill of your own (Repeaters), which reaches every squad already on the Field.",
  "wardens-6": "The air: Knights can't strike what flies. Know which champions can (bows, Griffon Riders).",
  "wardens-7": "Veterancy: squads that live earn levels. Promote them, and put the longest weapons (pikes) where the biggest enemy walks.",
  "wardens-8": "The full Compact: choose an opening, deploy blind from round 1, and use every page of the book at once.",
};

const UNITS = new Map(DEFAULT_UNITS.map((u) => [u.id, u]));
const unitName = (id: string) => UNITS.get(id)?.name ?? id;
const say = (l: Line) => `**${CAST[l.who].name}:** ${l.text}`;
const quote = (s: string) => s.split("\n").map((l) => `> ${l}`).join("\n");

// The kit line under the briefing, as Briefing (src/ui/Mission.tsx) builds it.
function kitLine(m: MissionDef): string {
  const parts: string[] = [];
  if (m.units.length) parts.push(`Your champions: ${m.units.map(unitName).join(", ")}.`);
  if (m.opening) parts.push(`Round 1 offers three packs (${m.opening.map(([a, b]) => `${unitName(a)} and ${unitName(b)}`).join("; ")}) or the war chest.`);
  if (m.shop?.length) parts.push(`In the armory: ${m.shop.map((id) => `${unitName(id)} (unlock ${unlockPrice(UNITS.get(id)!)})`).join(", ")}.`);
  if (!m.hp) parts.push("One battle decides it.");
  else if (m.hp[0] === m.hp[1]) parts.push(`Each side starts with ${m.hp[0]} HP.`);
  else parts.push(`You start with ${m.hp[0]} HP, ${m.enemy.name} with ${m.hp[1]}.`);
  return parts.join(" ");
}

// The enemy's lines as it deploys, by round. Scripted rounds (functions) are found by playing the reference plans.
function enemyLines(m: MissionDef): string[] {
  const out: string[] = [];
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
  m.enemy.rounds.forEach((r, i) => {
    if (typeof r !== "function" && !Array.isArray(r) && r.line) out.push(`- Round ${i + 1}. ${say(r.line)}`);
  });
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
  "Every word the story campaigns show, mission by mission, for editing for consistency and tone. Generated from `src/data/campaign.ts` by `npm run copy-doc > docs/COPY.md`: edit here, then the changes go back into `campaign.ts` (ask Claude) and this page is regenerated. The voices are in `docs/VISION.md`.",
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
    out.push("", `Drill Book page, **${m.page.title}**:`, "", quote(`“${m.page.text}”`));
    if (m.page.drill) out.push(">", quote(`*${m.page.drill}*`));
    out.push("", `**Objective** (also the sidebar's line while deploying): ${m.objective}`, "");
    out.push(`**Kit line** (built from the mission's setup): ${kitLine(m)}`, "");

    const lines = enemyLines(m);
    out.push("### During the match", "");
    out.push(...(lines.length ? lines : ["*(the enemy says nothing)*"]));

    out.push("", "### Debrief after a win", "");
    for (const l of m.win) out.push(`- ${say(l)}`);
    if (m.lastPage) out.push("", `Then a page of the book, **${m.lastPage.title}**: ${m.lastPage.text}`);

    out.push("", "### Hints after a loss (the first that matches)", "");
    for (const h of m.hints) out.push(`- When ${condition(h.when)}: ${say(h.line)}`);

    if (m.commendation) out.push("", "### Commendation", "", `**${m.commendation.name}:** ${m.commendation.text}`);
  });
}

console.log(out.join("\n"));
