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
    <rect x="10" y="10" width="80" height="120" rx="5" fill="none" stroke="#7fd8c8" stroke-width="0.6" opacity="0.25" />
    <path d="M50 32 Q66 52 80 70 Q64 90 50 108 Q34 88 20 70 Q36 50 50 32Z" fill="#0c3348" stroke="#7fd8c8" stroke-width="1" />
    <circle cx="50" cy="70" r="20" fill="none" stroke="#7fd8c8" stroke-width="0.7" opacity="0.5" />
    <path d="M32 71 Q36 51 50 51 Q64 51 68 71 Q59 85 50 89 Q41 85 32 71Z" fill="#7fd8c8" opacity="0.85" />
    <path d="M50 55 V84 M42 57 L46 83 M58 57 L54 83 M35 64 L43 80 M65 64 L57 80" fill="none" stroke="#114660" stroke-width="1.4" />
    <circle cx="50" cy="71" r="6.5" fill="#fff5dd" />
    <circle cx="48" cy="69" r="2" fill="#ffffff" />
    <path d="M47 21 H53 M50 18 V24 M47 119 H53 M50 116 V122" stroke="#ffe27a" stroke-width="1.4" stroke-linecap="round" />
  {:else}
    <!-- small boards stay quiet so the face-up values stand out -->
    <rect width="100" height="140" rx="12" fill="#134b64" />
    <rect x="6" y="6" width="88" height="128" rx="8" fill="none" stroke="#7fd8c8" stroke-width="4" opacity="0.28" />
  {/if}
</svg>
