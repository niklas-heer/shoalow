import type { CreateRoomResponse } from "@shoalow/game";

export class ApiError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "Content-Type": "application/json" } });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(body.error ? capitalize(body.error) : `The server answered ${res.status}.`);
  return body;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const createRoom = (name: string, targetScore = 100) =>
  call<CreateRoomResponse>("/api/rooms", { method: "POST", body: JSON.stringify({ name, targetScore }) });

export const joinRoom = (code: string, name: string) =>
  call<CreateRoomResponse>(`/api/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ name }) });

export interface RoomInfo {
  code: string;
  status: "lobby" | "playing";
  players: number;
  seated?: boolean;
}

export const roomInfo = (code: string, token?: string) =>
  call<RoomInfo>(`/api/rooms/${code}${token ? `?token=${encodeURIComponent(token)}` : ""}`);
