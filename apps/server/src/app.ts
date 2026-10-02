import { mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import {
  BOT_SPEED_FACTOR,
  type ClientMessage,
  type GameEvent,
  parseClientMessage,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ServerMessage,
} from "@shoalow/game";
import type { Server, ServerWebSocket } from "bun";
import { clientKey, DEFAULT_LIMITS, type Limits, RateLimiter } from "./limits.ts";
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
  /**
   * Request header with the client's address, set by a trusted proxy in front of the server
   * (`Fly-Client-IP` on Fly.io). Without it, the connection's own address is used.
   */
  clientIpHeader?: string;
  /** Overrides for the abuse limits. */
  limits?: Partial<Limits>;
  /** Upper bound for the SQLite file. */
  maxDbBytes?: number;
}

interface SocketData {
  code: string;
  token: string;
  /** Rate-limit key of the client address. */
  client: string;
  /** Unique per connection, for the per-connection message limit. */
  id: number;
  strikes: number;
  /** Counted towards the connection limits; set once the connection is accepted. */
  tracked: boolean;
}

type Socket = ServerWebSocket<SocketData>;

/** Close code for a connection that gave way to a newer one for the same seat. */
export const REPLACED_CLOSE_CODE = 4001;
const IDLE_ROOM_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
/** Trim a room's message log after this many saves. */
const TRIM_EVERY = 250;

function roomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers });
const error = (message: string, status: number) => json({ error: message }, status);
const tooMany = (retryAfter: number) =>
  json({ error: "too many requests, please wait a moment" }, 429, { "Retry-After": String(retryAfter) });

async function readBody(req: Request): Promise<{ name?: unknown; targetScore?: unknown }> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

/** Browsers always send Origin on cross-site requests; other clients may leave it out. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/** Headers for every HTTP response. The page talks only to its own origin. */
function securityHeaders(req: Request, https: boolean): Record<string, string> {
  const host = req.headers.get("host") ?? "";
  const sockets = /^[\w.:[\]-]+$/.test(host) ? ` wss://${host} ws://${host}` : "";
  const headers: Record<string, string> = {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self'",
      // Svelte sets inline styles for layout and animation.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self'${sockets}`,
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (https) headers["Strict-Transport-Security"] = "max-age=31536000";
  return headers;
}

export function createServer(options: ServerOptions) {
  const limits: Limits = { ...DEFAULT_LIMITS, ...options.limits };
  mkdirSync(options.dataDir, { recursive: true });
  const store = new Store(join(options.dataDir, "shoalow.sqlite"), options.maxDbBytes);
  const botDelayMs = options.botDelayMs ?? 1400;
  const rooms = new Map<string, Room>();
  const sockets = new Map<string, Set<Socket>>();
  const botTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** When each room last changed, for choosing which idle room gives way when the server is full. */
  const lastActive = new Map<string, number>();
  /** The snapshot last written per room; an identical one is not written or broadcast again. */
  const lastSaved = new Map<string, string>();
  const savesSinceTrim = new Map<string, number>();
  const socketsPerClient = new Map<string, number>();
  let socketCount = 0;
  let nextSocketId = 1;

  const limiters = {
    createRoom: new RateLimiter(limits.createRoom),
    joinRoom: new RateLimiter(limits.joinRoom),
    lookupRoom: new RateLimiter(limits.lookupRoom),
    connect: new RateLimiter(limits.connect),
    messages: new RateLimiter(limits.messages),
  };

  for (const code of store.deleteIdle(IDLE_ROOM_MS)) console.log(`deleted idle room ${code}`);
  {
    const { rooms: loaded, broken } = store.loadRooms();
    for (const { snap, updatedAt } of loaded) {
      rooms.set(snap.code, new Room(snap));
      lastActive.set(snap.code, updatedAt);
    }
    for (const code of broken) console.error(`room ${code}: unreadable snapshot left in the database, not loaded`);
  }

  const cleanup = setInterval(() => {
    for (const code of store.deleteIdle(IDLE_ROOM_MS)) {
      forget(code);
      for (const ws of sockets.get(code) ?? []) ws.close(1000, "room expired");
      sockets.delete(code);
    }
  }, HOUR_MS);
  cleanup.unref?.();
  const prune = setInterval(() => {
    for (const limiter of Object.values(limiters)) limiter.prune();
  }, MINUTE_MS);
  prune.unref?.();

  const clientOf = (req: Request, srv: Server<SocketData>): string =>
    clientKey((options.clientIpHeader && req.headers.get(options.clientIpHeader)) || srv.requestIP(req)?.address);

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

  /**
   * Saves the room and logs the message that changed it. Returns false when nothing changed,
   * so repeated no-op messages cost neither disk nor broadcasts. A failed write is logged and
   * the game carries on from memory; the next successful save catches the database up.
   */
  function persist(room: Room, entry?: { seat: number; message: unknown }): boolean {
    const text = JSON.stringify(room.snap);
    if (lastSaved.get(room.code) === text) return false;
    lastActive.set(room.code, Date.now());
    try {
      store.save(room.snap, entry, text);
      lastSaved.set(room.code, text);
      const saves = (savesSinceTrim.get(room.code) ?? 0) + 1;
      savesSinceTrim.set(room.code, saves % TRIM_EVERY);
      if (saves >= TRIM_EVERY) store.trimLog(room.code, limits.logPerRoom);
    } catch (e) {
      console.error(`room ${room.code}: could not save: ${(e as Error).message}`);
    }
    return true;
  }

  function scheduleBots(room: Room): void {
    if (botTimers.has(room.code) || room.pendingBot() === null) return;
    const opening = room.snap.game?.phase === "initialFlip";
    const delay = botDelayMs * BOT_SPEED_FACTOR[room.botSpeed];
    const timer = setTimeout(
      () => {
        botTimers.delete(room.code);
        if (rooms.get(room.code) !== room) return;
        try {
          const step = room.botStep();
          if (!step) return;
          if (!step.outcome.ok) {
            console.error(`room ${room.code}: bot at seat ${step.seat} chose an illegal move: ${step.outcome.error}`);
            return;
          }
          persist(room, { seat: step.seat, message: { t: "action", action: step.action, bot: true } });
          broadcast(room, step.outcome.events);
          scheduleBots(room);
        } catch (e) {
          console.error(`room ${room.code}: bot move failed:`, e);
        }
      },
      opening ? delay / 3 : delay,
    );
    botTimers.set(room.code, timer);
  }

  for (const room of rooms.values()) scheduleBots(room);

  /** Drops a room from memory only; the database is handled by the caller. */
  function forget(code: string): void {
    rooms.delete(code);
    lastActive.delete(code);
    lastSaved.delete(code);
    savesSinceTrim.delete(code);
    const timer = botTimers.get(code);
    if (timer) clearTimeout(timer);
    botTimers.delete(code);
  }

  function removeRoom(code: string): void {
    forget(code);
    try {
      store.delete(code);
    } catch (e) {
      console.error(`room ${code}: could not delete: ${(e as Error).message}`);
    }
  }

  /**
   * Makes space for a new room when the server is full: the room that nobody is connected to
   * and that has been idle longest gives way, lobbies before games. Fails if every room is
   * in use or was touched recently.
   */
  function makeSpace(): boolean {
    if (rooms.size < limits.rooms) return true;
    const now = Date.now();
    let victim: { code: string; lobby: boolean; idle: number } | null = null;
    for (const room of rooms.values()) {
      if (sockets.has(room.code)) continue;
      const idle = now - (lastActive.get(room.code) ?? 0);
      if (idle < limits.evictAfterMs) continue;
      const lobby = room.snap.status === "lobby";
      if (!victim || (lobby && !victim.lobby) || (lobby === victim.lobby && idle > victim.idle))
        victim = { code: room.code, lobby, idle };
    }
    if (!victim) return false;
    console.log(`server full: removed idle room ${victim.code}`);
    removeRoom(victim.code);
    return true;
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
    // A bot may stand in for someone who is away, not push out someone who is still here.
    if (msg.t === "takeover" && msg.bot && isConnected(room)(msg.seat)) {
      send(ws, { t: "error", message: "that player is still connected" });
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
    if (!persist(room, { seat, message: msg })) return;
    if (msg.t === "stopGame") {
      clearTimeout(botTimers.get(room.code));
      botTimers.delete(room.code);
    }
    broadcast(room, outcome.events);
    scheduleBots(room);
  }

  /** Counts a new connection; a seat with too many open connections drops its oldest. */
  function track(ws: Socket, room: Room): void {
    let set = sockets.get(room.code);
    if (!set) {
      set = new Set();
      sockets.set(room.code, set);
    }
    set.add(ws);
    ws.data.tracked = true;
    socketCount += 1;
    socketsPerClient.set(ws.data.client, (socketsPerClient.get(ws.data.client) ?? 0) + 1);
    const same = [...set].filter((other) => other.data.token === ws.data.token);
    for (const old of same.slice(0, Math.max(0, same.length - limits.socketsPerSeat))) {
      old.close(REPLACED_CLOSE_CODE, "replaced by a newer connection");
    }
  }

  function untrack(ws: Socket): void {
    if (!ws.data.tracked) return;
    ws.data.tracked = false;
    const set = sockets.get(ws.data.code);
    set?.delete(ws);
    if (set?.size === 0) sockets.delete(ws.data.code);
    socketCount -= 1;
    const left = (socketsPerClient.get(ws.data.client) ?? 1) - 1;
    if (left > 0) socketsPerClient.set(ws.data.client, left);
    else socketsPerClient.delete(ws.data.client);
  }

  const staticRoot = options.staticDir ? resolve(options.staticDir) : null;

  async function serveStatic(req: Request, pathname: string): Promise<Response> {
    if (!staticRoot) return error("not found", 404);
    if (req.method !== "GET" && req.method !== "HEAD") return error("method not allowed", 405);
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return error("bad path", 400);
    }
    if (decoded.includes("\0")) return error("bad path", 400);
    const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
    const path = resolve(staticRoot, `.${relative}`);
    const hiddenSegment = relative.split(/[/\\]/).some((part) => part.startsWith("."));
    if (path.startsWith(staticRoot + sep) && !hiddenSegment) {
      const info = await stat(path).catch(() => null);
      if (info?.isFile()) {
        const immutable = pathname.startsWith("/assets/");
        return new Response(Bun.file(path), {
          headers: { "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache" },
        });
      }
    }
    return new Response(Bun.file(join(staticRoot, "index.html")), {
      headers: { "Cache-Control": "no-cache", "Content-Type": "text/html;charset=utf-8" },
    });
  }

  async function route(req: Request, srv: Server<SocketData>): Promise<Response | undefined> {
    // A forged Host header can make the request URL unparseable.
    const url = URL.parse(req.url);
    if (!url) return error("bad request", 400);
    const path = url.pathname;

    if (path === "/healthz") return new Response("ok");

    if (path === "/ws") {
      if (!sameOrigin(req)) return error("cross-site connections are not allowed", 403);
      const client = clientOf(req, srv);
      const wait = limiters.connect.take(client);
      if (wait) return tooMany(wait);
      if (socketCount >= limits.sockets) return error("the server is busy, try again soon", 503);
      if ((socketsPerClient.get(client) ?? 0) >= limits.socketsPerClient) return tooMany(30);
      const code = (url.searchParams.get("room") ?? "").toUpperCase();
      const token = url.searchParams.get("token") ?? "";
      const room = rooms.get(code);
      if (!room || room.seatOf(token) === -1) return error("unknown room or seat", 404);
      if (srv.upgrade(req, { data: { code, token, client, id: nextSocketId++, strikes: 0, tracked: false } }))
        return undefined;
      return error("expected a WebSocket upgrade", 400);
    }

    if (path.startsWith("/api/") && req.method === "POST") {
      if (!sameOrigin(req)) return error("cross-site requests are not allowed", 403);
      if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
        return error("send JSON", 415);
    }

    if (path === "/api/rooms" && req.method === "POST") {
      const wait = limiters.createRoom.take(clientOf(req, srv));
      if (wait) return tooMany(wait);
      const body = await readBody(req);
      let code = roomCode();
      while (rooms.has(code)) code = roomCode();
      const created = Room.createChecked(code, body.name, body.targetScore);
      if ("error" in created) return error(created.error, 400);
      if (!makeSpace()) return error("too many open rooms, try again later", 503);
      rooms.set(code, created.room);
      persist(created.room);
      return json({ code, token: created.token });
    }

    const match = path.match(/^\/api\/rooms\/([A-Za-z0-9]{5})(\/join)?$/);
    if (match) {
      const joining = !!match[2] && req.method === "POST";
      const looking = !match[2] && req.method === "GET";
      if (!joining && !looking) return error("not found", 404);
      const wait = (joining ? limiters.joinRoom : limiters.lookupRoom).take(clientOf(req, srv));
      if (wait) return tooMany(wait);
      const code = (match[1] ?? "").toUpperCase();
      const room = rooms.get(code);
      if (!room) return error("no room with that code", 404);
      if (looking) {
        const token = url.searchParams.get("token");
        const seated = token === null ? {} : { seated: room.seatOf(token) !== -1 };
        return json({ code, status: room.snap.status, players: room.snap.seats.length, ...seated });
      }
      const joined = room.join((await readBody(req)).name);
      if ("error" in joined) return error(joined.error, 409);
      persist(room, { seat: room.seatOf(joined.token), message: { t: "join" } });
      broadcast(room);
      return json({ code, token: joined.token });
    }

    if (path.startsWith("/api/")) return error("not found", 404);
    return serveStatic(req, path);
  }

  const server: Server<SocketData> = Bun.serve<SocketData>({
    port: options.port ?? 3000,
    hostname: options.hostname ?? "0.0.0.0",
    maxRequestBodySize: 16 * 1024,
    async fetch(req, srv) {
      let res: Response | undefined;
      try {
        res = await route(req, srv);
      } catch (e) {
        // The path only: query strings can carry seat tokens.
        console.error(`${req.method} ${URL.parse(req.url)?.pathname ?? "(bad URL)"} failed:`, e);
        res = error("something went wrong", 500);
      }
      if (!res) return undefined;
      const https = !!options.clientIpHeader && req.headers.get("x-forwarded-proto") === "https";
      for (const [name, value] of Object.entries(securityHeaders(req, https))) res.headers.set(name, value);
      return res;
    },
    error(e) {
      console.error("request failed:", e);
      return error("something went wrong", 500);
    },
    websocket: {
      idleTimeout: 70,
      maxPayloadLength: 4 * 1024,
      // A client that stops reading must not make the server buffer without limit.
      backpressureLimit: 1024 * 1024,
      closeOnBackpressureLimit: true,
      open(ws) {
        try {
          const room = rooms.get(ws.data.code);
          const seat = room ? room.seatOf(ws.data.token) : -1;
          if (!room || seat === -1) {
            ws.close(1000, "removed");
            return;
          }
          track(ws, room);
          if (room.reclaim(seat)) persist(room, { seat, message: { t: "reclaim" } });
          broadcast(room);
        } catch (e) {
          console.error(`room ${ws.data.code}: opening a connection failed:`, e);
          ws.close(1011, "server error");
        }
      },
      message(ws, raw) {
        if (limiters.messages.take(String(ws.data.id))) {
          ws.data.strikes += 1;
          if (ws.data.strikes >= limits.messageStrikes) ws.close(1008, "too many messages");
          else if (ws.data.strikes === 1) send(ws, { t: "error", message: "too many messages, slow down" });
          return;
        }
        const msg = typeof raw === "string" ? parseClientMessage(raw) : null;
        if (!msg) {
          send(ws, { t: "error", message: "malformed message" });
          return;
        }
        try {
          onMessage(ws, msg);
        } catch (e) {
          console.error(`room ${ws.data.code}: message ${msg.t} failed:`, e);
          send(ws, { t: "error", message: "something went wrong, please try again" });
        }
      },
      close(ws) {
        try {
          untrack(ws);
          const room = rooms.get(ws.data.code);
          if (room) broadcast(room);
        } catch (e) {
          console.error(`room ${ws.data.code}: closing a connection failed:`, e);
        }
      },
    },
  });

  return {
    server,
    url: server.url,
    store,
    rooms,
    /** Open connections, for tests and diagnostics. */
    get socketCount() {
      return socketCount;
    },
    stop() {
      clearInterval(cleanup);
      clearInterval(prune);
      for (const timer of botTimers.values()) clearTimeout(timer);
      botTimers.clear();
      server.stop(true);
      store.close();
    },
  };
}
