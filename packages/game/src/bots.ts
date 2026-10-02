import { columnIndices, fullDeck } from "./engine.ts";
import { legalActions } from "./legal.ts";
import { type Action, COLS } from "./types.ts";
import type { CardView, GameView } from "./view.ts";

export type BotLevel = "easy" | "normal";

/** Average card value of the full deck, used as the estimate for any unknown card. */
const DECK = fullDeck();
const UNKNOWN = DECK.reduce((a, b) => a + b, 0) / DECK.length;

const DECK_WEIGHTS: [value: number, weight: number][] = (() => {
  const counts = new Map<number, number>();
  for (const v of DECK) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([v, c]) => [v, c / DECK.length]);
})();

/**
 * Picks the next action for the viewing seat. Bots see exactly what a human in
 * that seat would see. `random` returns numbers in [0, 1).
 */
export function chooseAction(view: GameView, level: BotLevel, random: () => number): Action | null {
  const legal = legalActions(view);
  if (legal.length === 0) return null;
  return level === "easy" ? easy(view, legal, random) : normal(view, legal, random);
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

function myCards(view: GameView): CardView[] {
  return view.boards[view.you ?? 0]?.cards ?? [];
}

function indicesWhere(cards: CardView[], test: (c: Exclude<CardView, null>) => boolean): number[] {
  return cards.flatMap((c, i) => (c !== null && test(c) ? [i] : []));
}

function highestFaceUp(cards: CardView[]): { index: number; value: number } | null {
  let best: { index: number; value: number } | null = null;
  cards.forEach((c, index) => {
    if (c?.faceUp && (best === null || c.value > best.value)) best = { index, value: c.value };
  });
  return best;
}

// ---------------------------------------------------------------- easy

function easy(view: GameView, legal: Action[], random: () => number): Action {
  if (random() < 0.15) return pick(legal, random);
  const cards = myCards(view);
  const faceDown = indicesWhere(cards, (c) => !c.faceUp);
  const high = highestFaceUp(cards);
  const placeLow = (v: number): Action => {
    if (high && high.value > v) return { type: "swap", index: high.index };
    if (faceDown.length > 0) return { type: "swap", index: pick(faceDown, random) };
    return {
      type: "swap",
      index:
        high?.index ??
        pick(
          indicesWhere(cards, () => true),
          random,
        ),
    };
  };

  if (view.phase === "initialFlip" || view.stage === "mustFlip") {
    return { type: "flip", index: pick(faceDown, random) };
  }
  switch (view.stage) {
    case "choose":
      return view.discardTop !== null && view.discardTop <= 2 && random() < 0.8
        ? { type: "takeDiscard" }
        : { type: "drawDeck" };
    case "drawn": {
      const v = view.hand ?? 0;
      if (v <= 4 || faceDown.length === 0) return placeLow(v);
      return { type: "discardHand" };
    }
    case "fromDiscard":
      return placeLow(view.hand ?? 0);
  }
  return pick(legal, random);
}

// ---------------------------------------------------------------- normal

type Hypo = (null | { faceUp: boolean; value: number })[];

function toHypo(cards: CardView[]): Hypo {
  return cards.map((c) =>
    c === null ? null : c.faceUp ? { faceUp: true, value: c.value } : { faceUp: false, value: 0 },
  );
}

function clearColumns(grid: Hypo): void {
  for (let column = 0; column < COLS; column++) {
    const idx = columnIndices(column);
    const slots = idx.map((i) => grid[i] ?? null);
    const first = slots[0];
    if (first && slots.every((s) => s?.faceUp && s.value === first.value)) for (const i of idx) grid[i] = null;
  }
}

/** Estimated final score of a grid: lower is better. */
function estimate(grid: Hypo): number {
  let score = 0;
  for (const s of grid) if (s) score += s.faceUp ? s.value : UNKNOWN;
  // Two equal positive face-up cards in a column may still become a cleared column.
  for (let column = 0; column < COLS; column++) {
    const slots = columnIndices(column).map((i) => grid[i] ?? null);
    const up = slots.filter((s) => s?.faceUp).map((s) => s?.value ?? 0);
    if (up.length === 2 && up[0] === up[1] && (up[0] ?? 0) > 0 && slots.every((s) => s !== null)) {
      score -= (up[0] ?? 0) * 0.4;
    }
  }
  return score;
}

const STALL_TURNS_PER_PLAYER = 20;
/** How much an opponent is expected to improve during their last turn. */
const OPPONENT_LAST_TURN_GAIN = 6;
/** Margin by which we want to be lowest before ending the round ourselves. */
const END_MARGIN = 3;

/** Best (lowest) estimated score among the other seats, allowing them one more turn. */
function opponentsBest(view: GameView): number {
  let best = Number.POSITIVE_INFINITY;
  view.boards.forEach((b, p) => {
    if (p === view.you) return;
    // Bots count face-up cards themselves, so they play the same whether or not the table shows sums.
    const shown = b.cards.reduce((sum, c) => sum + (c?.faceUp ? c.value : 0), 0);
    best = Math.min(best, shown + b.faceDown * UNKNOWN - OPPONENT_LAST_TURN_GAIN);
  });
  return best;
}

/** Score of a hypothetical grid after our move, including the risk of ending the round. */
function judge(view: GameView, grid: Hypo): number {
  const faceDown = grid.filter((s) => s !== null && !s.faceUp).length;
  const base = estimate(grid);
  if (faceDown > 0 || view.endedBy !== null) return base;
  // A long round means everyone is stalling; stop avoiding the end so the game always finishes.
  if (view.turn > view.boards.length * STALL_TURNS_PER_PLAYER) return base;
  // This move ends the round: doubling applies unless we are strictly lowest.
  const mine = base;
  const theirs = opponentsBest(view);
  if (mine < theirs - END_MARGIN) return mine - 2;
  return mine > 0 ? mine * 2 : mine;
}

function afterSwap(cards: CardView[], index: number, value: number): Hypo {
  const grid = toHypo(cards);
  grid[index] = { faceUp: true, value };
  clearColumns(grid);
  return grid;
}

function bestSwap(view: GameView, cards: CardView[], value: number): { index: number; score: number } {
  let best = { index: -1, score: Number.POSITIVE_INFINITY };
  cards.forEach((c, index) => {
    if (c === null) return;
    const score = judge(view, afterSwap(cards, index, value));
    if (score < best.score) best = { index, score };
  });
  return best;
}

/** Estimated score of discarding the drawn card and revealing one face-down card. */
function flipPlan(view: GameView, cards: CardView[]): number {
  const faceDown = indicesWhere(cards, (c) => !c.faceUp);
  if (faceDown.length === 0) return Number.POSITIVE_INFINITY;
  const grid = toHypo(cards);
  if (faceDown.length === 1) {
    // Revealing the last card ends the round with an unknown value.
    const i = faceDown[0] as number;
    grid[i] = { faceUp: true, value: UNKNOWN };
  }
  // Information is worth a little.
  return judge(view, grid) - 0.3;
}

function normal(view: GameView, legal: Action[], random: () => number): Action {
  const cards = myCards(view);
  const faceDown = indicesWhere(cards, (c) => !c.faceUp);

  if (view.phase === "initialFlip") return { type: "flip", index: pick(faceDown, random) };

  switch (view.stage) {
    case "choose": {
      const top = view.discardTop;
      if (top === null) return { type: "drawDeck" };
      const takeScore = bestSwap(view, cards, top).score;
      let drawScore = 0;
      for (const [v, w] of DECK_WEIGHTS) {
        drawScore += w * Math.min(bestSwap(view, cards, v).score, flipPlan(view, cards));
      }
      return takeScore <= drawScore - 0.5 ? { type: "takeDiscard" } : { type: "drawDeck" };
    }
    case "drawn": {
      const swap = bestSwap(view, cards, view.hand ?? 0);
      if (faceDown.length > 0 && flipPlan(view, cards) < swap.score) return { type: "discardHand" };
      return { type: "swap", index: swap.index };
    }
    case "fromDiscard":
      return { type: "swap", index: bestSwap(view, cards, view.hand ?? 0).index };
    case "mustFlip":
      return { type: "flip", index: preferredFlip(cards, faceDown, random) };
  }
  return pick(legal, random);
}

/** Prefer revealing a card in a column that already holds two equal face-up cards. */
function preferredFlip(cards: CardView[], faceDown: number[], random: () => number): number {
  for (const i of faceDown) {
    const column = columnIndices(i % COLS)
      .filter((j) => j !== i)
      .map((j) => cards[j]);
    const [a, b] = column;
    if (a?.faceUp && b?.faceUp && a.value === b.value) return i;
  }
  return pick(faceDown, random);
}
