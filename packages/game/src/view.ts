import { visibleSum } from "./engine.ts";
import type { GameState, Phase, RoundResult, Settings, TurnStage } from "./types.ts";

/** A card as another player sees it: its value only when it is face up. */
export type CardView = null | { faceUp: false } | { faceUp: true; value: number };

export interface BoardView {
  cards: CardView[];
  /** Sum of the face-up cards; null when the table plays without running sums. */
  visibleSum: number | null;
  initialFlips: number;
  faceDown: number;
}

/** Everything one seat may see. Never contains face-down or draw-pile values. */
export interface GameView {
  you: number | null;
  settings: Settings;
  round: number;
  turn: number;
  phase: Phase;
  current: number;
  stage: TurnStage;
  hand: number | null;
  discardTop: number | null;
  discardCount: number;
  drawCount: number;
  boards: BoardView[];
  endedBy: number | null;
  rounds: RoundResult[];
  totals: number[];
  winners: number[];
}

export function viewFor(state: GameState, you: number | null): GameView {
  // Snapshots saved before the setting existed have no `showSums`: they showed sums.
  const sums = state.settings.showSums !== false;
  return {
    you,
    settings: { ...state.settings, showSums: sums },
    round: state.round,
    turn: state.turn,
    phase: state.phase,
    current: state.current,
    stage: state.stage,
    hand: state.hand,
    discardTop: state.discardPile.at(-1) ?? null,
    discardCount: state.discardPile.length,
    drawCount: state.drawPile.length,
    boards: state.grids.map((grid, p) => ({
      cards: grid.map((s): CardView => {
        if (s === null) return null;
        return s.faceUp ? { faceUp: true, value: s.value } : { faceUp: false };
      }),
      visibleSum: sums ? visibleSum(grid) : null,
      initialFlips: state.initialFlips[p] ?? 0,
      faceDown: grid.filter((s) => s !== null && !s.faceUp).length,
    })),
    endedBy: state.endedBy,
    rounds: structuredClone(state.rounds),
    totals: [...state.totals],
    winners: [...state.winners],
  };
}
