export const ROWS = 3;
export const COLS = 4;
export const GRID_SIZE = ROWS * COLS;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const DEFAULT_TARGET_SCORE = 100;
export const DEFAULT_SHOW_SUMS = true;

/**
 * What the piles reveal: only their top cards, as at a real table; how many cards each holds;
 * or that and every card in the discard pile.
 */
export type PileInfo = "top" | "counts" | "browse";
export const PILE_INFOS: readonly PileInfo[] = ["top", "counts", "browse"];
export const DEFAULT_PILE_INFO: PileInfo = "counts";

/** A slot in a player's grid; `null` once its column has been cleared. */
export interface Slot {
  value: number;
  faceUp: boolean;
}

export interface Settings {
  targetScore: number;
  /**
   * Whether views include each board's running sum of face-up cards. Hiding it leaves the
   * counting to the players. Totals of finished rounds are always shown.
   */
  showSums: boolean;
  piles: PileInfo;
}

export type Phase = "initialFlip" | "turn" | "roundOver" | "gameOver";

/**
 * - `choose`: pick a pile.
 * - `drawn`: holding a card from the draw pile; swap it or discard it.
 * - `fromDiscard`: holding the top discard; must swap it.
 * - `mustFlip`: discarded the drawn card; must reveal a face-down card.
 */
export type TurnStage = "choose" | "drawn" | "fromDiscard" | "mustFlip";

export interface RoundResult {
  scores: number[];
  /** Seat whose score was doubled, if any. */
  doubled: number | null;
  endedBy: number;
}

import type { RngState } from "./rng.ts";

export interface GameState {
  settings: Settings;
  playerCount: number;
  /** Cards in this game's deck. Missing in games saved before decks scaled: 150. */
  deckSize?: number;
  /** Secret: decides every shuffle. Never part of a view. */
  rng: RngState;
  round: number;
  /** Turns completed in the current round. */
  turn: number;
  /** Times the discard pile became the draw pile this round. Missing in older saves: 0. */
  reshuffles?: number;
  phase: Phase;
  drawPile: number[];
  /** Last element is the top card. */
  discardPile: number[];
  grids: (Slot | null)[][];
  initialFlips: number[];
  current: number;
  stage: TurnStage;
  hand: number | null;
  endedBy: number | null;
  rounds: RoundResult[];
  totals: number[];
  winners: number[];
}

export type Action =
  | { type: "flip"; index: number }
  | { type: "drawDeck" }
  | { type: "takeDiscard" }
  | { type: "swap"; index: number }
  | { type: "discardHand" }
  | { type: "nextRound" };

/** Public events describing what happened, used for animation and log lines. */
export type GameEvent =
  | { type: "flipped"; player: number; index: number; value: number }
  | { type: "drew"; player: number; source: "deck" | "discard"; value: number }
  | { type: "swapped"; player: number; index: number; placed: number; removed: number }
  | { type: "discarded"; player: number; value: number }
  | { type: "columnCleared"; player: number; column: number; value: number }
  /** `count` is the new draw pile's size, or null when the table plays without pile counts. */
  | { type: "reshuffled"; count: number | null }
  | { type: "finalTurns"; endedBy: number }
  | { type: "turnStarted"; player: number }
  | { type: "roundEnded"; result: RoundResult }
  | { type: "roundStarted"; round: number }
  | { type: "gameOver"; winners: number[] };

/** Actor for actions that are not a seat's move, such as starting the next round. */
export const SYSTEM = -1;
