import { mkdirSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import {
  BOT_SPEED_FACTOR,
  type ClientMessage,
  type GameEvent,
  parseClientMessage,
  type ServerMessage,
} from "@shoalow/game";
import type { Server, ServerWebSocket } from "bun";
import { Room } from "./room.ts";
import { Store } from "./store.ts";

export interface ServerOptions {
  port?: number;
  hostname?: string;
  dataDir: string;
  /** Built web client to serve; omitted in development, where Vite serves it. */
  staticDir?: string;
  /** Pause before each bot move at normal speed, so humans can follow along. */
  botDelayMs?: number;
}

interface SocketData {
  code: string;
  token: string;
}

type Socket = ServerWebSocket<SocketData>;

const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 5;
const MAX_ROOMS = 2000;
const IDLE_ROOM_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function roomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const error = (message: string, status: number) => json({ error: message }, status);

async function readBody(req: Request): Promise<{ name?: unknown; targetScore?: unknown }> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

export function createServer(options: ServerOptions) {
  mkdirSync(options.dataDir, { recursive: true });
  const store = new Store(join(options.dataDir, "shoalow.sqlite"));
  const botDelayMs = options.botDelayMs ?? 1400;
  const rooms = new Map<string, Room>();
  const sockets = new Map<string, Set<Socket>>();
  const botTimers = new Map<string, ReturnType<typeof setTimeout>>();

  for (const code of store.deleteIdle(IDLE_ROOM_MS)) console.log(`deleted idle room ${code}`);
  for (const snap of store.loadRooms()) rooms.set(snap.code, new Room(snap));

  const cleanup = setInterval(() => {
    for (const code of store.deleteIdle(IDLE_ROOM_MS)) {
      rooms.delete(code);
      for (const ws of sockets.get(code) ?? []) ws.close(1000, "room expired");
      sockets.delete(code);
    }
  }, HOUR_MS);
  cleanup.unref?.();

  const isConnected = (room: Room) => (seat: number) => {
    const token = room.snap.seats[seat]?.token;
    for (const ws of sockets.get(room.code) ?? []) if (ws.data.token === token) return true;
    return false;
  };

  function send(ws: Socket, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }

  function broadcast(room: Room, events: GameEvent[] = []): void {
    const connected = isConnected(room);
    for (const ws of sockets.get(room.code) ?? []) {
      const seat = room.seatOf(ws.data.token);
      if (seat === -1) continue;
      send(ws, { t: "room", room: room.view(seat, connected), events });
    }
  }

  function scheduleBots(room: Room): void {
    if (botTimers.has(room.code) || room.pendingBot() === null) return;
    const opening = room.snap.game?.phase === "initialFlip";
    const delay = botDelayMs * BOT_SPEED_FACTOR[room.botSpeed];
    const timer = setTimeout(
      () => {
        botTimers.delete(room.code);
        if (rooms.get(room.code) !== room) return;
        const step = room.botStep();
        if (!step) return;
        if (!step.outcome.ok) {
          console.error(`room ${room.code}: bot at seat ${step.seat} chose an illegal move: ${step.outcome.error}`);
          return;
        }
        store.save(room.snap, { seat: step.seat, message: { t: "action", action: step.action, bot: true } });
        broadcast(room, step.outcome.events);
        scheduleBots(room);
      },
      opening ? delay / 3 : delay,
    );
    botTimers.set(room.code, timer);
  }

  for (const room of rooms.values()) scheduleBots(room);

  function removeRoom(code: string): void {
    rooms.delete(code);
    store.delete(code);
    const timer = botTimers.get(code);
    if (timer) clearTimeout(timer);
    botTimers.delete(code);
  }

  function onMessage(ws: Socket, msg: ClientMessage): void {
    if (msg.t === "ping") {
      send(ws, { t: "pong" });
      return;
    }
    const room = rooms.get(ws.data.code);
    const seat = room ? room.seatOf(ws.data.token) : -1;
    if (!room || seat === -1) {
      send(ws, { t: "removed" });
      ws.close(1000, "removed");
      return;
    }
    const outcome = room.handle(seat, msg);
    if (!outcome.ok) {
      send(ws, { t: "error", message: outcome.error });
      return;
    }
    for (const token of outcome.removedTokens ?? []) {
      for (const other of sockets.get(room.code) ?? []) {
        if (other.data.token !== token) continue;
        send(other, { t: "removed" });
        other.close(1000, "removed");
      }
    }
    if (!room.snap.seats.some((s) => s.kind === "human")) {
      removeRoom(room.code);
      return;
    }
    store.save(room.snap, { seat, message: msg });
    if (msg.t === "stopGame") {
      clearTimeout(botTimers.get(room.code));
      botTimers.delete(room.code);
    }
    broadcast(room, outcome.events);
    scheduleBots(room);
  }

  const staticRoot = options.staticDir ? resolve(options.staticDir) : null;

  async function serveStatic(pathname: string): Promise<Response> {
    if (!staticRoot) return error("not found", 404);
    const relative = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
    const path = resolve(staticRoot, `.${relative}`);
    if (path.startsWith(staticRoot) && pathname !== "/") {
      const file = Bun.file(path);
      if (await file.exists()) {
        const immutable = pathname.startsWith("/assets/");
        return new Response(file, {
          headers: { "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache" },
        });
      }
    }
    return new Response(Bun.file(join(staticRoot, "index.html")), { headers: { "Cache-Control": "no-cache" } });
  }

  const server: Server<SocketData> = Bun.serve<SocketData>({
    port: options.port ?? 3000,
    hostname: options.hostname ?? "0.0.0.0",
    maxRequestBodySize: 16 * 1024,
    async fetch(req, srv) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === "/healthz") return new Response("ok");

      if (path === "/ws") {
        const code = (url.searchParams.get("room") ?? "").toUpperCase();
        const token = url.searchParams.get("token") ?? "";
        const room = rooms.get(code);
        if (!room || room.seatOf(token) === -1) return error("unknown room or seat", 404);
        if (srv.upgrade(req, { data: { code, token } })) return undefined;
        return error("expected a WebSocket upgrade", 400);
      }

      if (path === "/api/rooms" && req.method === "POST") {
        if (rooms.size >= MAX_ROOMS) return error("too many open rooms, try again later", 503);
        const body = await readBody(req);
        let code = roomCode();
        while (rooms.has(code)) code = roomCode();
        const created = Room.createChecked(code, body.name, body.targetScore);
        if ("error" in created) return error(created.error, 400);
        rooms.set(code, created.room);
        store.save(created.room.snap);
        return json({ code, token: created.token });
      }

      const match = path.match(/^\/api\/rooms\/([A-Za-z0-9]{5})(\/join)?$/);
      if (match) {
        const code = (match[1] ?? "").toUpperCase();
        const room = rooms.get(code);
        if (!room) return error("no room with that code", 404);
        if (!match[2] && req.method === "GET") {
          const token = url.searchParams.get("token");
          const seated = token === null ? {} : { seated: room.seatOf(token) !== -1 };
          return json({ code, status: room.snap.status, players: room.snap.seats.length, ...seated });
        }
        if (match[2] && req.method === "POST") {
          const joined = room.join((await readBody(req)).name);
          if ("error" in joined) return error(joined.error, 409);
          store.save(room.snap, { seat: room.seatOf(joined.token), message: { t: "join" } });
          broadcast(room);
          return json({ code, token: joined.token });
        }
      }

      if (path.startsWith("/api/")) return error("not found", 404);
      return serveStatic(path);
    },
    websocket: {
      idleTimeout: 70,
      maxPayloadLength: 4 * 1024,
      open(ws) {
        const room = rooms.get(ws.data.code);
        if (!room) {
          ws.close(1000, "removed");
          return;
        }
        let set = sockets.get(room.code);
        if (!set) {
          set = new Set();
          sockets.set(room.code, set);
        }
        set.add(ws);
        const seat = room.seatOf(ws.data.token);
        if (room.reclaim(seat)) store.save(room.snap, { seat, message: { t: "reclaim" } });
        broadcast(room);
      },
      message(ws, raw) {
        const msg = parseClientMessage(typeof raw === "string" ? raw : raw.toString());
        if (!msg) {
          send(ws, { t: "error", message: "malformed message" });
          return;
        }
        onMessage(ws, msg);
      },
      close(ws) {
        const set = sockets.get(ws.data.code);
        set?.delete(ws);
        if (set?.size === 0) sockets.delete(ws.data.code);
        const room = rooms.get(ws.data.code);
        if (room) broadcast(room);
      },
    },
  });

  return {
    server,
    url: server.url,
    store,
    rooms,
    stop() {
      clearInterval(cleanup);
      for (const timer of botTimers.values()) clearTimeout(timer);
      botTimers.clear();
      server.stop(true);
      store.close();
    },
  };
}
