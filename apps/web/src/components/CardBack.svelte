<script lang="ts">
  let { size = "lg" }: { size?: "lg" | "sm" } = $props();
  // Rows of overlapping scales, like the side of a fish.
  const scales: { x: number; y: number }[] = [];
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 7; col++) scales.push({ x: col * 16 + (row % 2 ? 8 : 0), y: row * 13 + 4 });
  }
</script>

<svg viewBox="0 0 100 140" aria-hidden="true">
  {#if size === "lg"}
    <rect width="100" height="140" rx="11" fill="#114660" />
    <!-- A nested viewport clips the scales without ids, which flying copies of cards would duplicate. -->
    <svg x="5" y="5" width="90" height="130" viewBox="5 5 90 130" overflow="hidden">
      <g fill="none" stroke="#18597a" stroke-width="1.5">
        {#each scales as s}
          <path d="M{s.x - 8} {s.y} a 8 8 0 0 0 16 0" />
        {/each}
      </g>
    </svg>
    <rect x="5" y="5" width="90" height="130" rx="8" fill="none" stroke="#7fd8c8" stroke-width="1.6" opacity="0.45" />
    <circle cx="50" cy="70" r="13" fill="#0c3348" stroke="#7fd8c8" stroke-width="1.6" opacity="0.9" />
    <circle cx="50" cy="70" r="4.5" fill="#ffe27a" opacity="0.75" />
  {:else}
    <!-- small boards stay quiet so the face-up values stand out -->
    <rect width="100" height="140" rx="12" fill="#134b64" />
    <rect x="6" y="6" width="88" height="128" rx="8" fill="none" stroke="#7fd8c8" stroke-width="4" opacity="0.28" />
  {/if}
</svg>
