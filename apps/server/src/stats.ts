import { type GameEvent, PLAYER_ID_PATTERN, type Stats } from "@shoalow/game";
import type { Store } from "./store.ts";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_CACHE_MS = 60 * 1000;

type Counter = "tables" | "gamesStarted" | "gamesFinished" | "rounds" | "columnsCleared" | "reshuffles";

/**
 * Public statistics about everyone's play. Counters live in memory and are written through
 * to the database whenever they change. Players are counted by a hash of the anonymous ID
 * their browser keeps; no addresses, names or other personal data are stored.
 */
export class StatsBook {
  private readonly values: Map<string, number>;
  private players: number;
  private recent: { value: number; at: number } | null = null;

  constructor(private readonly store: Store) {
    this.values = store.counters();
    if (!this.values.has("since")) {
      this.values.set("since", Date.now());
      store.setCounters(new Map([["since", this.values.get("since") as number]]));
    }
    this.players = store.playerCounts(0).total;
  }

  /** Counts a new table. */
  table(): void {
    this.save(new Map([["tables", (this.values.get("tables") ?? 0) + 1]]));
  }

  /** Counts what happened in a game: starts, rounds, columns, reshuffles and finishes. */
  game(events: readonly GameEvent[]): void {
    const changes = new Map<Counter, number>();
    const add = (key: Counter) => changes.set(key, (changes.get(key) ?? 0) + 1);
    let best: number | null = null;
    for (const e of events) {
      if (e.type === "roundStarted" && e.round === 1) add("gamesStarted");
      else if (e.type === "roundEnded") {
        add("rounds");
        const low = Math.min(...e.result.scores);
        best = best === null ? low : Math.min(best, low);
      } else if (e.type === "columnCleared") add("columnsCleared");
      else if (e.type === "reshuffled") add("reshuffles");
      else if (e.type === "gameOver") add("gamesFinished");
    }
    const updated = new Map<string, number>();
    for (const [key, delta] of changes) updated.set(key, (this.values.get(key) ?? 0) + delta);
    const known = this.values.get("bestRound");
    if (best !== null && (known === undefined || best < known)) updated.set("bestRound", best);
    this.save(updated);
  }

  /** Counts a player sitting down. IDs that do not look like one are ignored. */
  player(rawId: unknown): void {
    if (typeof rawId !== "string" || !PLAYER_ID_PATTERN.test(rawId)) return;
    const id = new Bun.CryptoHasher("sha256").update(`shoalow-player:${rawId}`).digest("hex");
    if (this.store.seePlayer(id)) {
      this.players += 1;
      this.recent = null;
    }
  }

  view(live: Stats["live"], now = Date.now()): Stats {
    if (!this.recent || now - this.recent.at > RECENT_CACHE_MS)
      this.recent = { value: this.store.playerCounts(now - MONTH_MS).recent, at: now };
    const get = (key: Counter) => this.values.get(key) ?? 0;
    return {
      since: this.values.get("since") ?? now,
      live,
      players: this.players,
      playersMonth: this.recent.value,
      tables: get("tables"),
      gamesStarted: get("gamesStarted"),
      gamesFinished: get("gamesFinished"),
      rounds: get("rounds"),
      columnsCleared: get("columnsCleared"),
      reshuffles: get("reshuffles"),
      bestRound: this.values.get("bestRound") ?? null,
    };
  }

  /** Sets counters in memory and saves them; a failed write is logged, not fatal. */
  private save(updated: Map<string, number>): void {
    if (updated.size === 0) return;
    for (const [key, value] of updated) this.values.set(key, value);
    try {
      this.store.setCounters(updated);
    } catch (e) {
      console.error(`could not save statistics: ${(e as Error).message}`);
    }
  }
}
