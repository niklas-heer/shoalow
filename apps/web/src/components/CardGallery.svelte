<script lang="ts">
  import { router } from "../lib/router.svelte.ts";
  import Card from "./Card.svelte";

  const values = Array.from({ length: 15 }, (_, index) => index - 2);
</script>

<main class="gallery">
  <header>
    <button class="btn quiet" onclick={() => router.go("/")}>← Back to Shoalow</button>
    <h1>Meet the shoal</h1>
    <p>Fifteen sea creatures, from helpful pearls to hefty anglerfish. Keep your score low to win.</p>
  </header>
  <section class="cards" aria-label="All fifteen cards">
    {#each values as value}
      <Card {value} />
    {/each}
  </section>
</main>

<style>
  .gallery { max-width: 70rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
  header { margin-bottom: 2rem; }
  h1 { margin: 1rem 0 0.5rem; font-size: clamp(2rem, 5vw, 3rem); }
  p { max-width: 36rem; margin: 0; color: var(--mist); font-size: 1.1rem; }
  .cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1rem; }
  @media (max-width: 800px) { .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 480px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; } }
</style>
