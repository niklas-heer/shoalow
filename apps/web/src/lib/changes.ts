import { savedName } from "./session.ts";

/**
 * What changed, for players: one entry per day something noticeable shipped, newest first.
 * Write for someone who plays, not for someone who reads the code. Add an entry with every
 * change a player could notice; a test keeps the list in order.
 */
export interface Release {
  /** `YYYY-MM-DD`. */
  date: string;
  title: string;
  notes: string[];
}

export const CHANGES: readonly Release[] = [
  {
    date: "2026-10-02",
    title: "House rules, a fairer deck and statistics",
    notes: [
      "The host can hide running sums in the lobby, so counting your face-up cards becomes part of the game. Round scores and totals still appear after each round.",
      "The host also decides what the piles show: only the top cards, as at a real table; how many cards each pile holds; or that and every card in the discard pile.",
      "The deck now grows with the table, 24 cards per player. The draw pile runs out late in about half of all rounds, whether you are two or ten.",
      "When the discards are shuffled into a new draw pile, the pile is marked “New pile”.",
      "Shuffling is now cryptographically secure, so nobody can work out the face-down cards from the ones on the table.",
      "The home page shows who is playing right now and how many players, games and rounds there have been.",
      "The server is better protected against floods and abuse, and you can now see what changed right here.",
    ],
  },
  {
    date: "2026-09-30",
    title: "A livelier table",
    notes: [
      "The places you can play gently pulse, and pointing at a card with a mouse previews your move.",
      "Above your cards, the steps of each turn show what to do next.",
      "A finished game ends with confetti and a trophy for the winner.",
    ],
  },
  {
    date: "2026-09-29",
    title: "Shoalow opens",
    notes: [
      "Play with 2 to 10 people and bots in the browser, with nothing to install.",
      "A practice game with a coach teaches you the rules against an easy bot.",
      "Fifteen sculpted paper-cut sea creatures, all in the card gallery.",
      "The whole table fits on one screen on iPhone, iPad and Android, and you can add Shoalow to your home screen.",
      "Your seat survives a refresh, a locked phone or a dropped connection, and the host can stop or restart a game.",
    ],
  },
];

const SEEN_KEY = "shoalow:changes-seen";

function seenDate(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Whether there are notes this browser has not seen. Someone who has never played here has
 * nothing to catch up on, so they start with everything marked as seen.
 */
export function hasUnseenChanges(): boolean {
  const latest = CHANGES[0]?.date;
  if (!latest) return false;
  const seen = seenDate();
  if (seen === null && !savedName()) {
    markChangesSeen();
    return false;
  }
  return seen === null || seen < latest;
}

export function markChangesSeen(): void {
  const latest = CHANGES[0]?.date;
  if (!latest) return;
  try {
    localStorage.setItem(SEEN_KEY, latest);
  } catch {
    // Private mode: the marker simply shows again next time.
  }
}
