import { Database } from "bun:sqlite";
import { isRoomSnapshot, type RoomSnapshot } from "./room.ts";

/** Upper bound for the database file, well inside the 1 GB volume, so it can never fill the disk. */
const DEFAULT_MAX_BYTES = 400 * 1024 * 1024;

/** SQLite persistence: one snapshot per room plus a bounded log of accepted messages. */
export class Store {
  private readonly db: Database;

  constructor(path: string, maxBytes = DEFAULT_MAX_BYTES) {
    this.db = new Database(path, { create: true, strict: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA synchronous = NORMAL");
    const pageSize = this.db.query<{ page_size: number }, []>("PRAGMA page_size").get()?.page_size ?? 4096;
    this.db.run(`PRAGMA max_page_count = ${Math.max(1, Math.floor(maxBytes / pageSize))}`);
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

  /** Every stored room. Rows that cannot be read are reported, not loaded, and stay on disk. */
  loadRooms(): { rooms: { snap: RoomSnapshot; updatedAt: number }[]; broken: string[] } {
    const rooms: { snap: RoomSnapshot; updatedAt: number }[] = [];
    const broken: string[] = [];
    const rows = this.db
      .query<{ code: string; snapshot: string; updated_at: number }, []>("SELECT code, snapshot, updated_at FROM rooms")
      .all();
    for (const row of rows) {
      let snap: unknown;
      try {
        snap = JSON.parse(row.snapshot);
      } catch {
        snap = null;
      }
      if (isRoomSnapshot(snap) && snap.code === row.code) rooms.push({ snap, updatedAt: row.updated_at });
      else broken.push(row.code);
    }
    return { rooms, broken };
  }

  /** Saves the room and, when given, the message that changed it, in one transaction. */
  save(snap: RoomSnapshot, entry?: { seat: number; message: unknown }, text = JSON.stringify(snap)): void {
    const now = Date.now();
    this.db.transaction(() => {
      this.db
        .query(
          "INSERT INTO rooms (code, snapshot, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(code) DO UPDATE SET snapshot = ?2, updated_at = ?3",
        )
        .run(snap.code, text, now);
      if (entry) {
        this.db
          .query("INSERT INTO log (code, seat, message, at) VALUES (?1, ?2, ?3, ?4)")
          .run(snap.code, entry.seat, JSON.stringify(entry.message), now);
      }
    })();
  }

  /** Keeps only the newest `keep` log entries of a room. */
  trimLog(code: string, keep: number): void {
    this.db
      .query(
        "DELETE FROM log WHERE code = ?1 AND id <= (SELECT id FROM log WHERE code = ?1 ORDER BY id DESC LIMIT 1 OFFSET ?2)",
      )
      .run(code, keep);
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
