import { CAMPAIGNS } from "../data/campaign";
import { FACTIONS } from "../data/roles";
import { CodexLink } from "./codexLinks";

// The campaigns, in the order they're meant to be played. They aren't playable yet; Play is the full game.
export function StoryView() {
  return (
    <div className="page story">
      <h2>Story</h2>
      <p className="lede">
        Generations ago, the three peoples fought a war that nearly wrecked the world: walls against swarms against storms. It ended in a
        treaty, the Compact. Now every dispute over land, insults and old grudges is settled on the Field. Each commander chooses
        champions and places them, and once the horn sounds, no one may touch the fight. The rules are the same for everyone.
      </p>
      <p className="muted">
        Three campaigns are on the way, one for each people. Until then, <a href="#play">Play</a> is the whole game, with every unit, and
        the <CodexLink topic="compact">Codex</CodexLink> explains the rules.
      </p>
      <div className="campaigns">
        {CAMPAIGNS.map((c, i) => (
          <section key={c.id} className={`campaign campaign-${c.faction}`}>
            <div className="campaign-head">
              <span className="campaign-num">{i + 1}</span>
              <div>
                <h3>{c.title}</h3>
                <span className="muted small">{FACTIONS.find((f) => f.id === c.faction)?.name} · coming soon</span>
              </div>
            </div>
            <p className="campaign-tagline">{c.tagline}</p>
            {c.missions.length > 0 && (
              <ol className="missions">
                {c.missions.map((m) => (
                  <li key={m.title}>
                    <b>{m.title}</b> <span className="muted">{m.teaser}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
