<script lang="ts">
  import { onDestroy } from "svelte";
  import { fly } from "svelte/transition";
  import { coachNote, coachTip } from "../lib/coach.ts";
  import { LocalTable } from "../lib/local.svelte.ts";
  import { motion } from "../lib/motion.ts";
  import { router } from "../lib/router.svelte.ts";
  import { savedName } from "../lib/session.ts";
  import Card from "./Card.svelte";
  import Logo from "./Logo.svelte";
  import Table from "./Table.svelte";

  let { onrules }: { onrules: () => void } = $props();

  /** Seed 33 opens with a 0 on the discard pile and a pair of 0s in the player's grid. */
  const SEED = 33;
  let table = $state<LocalTable | null>(null);
  onDestroy(() => table?.close());

  let note = $state<string | null>(null);
  $effect(() => {
    if (!table?.room) return;
    const events = table.events.list;
    const fresh = coachNote(table.room, events);
    if (fresh) note = fresh;
    else if (events.some((e) => "player" in e && e.player === table?.room?.you && e.type !== "turnStarted"))
      note = null;
  });
  const tip = $derived(table?.room ? coachTip(table.room) : null);

  function start() {
    table = new LocalTable(savedName() || "You", SEED);
  }
</script>

{#if table?.room}
  <Table room={table.room} conn={table} {onrules}>
    {#snippet coach()}
      {#if tip}
        {#key tip.title}
          <aside class="coach" aria-live="polite" in:fly={{ y: 8, duration: motion(220) }}>
            <p class="title">{tip.title}</p>
            <p>{tip.text}</p>
            {#if note}<p class="note">{note}</p>{/if}
            {#if table?.room?.game?.phase === "gameOver"}
              <button class="btn primary small" onclick={() => router.go("/")}>Go to the start page</button>
            {/if}
          </aside>
        {/key}
      {/if}
      {#if table?.error}<p class="error" role="alert">{table.error}</p>{/if}
    {/snippet}
    {#snippet exit()}
      <button class="btn quiet small" onclick={() => router.go("/")}>Leave</button>
    {/snippet}
  </Table>
{:else}
  <main class="intro">
    <header><Logo /><button class="btn quiet" onclick={() => router.go("/")}>Back</button></header>
    <h1>Learn Shoalow in one round</h1>
    <p class="lede">
      A practice game against one easy bot. A coach explains each step as you play. Nothing is shared and nobody is
      waiting for you.
    </p>

    <ul class="facts">
      <li>
        <div class="cards" aria-hidden="true">
          <Card value={-2} /><Card value={0} /><Card value={5} /><Card value={12} />
        </div>
        <p>Each card is worth its number. You want the <strong>lowest</strong> score, so pearls (−2) are treasure and the anglerfish (12) is trouble.</p>
      </li>
      <li>
        <div class="cards" aria-hidden="true"><Card value={7} /><Card value={7} /><Card value={7} /></div>
        <p>Three equal cards in one column vanish and stop counting.</p>
      </li>
      <li>
        <div class="cards" aria-hidden="true"><Card faceUp={false} /><Card faceUp={false} /><Card value={3} /></div>
        <p>The round ends when someone has turned over all their cards. Everyone else gets one more turn.</p>
      </li>
    </ul>

    <button class="btn primary big" onclick={start}>Start the practice game</button>
  </main>
{/if}

<style>
  .coach {
    display: grid;
    align-content: start;
    min-height: 12rem;
    gap: 0.3rem;
    width: min(34rem, 100%);
    padding: 0.8rem 1rem;
    border-left: 4px solid var(--glass);
    border-radius: 4px 12px 12px 4px;
    background: rgb(127 216 200 / 0.12);
  }
  .coach p {
    margin: 0;
  }
  .title {
    color: var(--glass);
    font-weight: 800;
  }
  .note {
    color: var(--lantern);
    font-weight: 600;
  }
  .coach .btn {
    justify-self: start;
    margin-top: 0.3rem;
  }
  .error {
    margin: 0;
    color: #ffb3aa;
    font-weight: 600;
  }
  .intro {
    display: grid;
    gap: 1.4rem;
    max-width: 36rem;
    margin: 0 auto;
    padding: 1.25rem 1.25rem 3rem;
  }
  .intro header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h1 {
    font-size: clamp(2rem, 7vw, 2.8rem);
  }
  .lede {
    margin: 0;
    color: var(--mist);
    font-size: 1.1rem;
  }
  .facts {
    display: grid;
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .facts li {
    display: grid;
    grid-template-columns: 9.5rem 1fr;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem;
    border-radius: var(--radius);
    background: rgb(6 25 40 / 0.45);
  }
  .facts p {
    margin: 0;
  }
  .cards {
    display: flex;
  }
  .cards > :global(.card) {
    width: 2.8rem;
    flex: none;
  }
  .cards > :global(.card + .card) {
    margin-left: -0.6rem;
  }
  .big {
    min-height: 56px;
    font-size: 1.15rem;
  }
  @media (max-width: 480px) {
    .facts li {
      grid-template-columns: 1fr;
    }
  }
</style>
