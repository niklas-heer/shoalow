/** How many requests a client may make at once, and how fast that allowance comes back. */
export interface Rate {
  burst: number;
  perSecond: number;
}

/** Abuse limits. Generous enough that a busy office behind one address can still play. */
export interface Limits {
  /** Creating tables, per client address. */
  createRoom: Rate;
  /** Joining tables, per client address. */
  joinRoom: Rate;
  /** Looking up a table by code, per client address. */
  lookupRoom: Rate;
  /** Opening a table connection, per client address. */
  connect: Rate;
  /** Messages on one connection. */
  messages: Rate;
  /** Messages over the limit before the connection is closed. */
  messageStrikes: number;
  /** Open connections from one client address. */
  socketsPerClient: number;
  /** Open connections for one seat; the oldest gives way to a new one. */
  socketsPerSeat: number;
  /** Open connections in total. */
  sockets: number;
  /** Tables kept at once; idle lobbies give way to new tables when full. */
  rooms: number;
  /** A table must be untouched and unwatched this long before it can give way. */
  evictAfterMs: number;
  /** Message log entries kept per table. */
  logPerRoom: number;
}

export const DEFAULT_LIMITS: Limits = {
  createRoom: { burst: 10, perSecond: 1 / 20 },
  joinRoom: { burst: 20, perSecond: 1 / 5 },
  lookupRoom: { burst: 60, perSecond: 1 },
  connect: { burst: 40, perSecond: 1 },
  messages: { burst: 30, perSecond: 5 },
  messageStrikes: 60,
  socketsPerClient: 64,
  socketsPerSeat: 3,
  sockets: 1500,
  rooms: 2000,
  evictAfterMs: 15 * 60 * 1000,
  logPerRoom: 5000,
};

/** Token buckets keyed by client. Buckets that have refilled completely are forgotten. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private readonly rate: Rate,
    private readonly now: () => number = Date.now,
  ) {}

  /** Takes one token for `key`; returns 0 when allowed, otherwise seconds until the next token. */
  take(key: string): number {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.rate.burst, at: now };
    bucket.tokens = Math.min(this.rate.burst, bucket.tokens + ((now - bucket.at) / 1000) * this.rate.perSecond);
    bucket.at = now;
    this.buckets.set(key, bucket);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return 0;
    }
    return Math.max(1, Math.ceil((1 - bucket.tokens) / this.rate.perSecond));
  }

  /** Drops buckets that are full again, so the map only holds recently active clients. */
  prune(): void {
    const now = this.now();
    for (const [key, b] of this.buckets) {
      if (b.tokens + ((now - b.at) / 1000) * this.rate.perSecond >= this.rate.burst) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}

/**
 * The key a client is limited by. IPv6 users usually control a whole /64, so they share one
 * key per /64; IPv4-mapped addresses count as IPv4.
 */
export function clientKey(address: string | null | undefined): string {
  const ip = (address ?? "").trim().toLowerCase().split("%")[0] ?? "";
  if (!ip) return "unknown";
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1] as string;
  if (!ip.includes(":")) return ip;
  const [head = "", tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
