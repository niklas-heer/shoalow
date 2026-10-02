import { expect, test } from "bun:test";
import {
  type Action,
  applyAction,
  type BotLevel,
  chooseAction,
  deckOf,
  type GameState,
  makeRandom,
  newGame,
  SYSTEM,
  viewFor,
} from "../src/index.ts";

const GAMES = Number(process.env.SIM_GAMES ?? 60);
const BASE_SEED = Number(process.env.SIM_SEED ?? 20260929);
/** First game index; together with the base seed this replays one failing game. */
const FROM = Number(process.env.SIM_FROM ?? 0);
const MAX_ACTIONS = 50_000;

function countValues(cards: number[]): number[] {
  const counts = Array.from({ length: 15 }, () => 0);
  for (const v of cards) counts[v + 2] = (counts[v + 2] ?? 0) + 1;
  return counts;
}

function checkInvariants(s: GameState, where: string, viewer: number): void {
  const sums = s.settings.showSums;
  const cards = [...s.drawPile, ...s.discardPile];
  if (s.hand !== null) cards.push(s.hand);
  for (const g of s.grids) for (const c of g) if (c) cards.push(c.value);
  const deck = deckOf(s.deckSize ?? 150);
  if (cards.length !== deck.length) throw new Error(`${where}: ${cards.length} cards in play`);
  if (JSON.stringify(countValues(cards)) !== JSON.stringify(countValues(deck)))
    throw new Error(`${where}: card values changed`);

  // Views are checked for one rotating seat per step; every seat is covered within a few steps.
  {
    const v = viewFor(s, viewer);
    v.boards.forEach((b, q) => {
      if ((b.visibleSum === null) === sums) throw new Error(`${where}: running sum shown against the setting`);
      b.cards.forEach((c, i) => {
        const real = s.grids[q]?.[i] ?? null;
        if ((c === null) !== (real === null)) throw new Error(`${where}: cleared slot mismatch`);
        if (c && !c.faceUp && "value" in c) throw new Error(`${where}: hidden value leaked`);
        if (c?.faceUp && real && c.value !== real.value) throw new Error(`${where}: wrong face-up value`);
      });
    });
  }

  const summed = s.totals.map((_, p) => s.rounds.reduce((acc, r) => acc + (r.scores[p] ?? 0), 0));
  if (JSON.stringify(summed) !== JSON.stringify(s.totals)) throw new Error(`${where}: totals do not add up`);
}

interface Played {
  final: GameState;
  log: [actor: number, action: Action][];
}

/** Plays one full game with bots only, checking invariants after every action. */
function playGame(seed: number, levels: BotLevel[], check = true, showSums = true): Played {
  let state = newGame(seed, levels.length, { targetScore: 100, showSums });
  const random = makeRandom(seed ^ 0x5eed);
  const log: [number, Action][] = [];
  for (let step = 0; step < MAX_ACTIONS; step++) {
    if (state.phase === "gameOver") return { final: state, log };
    let actor: number;
    let action: Action | null;
    if (state.phase === "roundOver") {
      actor = SYSTEM;
      action = { type: "nextRound" };
    } else {
      actor = state.phase === "initialFlip" ? state.initialFlips.findIndex((n) => n < 2) : state.current;
      action = chooseAction(viewFor(state, actor), levels[actor] ?? "normal", random);
    }
    if (!action) throw new Error(`seed ${seed}: bot ${actor} had no move at step ${step}`);
    const r = applyAction(state, actor, action);
    if (!r.ok) throw new Error(`seed ${seed}: bot ${actor} chose illegal ${JSON.stringify(action)}: ${r.error}`);
    state = r.state;
    log.push([actor, action]);
    if (check) checkInvariants(state, `seed ${seed} step ${step}`, step % state.playerCount);
  }
  throw new Error(`seed ${seed}: game did not finish within ${MAX_ACTIONS} actions`);
}

function replay(seed: number, playerCount: number, log: Played["log"], showSums: boolean): GameState {
  let state = newGame(seed, playerCount, { targetScore: 100, showSums });
  for (const [actor, action] of log) {
    const r = applyAction(state, actor, action);
    if (!r.ok) throw new Error(`replay rejected ${JSON.stringify(action)}: ${r.error}`);
    state = r.state;
  }
  return state;
}

test(`${GAMES} seeded bot games keep every invariant and replay exactly`, () => {
  const started = performance.now();
  let rounds = 0;
  let actions = 0;
  for (let g = FROM; g < FROM + GAMES; g++) {
    const seed = (BASE_SEED + g * 7919) | 0;
    const players = 2 + (g % 9);
    const levels: BotLevel[] = Array.from({ length: players }, (_, p) => ((g + p) % 3 === 0 ? "easy" : "normal"));
    const showSums = g % 4 !== 3;
    let played: Played;
    try {
      played = playGame(seed, levels, true, showSums);
    } catch (e) {
      throw new Error(
        `${(e as Error).message}\nreproduce: SIM_SEED=${BASE_SEED} SIM_FROM=${g} SIM_GAMES=1 mise run sim`,
      );
    }
    const { final, log } = played;
    expect(final.phase).toBe("gameOver");
    expect(final.totals.some((t) => t >= 100)).toBe(true);
    expect(final.winners.length).toBeGreaterThan(0);
    expect(replay(seed, players, log, showSums)).toEqual(final);
    rounds += final.rounds.length;
    actions += log.length;
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`simulated ${GAMES} games, ${rounds} rounds, ${actions} actions in ${seconds}s (base seed ${BASE_SEED})`);
}, 600_000);

test("bots play exactly the same game whether or not sums are shown", () => {
  for (let g = 0; g < 20; g++) {
    const levels: BotLevel[] = Array.from({ length: 2 + (g % 5) }, (_, p) => (p % 2 ? "easy" : "normal"));
    const shown = playGame(4000 + g, levels, false, true);
    const hidden = playGame(4000 + g, levels, false, false);
    expect(hidden.log).toEqual(shown.log);
    expect(hidden.final.totals).toEqual(shown.final.totals);
  }
});

test("normal bots clearly beat easy bots head to head", () => {
  let normalWins = 0;
  const games = 150;
  for (let g = 0; g < games; g++) {
    const normalSeat = g % 2;
    const levels: BotLevel[] = normalSeat === 0 ? ["normal", "easy"] : ["easy", "normal"];
    const { final } = playGame(1000 + g, levels, false);
    if (final.winners.length === 1 && final.winners[0] === normalSeat) normalWins++;
  }
  console.log(`normal won ${normalWins} of ${games} games against easy`);
  expect(normalWins / games).toBeGreaterThan(0.75);
}, 60_000);
