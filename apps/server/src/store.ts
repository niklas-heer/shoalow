import { Database } from "bun:sqlite";
import type { RoomSnapshot } from "./room.ts";

/** SQLite persistence: one snapshot per room plus an append-only log of accepted messages. */
export class Store {
  private readonly db: Database;

  constructor(path: string) {
    this.db = new Database(path, { create: true, strict: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA synchronous = NORMAL");
    this.db.run(`CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      snapshot TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      seat INTEGER NOT NULL,
      message TEXT NOT NULL,
      at INTEGER NOT NULL
    )`);
    this.db.run("CREATE INDEX IF NOT EXISTS log_code ON log (code, id)");
  }

  loadRooms(): RoomSnapshot[] {
    return this.db
      .query<{ snapshot: string }, []>("SELECT snapshot FROM rooms")
      .all()
      .map((r) => JSON.parse(r.snapshot) as RoomSnapshot);
  }

  /** Saves the room and, when given, the message that changed it, in one transaction. */
  save(snap: RoomSnapshot, entry?: { seat: number; message: unknown }): void {
    const now = Date.now();
    this.db.transaction(() => {
      this.db
        .query(
          "INSERT INTO rooms (code, snapshot, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(code) DO UPDATE SET snapshot = ?2, updated_at = ?3",
        )
        .run(snap.code, JSON.stringify(snap), now);
      if (entry) {
        this.db
          .query("INSERT INTO log (code, seat, message, at) VALUES (?1, ?2, ?3, ?4)")
          .run(snap.code, entry.seat, JSON.stringify(entry.message), now);
      }
    })();
  }

  delete(code: string): void {
    this.db.transaction(() => {
      this.db.query("DELETE FROM rooms WHERE code = ?1").run(code);
      this.db.query("DELETE FROM log WHERE code = ?1").run(code);
    })();
  }

  /** Deletes rooms untouched for longer than `maxAgeMs`; returns their codes. */
  deleteIdle(maxAgeMs: number): string[] {
    const cutoff = Date.now() - maxAgeMs;
    const codes = this.db
      .query<{ code: string }, [number]>("SELECT code FROM rooms WHERE updated_at < ?1")
      .all(cutoff)
      .map((r) => r.code);
    for (const code of codes) this.delete(code);
    return codes;
  }

  logFor(code: string): { seat: number; message: unknown }[] {
    return this.db
      .query<{ seat: number; message: string }, [string]>("SELECT seat, message FROM log WHERE code = ?1 ORDER BY id")
      .all(code)
      .map((r) => ({ seat: r.seat, message: JSON.parse(r.message) }));
  }

  close(): void {
    this.db.close();
  }
}
