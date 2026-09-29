import { type Action, applyAction, type GameEvent, type GameState, newGame, type Slot } from "../src/index.ts";

/** Grid shorthand: a number is face down, "u5" style strings are face up, null is cleared. */
export type Cell = number | `u${number}` | null;

export function grid(cells: Cell[]): (Slot | null)[] {
  if (cells.length !== 12) throw new Error("a grid needs 12 cells");
  return cells.map((c) => {
    if (c === null) return null;
    if (typeof c === "number") return { value: c, faceUp: false };
    return { value: Number(c.slice(1)), faceUp: true };
  });
}

/** A game already in the turn phase with the given grids and piles. */
export function playing(
  grids: Cell[][],
  opts: { current?: number; discard?: number[]; draw?: number[]; target?: number } = {},
): GameState {
  const s = newGame(1, grids.length, { targetScore: opts.target ?? 100 });
  s.grids = grids.map(grid);
  s.phase = "turn";
  s.stage = "choose";
  s.current = opts.current ?? 0;
  s.initialFlips = grids.map(() => 2);
  s.discardPile = opts.discard ?? [5];
  s.drawPile = opts.draw ?? [1, 2, 3, 4];
  return s;
}

export function act(state: GameState, actor: number, action: Action): { state: GameState; events: GameEvent[] } {
  const r = applyAction(state, actor, action);
  if (!r.ok) throw new Error(`unexpected rejection: ${r.error}`);
  return r;
}

export function rejects(state: GameState, actor: number, action: Action): string {
  const r = applyAction(state, actor, action);
  if (r.ok) throw new Error(`expected ${JSON.stringify(action)} to be rejected`);
  return r.error;
}

/** Twelve face-down cards of one value. */
export const hidden = (v: number): Cell[] => Array.from({ length: 12 }, () => v);
