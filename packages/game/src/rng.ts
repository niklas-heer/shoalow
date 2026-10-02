/** Mulberry32: a tiny seeded generator whose whole state is one 32-bit integer. */
export function nextRandom(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Returns a shuffled copy and the advanced generator state. */
export function shuffle<T>(items: readonly T[], state: number): [T[], number] {
  const out = [...items];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, n] = nextRandom(s);
    s = n;
    const j = Math.floor(r * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return [out, s];
}

/** A stateful convenience wrapper, used by bots and simulations. */
export function makeRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    const [r, n] = nextRandom(s);
    s = n;
    return r;
  };
}

// ---------------------------------------------------------------- decks

/**
 * The deck generator's state: a 256-bit ChaCha20 key and the next unused 64-byte block.
 * Without the key, which never leaves the server, the deck cannot be predicted from the
 * cards on the table.
 */
export interface DeckRng {
  key: number[];
  block: number;
}

/** A deck generator, or the bare number of a game started before decks used ChaCha20. */
export type RngState = number | DeckRng;

const SIGMA = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

function quarter(x: Uint32Array, a: number, b: number, c: number, d: number): void {
  const rotl = (v: number, n: number) => (v << n) | (v >>> (32 - n));
  x[a] = (x[a] as number) + (x[b] as number);
  x[d] = rotl((x[d] as number) ^ (x[a] as number), 16);
  x[c] = (x[c] as number) + (x[d] as number);
  x[b] = rotl((x[b] as number) ^ (x[c] as number), 12);
  x[a] = (x[a] as number) + (x[b] as number);
  x[d] = rotl((x[d] as number) ^ (x[a] as number), 8);
  x[c] = (x[c] as number) + (x[d] as number);
  x[b] = rotl((x[b] as number) ^ (x[c] as number), 7);
}

/** One ChaCha20 block (RFC 8439, section 2.3) as sixteen 32-bit words. */
export function chachaBlock(
  key: readonly number[],
  counter: number,
  nonce: readonly number[] = [0, 0, 0],
): Uint32Array {
  if (key.length !== 8 || nonce.length !== 3) throw new Error("ChaCha20 needs an 8-word key and a 3-word nonce");
  const input = Uint32Array.from([...SIGMA, ...key, counter, ...nonce]);
  const x = input.slice();
  for (let round = 0; round < 10; round++) {
    quarter(x, 0, 4, 8, 12);
    quarter(x, 1, 5, 9, 13);
    quarter(x, 2, 6, 10, 14);
    quarter(x, 3, 7, 11, 15);
    quarter(x, 0, 5, 10, 15);
    quarter(x, 1, 6, 11, 12);
    quarter(x, 2, 7, 8, 13);
    quarter(x, 3, 4, 9, 14);
  }
  for (let i = 0; i < 16; i++) x[i] = (x[i] as number) + (input[i] as number);
  return x;
}

/** 256 bits from the platform's secure random source, for a new game's deck key. */
export function secureSeed(): number[] {
  return [...crypto.getRandomValues(new Uint32Array(8))];
}

/** Stretches a small number into a deck key, for tests, simulations and replays by number. */
export function seedFromNumber(seed: number): number[] {
  const random = makeRandom(seed);
  return Array.from({ length: 8 }, () => Math.floor(random() * 2 ** 32));
}

/**
 * Shuffles a copy of `items` with Fisher–Yates. ChaCha20 games pick each position by
 * rejection sampling, so every order is exactly equally likely; legacy games keep their
 * original generator so a restored game continues exactly as it would have.
 */
export function shuffleDeck<T>(items: readonly T[], rng: RngState): [T[], RngState] {
  if (typeof rng === "number") return shuffle(items, rng);
  const out = [...items];
  let block = rng.block;
  let words: Uint32Array = new Uint32Array(0);
  let used = 0;
  const next = (): number => {
    if (used === words.length) {
      if (block >= 2 ** 32) throw new Error("deck generator exhausted");
      words = chachaBlock(rng.key, block++);
      used = 0;
    }
    return words[used++] as number;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const bound = i + 1;
    const limit = 2 ** 32 - (2 ** 32 % bound);
    let u = next();
    while (u >= limit) u = next();
    const j = u % bound;
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return [out, { key: [...rng.key], block }];
}
