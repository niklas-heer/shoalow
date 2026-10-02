/**
 * Measures how reshuffles behave for each table size and deck size, to choose how big the
 * deck should be. Bots stand in for people. Usage:
 *   bun packages/game/scripts/deck-calibration.ts [rounds per cell] [sizes...]
 * With no sizes it compares the boxed 150-card deck with the sizes `deckSizeFor` picks.
 */
import {
  type Action,
  applyAction,
  type BotLevel,
  chooseAction,
  deckSizeFor,
  type GameState,
  makeRandom,
  newGame,
  viewFor,
} from "../src/index.ts";

const ROUNDS = Number(process.argv[2] ?? 400);
const PER_PLAYER = process.argv.slice(3).map(Number);

interface Cell {
  rounds: number;
  reshuffled: number;
  /** How far through the round (0 to 1) the first reshuffle came. */
  progress: number[];
  turns: number[];
}

/** Plays single rounds and records when the draw pile first ran out. */
function measure(players: number, deckSize: number, seed: number): Cell {
  const cell: Cell = { rounds: 0, reshuffled: 0, progress: [], turns: [] };
  const random = makeRandom(seed);
  for (let r = 0; r < ROUNDS; r++) {
    const levels: BotLevel[] = Array.from({ length: players }, (_, p) => ((r + p) % 3 === 0 ? "easy" : "normal"));
    let state: GameState = newGame(seed * 1000 + r, players, {}, deckSize);
    let first: number | null = null;
    while (state.phase === "initialFlip" || state.phase === "turn") {
      const actor = state.phase === "initialFlip" ? state.initialFlips.findIndex((n) => n < 2) : state.current;
      const action = chooseAction(viewFor(state, actor), levels[actor] ?? "normal", random) as Action;
      const result = applyAction(state, actor, action);
      if (!result.ok) throw new Error(result.error);
      if (first === null && result.events.some((e) => e.type === "reshuffled")) first = state.turn;
      state = result.state;
    }
    cell.rounds += 1;
    cell.turns.push(state.rounds.at(-1) ? state.turn : 0);
    if (first !== null) {
      cell.reshuffled += 1;
      cell.progress.push(first / Math.max(1, state.turn));
    }
  }
  return cell;
}

const median = (xs: number[]) => {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
};
const pct = (x: number) => `${(x * 100).toFixed(0).padStart(3)}%`;

const columns: { label: string; size: (players: number) => number }[] = PER_PLAYER.length
  ? PER_PLAYER.map((c) => ({ label: `${c}/player`, size: (n: number) => Math.round(c * n) }))
  : [
      { label: "boxed 150", size: () => 150 },
      { label: "scaled", size: deckSizeFor },
    ];

console.log(
  `${ROUNDS} bot rounds per cell; "reshuffle" = rounds that ran the draw pile out, "at" = median point in the round`,
);
for (const { label, size } of columns) {
  console.log(`\n${label}`);
  console.log("players  deck  draw pile  turns/round  reshuffle  at");
  for (let n = 2; n <= 10; n++) {
    const deck = size(n);
    const cell = measure(n, deck, 7 + n);
    const draw = deck - 12 * n - 1;
    console.log(
      `${String(n).padStart(7)}  ${String(deck).padStart(4)}  ${String(draw).padStart(9)}  ${String(median(cell.turns)).padStart(11)}  ${pct(cell.reshuffled / cell.rounds).padStart(9)}  ${Number.isNaN(median(cell.progress)) ? "  -" : pct(median(cell.progress))}`,
    );
  }
}
