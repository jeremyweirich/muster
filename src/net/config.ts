// Where the PvP relay lives (relay/, docs/MULTIPLAYER.md). Paste the address `wrangler deploy` printed here.
// Until it's set, the live site says multiplayer isn't available yet.
export const PROD_RELAY_URL: string = "https://common-ground-relay.common-ground-relay.workers.dev";

// On a development machine (localhost, or the LAN address you open on a phone) the game uses `npm run relay`.
export function relayUrl(): string | null {
  const host = location.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);
  if (local) return `ws://${host}:8787`;
  return PROD_RELAY_URL ? PROD_RELAY_URL.replace(/^http/, "ws").replace(/\/$/, "") : null;
}
