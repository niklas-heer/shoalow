<script lang="ts">
  import { scale } from "svelte/transition";
  import { BAND_COLORS, band, CREATURES, formatValue } from "../lib/cards.ts";
  import { motion } from "../lib/motion.ts";
  import CardBack from "./CardBack.svelte";
  import Creature from "./Creature.svelte";

  let {
    value = null,
    faceUp = true,
    size = "lg",
    selectable = false,
    label = "",
    onclick,
  }: {
    value?: number | null;
    faceUp?: boolean;
    size?: "lg" | "sm";
    selectable?: boolean;
    label?: string;
    onclick?: () => void;
  } = $props();

  const up = $derived(faceUp && value !== null);
  const colors = $derived(value === null ? null : BAND_COLORS[band(value)]);
  const description = $derived(up && value !== null ? `${formatValue(value)}, ${CREATURES[value]}` : "face down");
</script>

<svelte:element
  this={selectable ? "button" : "div"}
  class="card {size}"
  class:down={!up}
  class:selectable
  role={selectable ? undefined : "img"}
  aria-label={label ? `${label}: ${description}` : description}
  onclick={selectable ? onclick : undefined}
  type={selectable ? "button" : undefined}
>
  <div class="flipper">
    <div class="face front">
      {#if up && value !== null && colors}
        {#key value}
          <svg
            viewBox="0 0 100 140"
            style:--card-fill={colors.fill}
            style:--card-ink={colors.ink}
            in:scale={{ start: 0.82, duration: motion(260) }}
          >
            <rect width="100" height="140" rx="11" fill={colors.fill} />
            {#if size === "lg"}
              <text class="corner" x="9" y="25" fill={colors.ink}>{formatValue(value)}</text>
              <text class="corner end" x="91" y="131" fill={colors.ink}>{formatValue(value)}</text>
              <g transform="translate(0 22)"><Creature {value} /></g>
            {:else}
              <g transform="translate(20 62) scale(0.6)" opacity="0.5"><Creature {value} /></g>
              <text class="big" x="50" y="52" fill={colors.ink}>{formatValue(value)}</text>
            {/if}
          </svg>
        {/key}
      {/if}
    </div>
    <div class="face back"><CardBack {size} /></div>
  </div>
</svelte:element>

<style>
  .card {
    position: relative;
    display: block;
    aspect-ratio: 5 / 7;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    perspective: 600px;
    border-radius: 9%/6.5%;
    color: inherit;
    font: inherit;
  }
  .flipper {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    transition: transform var(--flip-ms, 420ms) cubic-bezier(0.3, 0.7, 0.3, 1);
  }
  .down .flipper {
    transform: rotateY(180deg);
  }
  .face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    border-radius: inherit;
  }
  .face :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .back {
    transform: rotateY(180deg);
  }
  .corner {
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  .end {
    text-anchor: end;
  }
  .big {
    font-size: 58px;
    font-weight: 800;
    letter-spacing: -0.05em;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  .selectable {
    cursor: pointer;
    border-radius: 9%/6.5%;
    box-shadow:
      0 0 0 2px var(--lantern),
      0 0 18px 2px rgb(255 226 122 / 0.45);
    animation: lure 1.8s ease-in-out infinite;
  }
  .selectable:hover,
  .selectable:focus-visible {
    transform: translateY(-3px);
    outline: none;
    box-shadow:
      0 0 0 3px var(--lantern),
      0 0 26px 6px rgb(255 226 122 / 0.6);
  }
  @keyframes lure {
    50% {
      box-shadow:
        0 0 0 2px var(--lantern),
        0 0 8px 0 rgb(255 226 122 / 0.25);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flipper {
      transition: none;
    }
    .selectable {
      animation: none;
    }
  }
</style>
