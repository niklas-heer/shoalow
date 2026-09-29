<script lang="ts">
  import atlas from "../assets/creatures-sculpted.png";

  let { value }: { value: number } = $props();

  // Values -2 through 12 occupy a five-column, three-row atlas.
  // A nested viewport avoids clip-path IDs, so flying DOM copies remain safe.
  const index = $derived(value + 2);
  const viewBox = $derived(`${(index % 5) * 100} ${Math.floor(index / 5) * 100} 100 100`);
</script>

<svg class="creature" x="0" y="0" width="100" height="100" {viewBox} aria-hidden="true">
  <image href={atlas} x="0" y="0" width="500" height="300" preserveAspectRatio="none" />
</svg>

<style>
  .creature { overflow: hidden; }
</style>
