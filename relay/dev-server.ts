// A stand-in for the relay for local development, in plain Node: the same protocol and the same rules (src/core.ts),
// with the rooms kept in memory. Run from the repo root with `npm run relay`. The real relay (src/index.ts) runs on
// Cloudflare; Wrangler's own local mode works too where its runtime does (`npm --prefix relay run dev`).
import { WebSocketServer, type WebSocket } from "ws";
import { ID_PATTERN, MAX_LOG, originAllowed, parsePost, seatFor, type LogEntry, type Seat } from "./src/core";

interface Room {
  tokens: [string | null, string | null];
  log: LogEntry[];
  sockets: [Set<WebSocket>, Set<WebSocket>];
}

const rooms = new Map<string, Room>();
const port = Number(process.env.PORT ?? 8787);
const wss = new WebSocketServer({ port });

const online = (room: Room): [boolean, boolean] => [room.sockets[0].size > 0, room.sockets[1].size > 0];
const broadcast = (room: Room, msg: unknown, except?: WebSocket) => {
  const text = JSON.stringify(msg);
  for (const set of room.sockets) for (const ws of set) if (ws !== except) ws.send(text);
};

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const refuse = (code: string) => {
    ws.send(JSON.stringify({ t: "error", code }));
    ws.close(4002, code);
  };
  const m = url.pathname.match(/^\/room\/([^/]+)$/);
  if (!m || !ID_PATTERN.test(m[1]) || !originAllowed(req.headers.origin ?? null, [])) return refuse("bad");
  const token = url.searchParams.get("token") ?? "";
  if (!ID_PATTERN.test(token)) return refuse("bad");
  let room = rooms.get(m[1]);
  if (!room) rooms.set(m[1], (room = { tokens: [null, null], log: [], sockets: [new Set(), new Set()] }));
  const r = room;
  const seat = seatFor(r.tokens, token, url.searchParams.get("claim") === "guest" ? "guest" : undefined);
  if ("error" in seat) return refuse(seat.error);
  if (seat.claimed) r.tokens[seat.seat] = token;
  const s: Seat = seat.seat;
  for (const old of r.sockets[s]) {
    old.send(JSON.stringify({ t: "error", code: "replaced" }));
    old.close(4000, "replaced");
    r.sockets[s].delete(old);
  }
  r.sockets[s].add(ws);
  ws.send(JSON.stringify({ t: "welcome", seat: s, log: r.log, online: online(r) }));
  broadcast(r, { t: "online", online: online(r) }, ws);
  console.log(`room ${m[1]}: seat ${s} connected`);

  ws.on("message", (data) => {
    const raw = data.toString();
    if (raw === "ping") return ws.send("pong");
    const post = parsePost(raw);
    if (!post) return;
    if (r.log.length >= MAX_LOG) return ws.send(JSON.stringify({ t: "error", code: "toolong" }));
    const entry: LogEntry = { seq: r.log.length, from: s, body: post.body };
    r.log.push(entry);
    broadcast(r, { t: "entry", entry });
  });
  ws.on("close", () => {
    r.sockets[s].delete(ws);
    broadcast(r, { t: "online", online: online(r) });
  });
});

console.log(`Common Ground dev relay on ws://localhost:${port}`);
