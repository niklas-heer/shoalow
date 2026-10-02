const NAME_KEY = "shoalow:name";
const PLAYER_KEY = "shoalow:player";
const seatKey = (code: string) => `shoalow:seat:${code.toUpperCase()}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or full storage: the seat only lasts for this page.
  }
}

export const savedName = (): string => read(NAME_KEY) ?? "";

/**
 * A random ID this browser keeps so the public statistics count it once. It is created on
 * first use and says nothing about the person.
 */
export function playerId(): string {
  const known = read(PLAYER_KEY);
  if (known) return known;
  const id = crypto.randomUUID();
  write(PLAYER_KEY, id);
  return id;
}
export const saveName = (name: string): void => write(NAME_KEY, name);
export const seatToken = (code: string): string | null => read(seatKey(code));
export const saveSeat = (code: string, token: string): void => write(seatKey(code), token);
export const forgetSeat = (code: string): void => write(seatKey(code), null);
