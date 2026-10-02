import { expect, test } from "bun:test";
import { isRoomSnapshot, Room } from "../src/room.ts";

function lobby() {
  const { room, token } = Room.create("ABCDE", "Anna");
  const ben = room.join("Ben");
  const cleo = room.join("Cleo");
  if ("error" in ben || "error" in cleo) throw new Error("join failed");
  return { room, anna: token, ben: ben.token, cleo: cleo.token };
}

test("duplicate names get a number and the table holds at most ten", () => {
  const { room } = lobby();
  const again = room.join("Ben");
  expect("token" in again && room.snap.seats[room.seatOf(again.token)]?.name).toBe("Ben 2");
  for (let i = 0; i < 6; i++) room.handle(0, { t: "addBot", level: "easy" });
  expect(room.snap.seats).toHaveLength(10);
  expect(room.join("Dora")).toEqual({ error: "the table is full" });
  expect(room.handle(0, { t: "addBot", level: "easy" })).toEqual({ ok: false, error: "the table is full" });
  expect(new Set(room.snap.seats.map((s) => s.name)).size).toBe(10);
});

test("when the host leaves the lobby, the next human becomes host", () => {
  const { room, ben } = lobby();
  room.handle(0, { t: "addBot", level: "normal" });
  const r = room.handle(0, { t: "leave" });
  expect(r.ok).toBe(true);
  expect(room.snap.host).toBe(room.seatOf(ben));
  expect(room.snap.seats.map((s) => s.name)).toEqual(["Ben", "Cleo", "🤖 Kelp"]);
});

test("removing a seat before the host keeps the host index right", () => {
  const { room, cleo } = lobby();
  room.handle(0, { t: "leave" });
  const host = room.snap.host;
  expect(room.handle(host, { t: "removeSeat", seat: host })).toEqual({
    ok: false,
    error: "the host cannot remove themselves",
  });
  const r = room.handle(host, { t: "removeSeat", seat: room.seatOf(cleo) });
  expect(r).toEqual({ ok: true, events: [], removedTokens: [cleo] });
  expect(room.snap.seats.map((s) => s.name)).toEqual(["Ben"]);
});

test("only the lobby allows adding seats and changing the goal", () => {
  const { room } = lobby();
  expect(room.handle(0, { t: "setTarget", score: 5 }).ok).toBe(false);
  expect(room.handle(0, { t: "setTarget", score: 150 }).ok).toBe(true);
  expect(room.handle(0, { t: "start" }).ok).toBe(true);
  expect(room.snap.game?.settings.targetScore).toBe(150);
  expect(room.handle(0, { t: "addBot", level: "easy" }).ok).toBe(false);
  expect(room.handle(0, { t: "setTarget", score: 50 }).ok).toBe(false);
  expect(room.handle(1, { t: "playAgain" })).toEqual({ ok: true, events: [] });
  expect(room.snap.gameNumber).toBe(1);
});

test("stopping is host-only and returns the same seats and settings to the lobby", () => {
  const { room, anna, ben } = lobby();
  room.handle(0, { t: "setTarget", score: 50 });
  room.handle(0, { t: "start" });
  room.handle(0, { t: "takeover", seat: 1, bot: true });
  expect(room.handle(1, { t: "stopGame" }).ok).toBe(false);
  expect(room.snap.status).toBe("playing");
  expect(room.handle(0, { t: "stopGame" }).ok).toBe(true);
  expect(room.snap.game).toBeNull();
  expect(room.snap.status).toBe("lobby");
  expect(room.pendingBot()).toBeNull();
  expect(room.seatOf(anna)).toBe(0);
  expect(room.seatOf(ben)).toBe(1);
  expect(room.snap.seats[1]?.takenOver).toBe(false);
  expect(room.snap.settings.targetScore).toBe(50);
  expect(room.handle(1, { t: "action", action: { type: "flip", index: 0 } }).ok).toBe(false);
  room.handle(0, { t: "setTarget", score: 100 });
  room.handle(0, { t: "start" });
  expect(room.snap.game?.settings.targetScore).toBe(100);
  expect(room.snap.game?.totals).toEqual([0, 0, 0]);
});

test("exiting preserves the grid, revokes the seat and transfers hosting to a human", () => {
  const { room, anna, ben, cleo } = lobby();
  room.handle(0, { t: "start" });
  room.handle(0, { t: "action", action: { type: "flip", index: 0 } });
  const before = structuredClone(room.snap.game);
  expect(room.handle(0, { t: "leave" })).toEqual({ ok: true, events: [], removedTokens: [anna] });
  expect(room.snap.game).toEqual(before);
  expect(room.snap.seats).toHaveLength(3);
  expect(room.snap.seats[0]?.kind).toBe("bot");
  expect(room.pendingBot()).toBe(0);
  expect(room.seatOf(anna)).toBe(-1);
  expect(room.snap.host).toBe(room.seatOf(ben));
  room.handle(1, { t: "leave" });
  expect(room.snap.host).toBe(room.seatOf(cleo));
  room.handle(2, { t: "stopGame" });
  expect(room.join("Anna")).toHaveProperty("token");
});

test("the host can change the bot speed at any time, and old snapshots default to normal", () => {
  const { room } = lobby();
  expect(room.botSpeed).toBe("normal");
  expect(room.handle(1, { t: "setBotSpeed", speed: "slow" }).ok).toBe(false);
  expect(room.handle(0, { t: "setBotSpeed", speed: "slow" }).ok).toBe(true);
  room.handle(0, { t: "start" });
  expect(room.handle(0, { t: "setBotSpeed", speed: "fast" }).ok).toBe(true);
  expect(room.view(1, () => true).botSpeed).toBe("fast");
  delete room.snap.botSpeed;
  expect(room.view(1, () => true).botSpeed).toBe("normal");
});

test("a second press of next round or play again changes nothing", () => {
  const { room } = lobby();
  room.handle(0, { t: "start" });
  const before = structuredClone(room.snap.game);
  expect(room.handle(1, { t: "nextRound" })).toEqual({ ok: true, events: [] });
  expect(room.snap.game).toEqual(before);
});

test("a bot plays a taken-over seat and its owner cannot act until they reclaim it", () => {
  const { room } = lobby();
  room.handle(0, { t: "start" });
  expect(room.handle(0, { t: "takeover", seat: 0, bot: true }).ok).toBe(false);
  expect(room.handle(1, { t: "takeover", seat: 2, bot: true }).ok).toBe(false);
  expect(room.handle(0, { t: "takeover", seat: 1, bot: true }).ok).toBe(true);
  expect(room.handle(1, { t: "action", action: { type: "flip", index: 0 } })).toEqual({
    ok: false,
    error: "a bot is playing this seat",
  });
  expect(room.pendingBot()).toBe(1);
  room.botStep();
  room.botStep();
  expect(room.snap.game?.initialFlips[1]).toBe(2);
  expect(room.pendingBot()).toBeNull();
  expect(room.reclaim(1)).toBe(true);
  expect(room.isBotControlled(1)).toBe(false);
});

test("only the host can hide running sums, only in the lobby, and the game keeps the choice", () => {
  const { room } = lobby();
  expect(room.snap.settings.showSums).toBe(true);
  expect(room.handle(1, { t: "setShowSums", show: false })).toEqual({
    ok: false,
    error: "only the host can choose whether sums are shown",
  });
  expect(room.handle(0, { t: "setShowSums", show: false }).ok).toBe(true);
  room.handle(0, { t: "start" });
  expect(room.handle(0, { t: "setShowSums", show: true }).ok).toBe(false);
  const view = room.view(1, () => true);
  expect(view.settings.showSums).toBe(false);
  expect(view.game?.boards.every((b) => b.visibleSum === null)).toBe(true);
  room.handle(0, { t: "stopGame" });
  expect(room.view(1, () => true).settings.showSums).toBe(false);
});

test("snapshots saved before sums could be hidden load with sums shown", () => {
  const { room } = lobby();
  room.handle(0, { t: "start" });
  const old = JSON.parse(JSON.stringify(room.snap));
  delete old.settings.showSums;
  delete old.game.settings.showSums;
  const loaded = new Room(old);
  expect(loaded.snap.settings.showSums).toBe(true);
  expect(loaded.view(0, () => true).game?.boards[0]?.visibleSum).toBe(0);
});

test("when the host exits a game, hosting goes to someone still playing their own seat", () => {
  const { room, cleo } = lobby();
  room.handle(0, { t: "start" });
  room.handle(0, { t: "takeover", seat: 1, bot: true });
  room.handle(0, { t: "leave" });
  expect(room.snap.host).toBe(room.seatOf(cleo));
});

test("if everyone is away when the host exits, the first person back becomes host", () => {
  const { room, ben, cleo } = lobby();
  room.handle(0, { t: "start" });
  room.handle(0, { t: "takeover", seat: 1, bot: true });
  room.handle(0, { t: "takeover", seat: 2, bot: true });
  room.handle(0, { t: "leave" });
  expect(room.snap.host).toBe(room.seatOf(ben));
  room.reclaim(room.seatOf(cleo));
  expect(room.snap.host).toBe(room.seatOf(cleo));
  room.reclaim(room.seatOf(ben));
  expect(room.snap.host).toBe(room.seatOf(cleo));
});

test("a bot only takes over a seat while a game is running", () => {
  const { room } = lobby();
  expect(room.handle(0, { t: "takeover", seat: 1, bot: true })).toEqual({
    ok: false,
    error: "a bot can only take over during a game",
  });
  expect(room.snap.seats[1]?.takenOver).toBe(false);
});

test("stored snapshots are checked before they are trusted", () => {
  const { room } = lobby();
  const good = JSON.parse(JSON.stringify(room.snap));
  expect(isRoomSnapshot(good)).toBe(true);
  for (const bad of [
    null,
    [],
    "text",
    { ...good, code: "../x" },
    { ...good, seats: [] },
    { ...good, seats: "x" },
    { ...good, host: 7 },
    { ...good, host: -1 },
    { ...good, status: "playing" },
    { ...good, status: "lobby", game: {} },
    { ...good, settings: null },
    { ...good, seats: [{ ...good.seats[0], kind: "alien" }] },
  ])
    expect(isRoomSnapshot(bad)).toBe(false);
  room.handle(0, { t: "start" });
  const playing = JSON.parse(JSON.stringify(room.snap));
  expect(isRoomSnapshot(playing)).toBe(true);
  expect(isRoomSnapshot({ ...playing, game: { ...playing.game, grids: [] } })).toBe(false);
});
