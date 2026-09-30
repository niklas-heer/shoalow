<script lang="ts">
  import { BAND_COLORS, band, CREATURES, formatValue } from "../lib/cards.ts";
  import CardBack from "./CardBack.svelte";
  import Creature from "./Creature.svelte";

  let {
    value = null,
    faceUp = true,
    size = "lg",
    selectable = false,
    label = "",
    action = "",
    onclick,
  }: {
    value?: number | null;
    faceUp?: boolean;
    size?: "lg" | "sm";
    selectable?: boolean;
    label?: string;
    action?: string;
    onclick?: (() => void) | undefined;
  } = $props();

  const up = $derived(faceUp && value !== null);
  const colors = $derived(value === null ? null : BAND_COLORS[band(value)]);
  const description = $derived(up && value !== null ? `${formatValue(value)}, ${CREATURES[value]}` : "face down");
  /** 6 and 9 get a bar underneath, as on real cards, so they can't be mixed up. */
  const marked = $derived(value === 6 || value === 9);
</script>

<svelte:element
  this={onclick ? "button" : "div"}
  class="card {size}"
  class:down={!up}
  class:selectable
  style:--card-fill={colors?.fill}
  style:--card-ink={colors?.ink}
  role={onclick ? undefined : "img"}
  aria-label={`${action ? `${action}. ` : ""}${label ? `${label}: ` : ""}${description}`}
  onclick={selectable ? onclick : undefined}
  type={onclick ? "button" : undefined}
  disabled={onclick ? !selectable : undefined}
>
  <div class="flipper">
    <div class="face front">
      {#if up && value !== null && colors}
          <svg viewBox="0 0 100 140" aria-hidden="true">
            {#if size === "lg"}
              <!-- No clip paths or ids here: flying cards are DOM copies, and copied ids would clash. -->
              <rect width="100" height="140" rx="11" fill={colors.fill} />
              <path d="M11 2 H89 A9 9 0 0 1 98 11 V54 Q45 35 2 65 V11 A9 9 0 0 1 11 2Z" fill="#fffdf7" opacity="0.14" />
              <ellipse cx="50" cy="73" rx="37" ry="38" fill="#fffdf7" opacity="0.16" />
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
              <g transform="translate(6 24) scale(0.88)"><Creature {value} /></g>
              <text class="species" x="50" y="108" fill={colors.ink}>{CREATURES[value]}</text>
            {:else}
              <rect width="100" height="140" rx="12" fill={colors.fill} />
              <text class="big" x="50" y="74" fill={colors.ink}>{formatValue(value)}</text>
              {#if marked}<rect x="36" y="106" width="28" height="6" rx="3" fill={colors.ink} />{/if}
            {/if}
          </svg>
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
    min-width: 0;
    flex: none;
    padding: 0;
    border: 0;
    background: none;
    perspective: 600px;
    border-radius: 9%/6.5%;
    color: inherit;
    font: inherit;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .flipper {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    transition: transform var(--flip-ms, 320ms) cubic-bezier(0.3, 0.7, 0.3, 1);
  }
  .down .flipper {
    transform: rotateY(180deg);
  }
  /* WebKit (Safari on iPhone and iPad) can draw a back face despite backface-visibility, so the
     hidden face also switches off at the halfway point of the flip, when the card is edge-on. */
  .face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    border-radius: inherit;
    transition: visibility 0s linear calc(var(--flip-ms, 320ms) / 2);
  }
  .card:not(.down) .back,
  .down .front {
    visibility: hidden;
  }
  .lg .face {
    box-shadow: 0 3px 0 rgb(3 16 26 / 0.35);
  }
  .face > :global(svg) {
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
  .species { font-size: 6.3px; font-weight: 750; letter-spacing: 0.09em; text-anchor: middle; text-transform: uppercase; }
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
      0 0 12px rgb(255 226 122 / 0.18);
    transition: box-shadow 140ms;
  }
  .selectable:hover,
  .selectable:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 3px var(--lantern),
      0 0 16px 2px rgb(255 226 122 / 0.3);
  }
  /* Everything you can play right now breathes slowly. Only the glow's opacity changes, so the
     pulse stays cheap with a whole grid of playable cards. */
  .selectable::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: 0 0 18px 4px rgb(255 226 122 / 0.45);
    opacity: 0;
    pointer-events: none;
    animation: pulse 1.8s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flipper,
    .face {
      transition: none;
    }
    .selectable::after {
      animation: none;
      opacity: 0.5;
    }
  }
</style>
