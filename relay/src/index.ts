import { DurableObject } from "cloudflare:workers";
import { ID_PATTERN, MAX_LOG, ROOM_TTL_MS, originAllowed, parsePost, seatFor, type LogEntry, type Seat } from "./core";

// The Common Ground PvP relay (docs/MULTIPLAYER.md). One Durable Object per match: it gives out the two seats, keeps
// the match's messages in order, and passes them to both players. It never reads the game messages themselves.
//
//   GET /                       -> "Common Ground relay" (a health check)
//   GET /room/<id>?token=<t>[&claim=guest]   (WebSocket)
//     server -> { t: "welcome", seat, log, online } | { t: "entry", entry } | { t: "online", online } | { t: "error", code }
//     client -> { t: "post", body } | "ping" (answered "pong" without waking the room)

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ALLOWED_ORIGINS?: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/") return new Response("Common Ground relay\n", { headers: { "content-type": "text/plain" } });
    const m = url.pathname.match(/^\/room\/([^/]+)$/);
    if (!m || !ID_PATTERN.test(m[1])) return new Response("Not found", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!originAllowed(req.headers.get("Origin"), allowed)) return new Response("Forbidden", { status: 403 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  },
};

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const claim = url.searchParams.get("claim") === "guest" ? "guest" : undefined;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (!ID_PATTERN.test(token)) return this.refuse(server, client, "bad");
    const tokens = ((await this.ctx.storage.get<[string | null, string | null]>("tokens")) ?? [null, null]) as [string | null, string | null];
    const seat = seatFor(tokens, token, claim);
    if ("error" in seat) return this.refuse(server, client, seat.error);
    if (seat.claimed) {
      tokens[seat.seat] = token;
      await this.ctx.storage.put("tokens", tokens);
      await this.touch();
    }
    // one live connection per seat: a newer tab takes over
    for (const old of this.ctx.getWebSockets(`seat${seat.seat}`)) {
      try {
        old.send(JSON.stringify({ t: "error", code: "replaced" }));
        old.close(4000, "replaced");
      } catch {
        // already gone
      }
    }
    this.ctx.acceptWebSocket(server, [`seat${seat.seat}`]);
    const log = await this.log();
    server.send(JSON.stringify({ t: "welcome", seat: seat.seat, log, online: this.online(server) }));
    this.broadcast({ t: "online", online: this.online(server) }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string") return;
    const post = parsePost(raw);
    const seat = this.seatOf(ws);
    if (!post || seat === null) return;
    const count = (await this.ctx.storage.get<number>("count")) ?? 0;
    if (count >= MAX_LOG) {
      ws.send(JSON.stringify({ t: "error", code: "toolong" }));
      return;
    }
    const entry: LogEntry = { seq: count, from: seat, body: post.body };
    await this.ctx.storage.put({ [`m${String(count).padStart(6, "0")}`]: entry, count: count + 1 });
    await this.touch();
    this.broadcast({ t: "entry", entry });
  }

  async webSocketClose(ws: WebSocket) {
    try {
      ws.close();
    } catch {
      // already closed
    }
    this.broadcast({ t: "online", online: this.online() });
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  // Rooms clean themselves up a while after their last message.
  async alarm() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(4001, "expired");
      } catch {
        // already gone
      }
    }
    await this.ctx.storage.deleteAll();
  }

  private async touch() {
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  private async log(): Promise<LogEntry[]> {
    const rows = await this.ctx.storage.list<LogEntry>({ prefix: "m" });
    return [...rows.values()];
  }

  private seatOf(ws: WebSocket): Seat | null {
    const tag = this.ctx.getTags(ws).find((t) => t.startsWith("seat"));
    return tag === "seat0" ? 0 : tag === "seat1" ? 1 : null;
  }

  // Whether each seat has a live connection. `extra` counts a socket accepted this instant.
  private online(extra?: WebSocket): [boolean, boolean] {
    const live = (seat: Seat) =>
      this.ctx.getWebSockets(`seat${seat}`).some((ws) => ws.readyState === WebSocket.OPEN || ws === extra);
    return [live(0), live(1)];
  }

  private broadcast(msg: unknown, except?: WebSocket) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || ws.readyState !== WebSocket.OPEN) continue;
      try {
        ws.send(text);
      } catch {
        // closing
      }
    }
  }

  private refuse(server: WebSocket, client: WebSocket, code: string): Response {
    server.accept();
    server.send(JSON.stringify({ t: "error", code }));
    server.close(4002, code);
    return new Response(null, { status: 101, webSocket: client });
  }
}
