import type { Side } from "../sim/types";

// A connection to one match room on the relay (relay/src/index.ts). It keeps the room's message log, reconnects with
// backoff when the connection drops, and resends anything that hadn't arrived. Snapshots are immutable, for React.

export type RelayStatus = "connecting" | "open" | "offline" | "failed";
export type RelayError = "notfound" | "full" | "taken" | "bad" | "replaced" | "toolong";

export interface RelayEntry<B> {
  seq: number;
  from: Side;
  body: B;
}

export interface RelaySnapshot<B> {
  status: RelayStatus;
  error: RelayError | null;
  seat: Side | null;
  log: RelayEntry<B>[];
  pending: B[]; // posted, not yet echoed back by the relay
  online: [boolean, boolean];
  everOpen: boolean;
}

type ServerMsg<B> =
  | { t: "welcome"; seat: Side; log: RelayEntry<B>[]; online: [boolean, boolean] }
  | { t: "entry"; entry: RelayEntry<B> }
  | { t: "online"; online: [boolean, boolean] }
  | { t: "error"; code: RelayError };

const PING_MS = 25_000;

export class RelayClient<B extends { id: string }> {
  private ws: WebSocket | null = null;
  private snap: RelaySnapshot<B> = { status: "connecting", error: null, seat: null, log: [], pending: [], online: [false, false], everOpen: false };
  private listeners = new Set<() => void>();
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;

  constructor(
    private url: string,
    private room: string,
    private token: string,
    private claim?: "guest",
  ) {
    this.connect();
  }

  get = (): RelaySnapshot<B> => this.snap;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  post(body: B) {
    this.update({ pending: [...this.snap.pending, body] });
    if (this.snap.status === "open") this.send(body);
  }

  close() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.ws?.close();
  }

  private update(patch: Partial<RelaySnapshot<B>>) {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.listeners) fn();
  }

  private send(body: B) {
    this.ws?.send(JSON.stringify({ t: "post", body }));
  }

  private connect() {
    if (this.stopped) return;
    const q = new URLSearchParams({ token: this.token });
    if (this.claim) q.set("claim", this.claim);
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${this.url}/room/${this.room}?${q}`);
    } catch {
      this.retry();
      return;
    }
    this.ws = ws;
    ws.onmessage = (e) => {
      if (e.data === "pong" || typeof e.data !== "string") return;
      let msg: ServerMsg<B>;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      this.receive(ws, msg);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws || this.stopped || this.snap.status === "failed") return;
      this.update({ status: "offline", online: [false, false] });
      this.retry();
    };
  }

  private receive(ws: WebSocket, msg: ServerMsg<B>) {
    switch (msg.t) {
      case "welcome": {
        this.retries = 0;
        this.claim = undefined; // the seat is ours now; the token gets it back
        const seen = new Set(msg.log.map((e) => e.body.id));
        const pending = this.snap.pending.filter((b) => !seen.has(b.id));
        this.update({ status: "open", seat: msg.seat, log: msg.log, online: msg.online, pending, everOpen: true });
        for (const b of pending) this.send(b);
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), PING_MS);
        break;
      }
      case "entry": {
        const { log } = this.snap;
        if (msg.entry.seq < log.length) return; // already have it
        if (msg.entry.seq > log.length) {
          ws.close(); // missed something: reconnect for the whole log
          return;
        }
        this.update({ log: [...log, msg.entry], pending: this.snap.pending.filter((b) => b.id !== msg.entry.body.id) });
        break;
      }
      case "online":
        this.update({ online: msg.online });
        break;
      case "error":
        this.update({ status: "failed", error: msg.code });
        this.stopped = true;
        ws.close();
        break;
    }
  }

  private retry() {
    clearTimeout(this.retryTimer);
    const delay = Math.min(15_000, 1000 * 2 ** this.retries++);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }
}
