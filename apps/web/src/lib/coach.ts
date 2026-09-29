import type { BoardView, GameEvent, RoomView } from "@shoalow/game";
import { formatValue } from "./cards.ts";

export interface Tip {
  title: string;
  text: string;
}

const faceUpValues = (board: BoardView) =>
  board.cards.flatMap((c, i) => (c?.faceUp ? [{ index: i, value: c.value }] : []));

/** A column with two equal face-up cards and a face-down third, if any. */
function nearColumn(board: BoardView): { column: number; value: number } | null {
  for (let column = 0; column < 4; column++) {
    const cells = [0, 1, 2].map((row) => board.cards[row * 4 + column]);
    if (cells.some((c) => c === null)) continue;
    const up = cells.flatMap((c) => (c?.faceUp ? [c.value] : []));
    if (up.length === 2 && up[0] === up[1] && up[0] !== undefined) return { column, value: up[0] };
  }
  return null;
}

/** The guidance for the current moment of a practice game, from the view of seat `room.you`. */
export function coachTip(room: RoomView): Tip | null {
  const g = room.game;
  if (!g) return null;
  const me = room.you;
  const board = g.boards[me];
  if (!board) return null;
  const other = (seat: number) => room.seats[seat]?.name ?? "The bot";

  if (g.phase === "initialFlip") {
    if (board.initialFlips === 0)
      return {
        title: "Peek at two cards",
        text: "Everyone starts with twelve face-down cards. Tap any two of yours to turn them over. Your goal for the whole game is the lowest score.",
      };
    if (board.initialFlips === 1)
      return {
        title: "One more",
        text: "Low is good: a pearl is worth −2, the grumpy anglerfish costs 12. Tap another card.",
      };
    return {
      title: "Who starts?",
      text: "The others turn over two cards too. Whoever shows the highest total goes first.",
    };
  }

  if (g.phase === "roundOver")
    return {
      title: "The round is over",
      text: `All cards were turned over and counted. Scores add up round after round until someone reaches ${g.settings.targetScore}; then the lowest total wins.`,
    };
  if (g.phase === "gameOver")
    return {
      title: "That's the whole game",
      text: "You know everything you need. Create a table from the start page and share the link with friends.",
    };

  const near = nearColumn(board);
  const column = near
    ? ` Your column ${near.column + 1} shows two ${formatValue(near.value)}s: a third ${formatValue(near.value)} there clears the whole column.`
    : "";

  if (g.current !== me) {
    if (g.endedBy === me)
      return {
        title: "Everyone else gets one last turn",
        text: "You turned over all your cards. If you don't end up with the lowest score on your own, yours counts double.",
      };
    return {
      title: `${other(g.current)}'s turn`,
      text: `Watch the piles: everyone can see what a player draws and where it goes.${column}`,
    };
  }

  const last = g.endedBy !== null ? "Last turn! " : "";
  const up = faceUpValues(board);
  const worst = up.reduce<{ index: number; value: number } | null>((w, c) => (!w || c.value > w.value ? c : w), null);

  switch (g.stage) {
    case "choose": {
      const top = g.discardTop;
      if (top !== null && (top <= 3 || (near && near.value === top)))
        return {
          title: `${last}Take the ${formatValue(top)}`,
          text: `The discard pile shows a ${formatValue(top)}. That's a useful card, so tap it to pick it up.${column}`,
        };
      return {
        title: `${last}Draw from the pile`,
        text: `${top !== null ? `A ${formatValue(top)} on the discard pile is too high to want. ` : ""}Tap the draw pile to see a new card.${column}`,
      };
    }
    case "fromDiscard":
      return {
        title: "Swap it in",
        text:
          worst && g.hand !== null && worst.value > g.hand
            ? `Tap the card to replace. Your ${formatValue(worst.value)} is the worst one showing; swapping it saves ${worst.value - g.hand} points. A face-down card is a gamble.`
            : "Tap the card to replace. A face-down card is a gamble: it might be high or low.",
      };
    case "drawn": {
      const v = g.hand ?? 0;
      if (board.faceDown === 0)
        return { title: "Swap it in", text: "All your cards are showing, so this card has to go into your grid." };
      if (v <= 4 || (near && near.value === v))
        return {
          title: `Keep the ${formatValue(v)}`,
          text: `That's a good card. Tap one of your cards to swap it in${worst && worst.value > v ? `, ideally your ${formatValue(worst.value)}` : ""}.`,
        };
      return {
        title: `Pass on the ${formatValue(v)}`,
        text: "That's high. Tap the discard pile to drop it; then you turn over one of your face-down cards instead.",
      };
    }
    case "mustFlip":
      return {
        title: "Turn over a card",
        text: "Tap any face-down card. Once all of yours are showing, the round ends after everyone else's last turn.",
      };
  }
}

/** A short remark about something notable that just happened, if anything did. */
export function coachNote(room: RoomView, events: GameEvent[]): string | null {
  const me = room.you;
  for (const e of events) {
    if (e.type === "columnCleared")
      return e.player === me
        ? "Column cleared! Three equal cards in a column leave the game and count nothing."
        : `${room.seats[e.player]?.name ?? "Someone"} cleared a column of ${formatValue(e.value)}s.`;
    if (e.type === "finalTurns" && e.endedBy !== me)
      return `${room.seats[e.endedBy]?.name ?? "Someone"} turned over every card, so the round is ending. If they don't have the lowest score, theirs counts double.`;
    if (e.type === "reshuffled") return "The draw pile ran out, so the discard pile was shuffled into a new one.";
  }
  return null;
}
