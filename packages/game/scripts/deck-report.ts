/**
 * Compares how often the draw pile runs out in real games with what the deck was tuned for.
 * Reads the live statistics. Usage: mise run deck-report [-- https://shoalow.fly.dev]
 *
 * The bot calibration (`deck-calibration.ts`) found that at 24 cards per player about half of
 * all rounds reshuffle, in their last 10 to 15 percent. Real tables play differently, so this
 * shows whether people see the same.
 */
import type { Stats } from "../src/index.ts";
import { CARDS_PER_PLAYER } from "../src/index.ts";

const base = process.argv[2] ?? "https://shoalow.fly.dev";
/** Rounds needed at one table size before its numbers say much. */
const ENOUGH = 30;
const TARGET = { rate: [0.35, 0.65], progress: 0.75 } as const;

const res = await fetch(new URL("/api/stats", base));
if (!res.ok) throw new Error(`${base} answered ${res.status}`);
const stats = (await res.json()) as Stats;

const pct = (x: number) => `${Math.round(x * 100)}%`;
console.log(`Deck report for ${base}, counted since ${new Date(stats.since).toISOString().slice(0, 10)}`);
console.log(`Tuned for: ${CARDS_PER_PLAYER} cards per player, about half of rounds reshuffling late.\n`);
console.log("players  deck  rounds  reshuffled  first at  verdict");
// Servers from before deck statistics existed send none.
const decks = stats.decks ?? [];
if (decks.length === 0) console.log("(no rounds counted yet)");
for (const d of decks) {
  const rate = d.rounds > 0 ? d.reshuffled / d.rounds : 0;
  let verdict: string;
  if (d.deckSize !== CARDS_PER_PLAYER * d.players) verdict = "older deck size";
  else if (d.rounds < ENOUGH) verdict = `need ${ENOUGH - d.rounds} more rounds`;
  else if (rate > TARGET.rate[1] || (d.progress !== null && d.progress < TARGET.progress))
    verdict = `too often or too early: try ${CARDS_PER_PLAYER + 1} per player`;
  else if (rate < TARGET.rate[0]) verdict = `rarely: try ${CARDS_PER_PLAYER - 1} per player`;
  else verdict = "as tuned";
  console.log(
    `${String(d.players).padStart(7)}  ${String(d.deckSize).padStart(4)}  ${String(d.rounds).padStart(6)}  ${pct(rate).padStart(10)}  ${(d.progress === null ? "-" : pct(d.progress)).padStart(8)}  ${verdict}`,
  );
}
