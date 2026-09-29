import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ClientMessage,
  chooseAction,
  legalActions,
  makeRandom,
  type RoomView,
  type ServerMessage,
} from "@shoalow/game";
import { createServer } from "../src/app.ts";

type App = ReturnType<typeof createServer>;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0).reverse()) c();
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "shoalow-test-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function start(dataDir: string, port = 0): App {
  const app = createServer({ port, hostname: "127.0.0.1", dataDir, botDelayMs: 0 });
  let stopped = false;
  const stop = app.stop;
  app.stop = () => {
    if (!stopped) stop();
    stopped = true;
  };
  cleanups.push(() => app.stop());
  return app;
}

async function post(app: App, path: string, body: unknown): Promise<{ status: number; body: Record<string, string> }> {
  const res = await fetch(new URL(path, app.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, string> };
}

/** A WebSocket client that records every message and can autoplay with the Normal bot logic. */
class Client {
  latest: RoomView | null = null;
  errors: string[] = [];
  removed = false;
  autoplay = false;
  private waiters: { pred: (r: RoomView) => boolean; resolve: (r: RoomView) => void }[] = [];
  private acted = new Set<string>();
  private readonly random = makeRandom(7);

  private constructor(
    readonly ws: WebSocket,
    readonly token: string,
  ) {}

  static async connect(app: App, code: string, token: string): Promise<Client> {
    const url = new URL(`/ws?room=${code}&token=${token}`, app.url);
    url.protocol = "ws:";
    const ws = new WebSocket(url);
    const client = new Client(ws, token);
    ws.onmessage = (e) => client.receive(JSON.parse(String(e.data)) as ServerMessage);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("socket failed"));
    });
    cleanups.push(() => ws.close());
    return client;
  }

  send(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  private receive(msg: ServerMessage): void {
    if (msg.t === "error") this.errors.push(msg.message);
    if (msg.t === "removed") this.removed = true;
    if (msg.t === "room") this.latest = msg.room;
    const latest = this.latest;
    if (!latest) return;
    this.waiters = this.waiters.filter((w) => {
      if (!w.pred(latest)) return true;
      w.resolve(latest);
      return false;
    });
    if (msg.t === "room" && this.autoplay) this.play(msg.room);
  }

  private play(room: RoomView): void {
    const g = room.game;
    if (!g) return;
    if (g.phase === "roundOver" && room.you === room.host) {
      const key = `next:${g.round}`;
      if (!this.acted.has(key)) {
        this.acted.add(key);
        this.send({ t: "nextRound" });
      }
      return;
    }
    if (legalActions(g).length === 0) return;
    const key = `${g.round}:${g.turn}:${g.stage}:${g.current}:${g.boards[room.you]?.initialFlips}`;
    if (this.acted.has(key)) return;
    this.acted.add(key);
    const action = chooseAction(g, "normal", this.random);
    if (action) this.send({ t: "action", action });
  }

  /** Starts autoplay from the latest state already received. */
  resume(): void {
    this.autoplay = true;
    if (this.latest) this.play(this.latest);
  }

  until(pred: (r: RoomView) => boolean, timeoutMs = 10_000): Promise<RoomView> {
    if (this.latest && pred(this.latest)) return Promise.resolve(this.latest);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for room state")), timeoutMs);
      this.waiters.push({
        pred,
        resolve: (r) => {
          clearTimeout(timer);
          resolve(r);
        },
      });
    });
  }
}

function assertNoHiddenValues(room: RoomView): void {
  for (const board of room.game?.boards ?? []) {
    for (const card of board.cards) if (card && !card.faceUp) expect(Object.keys(card)).toEqual(["faceUp"]);
  }
  expect(JSON.stringify(room)).not.toContain("drawPile");
}

async function createRoom(app: App, name = "Anna"): Promise<{ code: string; token: string }> {
  const r = await post(app, "/api/rooms", { name });
  expect(r.status).toBe(200);
  return { code: r.body.code as string, token: r.body.token as string };
}

test("two humans and a bot play a complete game over WebSockets", async () => {
  const app = start(tempDir());
  const { code, token } = await createRoom(app);
  expect(code).toMatch(/^[A-Z2-9]{5}$/);
  const joined = await post(app, `/api/rooms/${code.toLowerCase()}/join`, { name: "Ben" });
  expect(joined.status).toBe(200);

  const anna = await Client.connect(app, code, token);
  const ben = await Client.connect(app, code, joined.body.token as string);
  await anna.until((r) => r.seats.length === 2 && r.seats.every((s) => s.connected));

  ben.send({ t: "addBot", level: "easy" });
  await ben.until(() => ben.errors.length > 0);
  expect(ben.errors[0]).toMatch(/only the host/);

  anna.send({ t: "addBot", level: "normal" });
  anna.send({ t: "setTarget", score: 40 });
  const lobby = await anna.until((r) => r.seats.length === 3 && r.settings.targetScore === 40);
  expect(lobby.seats[2]).toMatchObject({ kind: "bot", level: "normal", connected: true });

  anna.autoplay = true;
  ben.autoplay = true;
  anna.send({ t: "start" });

  const late = await post(app, `/api/rooms/${code}/join`, { name: "Cleo" });
  expect(late.status).toBe(409);

  const seen: RoomView[] = [];
  const final = await ben.until((r) => {
    seen.push(r);
    return r.game?.phase === "gameOver";
  }, 30_000);
  for (const r of seen) assertNoHiddenValues(r);
  expect(final.game?.totals.some((t) => t >= 40)).toBe(true);
  expect(final.game?.winners.length).toBeGreaterThan(0);
  expect(final.game?.rounds.length).toBeGreaterThan(0);
  expect(app.store.logFor(code).length).toBeGreaterThan(20);
}, 60_000);

test("a game resumes exactly where it was after the server restarts", async () => {
  const dir = tempDir();
  let app = start(dir);
  const { code, token } = await createRoom(app);
  let anna = await Client.connect(app, code, token);
  anna.send({ t: "addBot", level: "normal" });
  await anna.until((r) => r.seats.length === 2);
  anna.send({ t: "start" });
  anna.autoplay = true;
  const midGame = await anna.until((r) => r.game?.phase === "turn" && (r.game?.turn ?? 0) >= 6);
  anna.autoplay = false;
  // Let any in-flight move settle, then snapshot what Anna sees.
  await Bun.sleep(50);
  const before = anna.latest;
  expect(before?.game?.round).toBe(midGame.game?.round);

  const port = Number(new URL(app.url).port);
  app.stop();
  app = start(dir, port);
  anna = await Client.connect(app, code, token);
  const after = await anna.until(() => true);
  expect(after.game).toEqual(before?.game ?? null);
  expect(after.seats.map((s) => s.name)).toEqual(["Anna", "🤖 Kelp"]);

  anna.resume();
  const done = await anna.until((r) => r.game?.phase === "gameOver", 60_000);
  expect(done.game?.winners.length).toBeGreaterThan(0);
}, 90_000);

test("the host can hand an absent player's seat to a bot until they return", async () => {
  const app = start(tempDir());
  const { code, token } = await createRoom(app);
  const joined = await post(app, `/api/rooms/${code}/join`, { name: "Ben" });
  const benToken = joined.body.token as string;
  const anna = await Client.connect(app, code, token);
  let ben = await Client.connect(app, code, benToken);
  await anna.until((r) => r.seats.length === 2 && r.seats[1]?.connected === true);
  anna.send({ t: "start" });
  await anna.until((r) => r.game?.phase === "initialFlip");
  ben.ws.close();
  await anna.until((r) => r.seats[1]?.connected === false);

  anna.send({ t: "takeover", seat: 1, bot: true });
  const covered = await anna.until(
    (r) => r.seats[1]?.takenOver === true && (r.game?.boards[1]?.initialFlips ?? 0) === 2,
  );
  expect(covered.game?.boards[1]?.faceDown).toBe(10);

  ben = await Client.connect(app, code, benToken);
  const back = await ben.until((r) => r.seats[1]?.connected === true);
  expect(back.seats[1]?.takenOver).toBe(false);
  expect(back.you).toBe(1);
});

test("bad requests are refused with clear errors", async () => {
  const app = start(tempDir());
  expect((await post(app, "/api/rooms", { name: "   " })).status).toBe(400);
  expect((await post(app, "/api/rooms/ZZZZZ/join", { name: "Ben" })).status).toBe(404);
  const { code, token } = await createRoom(app);
  const info = await fetch(new URL(`/api/rooms/${code}`, app.url));
  expect(await info.json()).toEqual({ code, status: "lobby", players: 1 });

  const ws = new URL(`/ws?room=${code}&token=nope`, app.url);
  expect((await fetch(ws)).status).toBe(404);

  const anna = await Client.connect(app, code, token);
  anna.ws.send("{not json");
  anna.send({ t: "start" });
  await anna.until(() => anna.errors.length >= 2);
  expect(anna.errors).toEqual(["malformed message", "add at least one more player or bot"]);
  expect((await fetch(new URL("/healthz", app.url))).status).toBe(200);
});
