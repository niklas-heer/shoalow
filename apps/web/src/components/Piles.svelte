<script lang="ts">
  import type { GameView } from "@shoalow/game";
  import { hovering } from "../lib/hover.ts";
  import Card from "./Card.svelte";

  let {
    game,
    holder,
    canDraw,
    canTake,
    canDrop,
    ondraw,
    ontake,
    ondrop,
    outgoing = null,
  }: {
    game: GameView;
    /** Who is holding the drawn card, for the caption. */
    holder: string;
    canDraw: boolean;
    canTake: boolean;
    canDrop: boolean;
    ondraw: () => void;
    ontake: () => void;
    ondrop: () => void;
    /** The card a previewed swap would put on the discard pile; `value` is `null` when face down. */
    outgoing?: { value: number | null } | null;
  } = $props();

  // With a mouse or keyboard, pointing at a pile previews where its card would go.
  let hover = $state<"deck" | "discard" | null>(null);
  const on = (pile: "deck" | "discard") => hovering((over) => (hover = over ? pile : null));

  const handGhost = $derived(
    hover === "deck" && canDraw
      ? { value: null }
      : hover === "discard" && canTake && game.discardTop !== null
        ? { value: game.discardTop }
        : null,
  );
  const discardGhost = $derived(hover === "discard" && canDrop && game.hand !== null ? { value: game.hand } : outgoing);
</script>

{#snippet ghost(card: { value: number | null })}
  <div class="preview" aria-hidden="true"><Card value={card.value} faceUp={card.value !== null} /></div>
{/snippet}

<div class="piles">
  <figure class="pile">
    <div
      class="stack"
      class:thin={game.drawCount < 3}
      data-anchor="deck"
      {@attach on("deck")}
    >
      <Card faceUp={false} selectable={canDraw} label="Draw pile, {game.drawCount} cards" onclick={ondraw} />
    </div>
    <figcaption><em>Pile</em><strong>{canDraw ? "Draw a card" : "Draw pile"}</strong><span>{game.drawCount} left · face down</span></figcaption>
  </figure>

  <figure class="pile">
    <div
      class="spot"
      data-anchor="discard"
      {@attach on("discard")}
    >
    {#if game.discardTop !== null}
      <Card
        value={game.discardTop}
        selectable={canTake || canDrop}
        label={canDrop ? "Discard pile, drop your card here" : "Discard pile"}
        onclick={canDrop ? ondrop : ontake}
      />
    {:else}
      <button class="empty" class:drop={canDrop} disabled={!canDrop} onclick={ondrop} aria-label="Discard pile, empty"
      ></button>
    {/if}
    {#if discardGhost}{@render ghost(discardGhost)}{/if}
    </div>
    <figcaption><em>Discard</em><strong>{canDrop ? "Discard here" : canTake ? "Take this card" : "Discard pile"}</strong><span>{canDrop ? "Then reveal a card" : "Face up"}</span></figcaption>
  </figure>

  <figure class="pile hand" aria-live="polite">
    <div class="spot" data-anchor="hand">
      {#if game.hand !== null}
        <div class="held" class:yours={holder === "You"}><Card value={game.hand} label="{holder} holding" /></div>
      {:else}
        <div class="hand-empty" aria-hidden="true"><span>Drawn<br />card</span></div>
      {/if}
      {#if handGhost}{@render ghost(handGhost)}{/if}
    </div>
    <figcaption><em>In hand</em><strong>{game.hand !== null ? holder === "You" ? "Your drawn card" : `${holder} holds` : "Your next card"}</strong><span>{game.hand !== null ? "Choose where it goes" : "Draw or take to begin"}</span></figcaption>
  </figure>
</div>

<style>
  .piles {
    display: grid;
    grid-template-columns: repeat(3, var(--pile-w, 5.2rem));
    justify-content: center;
    gap: 1rem;
  }
  .pile {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    text-align: center;
  }
  /* Small screens show one word under each pile; the prompt above says what to do. */
  figcaption {
    color: var(--mist);
    font-size: 0.78rem;
    font-weight: 650;
  }
  figcaption em {
    font-style: normal;
  }
  figcaption strong,
  figcaption span {
    display: none;
  }
  @media (min-width: 700px) and (min-height: 501px) {
    .pile {
      grid-template-rows: auto 4.6rem;
      gap: 0.35rem;
    }
    figcaption {
      display: grid;
      align-content: start;
      gap: 0.15rem;
      font-size: clamp(0.9rem, 1.1vw, 1.05rem);
      font-weight: 600;
    }
    figcaption em {
      display: none;
    }
    figcaption strong {
      display: block;
      color: var(--foam);
      font-weight: 700;
    }
    figcaption span {
      display: block;
      font-size: 0.8rem;
    }
  }
  .stack {
    position: relative;
    filter: drop-shadow(3px 3px 0 #0c3448) drop-shadow(3px 3px 0 #0a2d3e);
  }
  .stack.thin {
    filter: none;
  }
  .empty {
    display: block;
    width: 100%;
    aspect-ratio: 5 / 7;
    border: 2px dashed rgb(127 216 200 / 0.3);
    border-radius: 9%/6.5%;
    background: none;
  }
  .empty.drop {
    border-color: var(--lantern);
    cursor: pointer;
    animation: pulse 1.8s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      box-shadow: 0 0 18px 4px rgb(255 226 122 / 0.45);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .empty.drop {
      animation: none;
      box-shadow: 0 0 18px 4px rgb(255 226 122 / 0.22);
    }
  }
  /* The card that would land here, hovering just above the pile like the grid's preview. */
  .preview {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    opacity: 0.92;
    transform: translateY(-12%) rotate(2deg);
    filter: drop-shadow(0 8px 10px rgb(0 0 0 / 0.45));
  }
  .spot {
    position: relative;
    aspect-ratio: 5 / 7;
    width: 100%;
  }
  .hand-empty { position: absolute; inset: 0; display: grid; place-items: center; border: 1px dashed rgb(127 216 200 / 0.22); border-radius: 9%/6.5%; color: var(--mist); font-size: clamp(0.7rem, 22cqw, 0.95rem); }
  .spot { container-type: inline-size; }
  .held {
    position: absolute;
    inset: 0;
    filter: drop-shadow(0 10px 14px rgb(0 0 0 / 0.4));
  }
  /* Your own drawn card glows like the places it can go, without their ring: it is not a target. */
  .held.yours {
    filter: drop-shadow(0 10px 14px rgb(0 0 0 / 0.4)) drop-shadow(0 0 10px rgb(255 226 122 / 0.45));
  }
</style>
