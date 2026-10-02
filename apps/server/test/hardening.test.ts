import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeRandom, type ServerMessage } from "@shoalow/game";
import { createServer, REPLACED_CLOSE_CODE, type ServerOptions } from "../src/app.ts";

/** Attacks and accidents a public game server meets: floods, junk, cross-site requests, broken data. */

type App = ReturnType<typeof createServer>;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0).reverse()) c();
});

/** Lets a test pretend to be several clients by setting this header, as a proxy would. */
const CLIENT = "x-test-client";

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "shoalow-hard-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function start(options: Partial<ServerOptions> = {}): App {
  const app = createServer({
    port: 0,
    hostname: "127.0.0.1",
    dataDir: tempDir(),
    botDelayMs: 0,
    clientIpHeader: CLIENT,
    ...options,
  });
  let stopped = false;
  const stop = app.stop;
  app.stop = () => {
    if (!stopped) stop();
    stopped = true;
  };
  cleanups.push(() => app.stop());
  return app;
}

async function post(app: App, path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(new URL(path, app.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return {
    status: res.status,
    headers: res.headers,
    body: (await res.json().catch(() => ({}))) as Record<string, string>,
  };
}

async function createRoom(app: App, client = "1.1.1.1"): Promise<{ code: string; token: string }> {
  const r = await post(app, "/api/rooms", { name: "Anna" }, { [CLIENT]: client });
  expect(r.status).toBe(200);
  return { code: r.body.code as string, token: r.body.token as string };
}

/** A bare socket that records what it hears and how it closed. */
class Raw {
  messages: ServerMessage[] = [];
  closed: { code: number; reason: string } | null = null;
  private constructor(readonly ws: WebSocket) {}

  static async open(app: App, code: string, token: string, client = "1.1.1.1"): Promise<Raw> {
    const url = new URL(`/ws?room=${code}&token=${token}`, app.url);
    url.protocol = "ws:";
    const ws = new WebSocket(url, { headers: { [CLIENT]: client } } as unknown as string[]);
    const raw = new Raw(ws);
    ws.onmessage = (e) => raw.messages.push(JSON.parse(String(e.data)) as ServerMessage);
    ws.onclose = (e) => {
      raw.closed = { code: e.code, reason: e.reason };
    };
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("socket failed"));
    });
    cleanups.push(() => ws.close());
    return raw;
  }

  send(data: string | Uint8Array<ArrayBuffer>): void {
    this.ws.send(data);
  }

  async until(pred: () => boolean, timeoutMs = 5000): Promise<void> {
    const end = Date.now() + timeoutMs;
    while (!pred()) {
      if (Date.now() > end) throw new Error("timed out");
      await Bun.sleep(5);
    }
  }

  errors(): string[] {
    return this.messages.flatMap((m) => (m.t === "error" ? [m.message] : []));
  }

  async ping(): Promise<void> {
    const before = this.messages.filter((m) => m.t === "pong").length;
    this.send(JSON.stringify({ t: "ping" }));
    await this.until(() => this.messages.filter((m) => m.t === "pong").length > before);
  }
}

test("a flood of new tables from one address is turned away, others can still play", async () => {
  const app = start({ limits: { createRoom: { burst: 3, perSecond: 0.001 } } });
  for (let i = 0; i < 3; i++) await createRoom(app, "6.6.6.6");
  const refused = await post(app, "/api/rooms", { name: "Spam" }, { [CLIENT]: "6.6.6.6" });
  expect(refused.status).toBe(429);
  expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
  // A whole IPv6 /64 counts as one address.
  for (let i = 0; i < 3; i++) await createRoom(app, `2001:db8:1:2::${i + 1}`);
  expect((await post(app, "/api/rooms", { name: "Spam" }, { [CLIENT]: "2001:db8:1:2::ff" })).status).toBe(429);
  await createRoom(app, "7.7.7.7");
});

test("guessing table codes is slowed down", async () => {
  const app = start({ limits: { lookupRoom: { burst: 5, perSecond: 0.001 } } });
  const statuses: number[] = [];
  for (let i = 0; i < 8; i++) {
    const res = await fetch(new URL("/api/rooms/ABCDE", app.url), { headers: { [CLIENT]: "6.6.6.6" } });
    statuses.push(res.status);
  }
  expect(statuses).toEqual([404, 404, 404, 404, 404, 429, 429, 429]);
});

test("cross-site requests and posts that are not JSON are refused", async () => {
  const app = start();
  const evil = { Origin: "https://evil.example" };
  expect((await post(app, "/api/rooms", { name: "Anna" }, evil)).status).toBe(403);
  expect((await post(app, "/api/rooms", { name: "Anna" }, { Origin: "null" })).status).toBe(403);
  const plain = await fetch(new URL("/api/rooms", app.url), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ name: "Anna" }),
  });
  expect(plain.status).toBe(415);
  const own = { Origin: new URL(app.url).origin };
  const { code, token } = (await post(app, "/api/rooms", { name: "Anna" }, own)).body as Record<string, string>;
  expect((await post(app, `/api/rooms/${code}/join`, { name: "Eve" }, evil)).status).toBe(403);
  const socket = await fetch(new URL(`/ws?room=${code}&token=${token}`, app.url), { headers: evil });
  expect(socket.status).toBe(403);
});

test("a client flooding messages is told to slow down and then cut off; the table plays on", async () => {
  const app = start({ limits: { messages: { burst: 5, perSecond: 1 }, messageStrikes: 20 } });
  const { code, token } = await createRoom(app);
  const joined = await post(app, `/api/rooms/${code}/join`, { name: "Ben" }, { [CLIENT]: "2.2.2.2" });
  const flooder = await Raw.open(app, code, token);
  const calm = await Raw.open(app, code, joined.body.token as string, "2.2.2.2");
  for (let i = 0; i < 200; i++) flooder.send(JSON.stringify({ t: "ping" }));
  await flooder.until(() => flooder.closed !== null);
  expect(flooder.closed?.code).toBe(1008);
  expect(flooder.errors()).toContain("too many messages, slow down");
  expect(flooder.messages.filter((m) => m.t === "pong").length).toBeLessThanOrEqual(6);
  await calm.ping();
});

test("junk, binary and oversized messages never break a table", async () => {
  const app = start({ limits: { messages: { burst: 10_000, perSecond: 10_000 } } });
  const { code, token } = await createRoom(app);
  const client = await Raw.open(app, code, token);
  const random = makeRandom(99);
  const fragments = [
    '{"t":',
    '"action"',
    ',"action":',
    '{"type":"swap","index":',
    "1e999",
    "null",
    "}",
    "[",
    '"',
    "\\u0000",
  ];
  for (let i = 0; i < 400; i++) {
    let text = "";
    const parts = 1 + Math.floor(random() * 6);
    for (let k = 0; k < parts; k++) text += fragments[Math.floor(random() * fragments.length)];
    client.send(text);
  }
  client.send(new Uint8Array([0, 159, 146, 150, 255]));
  await client.ping();
  expect(client.errors().length).toBeGreaterThan(300);
  expect(client.errors().every((e) => e === "malformed message")).toBe(true);
  expect(client.closed).toBeNull();

  client.send(JSON.stringify({ t: "ping", pad: "x".repeat(8 * 1024) }));
  await client.until(() => client.closed !== null);
  const again = await Raw.open(app, code, token);
  await again.ping();
  expect(app.rooms.get(code)?.snap.seats).toHaveLength(1);
});

test("a seat keeps at most three connections; the oldest gives way to a new one", async () => {
  const app = start();
  const { code, token } = await createRoom(app);
  const tabs: Raw[] = [];
  for (let i = 0; i < 4; i++) tabs.push(await Raw.open(app, code, token));
  await tabs[0]?.until(() => tabs[0]?.closed !== null);
  expect(tabs[0]?.closed?.code).toBe(REPLACED_CLOSE_CODE);
  for (const tab of tabs.slice(1)) await tab.ping();
  await tabs[3]?.until(() => app.socketCount === 3);
});

test("one address cannot hold more than its share of connections", async () => {
  const app = start({ limits: { socketsPerClient: 2 } });
  const a = await createRoom(app);
  const b = await createRoom(app);
  await Raw.open(app, a.code, a.token, "8.8.8.8");
  await Raw.open(app, b.code, b.token, "8.8.8.8");
  const third = await fetch(new URL(`/ws?room=${a.code}&token=${a.token}`, app.url), {
    headers: { [CLIENT]: "8.8.8.8" },
  });
  expect(third.status).toBe(429);
  await Raw.open(app, a.code, a.token, "9.9.9.9");
});

test("when the server is full, the longest idle lobby gives way and busy tables stay", async () => {
  const app = start({ limits: { rooms: 2, evictAfterMs: 0 } });
  const busy = await createRoom(app);
  const watcher = await Raw.open(app, busy.code, busy.token);
  const idle = await createRoom(app);
  expect((await post(app, "/api/rooms", { name: " " })).status).toBe(400);
  expect(app.rooms.has(idle.code)).toBe(true);
  const fresh = await createRoom(app);
  expect(app.rooms.has(idle.code)).toBe(false);
  expect(app.rooms.has(busy.code)).toBe(true);
  expect(app.rooms.has(fresh.code)).toBe(true);
  expect((await fetch(new URL(`/api/rooms/${idle.code}`, app.url))).status).toBe(404);
  await watcher.ping();

  const strict = start({ limits: { rooms: 1, evictAfterMs: 60_000 } });
  await createRoom(strict);
  expect((await post(strict, "/api/rooms", { name: "Late" })).status).toBe(503);
});

test("static files never leave the web root and odd paths do not crash the server", async () => {
  const base = tempDir();
  const root = join(base, "dist");
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "index.html"), "<!doctype html><p>shoalow</p>");
  writeFileSync(join(root, "assets", "app.js"), "console.log('app')");
  writeFileSync(join(root, ".env"), "SECRET=root-dotfile");
  mkdirSync(join(base, "dist-private"));
  writeFileSync(join(base, "dist-private", "secret.txt"), "SECRET=sibling");
  writeFileSync(join(base, "secret.txt"), "SECRET=parent");
  const app = start({ staticDir: root });

  const get = (path: string, init?: RequestInit) => fetch(`${app.url.origin}${path}`, init);
  expect(await (await get("/assets/app.js")).text()).toBe("console.log('app')");
  for (const path of [
    "/..%2fsecret.txt",
    "/%2e%2e%2fsecret.txt",
    "/..%2fdist-private%2fsecret.txt",
    "/assets/..%2f..%2fsecret.txt",
    "/.env",
    "/assets/%2e%2e/.env",
    "/..%5csecret.txt",
  ]) {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("SECRET");
  }
  expect((await get("/%E0%A4%A")).status).toBe(400);
  expect((await get("/a%00b")).status).toBe(400);
  expect((await get("/", { method: "DELETE" })).status).toBe(405);
  expect((await get("/healthz")).status).toBe(200);
});

test("every response carries security headers", async () => {
  const base = tempDir();
  writeFileSync(join(base, "index.html"), "<!doctype html>");
  const app = start({ staticDir: base });
  for (const path of ["/", "/api/rooms/ABCDE", "/r/ABCDE"]) {
    const res = await fetch(new URL(path, app.url));
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  }
  // A forged Host header cannot widen the policy.
  const forged = await fetch(new URL("/", app.url), { headers: { Host: "a.example; script-src *" } });
  expect(forged.status).toBe(400);
  expect(forged.headers.get("Content-Security-Policy")).not.toContain("script-src *");
});

test("unreadable rows in the database are skipped and the rest of the tables load", async () => {
  const dataDir = tempDir();
  const first = start({ dataDir });
  const { code, token } = await createRoom(first);
  first.stop();

  const db = new Database(join(dataDir, "shoalow.sqlite"));
  const insert = db.query("INSERT INTO rooms (code, snapshot, updated_at) VALUES (?1, ?2, ?3)");
  insert.run("BROKE", "{not json", Date.now());
  insert.run("WRONG", JSON.stringify({ code: "WRONG", seats: "nobody" }), Date.now());
  insert.run(
    "MIXUP",
    JSON.stringify({ ...JSON.parse(JSON.stringify(first.rooms.get(code)?.snap)), code: "OTHER" }),
    Date.now(),
  );
  db.close();

  const second = start({ dataDir });
  expect([...second.rooms.keys()]).toEqual([code]);
  const client = await Raw.open(second, code, token);
  await client.ping();
});

test("repeated messages that change nothing are neither saved nor broadcast", async () => {
  const app = start();
  const { code, token } = await createRoom(app);
  const client = await Raw.open(app, code, token);
  await client.until(() => client.messages.some((m) => m.t === "room"));
  const logged = app.store.logFor(code).length;
  const heard = client.messages.length;
  for (let i = 0; i < 10; i++) client.send(JSON.stringify({ t: "setBotSpeed", speed: "normal" }));
  for (let i = 0; i < 5; i++) client.send(JSON.stringify({ t: "stopGame" }));
  await client.ping();
  expect(app.store.logFor(code).length).toBe(logged);
  expect(client.messages.length).toBe(heard + 1);
});

test("the message log of a busy table stays bounded", async () => {
  const app = start({ limits: { logPerRoom: 20, messages: { burst: 10_000, perSecond: 10_000 } } });
  const { code, token } = await createRoom(app);
  const client = await Raw.open(app, code, token);
  for (let i = 0; i < 600; i++) client.send(JSON.stringify({ t: "setBotSpeed", speed: i % 2 ? "slow" : "fast" }));
  await client.ping();
  expect(app.store.logFor(code).length).toBeLessThan(300);
  expect(app.store.logFor(code).at(-1)?.message).toEqual({ t: "setBotSpeed", speed: "slow" });
});

test("the host cannot hand a connected player's seat to a bot", async () => {
  const app = start();
  const { code, token } = await createRoom(app);
  const joined = await post(app, `/api/rooms/${code}/join`, { name: "Ben" });
  const host = await Raw.open(app, code, token);
  await Raw.open(app, code, joined.body.token as string);
  host.send(JSON.stringify({ t: "start" }));
  host.send(JSON.stringify({ t: "takeover", seat: 1, bot: true }));
  await host.until(() => host.errors().length > 0);
  expect(host.errors()).toEqual(["that player is still connected"]);
  expect(app.rooms.get(code)?.snap.seats[1]?.takenOver).toBe(false);
});
