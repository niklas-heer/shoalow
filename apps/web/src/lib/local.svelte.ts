import {
  applyAction,
  BOT_SPEED_FACTOR,
  type BotSpeed,
  type ClientMessage,
  chooseAction,
  DEFAULT_BOT_SPEED,
  type GameEvent,
  type GameState,
  newGame,
  type RoomView,
  type SeatView,
  SYSTEM,
  viewFor,
} from "@shoalow/game";
import type { TableLink } from "./connection.svelte.ts";

const BOT_DELAY_MS = 1400;

/**
 * A practice table that runs entirely in the browser: the same rules engine and bots as
 * the server, one human seat, no network. Used by the tutorial.
 */
export class LocalTable implements TableLink {
  room = $state<RoomView | null>(null);
  events = $state<{ seq: number; list: GameEvent[] }>({ seq: 0, list: [] });
  error = $state<string | null>(null);

  private state: GameState;
  private botSpeed: BotSpeed = DEFAULT_BOT_SPEED;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly seats: SeatView[];

  constructor(
    playerName: string,
    private readonly seed: number,
    private readonly targetScore = 50,
  ) {
    this.seats = [
      { name: playerName, kind: "human", level: null, connected: true, takenOver: false },
      { name: "🤖 Kelp", kind: "bot", level: "easy", connected: true, takenOver: false },
    ];
    this.state = newGame(seed, this.seats.length, { targetScore });
    this.publish([{ type: "roundStarted", round: 1 }]);
  }

  send(msg: ClientMessage): void {
    switch (msg.t) {
      case "action":
        this.apply(0, msg.action);
        return;
      case "nextRound":
        if (this.state.phase === "roundOver") this.apply(SYSTEM, { type: "nextRound" });
        return;
      case "playAgain":
        if (this.state.phase !== "gameOver") return;
        this.state = newGame(this.seed + 1, this.seats.length, { targetScore: this.targetScore });
        this.publish([{ type: "roundStarted", round: 1 }]);
        return;
      case "setBotSpeed":
        this.botSpeed = msg.speed;
        this.publish([]);
        return;
      default:
        return;
    }
  }

  private apply(actor: number, action: Parameters<typeof applyAction>[2]): void {
    const r = applyAction(this.state, actor, action);
    if (!r.ok) {
      this.error = r.error.charAt(0).toUpperCase() + r.error.slice(1);
      return;
    }
    this.error = null;
    this.state = r.state;
    this.publish(r.events);
  }

  private publish(events: GameEvent[]): void {
    this.room = {
      code: "Practice",
      host: 0,
      you: 0,
      seats: this.seats.map((s) => ({ ...s })),
      settings: { ...this.state.settings },
      botSpeed: this.botSpeed,
      status: "playing",
      game: viewFor(this.state, 0),
    };
    this.events = { seq: this.events.seq + 1, list: events };
    this.scheduleBot();
  }

  private scheduleBot(): void {
    clearTimeout(this.timer);
    const g = this.state;
    const botSeat = 1;
    const pending =
      (g.phase === "initialFlip" && (g.initialFlips[botSeat] ?? 0) < 2) ||
      (g.phase === "turn" && g.current === botSeat);
    if (!pending) return;
    const delay = BOT_DELAY_MS * BOT_SPEED_FACTOR[this.botSpeed];
    this.timer = setTimeout(
      () => {
        const action = chooseAction(viewFor(this.state, botSeat), "easy", Math.random);
        if (action) this.apply(botSeat, action);
      },
      g.phase === "initialFlip" ? delay / 2 : delay,
    );
  }

  close(): void {
    clearTimeout(this.timer);
  }
}
