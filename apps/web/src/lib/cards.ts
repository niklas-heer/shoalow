export type Band = "pearl" | "sand" | "glass" | "amber" | "coral";

/** Value bands and their card colours; our own palette, not the original game's. */
export const BAND_COLORS: Record<Band, { fill: string; ink: string }> = {
  pearl: { fill: "#d9c8f0", ink: "#1f1840" },
  sand: { fill: "#ecd9a8", ink: "#3a2a0c" },
  glass: { fill: "#7fd8c8", ink: "#0c3530" },
  amber: { fill: "#f0b44c", ink: "#3d2503" },
  coral: { fill: "#e2574c", ink: "#3a0b08" },
};

export function band(value: number): Band {
  if (value < 0) return "pearl";
  if (value === 0) return "sand";
  if (value <= 4) return "glass";
  if (value <= 8) return "amber";
  return "coral";
}

export const CREATURES: Record<number, string> = {
  [-2]: "pearl clam",
  [-1]: "conch",
  0: "starfish",
  1: "krill",
  2: "shrimp",
  3: "seahorse",
  4: "jellyfish",
  5: "octopus",
  6: "sea turtle",
  7: "crab",
  8: "pufferfish",
  9: "lionfish",
  10: "moray eel",
  11: "shark",
  12: "anglerfish",
};

export const formatValue = (v: number): string => (v < 0 ? `−${-v}` : String(v));
