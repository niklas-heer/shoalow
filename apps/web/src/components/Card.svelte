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
  /** 6 and 9 get a bar underneath, as on real cards, so they can't be mixed up. */
  const marked = $derived(value === 6 || value === 9);
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
          <svg viewBox="0 0 100 140" in:scale={{ start: 0.82, duration: motion(260) }}>
            {#if size === "lg"}
              <!-- No clip paths or ids here: flying cards are DOM copies, and copied ids would clash. -->
              <rect width="100" height="140" rx="11" fill={colors.fill} />
              <!-- a low swell of water along the bottom edge -->
              <path
                d="M0 120 C 18 112 32 128 52 120 S 86 110 100 118 V129 A11 11 0 0 1 89 140 H11 A11 11 0 0 1 0 129 Z"
                fill={colors.ink}
                opacity="0.1"
              />
              <circle cx="84" cy="20" r="3" fill="none" stroke={colors.ink} stroke-width="1.4" opacity="0.18" />
              <circle cx="78" cy="30" r="1.8" fill="none" stroke={colors.ink} stroke-width="1.2" opacity="0.18" />
              <rect x="4" y="4" width="92" height="132" rx="8" fill="none" stroke={colors.ink} stroke-width="1.4" opacity="0.2" />
              <text class="corner" x="10" y="28" fill={colors.ink}>{formatValue(value)}</text>
              <text class="corner end" x="90" y="129" fill={colors.ink}>{formatValue(value)}</text>
              {#if marked}
                <rect x="10" y="32" width="13" height="2.6" rx="1.3" fill={colors.ink} />
                <rect x="77" y="133" width="13" height="2.6" rx="1.3" fill={colors.ink} />
              {/if}
              <g transform="translate(0 22)"><Creature {value} /></g>
            {:else}
              <rect width="100" height="140" rx="12" fill={colors.fill} />
              <text class="big" x="50" y="74" fill={colors.ink}>{formatValue(value)}</text>
              {#if marked}<rect x="36" y="106" width="28" height="6" rx="3" fill={colors.ink} />{/if}
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
  .lg .face {
    box-shadow: 0 3px 0 rgb(3 16 26 / 0.35);
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
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  .end {
    text-anchor: end;
  }
  .big {
    font-size: 64px;
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
    transition: transform 140ms;
  }
  .selectable:hover,
  .selectable:focus-visible {
    transform: translateY(-4px);
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
