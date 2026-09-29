import type { ClientMessage, GameEvent, RoomView, ServerMessage } from "@shoalow/game";
import { ApiError, roomInfo } from "./api.ts";

/** What a table screen needs: the current view, the latest events, and a way to act. */
export interface TableLink {
  readonly room: RoomView | null;
  readonly events: { seq: number; list: GameEvent[] };
  send(msg: ClientMessage): void;
}

const PING_MS = 25_000;
const HIDDEN_DISCONNECT_MS = 10 * 60_000;
const MAX_BACKOFF_MS = 8_000;
const WAKE_CHECK_MS = 4_000;

/**
 * One live seat at a table. Reconnects on its own, sends a heartbeat, and lets go of
 * the socket when the tab has been hidden for a while so an idle Fly machine can stop.
 * Phones freeze pages while locked, so coming back checks the line straight away.
 */
export class Connection implements TableLink {
  room = $state<RoomView | null>(null);
  status = $state<"connecting" | "open" | "reconnecting" | "paused">("connecting");
  error = $state<string | null>(null);
  removed = $state(false);
  /** Events from the latest update, with a counter so repeated identical events still register. */
  events = $state<{ seq: number; list: GameEvent[] }>({ seq: 0, list: [] });

  private ws: WebSocket | null = null;
  private ping: ReturnType<typeof setInterval> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private hiddenTimer: ReturnType<typeof setTimeout> | undefined;
  private errorTimer: ReturnType<typeof setTimeout> | undefined;
  private wakeTimer: ReturnType<typeof setTimeout> | undefined;
  private lastHeard = 0;
  private attempts = 0;
  private closed = false;

  constructor(
    readonly code: string,
    readonly token: string,
  ) {
    document.addEventListener("visibilitychange", this.onVisibility);
    addEventListener("pageshow", this.wake);
    addEventListener("online", this.wake);
    this.connect();
  }

  private connect(): void {
    clearTimeout(this.retry);
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${scheme}//${location.host}/ws?room=${this.code}&token=${encodeURIComponent(this.token)}`,
    );
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.status = "open";
      clearInterval(this.ping);
      this.ping = setInterval(() => this.send({ t: "ping" }), PING_MS);
    };
    ws.onmessage = (e) => {
      this.lastHeard = Date.now();
      this.receive(JSON.parse(String(e.data)) as ServerMessage);
    };
    let opened = false;
    ws.addEventListener("open", () => {
      opened = true;
    });
    ws.onclose = async () => {
      clearInterval(this.ping);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closed || this.removed || this.status === "paused") return;
      this.status = "reconnecting";
      if (!opened && (await this.seatIsGone())) {
        this.removed = true;
        return;
      }
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempts++);
      this.retry = setTimeout(() => this.connect(), delay);
    };
  }

  /** A refused connection is either a network problem or a seat that no longer exists. */
  private async seatIsGone(): Promise<boolean> {
    try {
      const info = await roomInfo(this.code, this.token);
      return info.seated === false;
    } catch (e) {
      return e instanceof ApiError && /no room/i.test(e.message);
    }
  }

  private receive(msg: ServerMessage): void {
    switch (msg.t) {
      case "room":
        this.room = msg.room;
        this.events = { seq: this.events.seq + 1, list: msg.events };
        return;
      case "error":
        this.showError(msg.message);
        return;
      case "removed":
        this.removed = true;
        this.close();
        return;
      case "pong":
        return;
    }
  }

  private showError(message: string): void {
    this.error = message.charAt(0).toUpperCase() + message.slice(1);
    clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => {
      this.error = null;
    }, 4000);
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else if (msg.t !== "ping") this.showError("Not connected yet. Your move was not sent.");
  }

  private onVisibility = (): void => {
    clearTimeout(this.hiddenTimer);
    if (document.hidden) {
      this.hiddenTimer = setTimeout(() => {
        this.status = "paused";
        this.ws?.close(1000, "tab hidden");
      }, HIDDEN_DISCONNECT_MS);
    } else {
      this.wake();
    }
  };

  /**
   * Back from a locked phone, a background tab or a lost network. A socket can still look
   * open after the server dropped it, so an open one must answer a ping in a few seconds.
   */
  private wake = (): void => {
    if (this.closed || this.removed) return;
    const ws = this.ws;
    if (ws?.readyState === WebSocket.CONNECTING) return;
    if (ws?.readyState !== WebSocket.OPEN) {
      this.reconnectNow();
      return;
    }
    const asked = Date.now();
    ws.send(JSON.stringify({ t: "ping" } satisfies ClientMessage));
    clearTimeout(this.wakeTimer);
    this.wakeTimer = setTimeout(() => {
      if (this.ws === ws && this.lastHeard < asked) this.reconnectNow();
    }, WAKE_CHECK_MS);
  };

  /** Drops the current socket, if any, and connects again without waiting for a backoff. */
  private reconnectNow(): void {
    const old = this.ws;
    this.ws = null;
    if (old) {
      // Its close event would arrive after the new socket opens and stop the new heartbeat.
      old.onclose = null;
      old.onmessage = null;
      old.close();
    }
    clearInterval(this.ping);
    this.attempts = 0;
    this.status = this.status === "paused" || !this.room ? "connecting" : "reconnecting";
    this.connect();
  }

  close(): void {
    this.closed = true;
    clearInterval(this.ping);
    clearTimeout(this.retry);
    clearTimeout(this.hiddenTimer);
    clearTimeout(this.wakeTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    removeEventListener("pageshow", this.wake);
    removeEventListener("online", this.wake);
    this.ws?.close(1000, "bye");
    this.ws = null;
  }
}
