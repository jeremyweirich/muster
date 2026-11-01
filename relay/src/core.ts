// The relay's rules, kept free of Cloudflare APIs so the game's tests can check them (tests/pvp.test.ts).

export type Seat = 0 | 1;
export type SeatError = "notfound" | "full" | "taken";

// Which seat a connection gets. A known token gets its seat back. The first player into an empty room hosts. An invite
// (`claim: "guest"`) takes the second seat if the room has a host and the seat is free.
export function seatFor(
  tokens: [string | null, string | null],
  token: string,
  claim: "guest" | undefined,
): { seat: Seat; claimed: boolean } | { error: SeatError } {
  if (tokens[0] === token) return { seat: 0, claimed: false };
  if (tokens[1] === token) return { seat: 1, claimed: false };
  if (claim === "guest") {
    if (!tokens[0]) return { error: "notfound" };
    if (tokens[1]) return { error: "full" };
    return { seat: 1, claimed: true };
  }
  if (!tokens[0]) return { seat: 0, claimed: true };
  return { error: "taken" };
}

export const ID_PATTERN = /^[a-z0-9]{6,40}$/;
export const MAX_MESSAGE = 32 * 1024; // characters; a turn is a few KB
export const MAX_LOG = 4000; // messages per room
export const ROOM_TTL_MS = 14 * 24 * 3600 * 1000; // a room is deleted this long after its last message

export interface LogEntry {
  seq: number;
  from: Seat;
  body: unknown;
}

// What a player sends: a message to append to the log. Anything else is ignored.
export function parsePost(raw: string): { body: unknown } | null {
  if (raw.length > MAX_MESSAGE) return null;
  try {
    const m = JSON.parse(raw) as { t?: unknown; body?: unknown };
    if (m && m.t === "post" && m.body && typeof m.body === "object") return { body: m.body };
  } catch {
    // not JSON
  }
  return null;
}

// Pages allowed to use the relay: the live site, plus local development.
export function originAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return false;
  if (allowed.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);
  } catch {
    return false;
  }
}
