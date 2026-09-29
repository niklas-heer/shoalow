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
