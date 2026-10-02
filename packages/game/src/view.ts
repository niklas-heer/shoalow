import { DECK_SIZE, visibleSum } from "./engine.ts";
import {
  DEFAULT_PILE_INFO,
  type GameEvent,
  type GameState,
  type Phase,
  type RoundResult,
  type Settings,
  type TurnStage,
} from "./types.ts";

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
  /** How many cards each pile holds; null when the table plays with top cards only. */
  discardCount: number | null;
  drawCount: number | null;
  /** Every card in the discard pile, bottom first, when the table lets players look through it. */
  discards: number[] | null;
  /** Cards in this game's deck. */
  deckSize: number;
  /** Times the discard pile became the draw pile this round. */
  reshuffles: number;
  boards: BoardView[];
  endedBy: number | null;
  rounds: RoundResult[];
  totals: number[];
  winners: number[];
}

export function viewFor(state: GameState, you: number | null): GameView {
  // Snapshots saved before these settings existed showed sums and pile counts.
  const sums = state.settings.showSums !== false;
  const piles = state.settings.piles ?? DEFAULT_PILE_INFO;
  return {
    you,
    settings: { ...state.settings, showSums: sums, piles },
    round: state.round,
    turn: state.turn,
    phase: state.phase,
    current: state.current,
    stage: state.stage,
    hand: state.hand,
    discardTop: state.discardPile.at(-1) ?? null,
    discardCount: piles === "top" ? null : state.discardPile.length,
    drawCount: piles === "top" ? null : state.drawPile.length,
    discards: piles === "browse" ? [...state.discardPile] : null,
    deckSize: state.deckSize ?? DECK_SIZE,
    reshuffles: state.reshuffles ?? 0,
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

/** Events as players may see them: without pile sizes when the table plays with top cards only. */
export function eventsFor(events: GameEvent[], settings: Settings): GameEvent[] {
  if ((settings.piles ?? DEFAULT_PILE_INFO) !== "top") return events;
  return events.map((e) => (e.type === "reshuffled" ? { ...e, count: null } : e));
}
