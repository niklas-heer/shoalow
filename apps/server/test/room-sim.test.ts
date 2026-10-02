import { expect, test } from "bun:test";
import {
  type Action,
  allCards,
  chooseAction,
  DECK_SIZE,
  legalActions,
  MAX_PLAYERS,
  makeRandom,
  parseClientMessage,
  viewFor,
} from "@shoalow/game";
import { isRoomSnapshot, Room } from "../src/room.ts";

/**
 * Deterministic simulation of whole tables: people join and leave, the host changes settings,
 * players send legal, illegal and malformed messages, bots move, and the server "restarts" from
 * the saved snapshot. Every step checks the table's invariants, and every table must still be
 * able to finish its game. A failure prints the command that replays it.
 */

const RUNS = Number(process.env.ROOM_SIM_RUNS ?? 15);
const BASE_SEED = Number(process.env.ROOM_SIM_SEED ?? 20261002);
const FROM = Number(process.env.ROOM_SIM_FROM ?? 0);
const STEPS = Number(process.env.ROOM_SIM_STEPS ?? 1500);
const FINISH_LIMIT = 60_000;

const JUNK = [
  "",
  "not json",
  "null",
  "[]",
  "{}",
  '{"t":"action"}',
  '{"t":"action","action":{"type":"swap","index":-1}}',
  '{"t":"action","action":{"type":"swap","index":1e9}}',
  '{"t":"action","action":{"type":"flip","index":"0"}}',
  '{"t":"action","action":{"type":"nextRound"}}',
  '{"t":"removeSeat","seat":-1}',
  '{"t":"removeSeat","seat":999}',
  '{"t":"takeover","seat":-5,"bot":true}',
  '{"t":"setTarget","score":1e308}',
  '{"t":"setTarget","score":-10}',
  '{"t":"__proto__","constructor":{"prototype":{"x":1}}}',
  '{"t":"start","extra":"x".repeat(10)}',
  `{"t":"addBot","level":"${"a".repeat(3000)}"}`,
];

const NAMES = ["Anna", "Ben", "Cleo", "Dora", "Anna", "  ", "‮evil", "x".repeat(40), "🐙", "🤖 Kelp", "Ben 2"];

interface Sim {
  room: Room;
  random: () => number;
  rooms: number;
}

function pickFrom<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

/** A message as a person (or someone poking at the protocol) might send it. */
function messageFor(sim: Sim, seat: number): string {
  const { room, random } = sim;
  const g = room.snap.game;
  const roll = random();
  if (roll < 0.04) return pickFrom(JUNK, random);
  if (g && roll < 0.6) {
    const legal = legalActions(viewFor(g, seat));
    if (legal.length > 0) return JSON.stringify({ t: "action", action: pickFrom(legal, random) });
  }
  const seat2 = Math.floor(random() * (room.snap.seats.length + 2)) - 1;
  const options: unknown[] = [
    { t: "ping" },
    { t: "action", action: randomAction(random) },
    { t: "addBot", level: random() < 0.5 ? "easy" : "normal" },
    { t: "removeSeat", seat: seat2 },
    { t: "setTarget", score: Math.floor(random() * 600) - 50 },
    { t: "setShowSums", show: random() < 0.5 },
    { t: "setBotSpeed", speed: pickFrom(["slow", "normal", "fast"], random) },
    { t: "start" },
    { t: "start" },
    { t: "nextRound" },
    { t: "playAgain" },
    { t: "takeover", seat: seat2, bot: random() < 0.6 },
  ];
  // Leaving and stopping end a lot of play, so they are rarer than the rest.
  if (random() < 0.08) options.push({ t: "leave" }, { t: "stopGame" });
  return JSON.stringify(pickFrom(options, random));
}

function randomAction(random: () => number): Action {
  const index = Math.floor(random() * 16) - 2;
  return pickFrom<Action>(
    [
      { type: "flip", index },
      { type: "swap", index },
      { type: "drawDeck" },
      { type: "takeDiscard" },
      { type: "discardHand" },
    ],
    random,
  );
}

function humanSeats(room: Room): number[] {
  return room.snap.seats.flatMap((s, i) => (s.kind === "human" ? [i] : []));
}

function freshRoom(sim: Pick<Sim, "random" | "rooms">): Room {
  sim.rooms += 1;
  return new Room(Room.create("REEFS", "Host").room.snap, sim.random);
}

function checkInvariants(room: Room, where: string): void {
  const s = room.snap;
  const fail = (what: string) => {
    throw new Error(`${where}: ${what}`);
  };
  if (!isRoomSnapshot(JSON.parse(JSON.stringify(s)))) fail("snapshot no longer has a valid shape");
  if (s.seats.length < 1 || s.seats.length > MAX_PLAYERS) fail(`${s.seats.length} seats`);
  if (s.seats[s.host]?.kind !== "human") fail("the host is not a person");
  if (s.seats[s.host]?.takenOver && s.seats.some((x) => x.kind === "human" && !x.takenOver))
    fail("hosting went to an away player while someone else is playing");
  if (new Set(s.seats.map((x) => x.token)).size !== s.seats.length) fail("two seats share a token");
  if (new Set(s.seats.map((x) => x.name)).size !== s.seats.length) fail("two seats share a name");
  if ((s.status === "lobby") !== (s.game === null)) fail(`status ${s.status} with game ${s.game ? "set" : "unset"}`);
  for (const seat of s.seats) if (seat.kind === "bot" && seat.takenOver) fail("a bot seat is marked taken over");

  const g = s.game;
  if (!g) {
    if (s.seats.some((x) => x.takenOver)) fail("a takeover survived the return to the lobby");
    return;
  }
  if (g.playerCount !== s.seats.length) fail("player count differs from the seats");
  if (allCards(g).length !== DECK_SIZE) fail(`${allCards(g).length} cards in play`);
  if (g.settings.showSums !== s.settings.showSums || g.settings.targetScore !== s.settings.targetScore)
    fail("the game's settings drifted from the table's");

  for (let seat = 0; seat < s.seats.length; seat++) {
    const view = room.view(seat, () => true);
    const text = JSON.stringify(view);
    if (text.includes("drawPile") || text.includes("token")) fail("a view carries private data");
    view.game?.boards.forEach((b, q) => {
      if ((b.visibleSum === null) === s.settings.showSums) fail("running sum against the setting");
      b.cards.forEach((c, i) => {
        const real = g.grids[q]?.[i] ?? null;
        if (c && !c.faceUp && "value" in c) fail(`hidden card ${q}/${i} leaked to seat ${seat}`);
        if (c?.faceUp && real?.value !== c.value) fail("a face-up card shows the wrong value");
      });
    });
  }
}

/** Plays out the current game with every seat on autopilot; it must reach the end. */
function finish(sim: Sim, where: string): void {
  const { room, random } = sim;
  if (!room.snap.game) {
    const r = room.handle(room.snap.host, { t: "start" });
    if (!r.ok && room.snap.seats.length >= 2) throw new Error(`${where}: could not start: ${r.error}`);
    if (!r.ok) return;
  }
  for (let i = 0; i < FINISH_LIMIT; i++) {
    const g = room.snap.game;
    if (!g) throw new Error(`${where}: the game vanished while finishing`);
    if (g.phase === "gameOver") return;
    if (g.phase === "roundOver") {
      // Anyone playing their own seat may deal the next round; if all are away, one comes back.
      let dealer = room.snap.seats.findIndex((x, p) => x.kind === "human" && !room.isBotControlled(p));
      if (dealer === -1) {
        dealer = room.snap.host;
        room.reclaim(dealer);
      }
      const r = room.handle(dealer, { t: "nextRound" });
      if (!r.ok) throw new Error(`${where}: next round refused: ${r.error}`);
      continue;
    }
    if (room.pendingBot() !== null) {
      const step = room.botStep();
      if (!step?.outcome.ok) throw new Error(`${where}: bot could not move`);
      continue;
    }
    const seat =
      g.phase === "initialFlip" ? g.initialFlips.findIndex((n, p) => n < 2 && !room.isBotControlled(p)) : g.current;
    const action = chooseAction(viewFor(g, seat), "normal", random);
    if (!action) throw new Error(`${where}: seat ${seat} has no move in ${g.phase}/${g.stage}`);
    const r = room.handle(seat, { t: "action", action });
    if (!r.ok) throw new Error(`${where}: seat ${seat} legal move refused: ${r.error}`);
    checkInvariants(room, `${where} finishing ${i}`);
  }
  throw new Error(`${where}: the game did not finish`);
}

function run(seed: number): { steps: number; rooms: number; restarts: number; games: number } {
  const random = makeRandom(seed);
  const sim: Sim = { room: null as unknown as Room, random, rooms: 0 };
  sim.room = freshRoom(sim);
  let restarts = 0;
  let games = 0;

  for (let step = 0; step < STEPS; step++) {
    const where = `seed ${seed} step ${step}`;
    const { room } = sim;
    const roll = random();
    const before = room.snap.gameNumber;

    if (roll < 0.06) {
      room.join(pickFrom(NAMES, random));
    } else if (roll < 0.08) {
      // The server restarts and reads the table back from its saved snapshot.
      const saved = JSON.parse(JSON.stringify(room.snap));
      expect(isRoomSnapshot(saved)).toBe(true);
      sim.room = new Room(saved, random);
      expect(sim.room.snap).toEqual(room.snap);
      restarts += 1;
    } else if (roll < 0.1) {
      const humans = humanSeats(room);
      room.reclaim(pickFrom(humans, random));
    } else if (roll < 0.3 && room.pendingBot() !== null) {
      const stepped = room.botStep();
      if (stepped && !stepped.outcome.ok) throw new Error(`${where}: bot chose an illegal move`);
    } else {
      const seat = pickFrom(humanSeats(room), random);
      // Only a connected player sends messages, and connecting takes a seat back from its bot.
      room.reclaim(seat);
      const msg = parseClientMessage(messageFor(sim, seat));
      if (msg) {
        let outcome: ReturnType<Room["handle"]>;
        try {
          outcome = room.handle(seat, msg);
        } catch (e) {
          throw new Error(`${where}: ${JSON.stringify(msg)} from seat ${seat} threw: ${(e as Error).message}`);
        }
        if (outcome.ok && msg.t === "action" && room.isBotControlled(seat))
          throw new Error(`${where}: a bot-controlled seat moved for itself`);
      }
    }

    if (sim.room.snap.gameNumber !== before) games += 1;
    // The server deletes a table once no people are left; the next visitor starts a new one.
    if (!sim.room.snap.seats.some((x) => x.kind === "human")) {
      sim.room = freshRoom(sim);
      continue;
    }
    checkInvariants(sim.room, where);
  }

  if (sim.room.snap.seats.length < 2) sim.room.handle(sim.room.snap.host, { t: "addBot", level: "easy" });
  finish(sim, `seed ${seed} final`);
  return { steps: STEPS, rooms: sim.rooms, restarts, games };
}

test(`${RUNS} simulated tables keep every invariant under random and hostile input`, () => {
  const started = performance.now();
  const totals = { steps: 0, rooms: 0, restarts: 0, games: 0 };
  for (let i = FROM; i < FROM + RUNS; i++) {
    const seed = (BASE_SEED + i * 104_729) | 0;
    try {
      const r = run(seed);
      totals.steps += r.steps;
      totals.rooms += r.rooms;
      totals.restarts += r.restarts;
      totals.games += r.games;
    } catch (e) {
      throw new Error(
        `${(e as Error).message}\nreproduce: ROOM_SIM_SEED=${BASE_SEED} ROOM_SIM_FROM=${i} ROOM_SIM_RUNS=1 mise run sim`,
      );
    }
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(
    `simulated ${RUNS} tables: ${totals.steps} steps, ${totals.rooms} rooms, ${totals.games} games started, ${totals.restarts} restarts in ${seconds}s (base seed ${BASE_SEED})`,
  );
}, 600_000);
