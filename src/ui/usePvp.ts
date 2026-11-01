import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Entry, PvpBody } from "../game/pvp";
import { relayUrl } from "../net/config";
import { RelayClient, type RelaySnapshot } from "../net/relay";

// A PvP seat: the match room, this player's seat token, and (for an invite not yet accepted) the claim on seat 2.
export interface PvpLink {
  room: string;
  token: string;
  claim?: "guest";
}

const ID = /^[a-z0-9]{6,40}$/;

// The page address carries the seat, so a reload (or the browser history) gets back into the match: ?join=<room> is
// an invite, ?match=<room>.<token> is a seat.
export function parsePvpLink(search: string, newToken: () => string): PvpLink | null {
  const q = new URLSearchParams(search);
  const join = q.get("join");
  if (join && ID.test(join)) return { room: join, token: newToken(), claim: "guest" };
  const [room, token] = (q.get("match") ?? "").split(".");
  return room && token && ID.test(room) && ID.test(token) ? { room, token } : null;
}

export function setPageQuery(query: string) {
  try {
    history.replaceState(null, "", `${location.pathname}${query}${location.hash}`);
  } catch {
    // some embedded hosts disallow history changes
  }
}

export function inviteUrl(room: string): string {
  return `${location.origin}${location.pathname}?join=${room}`;
}

const EMPTY: RelaySnapshot<PvpBody> = { status: "failed", error: null, seat: null, log: [], pending: [], online: [false, false], everOpen: false };
const noSubscribe = () => () => {};
const getEmpty = () => EMPTY;

// The connection to a PvP room, with the log as entries (messages still on their way are included, so the page never
// posts the same thing twice).
export function usePvpConnection(link: PvpLink | null) {
  const [client, setClient] = useState<RelayClient<PvpBody> | null>(null);
  const url = relayUrl();
  useEffect(() => {
    if (!link || !url) return;
    const c = new RelayClient<PvpBody>(url, link.room, link.token, link.claim);
    setClient(c);
    return () => {
      c.close();
      setClient(null);
    };
  }, [link?.room, link?.token, url]);
  const snap = useSyncExternalStore(client?.subscribe ?? noSubscribe, client?.get ?? getEmpty);

  // once the relay has given us a seat, the address becomes the seat's
  useEffect(() => {
    if (link && snap.seat !== null) setPageQuery(`?match=${link.room}.${link.token}`);
  }, [link?.room, link?.token, snap.seat]);

  const entries = useMemo<Entry[]>(
    () => (snap.seat === null ? snap.log : [...snap.log, ...snap.pending.map((body) => ({ seq: -1, from: snap.seat!, body }))]),
    [snap.log, snap.pending, snap.seat],
  );
  return {
    configured: !!url,
    snap: client ? snap : { ...EMPTY, status: url ? ("connecting" as const) : ("failed" as const) },
    entries,
    post: (body: PvpBody) => client?.post(body),
  };
}
