import type { GameEvent } from "@shoalow/game";
import { motion } from "./motion.ts";

/**
 * Card movement between the piles, the hand and the grids. Every place a card can be has a
 * `data-anchor` attribute. By the time events arrive the DOM already shows the new state, so
 * each flight copies the card at its destination, hides the original, and flies the copy in
 * from where the card came from.
 */

const DURATION = 300;
const hidden = new Map<Element, number>();

const anchor = (name: string): HTMLElement | null => document.querySelector(`[data-anchor="${name}"]`);

function hide(el: HTMLElement): () => void {
  hidden.set(el, (hidden.get(el) ?? 0) + 1);
  el.style.visibility = "hidden";
  return () => {
    const n = (hidden.get(el) ?? 1) - 1;
    if (n > 0) hidden.set(el, n);
    else {
      hidden.delete(el);
      el.style.visibility = "";
    }
  };
}

function fly(fromName: string, toName: string, opts: { delay?: number; flipIn?: boolean } = {}): void {
  const from = anchor(fromName);
  const to = anchor(toName);
  const card = to?.querySelector<HTMLElement>(".card");
  if (!from || !to || !card) return;
  const a = from.getBoundingClientRect();
  const b = card.getBoundingClientRect();
  if (!a.width || !b.width) return;

  const ghost = card.cloneNode(true) as HTMLElement;
  ghost.classList.remove("selectable");
  ghost.classList.add("ghost");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${b.left}px`,
    top: `${b.top}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
    margin: "0",
    zIndex: "60",
    pointerEvents: "none",
    transformOrigin: "0 0",
  });
  if (opts.flipIn) ghost.classList.add("down");
  const show = hide(to);
  document.body.append(ghost);

  const dx = a.left - b.left;
  const dy = a.top - b.top;
  // Keep the destination card's size throughout the move: no zoom or overshoot.
  const animation = ghost.animate(
    [
      { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.85 },
      { transform: "none", opacity: 1 },
    ],
    { duration: DURATION, delay: opts.delay ?? 0, easing: "cubic-bezier(0.3, 0.6, 0.25, 1)", fill: "backwards" },
  );
  if (opts.flipIn) setTimeout(() => ghost.classList.remove("down"), (opts.delay ?? 0) + DURATION * 0.2);
  const done = () => {
    ghost.remove();
    show();
  };
  animation.onfinish = done;
  animation.oncancel = done;
}

/** Animates one update's events. `slot` names a grid position's anchor. */
export function playFlights(events: GameEvent[]): void {
  if (motion(1) === 0) return;
  const slot = (player: number, index: number) => `slot-${player}-${index}`;
  let delay = 0;
  for (const e of events) {
    switch (e.type) {
      case "drew":
        fly(e.source === "deck" ? "deck" : "discard", "hand", { flipIn: e.source === "deck" });
        break;
      case "swapped":
        fly("hand", slot(e.player, e.index), { delay });
        fly(slot(e.player, e.index), "discard", { delay: delay + 90 });
        delay += 90;
        break;
      case "discarded":
        fly("hand", "discard", { delay });
        break;
    }
  }
}
