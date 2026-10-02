import {
  applyAction,
  type BotLevel,
  type BotSpeed,
  type ClientMessage,
  chooseAction,
  cleanName,
  DEFAULT_BOT_SPEED,
  DEFAULT_SHOW_SUMS,
  DEFAULT_TARGET_SCORE,
  type GameEvent,
  type GameState,
  MAX_PLAYERS,
  MAX_TARGET_SCORE,
  MIN_PLAYERS,
  MIN_TARGET_SCORE,
  newGame,
  ROOM_CODE_PATTERN,
  type RoomView,
  type Settings,
  SYSTEM,
  secureSeed,
  viewFor,
} from "@shoalow/game";

export interface Seat {
  token: string;
  name: string;
  kind: "human" | "bot";
  level: BotLevel | null;
  takenOver: boolean;
}

/** Everything needed to restore a room after a restart. */
export interface RoomSnapshot {
  code: string;
  seats: Seat[];
  host: number;
  settings: Settings;
  /** Missing in snapshots saved before bot speeds existed. */
  botSpeed?: BotSpeed;
  status: "lobby" | "playing";
  game: GameState | null;
  gameNumber: number;
  createdAt: number;
}

export type Outcome = { ok: true; events: GameEvent[]; removedTokens?: string[] } | { ok: false; error: string };

const BOT_NAMES = ["Kelp", "Coral", "Barnacle", "Pebble", "Nautilus", "Plankton", "Brine", "Sprat", "Minnow", "Urchin"];

export const newToken = (): string => crypto.randomUUID();

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Whether a stored snapshot has the shape the server relies on. A row that fails this is
 * skipped at startup rather than taking every other table down with it.
 */
export function isRoomSnapshot(v: unknown): v is RoomSnapshot {
  if (!isRecord(v) || typeof v.code !== "string" || !ROOM_CODE_PATTERN.test(v.code)) return false;
  if (!Array.isArray(v.seats) || v.seats.length === 0 || v.seats.length > MAX_PLAYERS) return false;
  const seatsOk = v.seats.every(
    (x) =>
      isRecord(x) &&
      typeof x.token === "string" &&
      typeof x.name === "string" &&
      (x.kind === "human" || x.kind === "bot") &&
      typeof x.takenOver === "boolean",
  );
  if (!seatsOk) return false;
  if (!Number.isInteger(v.host) || (v.host as number) < 0 || (v.host as number) >= v.seats.length) return false;
  if (!isRecord(v.settings) || !Number.isInteger(v.settings.targetScore)) return false;
  if (v.status === "lobby") return v.game === null;
  if (v.status !== "playing" || !isRecord(v.game)) return false;
  const g = v.game;
  return g.playerCount === v.seats.length && Array.isArray(g.grids) && g.grids.length === v.seats.length;
}

/** Lobby and table rules for one room. Holds no sockets or timers. */
export class Room {
  constructor(
    public snap: RoomSnapshot,
    /** For bots' choices. */
    private readonly random: () => number = Math.random,
    /** Each new game's secret deck key; simulations pass a reproducible one. */
    private readonly deckSeed: () => number[] = secureSeed,
  ) {
    // Snapshots saved before running sums could be hidden always showed them.
    snap.settings.showSums ??= DEFAULT_SHOW_SUMS;
    if (snap.game) snap.game.settings.showSums ??= DEFAULT_SHOW_SUMS;
  }

  /** Creates a room after validating the host's display name. */
  static createChecked(
    code: string,
    rawName: unknown,
    targetScore: unknown = DEFAULT_TARGET_SCORE,
  ): { room: Room; token: string } | { error: string } {
    const name = cleanName(rawName);
    if (!name) return { error: "pick a name of 1 to 20 characters" };
    if (
      typeof targetScore !== "number" ||
      !Number.isInteger(targetScore) ||
      targetScore < MIN_TARGET_SCORE ||
      targetScore > MAX_TARGET_SCORE
    )
      return { error: `the target must be a whole number between ${MIN_TARGET_SCORE} and ${MAX_TARGET_SCORE}` };
    const created = Room.create(code, name);
    created.room.snap.settings.targetScore = targetScore;
    return created;
  }

  static create(code: string, hostName: string): { room: Room; token: string } {
    const token = newToken();
    const room = new Room({
      code,
      seats: [{ token, name: hostName, kind: "human", level: null, takenOver: false }],
      host: 0,
      settings: { targetScore: DEFAULT_TARGET_SCORE, showSums: DEFAULT_SHOW_SUMS },
      botSpeed: DEFAULT_BOT_SPEED,
      status: "lobby",
      game: null,
      gameNumber: 0,
      createdAt: Date.now(),
    });
    return { room, token };
  }

  get code(): string {
    return this.snap.code;
  }

  get botSpeed(): BotSpeed {
    return this.snap.botSpeed ?? DEFAULT_BOT_SPEED;
  }

  seatOf(token: string): number {
    return this.snap.seats.findIndex((s) => s.kind === "human" && s.token === token);
  }

  join(rawName: unknown): { token: string } | { error: string } {
    const name = cleanName(rawName);
    if (!name) return { error: "pick a name of 1 to 20 characters" };
    if (this.snap.status !== "lobby") return { error: "this game has already started" };
    if (this.snap.seats.length >= MAX_PLAYERS) return { error: "the table is full" };
    const token = newToken();
    this.snap.seats.push({ token, name: this.uniqueName(name), kind: "human", level: null, takenOver: false });
    return { token };
  }

  private uniqueName(name: string): string {
    const taken = new Set(this.snap.seats.map((s) => s.name));
    if (!taken.has(name)) return name;
    for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`;
  }

  /** Whether a bot decides for this seat. */
  isBotControlled(seat: number): boolean {
    const s = this.snap.seats[seat];
    return !!s && (s.kind === "bot" || s.takenOver);
  }

  /**
   * Called when the owner of a human seat connects: they take their seat back. If everyone was
   * away when hosting last changed hands, the first person back becomes host.
   */
  reclaim(seat: number): boolean {
    const s = this.snap.seats[seat];
    if (!s?.takenOver) return false;
    s.takenOver = false;
    if (this.snap.seats[this.snap.host]?.takenOver) this.snap.host = seat;
    return true;
  }

  handle(seat: number, msg: ClientMessage): Outcome {
    const s = this.snap;
    const isHost = seat === s.host;
    const fail = (error: string): Outcome => ({ ok: false, error });
    const done = (events: GameEvent[] = []): Outcome => ({ ok: true, events });

    switch (msg.t) {
      case "ping":
        return done();
      case "addBot": {
        if (!isHost) return fail("only the host can add bots");
        if (s.status !== "lobby") return fail("bots can only join in the lobby");
        if (s.seats.length >= MAX_PLAYERS) return fail("the table is full");
        const used = new Set(s.seats.map((x) => x.name));
        const name = BOT_NAMES.find((n) => !used.has(`🤖 ${n}`)) ?? "Bot";
        s.seats.push({ token: newToken(), name: `🤖 ${name}`, kind: "bot", level: msg.level, takenOver: false });
        return done();
      }
      case "removeSeat": {
        if (!isHost) return fail("only the host can remove players");
        if (s.status !== "lobby") return fail("players can only be removed in the lobby");
        if (msg.seat === s.host) return fail("the host cannot remove themselves");
        const removed = s.seats[msg.seat];
        if (!removed) return fail("no such seat");
        s.seats.splice(msg.seat, 1);
        if (msg.seat < s.host) s.host -= 1;
        return { ok: true, events: [], removedTokens: [removed.token] };
      }
      case "leave": {
        const removed = s.seats[seat];
        if (!removed) return fail("no such seat");
        if (s.status === "playing") {
          const token = removed.token;
          // Preserve board indices and turn order; revoke every connection to the old seat.
          removed.kind = "bot";
          removed.level = "normal";
          removed.takenOver = false;
          removed.token = newToken();
          if (isHost) s.host = this.nextHost();
          return { ok: true, events: [], removedTokens: [token] };
        }
        s.seats.splice(seat, 1);
        if (seat < s.host) s.host -= 1;
        else if (seat === s.host) s.host = this.nextHost();
        return { ok: true, events: [], removedTokens: [removed.token] };
      }
      case "setTarget": {
        if (!isHost) return fail("only the host can change the target score");
        if (s.status !== "lobby") return fail("the target can only change in the lobby");
        if (msg.score < MIN_TARGET_SCORE || msg.score > MAX_TARGET_SCORE) {
          return fail(`the target must be between ${MIN_TARGET_SCORE} and ${MAX_TARGET_SCORE}`);
        }
        s.settings = { ...s.settings, targetScore: msg.score };
        return done();
      }
      case "setShowSums": {
        if (!isHost) return fail("only the host can choose whether sums are shown");
        if (s.status !== "lobby") return fail("sums can only be switched in the lobby");
        s.settings = { ...s.settings, showSums: msg.show };
        return done();
      }
      case "setBotSpeed": {
        if (!isHost) return fail("only the host can change the bot speed");
        s.botSpeed = msg.speed;
        return done();
      }
      case "start": {
        if (!isHost) return fail("only the host can start the game");
        if (s.status !== "lobby") return fail("the game has already started");
        if (s.seats.length < MIN_PLAYERS) return fail("add at least one more player or bot");
        return done(this.startGame());
      }
      case "stopGame": {
        if (!isHost) return fail("only the host can stop the game");
        if (s.status === "lobby") return done();
        s.status = "lobby";
        s.game = null;
        for (const player of s.seats) player.takenOver = false;
        return done();
      }
      case "playAgain": {
        if (!s.game) return fail("no game in progress");
        // Someone else already pressed it: nothing to do.
        if (s.game.phase !== "gameOver") return done();
        return done(this.startGame());
      }
      case "nextRound": {
        if (!s.game) return fail("no game in progress");
        if (this.isBotControlled(seat)) return fail("no such seat");
        if (s.game.phase !== "roundOver") return done();
        return this.apply(SYSTEM, { type: "nextRound" });
      }
      case "takeover": {
        if (!isHost) return fail("only the host can hand a seat to a bot");
        if (s.status !== "playing") return fail("a bot can only take over during a game");
        const target = s.seats[msg.seat];
        if (target?.kind !== "human") return fail("only a player's seat can be handed to a bot");
        if (msg.seat === s.host) return fail("the host keeps their own seat");
        target.takenOver = msg.bot;
        return done();
      }
      case "action": {
        if (!s.game) return fail("no game in progress");
        if (this.isBotControlled(seat)) return fail("a bot is playing this seat");
        return this.apply(seat, msg.action);
      }
    }
  }

  /** The person who takes over hosting: someone still playing their own seat if possible. */
  private nextHost(): number {
    const seats = this.snap.seats;
    const present = seats.findIndex((x) => x.kind === "human" && !x.takenOver);
    return present !== -1
      ? present
      : Math.max(
          0,
          seats.findIndex((x) => x.kind === "human"),
        );
  }

  private startGame(): GameEvent[] {
    this.snap.game = newGame(this.deckSeed(), this.snap.seats.length, this.snap.settings);
    this.snap.status = "playing";
    this.snap.gameNumber += 1;
    return [{ type: "roundStarted", round: 1 }];
  }

  private apply(actor: number, action: Parameters<typeof applyAction>[2]): Outcome {
    if (!this.snap.game) return { ok: false, error: "no game in progress" };
    const r = applyAction(this.snap.game, actor, action);
    if (!r.ok) return r;
    this.snap.game = r.state;
    return { ok: true, events: r.events };
  }

  /** The bot-controlled seat that should move next, if any. */
  pendingBot(): number | null {
    const g = this.snap.game;
    if (!g) return null;
    if (g.phase === "initialFlip") {
      const seat = g.initialFlips.findIndex((n, i) => n < 2 && this.isBotControlled(i));
      return seat === -1 ? null : seat;
    }
    if (g.phase === "turn" && this.isBotControlled(g.current)) return g.current;
    return null;
  }

  /** Plays one move for the pending bot seat. */
  botStep(): { seat: number; action: NonNullable<ReturnType<typeof chooseAction>>; outcome: Outcome } | null {
    const seat = this.pendingBot();
    const g = this.snap.game;
    if (seat === null || !g) return null;
    const level = this.snap.seats[seat]?.level ?? "normal";
    const action = chooseAction(viewFor(g, seat), level, this.random);
    if (!action) return null;
    return { seat, action, outcome: this.apply(seat, action) };
  }

  view(seat: number, connected: (seat: number) => boolean): RoomView {
    const s = this.snap;
    return {
      code: s.code,
      host: s.host,
      you: seat,
      seats: s.seats.map((x, i) => ({
        name: x.name,
        kind: x.kind,
        level: x.level,
        connected: x.kind === "bot" || connected(i),
        takenOver: x.takenOver,
      })),
      settings: { ...s.settings },
      botSpeed: this.botSpeed,
      status: s.status,
      game: s.game ? viewFor(s.game, seat) : null,
    };
  }
}
