<script lang="ts">
  let { size = "lg" }: { size?: "lg" | "sm" } = $props();
  const uid = $props.id();
  const clip = `back-${uid}`;

  // Rows of overlapping scales, like the side of a fish.
  const scales: { x: number; y: number }[] = [];
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 7; col++) scales.push({ x: col * 16 + (row % 2 ? 8 : 0), y: row * 13 + 4 });
  }
</script>

<svg viewBox="0 0 100 140" aria-hidden="true">
  <defs>
    <clipPath id={clip}><rect width="100" height="140" rx="11" /></clipPath>
  </defs>
  <rect width="100" height="140" rx="11" fill="#124a63" />
  {#if size === "lg"}
    <g fill="none" stroke="#1d6480" stroke-width="1.6" clip-path="url(#{clip})">
      {#each scales as s}
        <path d="M{s.x - 8} {s.y} a 8 8 0 0 0 16 0" />
      {/each}
    </g>
  {/if}
  <rect x="5" y="5" width="90" height="130" rx="8" fill="none" stroke="#7fd8c8" stroke-width="2" opacity="0.7" />
  <circle cx="50" cy="70" r="17" fill="#0a2a3f" stroke="#7fd8c8" stroke-width="2" />
  <circle cx="50" cy="70" r="9" fill="#ffe27a" opacity="0.3" />
  <circle cx="50" cy="70" r="5" fill="#ffe27a" />
</svg>
