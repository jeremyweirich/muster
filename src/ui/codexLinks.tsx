import type { ReactNode } from "react";

// Codex topics are anchors on the Codex tab (#codex/<topic>). Game screens link keywords here
// instead of explaining the rules again. Topic ids: role-<id>, element-<id>, status-<id>,
// surface-<id>, plus the rule sections in CodexView (layers, keeps, reactions, ...).
export function codexHref(topic: string): string {
  return `#codex/${topic}`;
}

export function CodexLink({ topic, children, className = "kw" }: { topic: string; children: ReactNode; className?: string }) {
  return (
    <a className={className} href={codexHref(topic)}>
      {children}
    </a>
  );
}

// Words in player-facing text (descriptions, effects) that have a Codex entry. Order matters:
// longer phrases first, so "burning ground" becomes the Fire surface rather than the Burning status.
export const KEYWORDS: [RegExp, string][] = [
  [/burning ground/i, "surface-fire"],
  [/electrified water/i, "surface-shockwater"],
  [/\bfliers?\b/i, "role-flier"],
  [/\bswarms?\b/i, "role-swarm"],
  [/\bsplash(es)?\b/i, "role-splash"],
  [/\b(burning|burns?)\b/i, "status-burning"],
  [/\bwet\b/i, "status-wet"],
  [/\bchill(ed|s)?\b/i, "status-chilled"],
  [/\b(frozen|freez(e|es|ing))\b/i, "status-frozen"],
  [/\bshock(ed|s)?\b/i, "status-shocked"],
  [/\boiled\b/i, "status-oiled"],
  [/\bdaze(d|s)?\b/i, "status-dazed"],
  [/\boil\b/i, "surface-oil"],
  [/\bpuddles?\b/i, "surface-puddle"],
  [/\bsteam\b/i, "surface-steam"],
  [/\bice\b/i, "surface-ice"],
  [/\b(conduct|shatter(s|ing)?|ignit(e|es|ing))\b/i, "reactions"],
  [/\b(keeps?|towers?)\b/i, "keeps"],
  [/\bfire\b/i, "element-fire"],
  [/\bwater\b/i, "element-water"],
  [/\bfrost\b/i, "element-frost"],
  [/\blightning\b/i, "element-lightning"],
  [/\bphysical\b/i, "element-physical"],
];

// Renders text with the first mention of each Codex keyword as a link. `except` skips a topic,
// so a Codex entry doesn't link to itself.
export function Linked({ text, except }: { text: string; except?: string }) {
  const parts: ReactNode[] = [];
  const used = new Set<string>(except ? [except] : []);
  let rest = text;
  let key = 0;
  for (;;) {
    let best: { index: number; length: number; topic: string } | null = null;
    for (const [re, topic] of KEYWORDS) {
      if (used.has(topic)) continue;
      const m = re.exec(rest);
      if (m && (!best || m.index < best.index)) best = { index: m.index, length: m[0].length, topic };
    }
    if (!best) break;
    if (best.index > 0) parts.push(rest.slice(0, best.index));
    parts.push(
      <CodexLink key={key++} topic={best.topic}>
        {rest.slice(best.index, best.index + best.length)}
      </CodexLink>,
    );
    used.add(best.topic);
    rest = rest.slice(best.index + best.length);
  }
  if (rest) parts.push(rest);
  return <>{parts}</>;
}
