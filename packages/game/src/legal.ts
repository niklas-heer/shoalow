import type { Action } from "./types.ts";
import type { GameView } from "./view.ts";

/** All legal actions for the viewing seat, derived from its view alone. */
export function legalActions(view: GameView): Action[] {
  const you = view.you;
  if (you === null) return [];
  const board = view.boards[you];
  if (!board) return [];
  const faceDown: number[] = [];
  const live: number[] = [];
  board.cards.forEach((c, i) => {
    if (c === null) return;
    live.push(i);
    if (!c.faceUp) faceDown.push(i);
  });

  if (view.phase === "initialFlip") {
    return board.initialFlips < 2 ? faceDown.map((index) => ({ type: "flip", index })) : [];
  }
  if (view.phase !== "turn" || view.current !== you) return [];
  switch (view.stage) {
    case "choose": {
      const actions: Action[] = [{ type: "drawDeck" }];
      if (view.discardCount > 0) actions.push({ type: "takeDiscard" });
      return actions;
    }
    case "drawn": {
      const actions: Action[] = live.map((index) => ({ type: "swap", index }));
      if (faceDown.length > 0) actions.push({ type: "discardHand" });
      return actions;
    }
    case "fromDiscard":
      return live.map((index) => ({ type: "swap", index }));
    case "mustFlip":
      return faceDown.map((index) => ({ type: "flip", index }));
  }
}
