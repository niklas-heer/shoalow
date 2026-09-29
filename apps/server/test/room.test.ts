import { expect, test } from "bun:test";
import { Room } from "../src/room.ts";

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

test("only the lobby allows seat and setting changes", () => {
  const { room } = lobby();
  expect(room.handle(0, { t: "setTarget", score: 5 }).ok).toBe(false);
  expect(room.handle(0, { t: "setTarget", score: 150 }).ok).toBe(true);
  expect(room.handle(0, { t: "start" }).ok).toBe(true);
  expect(room.snap.game?.settings.targetScore).toBe(150);
  expect(room.handle(0, { t: "addBot", level: "easy" }).ok).toBe(false);
  expect(room.handle(1, { t: "leave" }).ok).toBe(false);
  expect(room.handle(0, { t: "setTarget", score: 50 }).ok).toBe(false);
  expect(room.handle(1, { t: "playAgain" })).toEqual({ ok: true, events: [] });
  expect(room.snap.gameNumber).toBe(1);
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
