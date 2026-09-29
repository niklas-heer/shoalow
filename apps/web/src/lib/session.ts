const NAME_KEY = "shoalow:name";
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
export const saveName = (name: string): void => write(NAME_KEY, name);
export const seatToken = (code: string): string | null => read(seatKey(code));
export const saveSeat = (code: string, token: string): void => write(seatKey(code), token);
export const forgetSeat = (code: string): void => write(seatKey(code), null);
