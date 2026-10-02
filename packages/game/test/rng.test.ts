import { expect, test } from "bun:test";
import {
  applyAction,
  chachaBlock,
  type DeckRng,
  fullDeck,
  newGame,
  secureSeed,
  shuffle,
  shuffleDeck,
  viewFor,
} from "../src/index.ts";

test("ChaCha20 matches the RFC 8439 test vector", () => {
  // Section 2.3.2: key 00..1f, block counter 1, nonce 00:00:00:09:00:00:00:4a:00:00:00:00.
  const key = Array.from(
    { length: 8 },
    (_, i) => (4 * i) | ((4 * i + 1) << 8) | ((4 * i + 2) << 16) | ((4 * i + 3) << 24),
  );
  const block = chachaBlock(
    key.map((w) => w >>> 0),
    1,
    [0x09000000, 0x4a000000, 0],
  );
  expect([...block].map((w) => w.toString(16).padStart(8, "0")).join(" ")).toBe(
    [
      "e4e7f110 15593bd1 1fdd0f50 c47120a3",
      "c7f4d1c7 0368c033 9aaa2204 4e6cd4c3",
      "466482d2 09aa9f07 05d7c214 a2028bd9",
      "d19c12b5 b94e16de e883d0cb 4e3c50a2",
    ].join(" "),
  );
});

test("a shuffle is a permutation, repeatable from its key and different for another key", () => {
  const rng: DeckRng = { key: secureSeed(), block: 0 };
  const [a, after] = shuffleDeck(fullDeck(), rng);
  const [b] = shuffleDeck(fullDeck(), rng);
  expect(a).toEqual(b);
  expect([...a].sort((x, y) => x - y)).toEqual([...fullDeck()].sort((x, y) => x - y));
  expect((after as DeckRng).block).toBeGreaterThan(0);
  const [next] = shuffleDeck(fullDeck(), after);
  expect(next).not.toEqual(a);
  const [other] = shuffleDeck(fullDeck(), { key: secureSeed(), block: 0 });
  expect(other).not.toEqual(a);
});

test("every card is equally likely in every position", () => {
  // 12 cards, 24,000 shuffles: each card should land in each position about 2,000 times.
  const n = 12;
  const shuffles = 24_000;
  const counts = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  let rng: DeckRng = { key: [1, 2, 3, 4, 5, 6, 7, 8], block: 0 };
  const items = Array.from({ length: n }, (_, i) => i);
  for (let s = 0; s < shuffles; s++) {
    const [out, next] = shuffleDeck(items, rng);
    rng = next as DeckRng;
    out.forEach((card, position) => {
      (counts[card] as number[])[position] = ((counts[card] as number[])[position] ?? 0) + 1;
    });
  }
  const expected = shuffles / n;
  for (const row of counts) {
    const chiSquare = row.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
    // 11 degrees of freedom: 31.3 is the 0.1% critical value.
    expect(chiSquare).toBeLessThan(31.3);
  }
});

test("games started with the old generator continue exactly as before", () => {
  const legacy = newGame(5, 2);
  legacy.rng = 12345;
  legacy.phase = "turn";
  legacy.stage = "choose";
  legacy.drawPile = [];
  legacy.discardPile = [1, 2, 3, 4, 5, 6, 7];
  const r = applyAction(legacy, legacy.current, { type: "drawDeck" });
  if (!r.ok) throw new Error(r.error);
  const [expected, rng] = shuffle([1, 2, 3, 4, 5, 6], 12345);
  expect(r.state.rng).toBe(rng);
  expect([...r.state.drawPile, r.state.hand]).toEqual(expected);
});

test("the deck key never reaches a player", () => {
  const s = newGame(secureSeed(), 4);
  const key = (s.rng as DeckRng).key;
  for (const seat of [0, 1, 2, 3, null]) {
    const text = JSON.stringify(viewFor(s, seat));
    expect(text).not.toContain("rng");
    for (const word of key) expect(text).not.toContain(String(word));
  }
});
