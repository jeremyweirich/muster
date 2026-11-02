# Multiplayer: play a friend by link

November 2026. Decided by the owner: PvP between friends by link, no matchmaking, through a tiny relay on the owner's
Cloudflare account. This doc is the plan, how it works, and the setup steps.

## What the player sees

1. On the Play tab, **Play a friend** starts a match and shows an invite link with a **Copy** button.
2. The friend opens the link and lands in round 1. Both are offered the same three opening packs (the seed is shared).
3. Each player deploys at their own pace and presses **Fight!**. The sidebar says whether the friend is still deploying
   or ready. Until the friend presses it too, **Not ready: keep deploying** takes the turn back. When both are in, both
   watch the same battle, each with their own army at the bottom.
4. Reloading, or closing the tab and coming back later through the browser history, resumes the match: the page
   address carries the player's seat token (no `localStorage`), and the relay keeps the match's messages. A slow match
   (a round a day) works too.
5. At the end: **Rematch** or **Leave match**. A third person who opens a used invite sees "This match is full".

## Why it's cheap

Battles are deterministic: the same armies, upgrades, tower levels and seed give the same battle on every machine. So
the players never stream a battle. Each round each player sends one small message (their army and what they bought),
and both browsers run the battle locally. A remote friend is just another source of the plan the AI produces.

## Pieces

| Piece | Where | What |
|---|---|---|
| Relay | `relay/` | A Cloudflare Worker with one Durable Object per match. It assigns the two seats, keeps the match's message log, and passes messages between the players. Rooms are deleted 14 days after their last message. It never reads the game messages. |
| Connection | `src/net/relay.ts` | WebSocket client: reconnects with backoff, resends what didn't arrive, keeps the log. |
| Match logic | `src/game/pvp.ts` | Message types, turning a player's deployment into a turn, the 180° view turn, rebuilding a match from the log. Pure and tested (`tests/pvp.test.ts`). |
| UI | `src/ui/PlayView.tsx`, `src/ui/PvpPanel.tsx`, `src/ui/usePvp.ts` | The invite panel, the friend's status, waiting, rematch, leave. `src/net/config.ts` holds the relay's address. |

### Messages

The relay stores every message in order and sends the whole log to a player when they connect. Each message has an
`id`, so a resend after a dropped connection is recognised, and each is keyed by match number and round, so a
duplicate is ignored.

- `hello { build }`: the sender's build. A different build from the friend shows a warning (both should reload).
- `start { game, seed }`: a new match (the host's first, or a rematch from either player).
- `turn { game, round, turn }`: the sender's whole army in their own view of the field, plus their opening choice,
  unlocks, upgrades and tower levels bought this round. The receiver turns the army round 180° into its own view.
- `cancel { game, round }`: takes the sender's turn back. A seat's turn counts until it cancels; a turn after that
  counts again. Once the relay's log holds both seats' turns the round is **locked**, and later cancels change nothing
  (`roundTurns` in `src/game/pvp.ts`). Only messages the relay has confirmed can lock a round, so if a cancel and the
  friend's turn cross, the relay's order decides for both browsers. A player whose cancel lost that race fights the
  turn they sent: the battle is rebuilt from the log, not from what's on their screen.
- `outcome { game, round, sig, … }`: the battle's result and a signature of it, so the two browsers can compare.

### Seats and the view

- The host is side 0 and the friend side 1 in the battle both browsers run. The sim isn't symmetric under a side
  swap, so both must run exactly the same battle.
- Each browser keeps its own match state with "me = side 0", so the deploy screen is unchanged. The friend's turn is
  turned 180° on arrival (x and y mirrored). The Keeps sit 180° apart, so each Keep keeps its index.
- When the friend's browser builds the battle it swaps the two sides back to the host's view, and draws the battle
  turned 180° with the team colours swapped (`drawBattle(…, flip)`). Text, health bars and fliers stay upright.

### Keeping both browsers in step

- Only exact float maths in the sim: `+ − × ÷` and `sqrt` give the same answer in every browser. `sin`, `cos` and
  `atan2` don't. Summoned models used to spawn at a `cos`/`sin` angle and now pick from a fixed table of 16
  directions. `atan2` only sets which way a model faces on screen.
- After each battle both browsers post an `outcome`. If they differ, the host's is right: the friend's browser
  rebuilds the match from the log using the host's results and says so.
- The receiver checks a turn adds up (it didn't spend more than it had). Between friends this is a warning, not a
  block. The deployment isn't shown until both players are ready, though someone could read it in the browser's
  developer tools. A hash-then-reveal step can be added later if that ever matters.

## Privacy

Single-player makes no network calls. The game connects only after someone clicks **Play a friend** or opens an
invite link, and only to the owner's relay. The relay stores the match messages (armies and purchases) and nothing
about the players; Cloudflare's own request logs see IP addresses, as any web host does.

## Setup (owner, once)

Done on November 1, 2026: the relay runs at `https://common-ground-relay.common-ground-relay.workers.dev` (Worker
`common-ground-relay` on the owner's Cloudflare account; the subdomain was registered automatically on the first deploy
and can be renamed in the Cloudflare dashboard, then update `src/net/config.ts`). The steps, for reference or a fresh
account:

You need the free Cloudflare account. Wrangler (Cloudflare's tool) needs Node 20 or newer; the relay's scripts run it
under a portable Node 22 through `npx`, so the machine's own Node version doesn't matter.

1. In a terminal at the repo root:
   ```bash
   cd relay
   npm install
   npm run login      # opens the browser: sign in to Cloudflare and click Allow
   npm run deploy
   ```
   The first deploy may ask you to choose a `workers.dev` subdomain (any name, e.g. your username). It prints the
   relay's address, like `https://common-ground-relay.<your-subdomain>.workers.dev`.
2. Put that address in `src/net/config.ts` (`PROD_RELAY_URL`), commit and push. The site redeploys as usual, and the
   **Play a friend** button appears on the live site (it's hidden while no relay is set).
3. Later relay changes: `cd relay && npm run deploy` again. Game-only changes need nothing here.

To check it's alive, open the relay's address in a browser: it answers "Common Ground relay". The relay only accepts
connections from `https://jeremyweirich.github.io` and from local development addresses (`ALLOWED_ORIGINS` in
`relay/wrangler.jsonc`).

## Local development

- `npm run relay` starts a stand-in relay at `ws://localhost:8787` (`relay/dev-server.ts`: plain Node, the same
  protocol and the same seat rules from `relay/src/core.ts`, rooms in memory). Wrangler's own local mode
  (`npm --prefix relay run dev`) runs the real Durable Object, but its runtime crashes on the owner's Windows 10 machine
  (it wants a newer Visual C++ runtime), hence the stand-in.
- `npm run dev` in another terminal. On `localhost` (or a LAN address, for a phone) the game uses the local relay.
- Click **Play a friend**, then open the invite link in a second window (a private window, or another browser).
- A player who reloads before sending their turn comes back to the last battle's result and clicks **Next round**
  again; whatever they had placed but not sent is gone. A turn that was sent is kept.

## Not yet checked

- First real match (Nov 1, 2026): the owner and a friend on their own machines (the friend's a Mac). Their notes asked
  for taking back Fight (now built) and reported no desync.
- Cross-browser determinism: Firefox and Safari running the same battle as Chrome. Playwright's Firefox and WebKit
  could run `npm run bench`'s fights in each engine and compare fingerprints. A mismatch in play shows a notice and the
  host's result wins.

## Not built (ideas)

- Hash-then-reveal turns, spectators, emotes or chat, a turn timer.
- A GitHub Action that deploys the relay when `relay/` changes.
