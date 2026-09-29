import { expect, test } from "bun:test";
import { applyAction, newGame, type RoomView, viewFor } from "@shoalow/game";
import { coachNote, coachTip } from "../src/lib/coach.ts";

const seats: RoomView["seats"] = [
  { name: "Anna", kind: "human", level: null, connected: true, takenOver: false },
  { name: "🤖 Kelp", kind: "bot", level: "easy", connected: true, takenOver: false },
];
const room = (state: ReturnType<typeof newGame>): RoomView => ({
  code: "Practice",
  host: 0,
  you: 0,
  seats,
  settings: state.settings,
  botSpeed: "normal",
  status: "playing",
  game: viewFor(state, 0),
});

test("the coach walks through the opening reveal", () => {
  let state = newGame(33, 2, { targetScore: 50 });
  expect(coachTip(room(state))?.title).toBe("Peek at two cards");
  const step = (seat: number, index: number) => {
    const r = applyAction(state, seat, { type: "flip", index });
    if (!r.ok) throw new Error(r.error);
    state = r.state;
  };
  step(0, 0);
  expect(coachTip(room(state))?.title).toBe("One more");
  step(0, 1);
  expect(coachTip(room(state))?.title).toBe("Who starts?");
  step(1, 0);
  step(1, 1);
  const tip = coachTip(room(state));
  // Seed 33 opens with a 0 on the discard pile, so whoever starts is told about it.
  expect(tip?.title === "Take the 0" || tip?.title === "🤖 Kelp's turn").toBe(true);
});

test("the coach remarks on cleared columns and the round ending", () => {
  const r = room(newGame(33, 2));
  expect(coachNote(r, [{ type: "columnCleared", player: 0, column: 1, value: 4 }])).toMatch(/^Column cleared/);
  expect(coachNote(r, [{ type: "finalTurns", endedBy: 1 }])).toMatch(/^🤖 Kelp turned over every card/);
  expect(coachNote(r, [{ type: "turnStarted", player: 0 }])).toBeNull();
});
