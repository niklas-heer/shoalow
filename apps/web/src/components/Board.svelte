<script lang="ts">
  import type { BoardView } from "@shoalow/game";
  import { cubicOut } from "svelte/easing";
  import { motion } from "../lib/motion.ts";
  import Card from "./Card.svelte";

  let {
    board,
    size = "lg",
    owner,
    selectable = () => false,
    onpick = () => {},
    bursting = [],
    anchor,
  }: {
    board: BoardView;
    size?: "lg" | "sm";
    owner: string;
    selectable?: (index: number) => boolean;
    onpick?: (index: number) => void;
    /** Columns cleared by the latest move, for the bubble burst. */
    bursting?: number[];
    /** Prefix for the cells' flight anchors; only the live table sets it. */
    anchor?: string;
  } = $props();

  function burst(_node: Element) {
    return {
      duration: motion(520),
      easing: cubicOut,
      css: (t: number) =>
        `transform: scale(${1 + (1 - t) * 0.25}) translateY(${(1 - t) * -14}px); opacity: ${t}; filter: blur(${(1 - t) * 3}px)`,
    };
  }

  const position = (i: number) => `row ${Math.floor(i / 4) + 1}, column ${(i % 4) + 1}`;
</script>

<div class="board {size}" role="group" aria-label="{owner} cards">
  {#each board.cards as card, i (i)}
    <div class="cell" data-anchor={anchor ? `${anchor}-${i}` : undefined}>
      {#if card}
        <div class="slot" out:burst>
          <Card
            {size}
            value={card.faceUp ? card.value : null}
            faceUp={card.faceUp}
            selectable={selectable(i)}
            label="{owner}, {position(i)}"
            onclick={() => onpick(i)}
          />
        </div>
      {:else}
        <div class="slot empty" class:bubbles={bursting.includes(i % 4)} aria-hidden="true">
          {#if bursting.includes(i % 4)}
            <span></span><span></span><span></span><span></span>
          {/if}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--gap, 8px);
  }
  .board.sm {
    --gap: 3px;
  }
  .cell {
    position: relative;
    aspect-ratio: 5 / 7;
  }
  .slot {
    position: absolute;
    inset: 0;
  }
  .empty {
    border: 2px dashed rgb(127 216 200 / 0.18);
    border-radius: 9%/6.5%;
  }
  .sm .empty {
    border-width: 1px;
  }
  .bubbles span {
    position: absolute;
    bottom: 10%;
    left: 50%;
    width: 18%;
    aspect-ratio: 1;
    border: 2px solid rgb(243 251 248 / 0.7);
    border-radius: 50%;
    animation: rise 1.4s ease-out forwards;
    opacity: 0;
  }
  .bubbles span:nth-child(2) {
    left: 25%;
    width: 12%;
    animation-delay: 0.15s;
  }
  .bubbles span:nth-child(3) {
    left: 65%;
    width: 14%;
    animation-delay: 0.3s;
  }
  .bubbles span:nth-child(4) {
    left: 40%;
    width: 9%;
    animation-delay: 0.45s;
  }
  @keyframes rise {
    0% {
      transform: translateY(0) scale(0.6);
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    100% {
      transform: translateY(-260%) scale(1.1);
      opacity: 0;
    }
  }
</style>
