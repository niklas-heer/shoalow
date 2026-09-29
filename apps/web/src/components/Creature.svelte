<script lang="ts">
  import atlas from "../assets/creatures-sculpted.png";

  let { value }: { value: number } = $props();

  // Centers of the visible silhouettes (alpha >= 128) in the 1619 × 971 PNG.
  // The generated atlas has uneven transparent padding inside its cells.
  const centers = [
    [176, 194],
    [475, 191],
    [808, 188],
    [1119.5, 194],
    [1437, 199],
    [173, 491],
    [467.5, 487.5],
    [808, 484.5],
    [1120, 494],
    [1445.5, 486.5],
    [164.5, 787],
    [481.5, 772.5],
    [812, 781],
    [1129.5, 783.5],
    [1438, 774],
  ] as const;

  // Values -2 through 12 occupy a five-column, three-row atlas.
  // A nested viewport avoids clip-path IDs, so flying DOM copies remain safe.
  const index = $derived(value + 2);
  const viewBox = $derived(`${(index % 5) * 100} ${Math.floor(index / 5) * 100} 100 100`);
  const center = $derived(centers[index] ?? centers[0]);
  const x = $derived(50 - ((center[0] * 500) / 1619 - (index % 5) * 100));
  const y = $derived(50 - ((center[1] * 300) / 971 - Math.floor(index / 5) * 100));
</script>

<svg class="creature" x="0" y="0" width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
  <svg class="creature" {x} {y} width="100" height="100" {viewBox}>
    <image href={atlas} x="0" y="0" width="500" height="300" preserveAspectRatio="none" />
  </svg>
</svg>

<style>
  .creature { overflow: hidden; }
</style>
