<script lang="ts">
  import type { GameView } from "@shoalow/game";
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
  } = $props();
</script>

<div class="piles">
  <figure class="pile">
    <div class="stack" class:thin={game.drawCount < 3} data-anchor="deck">
      <Card faceUp={false} selectable={canDraw} label="Draw pile, {game.drawCount} cards" onclick={ondraw} />
    </div>
    <figcaption>{canDraw ? "Draw" : `${game.drawCount} left`}</figcaption>
  </figure>

  <figure class="pile">
    <div class="spot" data-anchor="discard">
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
    </div>
    <figcaption>{canDrop ? "Drop here" : canTake ? "Take" : "Discard"}</figcaption>
  </figure>

  <figure class="pile hand" aria-live="polite">
    <div class="spot" data-anchor="hand">
      {#if game.hand !== null}
        <div class="held"><Card value={game.hand} label="{holder} holding" /></div>
      {/if}
    </div>
    <figcaption>{#if game.hand !== null}{holder === "You" ? "You hold" : `${holder} holds`}{/if}</figcaption>
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
    gap: 0.35rem;
    margin: 0;
    text-align: center;
  }
  figcaption {
    color: var(--mist);
    font-size: 0.9rem;
    font-weight: 600;
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
  }
  .spot {
    aspect-ratio: 5 / 7;
  }
  .held {
    transform: rotate(4deg);
    filter: drop-shadow(0 10px 14px rgb(0 0 0 / 0.4));
  }
</style>
