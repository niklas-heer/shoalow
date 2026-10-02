import type { BotLevel } from "./bots.ts";
import { type Action, type GameEvent, PILE_INFOS, type PileInfo, type Settings } from "./types.ts";
import type { GameView } from "./view.ts";

export const MAX_NAME_LENGTH = 20;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;
/** A table code as the server issues it: five letters and digits that are hard to mix up. */
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
export const MIN_TARGET_SCORE = 10;
export const MAX_TARGET_SCORE = 500;

/** How long bots pause before each move; the host can change it at any time. */
export type BotSpeed = "slow" | "normal" | "fast";
export const BOT_SPEEDS: readonly BotSpeed[] = ["slow", "normal", "fast"];
export const DEFAULT_BOT_SPEED: BotSpeed = "normal";
/** Multiplier on the server's base bot delay for each speed. */
export const BOT_SPEED_FACTOR: Record<BotSpeed, number> = { slow: 1.8, normal: 1, fast: 0.45 };

export interface SeatView {
  name: string;
  kind: "human" | "bot";
  level: BotLevel | null;
  connected: boolean;
  /** A bot is playing this human seat while its owner is away. */
  takenOver: boolean;
}

export interface RoomView {
  code: string;
  host: number;
  you: number;
  seats: SeatView[];
  settings: Settings;
  botSpeed: BotSpeed;
  status: "lobby" | "playing";
  game: GameView | null;
}

export type ClientMessage =
  | { t: "ping" }
  | { t: "action"; action: Action }
  | { t: "addBot"; level: BotLevel }
  | { t: "removeSeat"; seat: number }
  | { t: "setTarget"; score: number }
  | { t: "setBotSpeed"; speed: BotSpeed }
  | { t: "setShowSums"; show: boolean }
  | { t: "setPiles"; piles: PileInfo }
  | { t: "start" }
  | { t: "stopGame" }
  | { t: "nextRound" }
  | { t: "playAgain" }
  | { t: "takeover"; seat: number; bot: boolean }
  | { t: "leave" };

export type ServerMessage =
  | { t: "room"; room: RoomView; events: GameEvent[] }
  | { t: "error"; message: string }
  | { t: "pong" }
  | { t: "removed" };

/** Public numbers about everyone's play, shown on the home page. */
export interface Stats {
  /** When counting began. */
  since: number;
  /** Right now: people connected, tables they sit at, and games in progress there. */
  live: { players: number; tables: number; games: number };
  /** Different players, by anonymous browser ID: ever, and in the last 30 days. */
  players: number;
  playersMonth: number;
  tables: number;
  gamesStarted: number;
  gamesFinished: number;
  rounds: number;
  columnsCleared: number;
  reshuffles: number;
  /** The lowest score anyone has finished a round with, if any round has ended. */
  bestRound: number | null;
  /**
   * How often the draw pile ran out, per table size and deck size: rounds played, rounds that
   * reshuffled, and how far through those rounds (0 to 1) the first reshuffle came on average.
   */
  decks: { players: number; deckSize: number; rounds: number; reshuffled: number; progress: number | null }[];
}

/** An anonymous ID a browser keeps so it is counted once; it identifies nothing else. */
export const PLAYER_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export interface CreateRoomResponse {
  code: string;
  token: string;
}

export type JoinRoomResponse = CreateRoomResponse;

/**
 * Trims and validates a display name; returns null when unusable. Names appear on everyone's
 * screen, so invisible and direction-changing characters are dropped and long runs of
 * combining marks are cut short. The zero-width joiner stays, since emoji sequences need it.
 */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  const name = raw
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/(?!\u200d)[\p{Cf}\p{Co}\p{Cn}\u115f\u1160\u3164\uffa0\u2800]/gu, "")
    .replace(/(\p{M}{3})\p{M}+/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[\p{L}\p{N}\p{S}\p{P}]/u.test(name) || [...name].length > MAX_NAME_LENGTH) return null;
  return name;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isLevel = (v: unknown): v is BotLevel => v === "easy" || v === "normal";
const isSpeed = (v: unknown): v is BotSpeed => BOT_SPEEDS.includes(v as BotSpeed);

function parseAction(raw: unknown): Action | null {
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case "flip":
    case "swap":
      return isInt(raw.index) ? { type: raw.type, index: raw.index } : null;
    case "drawDeck":
    case "takeDiscard":
    case "discardHand":
      return { type: raw.type };
    default:
      return null;
  }
}

/** Validates an untrusted client message. Unknown or malformed input returns null. */
export function parseClientMessage(text: string): ClientMessage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  switch (raw.t) {
    case "ping":
    case "start":
    case "stopGame":
    case "nextRound":
    case "playAgain":
    case "leave":
      return { t: raw.t };
    case "action": {
      const action = parseAction(raw.action);
      return action ? { t: "action", action } : null;
    }
    case "addBot":
      return isLevel(raw.level) ? { t: "addBot", level: raw.level } : null;
    case "removeSeat":
      return isInt(raw.seat) ? { t: "removeSeat", seat: raw.seat } : null;
    case "setTarget":
      return isInt(raw.score) ? { t: "setTarget", score: raw.score } : null;
    case "setBotSpeed":
      return isSpeed(raw.speed) ? { t: "setBotSpeed", speed: raw.speed } : null;
    case "setShowSums":
      return typeof raw.show === "boolean" ? { t: "setShowSums", show: raw.show } : null;
    case "setPiles":
      return PILE_INFOS.includes(raw.piles as PileInfo) ? { t: "setPiles", piles: raw.piles as PileInfo } : null;
    case "takeover":
      return isInt(raw.seat) && typeof raw.bot === "boolean" ? { t: "takeover", seat: raw.seat, bot: raw.bot } : null;
    default:
      return null;
  }
}
