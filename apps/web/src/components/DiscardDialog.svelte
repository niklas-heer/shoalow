<script lang="ts">
  import { onMount } from "svelte";
  import { formatValue } from "../lib/cards.ts";
  import Card from "./Card.svelte";

  /** Every card in the discard pile, bottom first. */
  let { discards, onclose }: { discards: number[]; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  onMount(() => dialog.showModal());

  const newestFirst = $derived([...discards].reverse());
  const tally = $derived(
    [...discards.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<number, number>())].sort(
      (a, b) => a[0] - b[0],
    ),
  );
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="discards-title"
  onclose={onclose}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  <div class="inner">
    <header>
      <h2 id="discards-title">Discard pile</h2>
      <button class="btn quiet small" onclick={() => dialog.close()}>Close</button>
    </header>
    <p class="sub">{discards.length} {discards.length === 1 ? "card" : "cards"}, newest first.</p>
    <ul class="tally" aria-label="Cards by value">
      {#each tally as [value, count] (value)}
        <li><strong>{count}</strong> × {formatValue(value)}</li>
      {/each}
    </ul>
    <ol class="cards">
      {#each newestFirst as value, i (i)}
        <li><Card {value} size="sm" /></li>
      {/each}
    </ol>
  </div>
</dialog>

<style>
  dialog {
    width: min(32rem, 94vw);
    max-height: 86dvh;
    padding: 0;
    border: 0;
    border-radius: var(--radius);
    background: #0b3147;
    color: var(--foam);
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
  }
  dialog::backdrop {
    background: rgb(4 18 28 / 0.7);
  }
  .inner {
    display: grid;
    gap: 0.8rem;
    padding: 1.1rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2,
  .sub {
    margin: 0;
  }
  .sub {
    color: var(--mist);
  }
  .tally {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tally li {
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    background: rgb(168 201 214 / 0.14);
    color: var(--mist);
    font-variant-numeric: tabular-nums;
  }
  .tally strong {
    color: var(--foam);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(3.2rem, 1fr));
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
