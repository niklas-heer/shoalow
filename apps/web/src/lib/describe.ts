import type { GameEvent, GameView, RoomView } from "@shoalow/game";
import { formatValue } from "./cards.ts";

export function seatName(room: RoomView, seat: number): string {
  return seat === room.you ? "You" : (room.seats[seat]?.name ?? "Someone");
}

/** Whether a seat won the finished game; a shared lowest total gives everyone on it the win. */
export const won = (game: GameView, seat: number): boolean => game.phase === "gameOver" && game.winners.includes(seat);

const article = (v: number) => (v === 8 || v === 11 ? "an" : "a");
const card = (v: number) => `${article(v)} ${formatValue(v)}`;

/** The instruction or status shown in the banner above the table. */
export function prompt(room: RoomView): { text: string; yours: boolean } {
  const g = room.game;
  if (!g) return { text: "", yours: false };
  const me = room.you;
  const myBoard = g.boards[me];
  if (g.phase === "initialFlip") {
    const left = 2 - (myBoard?.initialFlips ?? 2);
    if (left > 0) return { text: left === 2 ? "Reveal two of your cards" : "Reveal one more card", yours: true };
    const waiting = g.boards.flatMap((b, i) => (b.initialFlips < 2 ? [room.seats[i]?.name ?? ""] : []));
    return { text: `Waiting for ${listNames(waiting)} to reveal their cards`, yours: false };
  }
  if (g.phase !== "turn") return { text: "", yours: false };
  if (g.current !== me) {
    const seat = room.seats[g.current];
    const verb = seat?.kind === "bot" || seat?.takenOver ? "is thinking" : "is choosing";
    return { text: `${seat?.name ?? "Someone"} ${verb}…`, yours: false };
  }
  const last = g.endedBy !== null ? "Last turn! " : "";
  switch (g.stage) {
    case "choose":
      return {
        text: `${last}Draw from the pile${g.discardTop !== null ? ` or take the ${formatValue(g.discardTop)}` : ""}`,
        yours: true,
      };
    case "drawn":
      return {
        text:
          myBoard && myBoard.faceDown > 0
            ? "Swap it into your grid, or drop it on the discard pile"
            : "Swap it into your grid",
        yours: true,
      };
    case "fromDiscard":
      return { text: "Swap it into your grid", yours: true };
    case "mustFlip":
      return { text: "Reveal one of your face-down cards", yours: true };
  }
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** A one-line summary of the most recent move, for following along. */
export function lastMove(room: RoomView, events: GameEvent[]): string | null {
  const who = (p: number) => seatName(room, p);
  let line: string | null = null;
  let discarded: { player: number; value: number } | null = null;
  for (const e of events) {
    switch (e.type) {
      case "swapped":
        line = `${who(e.player)} swapped ${card(e.removed)} for ${card(e.placed)}`;
        break;
      case "discarded":
        discarded = e;
        break;
      case "flipped":
        if (discarded && discarded.player === e.player) {
          line = `${who(e.player)} passed on ${card(discarded.value)} and revealed ${card(e.value)}`;
          discarded = null;
        }
        break;
      case "columnCleared":
        line = `${line ? `${line}. ` : ""}${who(e.player)} cleared a column of ${formatValue(e.value)}s`;
        break;
      case "reshuffled":
        line =
          e.count === null
            ? "The discard pile was shuffled into a new draw pile"
            : `The discard pile was shuffled into a new draw pile of ${e.count}`;
        break;
      case "finalTurns":
        line = `${line ? `${line}. ` : ""}${who(e.endedBy)} revealed every card`;
        break;
    }
  }
  return line;
}
