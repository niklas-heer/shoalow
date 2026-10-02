import { seedFromNumber, shuffleDeck } from "./rng.ts";
import {
  type Action,
  COLS,
  DEFAULT_PILE_INFO,
  DEFAULT_SHOW_SUMS,
  DEFAULT_TARGET_SCORE,
  type GameEvent,
  type GameState,
  GRID_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROWS,
  type RoundResult,
  type Settings,
  type Slot,
  SYSTEM,
} from "./types.ts";

/** Copies of each value per 30 cards. The boxed 150-card deck is five of these. */
const MIX: readonly (readonly [value: number, per30: number])[] = [
  [-2, 1],
  [-1, 2],
  [0, 3],
  ...Array.from({ length: 12 }, (_, i) => [i + 1, 2] as const),
];
const MIX_MEAN = MIX.reduce((sum, [v, w]) => sum + v * w, 0) / 30;

/**
 * How many of each value a deck of `size` cards holds: the boxed mix, scaled. Multiples of
 * 30 match it exactly. Otherwise every value gets its exact share rounded down, and the few
 * cards left over go to the values that lost the most in rounding, keeping the deck's average
 * as close to the boxed one as possible.
 */
export function deckCounts(size: number): Map<number, number> {
  if (!Number.isInteger(size) || size < 30) throw new Error("a deck has at least 30 cards");
  const counts = new Map<number, number>();
  const remainders = MIX.map(([value, w]) => {
    const exact = (size * w) / 30;
    counts.set(value, Math.floor(exact));
    return { value, remainder: exact - Math.floor(exact) };
  });
  let total = [...counts.values()].reduce((a, b) => a + b, 0);
  let sum = [...counts].reduce((acc, [v, c]) => acc + v * c, 0);
  while (total < size) {
    const most = Math.max(...remainders.map((r) => r.remainder));
    const tied = remainders.filter((r) => r.remainder > most - 1e-9);
    const best = tied.reduce((a, b) =>
      Math.abs((sum + a.value) / (total + 1) - MIX_MEAN) <= Math.abs((sum + b.value) / (total + 1) - MIX_MEAN) ? a : b,
    );
    counts.set(best.value, (counts.get(best.value) ?? 0) + 1);
    best.remainder = -1;
    total += 1;
    sum += best.value;
  }
  return counts;
}

/** A deck of `size` cards in value order. */
export function deckOf(size: number): number[] {
  return [...deckCounts(size)].flatMap(([value, count]) => Array.from({ length: count }, () => value));
}

/** The boxed deck: 5 × −2, 10 × −1, 15 × 0, and 10 each of 1 to 12. */
export const DECK_SIZE = 150;

export function fullDeck(): number[] {
  return deckOf(DECK_SIZE);
}

/**
 * Cards per player. The boxed 150 cards never run out with 2 to 5 players and run out early
 * in every round with 9 or 10. At 24 per player, about half of all rounds reshuffle, in their
 * last 10 to 15 percent, at every table size (`packages/game/scripts/deck-calibration.ts`).
 */
export const CARDS_PER_PLAYER = 24;

/** The deck a table of `players` plays with: 48 cards for two, up to 240 for ten. */
export function deckSizeFor(players: number): number {
  return CARDS_PER_PLAYER * players;
}

export type Result = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string };

export function columnOf(index: number): number {
  return index % COLS;
}

export function columnIndices(column: number): number[] {
  return Array.from({ length: ROWS }, (_, row) => row * COLS + column);
}

export function hasFaceDown(grid: readonly (Slot | null)[]): boolean {
  return grid.some((s) => s !== null && !s.faceUp);
}

export function visibleSum(grid: readonly (Slot | null)[]): number {
  let sum = 0;
  for (const s of grid) if (s?.faceUp) sum += s.value;
  return sum;
}

/**
 * Deals a new game. `seed` is a 256-bit deck key as eight 32-bit words (use `secureSeed()`),
 * or a number that is stretched into one, for tests and replays.
 */
export function newGame(
  seed: number | readonly number[],
  playerCount: number,
  settings?: Partial<Settings>,
  deckSize = deckSizeFor(playerCount),
): GameState {
  const key = typeof seed === "number" ? seedFromNumber(seed) : [...seed];
  if (key.length !== 8 || !key.every((w) => Number.isInteger(w) && w >= 0 && w < 2 ** 32))
    throw new Error("a deck key is eight 32-bit words");
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`player count must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`);
  }
  const state: GameState = {
    settings: {
      targetScore: settings?.targetScore ?? DEFAULT_TARGET_SCORE,
      showSums: settings?.showSums ?? DEFAULT_SHOW_SUMS,
      piles: settings?.piles ?? DEFAULT_PILE_INFO,
    },
    playerCount,
    deckSize,
    rng: { key, block: 0 },
    round: 0,
    turn: 0,
    phase: "initialFlip",
    drawPile: [],
    discardPile: [],
    grids: [],
    initialFlips: [],
    current: 0,
    stage: "choose",
    hand: null,
    endedBy: null,
    rounds: [],
    totals: Array.from({ length: playerCount }, () => 0),
    winners: [],
  };
  deal(state);
  return state;
}

function deal(state: GameState): void {
  const [deck, rng] = shuffleDeck(deckOf(state.deckSize ?? DECK_SIZE), state.rng);
  state.rng = rng;
  state.round += 1;
  state.turn = 0;
  state.reshuffles = 0;
  state.grids = [];
  for (let p = 0; p < state.playerCount; p++) {
    state.grids.push(deck.splice(0, GRID_SIZE).map((value) => ({ value, faceUp: false })));
  }
  state.discardPile = deck.splice(0, 1);
  state.drawPile = deck;
  state.initialFlips = Array.from({ length: state.playerCount }, () => 0);
  state.phase = "initialFlip";
  state.stage = "choose";
  state.hand = null;
  state.endedBy = null;
}

const fail = (error: string): Result => ({ ok: false, error });

/** Applies one action for `actor` (a seat index, or SYSTEM). Never mutates `input`. */
export function applyAction(input: GameState, actor: number, action: Action): Result {
  const state = structuredClone(input);
  const events: GameEvent[] = [];

  if (action.type === "nextRound") {
    if (actor !== SYSTEM) return fail("only the table can start the next round");
    if (state.phase !== "roundOver") return fail("the round is not over");
    deal(state);
    events.push({ type: "roundStarted", round: state.round });
    return { ok: true, state, events };
  }

  if (!Number.isInteger(actor) || actor < 0 || actor >= state.playerCount) return fail("unknown seat");
  const grid = state.grids[actor] as (Slot | null)[];

  if (state.phase === "initialFlip") {
    if (action.type !== "flip") return fail("reveal two cards first");
    if ((state.initialFlips[actor] ?? 0) >= 2) return fail("you already revealed two cards");
    const slot = faceDownSlot(grid, action.index);
    if (!slot) return fail("pick one of your face-down cards");
    slot.faceUp = true;
    state.initialFlips[actor] = (state.initialFlips[actor] ?? 0) + 1;
    events.push({ type: "flipped", player: actor, index: action.index, value: slot.value });
    if (state.initialFlips.every((n) => n >= 2)) {
      state.phase = "turn";
      state.current = startingPlayer(state);
      state.stage = "choose";
      events.push({ type: "turnStarted", player: state.current });
    }
    return { ok: true, state, events };
  }

  if (state.phase !== "turn") return fail("the round is not in progress");
  if (actor !== state.current) return fail("it is not your turn");

  switch (state.stage) {
    case "choose": {
      if (action.type === "drawDeck") {
        if (state.drawPile.length === 0) reshuffle(state, events);
        const value = state.drawPile.pop();
        if (value === undefined) return fail("no cards left to draw");
        state.hand = value;
        state.stage = "drawn";
        events.push({ type: "drew", player: actor, source: "deck", value });
        return { ok: true, state, events };
      }
      if (action.type === "takeDiscard") {
        const value = state.discardPile.pop();
        if (value === undefined) return fail("the discard pile is empty");
        state.hand = value;
        state.stage = "fromDiscard";
        events.push({ type: "drew", player: actor, source: "discard", value });
        return { ok: true, state, events };
      }
      return fail("draw a card or take the discard first");
    }
    case "drawn":
    case "fromDiscard": {
      const hand = state.hand;
      if (hand === null) return fail("no card in hand");
      if (action.type === "swap") {
        const slot = liveSlot(grid, action.index);
        if (!slot) return fail("pick one of your cards");
        const removed = slot.value;
        slot.value = hand;
        slot.faceUp = true;
        state.hand = null;
        state.discardPile.push(removed);
        events.push({ type: "swapped", player: actor, index: action.index, placed: hand, removed });
        clearColumns(state, actor, events);
        endTurn(state, events);
        return { ok: true, state, events };
      }
      if (action.type === "discardHand") {
        if (state.stage === "fromDiscard") return fail("a card taken from the discard pile must be swapped in");
        if (!hasFaceDown(grid)) return fail("you have no face-down card to reveal, so swap the card in");
        state.discardPile.push(hand);
        state.hand = null;
        state.stage = "mustFlip";
        events.push({ type: "discarded", player: actor, value: hand });
        return { ok: true, state, events };
      }
      return fail("swap the card into your grid or discard it");
    }
    case "mustFlip": {
      if (action.type !== "flip") return fail("reveal one of your face-down cards");
      const slot = faceDownSlot(grid, action.index);
      if (!slot) return fail("pick one of your face-down cards");
      slot.faceUp = true;
      events.push({ type: "flipped", player: actor, index: action.index, value: slot.value });
      clearColumns(state, actor, events);
      endTurn(state, events);
      return { ok: true, state, events };
    }
  }
}

function liveSlot(grid: (Slot | null)[], index: number): Slot | null {
  if (!Number.isInteger(index) || index < 0 || index >= GRID_SIZE) return null;
  return grid[index] ?? null;
}

function faceDownSlot(grid: (Slot | null)[], index: number): Slot | null {
  const slot = liveSlot(grid, index);
  return slot && !slot.faceUp ? slot : null;
}

function startingPlayer(state: GameState): number {
  const previous = state.rounds.at(-1);
  if (previous) return previous.endedBy;
  let best = 0;
  let bestSum = Number.NEGATIVE_INFINITY;
  state.grids.forEach((grid, p) => {
    const sum = visibleSum(grid);
    if (sum > bestSum) {
      best = p;
      bestSum = sum;
    }
  });
  return best;
}

function reshuffle(state: GameState, events: GameEvent[]): void {
  const top = state.discardPile.pop();
  const [pile, rng] = shuffleDeck(state.discardPile, state.rng);
  state.rng = rng;
  state.drawPile = pile;
  state.discardPile = top === undefined ? [] : [top];
  state.reshuffles = (state.reshuffles ?? 0) + 1;
  events.push({ type: "reshuffled", count: pile.length });
}

function clearColumns(state: GameState, player: number, events: GameEvent[]): void {
  const grid = state.grids[player] as (Slot | null)[];
  for (let column = 0; column < COLS; column++) {
    const indices = columnIndices(column);
    const slots = indices.map((i) => grid[i] ?? null);
    const first = slots[0];
    if (!first) continue;
    if (!slots.every((s) => s?.faceUp && s.value === first.value)) continue;
    for (const i of indices) grid[i] = null;
    for (let k = 0; k < ROWS; k++) state.discardPile.push(first.value);
    events.push({ type: "columnCleared", player, column, value: first.value });
  }
}

function endTurn(state: GameState, events: GameEvent[]): void {
  const player = state.current;
  state.turn += 1;
  if (state.endedBy === null && !hasFaceDown(state.grids[player] as (Slot | null)[])) {
    state.endedBy = player;
    events.push({ type: "finalTurns", endedBy: player });
  }
  const next = (player + 1) % state.playerCount;
  if (state.endedBy !== null && next === state.endedBy) {
    endRound(state, events);
    return;
  }
  state.current = next;
  state.stage = "choose";
  events.push({ type: "turnStarted", player: next });
}

function endRound(state: GameState, events: GameEvent[]): void {
  const endedBy = state.endedBy as number;
  state.grids.forEach((grid, player) => {
    grid.forEach((slot, index) => {
      if (slot && !slot.faceUp) {
        slot.faceUp = true;
        events.push({ type: "flipped", player, index, value: slot.value });
      }
    });
    clearColumns(state, player, events);
  });
  const scores = state.grids.map(visibleSum);
  let doubled: number | null = null;
  const enderScore = scores[endedBy] as number;
  const strictlyLowest = scores.every((s, p) => p === endedBy || s > enderScore);
  if (!strictlyLowest && enderScore > 0) {
    scores[endedBy] = enderScore * 2;
    doubled = endedBy;
  }
  const result: RoundResult = { scores, doubled, endedBy };
  state.rounds.push(result);
  state.totals = state.totals.map((t, p) => t + (scores[p] as number));
  state.stage = "choose";
  state.hand = null;
  events.push({ type: "roundEnded", result });

  if (state.totals.some((t) => t >= state.settings.targetScore)) {
    const low = Math.min(...state.totals);
    state.winners = state.totals.flatMap((t, p) => (t === low ? [p] : []));
    state.phase = "gameOver";
    events.push({ type: "gameOver", winners: state.winners });
  } else {
    state.phase = "roundOver";
  }
}

/** Every card in the game, for invariant checks: grids, piles and hand. */
export function allCards(state: GameState): number[] {
  const cards = [...state.drawPile, ...state.discardPile];
  if (state.hand !== null) cards.push(state.hand);
  for (const grid of state.grids) for (const s of grid) if (s) cards.push(s.value);
  return cards;
}
