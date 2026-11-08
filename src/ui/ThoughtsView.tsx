import type { ReactNode } from "react";
import essay from "../../docs/THOUGHTS.md?raw";

// The owner's essay on building the game (docs/THOUGHTS.md), read at build time. A small Markdown reader for what the
// essay uses: ## headings, paragraphs, lists (nested by indent), ``` code blocks, **bold**, *italics* and `code`.

type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "code"; text: string }
  | { kind: "list"; items: { depth: number; text: string }[] };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]);
      blocks.push({ kind: "code", text: code.join("\n").trim().replace(/\n(\s*\n)+/g, "\n\n") });
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)/);
    if (heading) {
      blocks.push({ kind: "h", text: heading[1].trim() });
      continue;
    }
    const item = line.match(/^(\s*)[-*]\s+(.*)/);
    if (item) {
      const depth = item[1].replace(/\t/g, "  ").length >> 1;
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list") last.items.push({ depth, text: item[2] });
      else blocks.push({ kind: "list", items: [{ depth, text: item[2] }] });
      continue;
    }
    if (!line.trim()) {
      blocks.push({ kind: "p", text: "" }); // a break: the next text starts a new paragraph
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last?.kind === "p" && last.text) last.text += " " + line.trim();
    else blocks.push({ kind: "p", text: line.trim() });
  }
  return blocks.filter((b) => b.kind !== "p" || b.text);
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <b key={i}>{part.slice(2, -2)}</b>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <i key={i}>{part.slice(1, -1)}</i>;
    return part;
  });
}

// List items by depth, as nested <ul>s.
function List({ items }: { items: { depth: number; text: string }[] }) {
  const top = items[0]?.depth ?? 0;
  const out: ReactNode[] = [];
  for (let i = 0; i < items.length; i++) {
    let j = i + 1;
    while (j < items.length && items[j].depth > top) j++;
    out.push(
      <li key={i}>
        {inline(items[i].text)}
        {j > i + 1 && <List items={items.slice(i + 1, j)} />}
      </li>,
    );
    i = j - 1;
  }
  return <ul>{out}</ul>;
}

const BLOCKS = parse(essay);

export function ThoughtsView() {
  return (
    <div className="page thoughts">
      <h2>Thoughts</h2>
      <p className="lede">A short essay by the game's creator on how it was built.</p>
      <article>
        {BLOCKS.map((b, i) =>
          b.kind === "h" ? (
            <h3 key={i}>{inline(b.text)}</h3>
          ) : b.kind === "p" ? (
            <p key={i}>{inline(b.text)}</p>
          ) : b.kind === "code" ? (
            <pre key={i}>{b.text}</pre>
          ) : (
            <List key={i} items={b.items} />
          ),
        )}
      </article>
    </div>
  );
}
