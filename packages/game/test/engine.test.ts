import { describe, expect, test } from "bun:test";
import {
  allCards,
  applyAction,
  deckCounts,
  deckOf,
  deckSizeFor,
  eventsFor,
  fullDeck,
  newGame,
  SYSTEM,
  viewFor,
} from "../src/index.ts";
import { act, type Cell, hidden, playing, rejects } from "./helpers.ts";

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

/** Face-up cards 1, 2, 3 in no matching column, with one face-down card at index 11; scores 21. */
const nearlyDone = (lastHidden: number): Cell[] => [
  "u1",
  "u2",
  "u3",
  "u1",
  "u2",
  "u3",
  "u1",
  "u2",
  "u3",
  "u1",
  "u2",
  lastHidden,
];

/** Face-down cards base..base+3 arranged so no column can match; totals 12 × base + 18. */
const varied = (base: number): Cell[] => {
  const [a, b, c, d] = [base, base + 1, base + 2, base + 3];
  return [a, b, c, d, b, c, d, a, c, d, a, b];
};

describe("deck and deal", () => {
  test("the deck has 150 cards with the original distribution", () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(150);
    const count = (v: number) => deck.filter((c) => c === v).length;
    expect(count(-2)).toBe(5);
    expect(count(-1)).toBe(10);
    expect(count(0)).toBe(15);
    for (let v = 1; v <= 12; v++) expect(count(v)).toBe(10);
  });

  test("each player gets 12 face-down cards and one card starts the discard pile", () => {
    const s = newGame(42, 10);
    expect(s.grids).toHaveLength(10);
    for (const g of s.grids) {
      expect(g).toHaveLength(12);
      expect(g.every((c) => c !== null && !c.faceUp)).toBe(true);
    }
    expect(s.discardPile).toHaveLength(1);
    expect(s.drawPile).toHaveLength(240 - 120 - 1);
    expect(sorted(allCards(s))).toEqual(sorted(deckOf(240)));
  });

  test("the deck grows with the table, 24 cards per player", () => {
    expect([2, 3, 6, 10].map(deckSizeFor)).toEqual([48, 72, 144, 240]);
    for (let players = 2; players <= 10; players++) {
      const s = newGame(players, players);
      expect(s.deckSize).toBe(24 * players);
      expect(allCards(s)).toHaveLength(24 * players);
    }
  });

  test("every deck size keeps the boxed mix to within one card per value", () => {
    for (let size = 30; size <= 300; size++) {
      const counts = deckCounts(size);
      expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(size);
      const box = deckCounts(150);
      for (const [value, count] of counts)
        expect(Math.abs(count - ((box.get(value) ?? 0) * size) / 150)).toBeLessThan(1);
      const mean = [...counts].reduce((sum, [v, c]) => sum + v * c, 0) / size;
      expect(Math.abs(mean - 760 / 150)).toBeLessThan(0.2);
    }
    // Multiples of 30 match it exactly.
    expect(sorted(deckOf(240))).toEqual(sorted([...fullDeck(), ...deckOf(90)]));
  });

  test("a game saved before decks scaled keeps its 150 cards", () => {
    const s = newGame(4, 3);
    delete s.deckSize;
    s.phase = "roundOver";
    const next = act(s, SYSTEM, { type: "nextRound" }).state;
    expect(allCards(next)).toHaveLength(150);
  });

  test("player counts outside 2 to 10 are refused", () => {
    expect(() => newGame(1, 1)).toThrow();
    expect(() => newGame(1, 11)).toThrow();
  });

  test("the same seed deals the same game", () => {
    expect(newGame(7, 4)).toEqual(newGame(7, 4));
    expect(newGame(7, 4).grids).not.toEqual(newGame(8, 4).grids);
  });
});

describe("opening reveal", () => {
  test("each player reveals exactly two cards, then the highest total starts", () => {
    let s = newGame(3, 3);
    s.grids[0] = s.grids[0]!.map((c, i) => ({ faceUp: false, value: i === 0 ? 1 : i === 1 ? 1 : c!.value }));
    s.grids[1] = s.grids[1]!.map((c, i) => ({ faceUp: false, value: i < 2 ? 6 : c!.value }));
    s.grids[2] = s.grids[2]!.map((c, i) => ({ faceUp: false, value: i < 2 ? 4 : c!.value }));
    expect(rejects(s, 0, { type: "drawDeck" })).toMatch(/reveal/);
    s = act(s, 0, { type: "flip", index: 0 }).state;
    s = act(s, 0, { type: "flip", index: 1 }).state;
    expect(rejects(s, 0, { type: "flip", index: 2 })).toMatch(/already/);
    s = act(s, 2, { type: "flip", index: 0 }).state;
    s = act(s, 2, { type: "flip", index: 1 }).state;
    expect(s.phase).toBe("initialFlip");
    s = act(s, 1, { type: "flip", index: 0 }).state;
    const last = act(s, 1, { type: "flip", index: 1 });
    expect(last.state.phase).toBe("turn");
    expect(last.state.current).toBe(1);
    expect(last.events.at(-1)).toEqual({ type: "turnStarted", player: 1 });
  });

  test("a tie for the highest total goes to the earliest seat", () => {
    let s = newGame(3, 2);
    for (const g of s.grids) for (const c of g) c!.value = 5;
    for (const p of [1, 0]) {
      s = act(s, p, { type: "flip", index: 0 }).state;
      s = act(s, p, { type: "flip", index: 5 }).state;
    }
    expect(s.current).toBe(0);
  });

  test("an already revealed card cannot be revealed again", () => {
    const s = act(newGame(3, 2), 0, { type: "flip", index: 3 }).state;
    expect(rejects(s, 0, { type: "flip", index: 3 })).toMatch(/face-down/);
  });
});

describe("turns", () => {
  test("only the current player may act", () => {
    const s = playing([hidden(5), hidden(5)]);
    expect(rejects(s, 1, { type: "drawDeck" })).toMatch(/not your turn/);
  });

  test("a card taken from the discard pile must be swapped in", () => {
    let s = playing([hidden(5), hidden(5)], { discard: [9, 2] });
    s = act(s, 0, { type: "takeDiscard" }).state;
    expect(s.hand).toBe(2);
    expect(s.discardPile).toEqual([9]);
    expect(rejects(s, 0, { type: "discardHand" })).toMatch(/must be swapped/);
    const r = act(s, 0, { type: "swap", index: 4 });
    expect(r.state.grids[0]![4]).toEqual({ value: 2, faceUp: true });
    expect(r.state.discardPile).toEqual([9, 5]);
    expect(r.state.current).toBe(1);
    expect(r.events).toContainEqual({ type: "swapped", player: 0, index: 4, placed: 2, removed: 5 });
  });

  test("a drawn card can be swapped with a face-up card", () => {
    let s = playing([["u11", 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], hidden(5)], { draw: [0] });
    s = act(s, 0, { type: "drawDeck" }).state;
    s = act(s, 0, { type: "swap", index: 0 }).state;
    expect(s.grids[0]![0]).toEqual({ value: 0, faceUp: true });
    expect(s.discardPile.at(-1)).toBe(11);
  });

  test("a drawn card can be discarded, then a face-down card must be revealed", () => {
    let s = playing([["u4", 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7], hidden(5)], { draw: [12] });
    s = act(s, 0, { type: "drawDeck" }).state;
    s = act(s, 0, { type: "discardHand" }).state;
    expect(s.discardPile.at(-1)).toBe(12);
    expect(s.stage).toBe("mustFlip");
    expect(rejects(s, 0, { type: "flip", index: 0 })).toMatch(/face-down/);
    expect(rejects(s, 0, { type: "drawDeck" })).toMatch(/reveal/);
    s = act(s, 0, { type: "flip", index: 1 }).state;
    expect(s.grids[0]![1]).toEqual({ value: 7, faceUp: true });
    expect(s.current).toBe(1);
  });

  test("with no face-down cards left, a drawn card must be swapped in", () => {
    const all: Cell[] = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10", "u11", "u12"];
    let s = playing([hidden(5), all], { current: 1, draw: [0] });
    s.endedBy = 0;
    s = act(s, 1, { type: "drawDeck" }).state;
    expect(rejects(s, 1, { type: "discardHand" })).toMatch(/no face-down/);
  });

  test("the draw pile is rebuilt from the discards, keeping the top card", () => {
    let s = playing([hidden(5), hidden(5)], { draw: [], discard: [1, 2, 3, 4, 9] });
    const r = act(s, 0, { type: "drawDeck" });
    s = r.state;
    expect(r.events[0]).toEqual({ type: "reshuffled", count: 4 });
    expect(s.discardPile).toEqual([9]);
    expect(s.drawPile).toHaveLength(3);
    expect(sorted([...s.drawPile, s.hand!])).toEqual([1, 2, 3, 4]);
  });

  test("actions never mutate the input state", () => {
    const s = playing([hidden(5), hidden(5)]);
    const copy = structuredClone(s);
    applyAction(s, 0, { type: "drawDeck" });
    expect(s).toEqual(copy);
  });
});

describe("columns", () => {
  test("three equal face-up cards in a column are cleared to the discard pile", () => {
    // Column 1 is indices 1, 5, 9.
    let s = playing([[0, "u7", 0, 0, 0, "u7", 0, 0, 0, 3, 0, 0], hidden(5)], { discard: [4, 7] });
    s = act(s, 0, { type: "takeDiscard" }).state;
    const r = act(s, 0, { type: "swap", index: 9 });
    expect(r.state.grids[0]![1]).toBeNull();
    expect(r.state.grids[0]![5]).toBeNull();
    expect(r.state.grids[0]![9]).toBeNull();
    expect(r.state.discardPile).toEqual([4, 3, 7, 7, 7]);
    expect(r.events).toContainEqual({ type: "columnCleared", player: 0, column: 1, value: 7 });
  });

  test("cleared slots can no longer be used", () => {
    let s = playing([[null, 1, 1, 1, null, 1, 1, 1, null, 1, 1, 1], hidden(5)]);
    s = act(s, 0, { type: "drawDeck" }).state;
    expect(rejects(s, 0, { type: "swap", index: 4 })).toMatch(/your cards/);
  });

  test("columns completed by the final reveal are cleared before scoring", () => {
    // Player 1's column 0 holds 9, 9, 9 but one of them stays face down until the end.
    const nine: Cell[] = [9, "u1", "u2", "u3", "u9", "u2", "u3", "u1", "u9", "u3", "u1", "u2"];
    let s = playing([nearlyDone(0), nine], { draw: [12, 12] });
    s = act(s, 0, { type: "drawDeck" }).state;
    s = act(s, 0, { type: "discardHand" }).state;
    s = act(s, 0, { type: "flip", index: 11 }).state;
    expect(s.endedBy).toBe(0);
    s = act(s, 1, { type: "drawDeck" }).state;
    const r = act(s, 1, { type: "swap", index: 1 });
    expect(r.state.phase).toBe("roundOver");
    expect(r.events).toContainEqual({ type: "columnCleared", player: 1, column: 0, value: 9 });
    expect(r.state.rounds[0]!.scores).toEqual([21, 29]);
  });
});

describe("round end and scoring", () => {
  test("revealing the last card gives every other player exactly one more turn", () => {
    let s = playing([nearlyDone(0), varied(5), varied(5)], { draw: [9, 9, 9, 12] });
    s = act(s, 0, { type: "drawDeck" }).state;
    s = act(s, 0, { type: "discardHand" }).state;
    const r = act(s, 0, { type: "flip", index: 11 });
    expect(r.events).toContainEqual({ type: "finalTurns", endedBy: 0 });
    s = r.state;
    expect(s.current).toBe(1);
    s = act(s, 1, { type: "drawDeck" }).state;
    s = act(s, 1, { type: "discardHand" }).state;
    s = act(s, 1, { type: "flip", index: 0 }).state;
    expect(s.phase).toBe("turn");
    expect(s.current).toBe(2);
    s = act(s, 2, { type: "drawDeck" }).state;
    s = act(s, 2, { type: "discardHand" }).state;
    const end = act(s, 2, { type: "flip", index: 0 });
    expect(end.state.phase).toBe("roundOver");
    expect(end.state.rounds[0]).toEqual({ scores: [21, 78, 78], doubled: null, endedBy: 0 });
  });

  /** Player 0 ends the round with 21 points; player 1 has one last turn. */
  const finishRound = (other: Cell[], ender: Cell[] = nearlyDone(0), target = 100) => {
    let s = playing([ender, other], { draw: [12, 12], target });
    s = act(s, 0, { type: "drawDeck" }).state;
    s = act(s, 0, { type: "discardHand" }).state;
    s = act(s, 0, { type: "flip", index: 11 }).state;
    s = act(s, 1, { type: "drawDeck" }).state;
    s = act(s, 1, { type: "discardHand" }).state;
    return act(s, 1, { type: "flip", index: 0 });
  };

  test("a round's end reports its length, deck and first reshuffle, for tuning the deck", () => {
    let s = playing([nearlyDone(0), varied(0)], { draw: [12] });
    s = act(s, 0, { type: "drawDeck" }).state;
    s = act(s, 0, { type: "discardHand" }).state;
    s = act(s, 0, { type: "flip", index: 11 }).state;
    s = act(s, 1, { type: "drawDeck" }).state;
    s = act(s, 1, { type: "discardHand" }).state;
    const { events } = act(s, 1, { type: "flip", index: 0 });
    const ended = events.find((e) => e.type === "roundEnded");
    expect(ended).toMatchObject({ turns: 2, deckSize: 48, firstReshuffle: 1 });

    const calm = finishRound(varied(0)).events.find((e) => e.type === "roundEnded");
    expect(calm).toMatchObject({ turns: 2, firstReshuffle: null });
  });

  test("the ender's positive score doubles when someone else is lower", () => {
    const { state } = finishRound(varied(0));
    expect(state.rounds[0]).toEqual({ scores: [42, 18], doubled: 0, endedBy: 0 });
    expect(state.totals).toEqual([42, 18]);
  });

  test("the ender's score doubles on a tie for lowest", () => {
    const tie = varied(0);
    tie[11] = 4;
    const { state } = finishRound(tie);
    expect(state.rounds[0]).toEqual({ scores: [42, 21], doubled: 0, endedBy: 0 });
  });

  test("the ender keeps their score when strictly lowest", () => {
    const { state } = finishRound(varied(1));
    expect(state.rounds[0]).toEqual({ scores: [21, 30], doubled: null, endedBy: 0 });
  });

  test("a zero or negative score is never doubled", () => {
    const zero: Cell[] = ["u-2", "u2", "u-1", "u1", "u2", "u-2", "u1", "u-1", "u0", "u0", "u0", 0];
    const { state } = finishRound(varied(-2), zero);
    expect(state.rounds[0]).toEqual({ scores: [0, -6], doubled: null, endedBy: 0 });
  });

  test("the next round starts on request and the previous ender goes first", () => {
    let s = finishRound(varied(0)).state;
    expect(rejects(s, 0, { type: "nextRound" })).toMatch(/only the table/);
    s = act(s, SYSTEM, { type: "nextRound" }).state;
    expect(s.round).toBe(2);
    expect(s.phase).toBe("initialFlip");
    expect(sorted(allCards(s))).toEqual(sorted(deckOf(s.deckSize ?? 150)));
    for (const p of [1, 0]) {
      s = act(s, p, { type: "flip", index: 0 }).state;
      s = act(s, p, { type: "flip", index: 1 }).state;
    }
    expect(s.current).toBe(0);
  });

  test("reaching the target ends the game and the lowest total wins", () => {
    const r = finishRound(varied(0), nearlyDone(0), 40);
    expect(r.state.phase).toBe("gameOver");
    expect(r.state.winners).toEqual([1]);
    expect(r.events.at(-1)).toEqual({ type: "gameOver", winners: [1] });
    expect(rejects(r.state, SYSTEM, { type: "nextRound" })).toMatch(/not over/);
  });

  test("tied lowest totals share the win", () => {
    let s = playing([nearlyDone(0), varied(1)], { draw: [12, 12], target: 10 });
    s.totals = [9, 0];
    s = act(s, 0, { type: "drawDeck" }).state;
    s = act(s, 0, { type: "discardHand" }).state;
    s = act(s, 0, { type: "flip", index: 11 }).state;
    s = act(s, 1, { type: "drawDeck" }).state;
    s = act(s, 1, { type: "discardHand" }).state;
    s = act(s, 1, { type: "flip", index: 0 }).state;
    expect(s.totals).toEqual([30, 30]);
    expect(s.phase).toBe("gameOver");
    expect(s.winners).toEqual([0, 1]);
  });
});

describe("views", () => {
  test("face-down values and the draw pile never appear in a view", () => {
    const s = playing([[3, "u4", 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], hidden(9)], { draw: [11, 11], discard: [2] });
    const v = viewFor(s, 0);
    expect(v.boards[0]!.cards[0]).toEqual({ faceUp: false });
    expect(v.boards[0]!.cards[1]).toEqual({ faceUp: true, value: 4 });
    expect(v.boards[0]!.visibleSum).toBe(4);
    expect(v.drawCount).toBe(2);
    expect(v.discardTop).toBe(2);
    const hiddenCards = v.boards.flatMap((b) => b.cards).filter((c) => c !== null && !c.faceUp);
    expect(hiddenCards).toHaveLength(23);
    for (const c of hiddenCards) expect(Object.keys(c!)).toEqual(["faceUp"]);
    expect(Object.keys(v)).not.toContain("drawPile");
    expect(JSON.stringify(v)).not.toContain('"value":9');
  });

  test("a table without running sums gets no sums in any view, while totals stay", () => {
    const s = playing([["u4", "u5", 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], hidden(9)]);
    s.settings.showSums = false;
    s.totals = [12, 30];
    for (const seat of [0, 1, null]) {
      const v = viewFor(s, seat);
      expect(v.settings.showSums).toBe(false);
      expect(v.boards.map((b) => b.visibleSum)).toEqual([null, null]);
      expect(v.totals).toEqual([12, 30]);
    }
  });

  test("the table decides whether piles show only top cards, counts, or every discard", () => {
    const s = playing([hidden(3), hidden(9)], { discard: [4, 7, 2], draw: [1, 5, 6] });
    const at = (piles: "top" | "counts" | "browse") => {
      s.settings.piles = piles;
      const v = viewFor(s, 0);
      return {
        draw: v.drawCount,
        discard: v.discardCount,
        discards: v.discards,
        top: v.discardTop,
        piles: v.settings.piles,
      };
    };
    expect(at("top")).toEqual({ draw: null, discard: null, discards: null, top: 2, piles: "top" });
    expect(at("counts")).toEqual({ draw: 3, discard: 3, discards: null, top: 2, piles: "counts" });
    expect(at("browse")).toEqual({ draw: 3, discard: 3, discards: [4, 7, 2], top: 2, piles: "browse" });
    delete (s.settings as Partial<typeof s.settings>).piles;
    const old = viewFor(s, 0);
    expect([old.settings.piles, old.drawCount, old.discards]).toEqual(["counts", 3, null]);
  });

  test("a reshuffle is counted for the round and its size hidden from top-cards tables", () => {
    let s = playing([hidden(3), hidden(9)], { discard: [4, 7, 2], draw: [] });
    s = act(s, 0, { type: "drawDeck" }).state;
    expect(s.reshuffles).toBe(1);
    expect(viewFor(s, 1).reshuffles).toBe(1);
    const events = [{ type: "reshuffled", count: 2 } as const];
    expect(eventsFor(events, { ...s.settings, piles: "counts" })).toEqual(events);
    expect(eventsFor(events, { ...s.settings, piles: "top" })).toEqual([{ type: "reshuffled", count: null }]);
    s.phase = "roundOver";
    expect(act(s, SYSTEM, { type: "nextRound" }).state.reshuffles).toBe(0);
  });

  test("a game saved before the setting existed still shows sums", () => {
    const s = playing([["u4", "u5", 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], hidden(9)]);
    delete (s.settings as Partial<typeof s.settings>).showSums;
    const v = viewFor(s, 0);
    expect(v.settings.showSums).toBe(true);
    expect(v.boards[0]!.visibleSum).toBe(9);
  });
});
