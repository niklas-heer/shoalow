<script lang="ts">
  import { CREATURES, formatValue } from "../lib/cards.ts";
  import { router } from "../lib/router.svelte.ts";
  import Card from "./Card.svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let dialog: HTMLDialogElement;
  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  /** Copies per 30 cards; every deck is made of this mix. */
  const deck = [
    { value: -2, count: 1 },
    { value: -1, count: 2 },
    { value: 0, count: 3 },
    ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, count: 2 })),
  ];
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} onclick={(e) => e.target === dialog && dialog.close()}>
  <article>
    <header>
      <h2>How to play Shoalow</h2>
      <button class="btn quiet small" onclick={() => dialog.close()}>Close</button>
    </header>

    <p class="goal">Finish with the fewest points. Pearls are worth less than nothing; anglerfish cost you 12.</p>
    {#if !router.learning}
      <p class="practice">
        Rather learn by playing?
        <button
          class="btn small"
          onclick={() => {
            dialog.close();
            router.go("/learn");
          }}>Start a practice game</button
        >
      </p>
    {/if}

    <h3>Setting up</h3>
    <p>
      Everyone gets twelve face-down cards in a grid of three rows and four columns. Before the first move, each player
      turns over two of their own cards. Whoever shows the highest pair goes first. After that, whoever ended the
      previous round starts.
    </p>

    <h3>Your turn</h3>
    <p>Pick one:</p>
    <ul>
      <li>
        <strong>Take the top card of the discard pile</strong> and put it in your grid in place of any card. The card you
        replace goes face up onto the discard pile.
      </li>
      <li>
        <strong>Draw from the pile.</strong> Either swap it into your grid the same way, or drop it on the discard pile and
        turn over one of your face-down cards.
      </li>
    </ul>

    <h3>Clearing a column</h3>
    <p>
      When a column shows three face-up cards of the same value, the whole column goes to the discard pile and stops
      counting. Three sharks gone is a very good day. Three pearls gone is not.
    </p>

    <h3>Ending a round</h3>
    <p>
      As soon as someone has turned over all of their cards, every other player gets exactly one more turn. Then all
      cards are revealed and counted. If the player who ended the round does not have the lowest score on their own,
      and their score is above zero, it counts double.
    </p>

    <h3>Winning</h3>
    <p>
      Rounds continue until someone reaches the target score, 100 unless the host chose another number. The player
      with the lowest total wins.
    </p>

    <h3>The deck</h3>
    <p>
      The deck grows with the table: 24 cards per player, so 48 for two and 240 for ten. That way the draw pile
      runs out late in about half of all rounds, whatever the table size. Every deck has the same mix; in every 30
      cards there are:
    </p>
    <ul class="deck">
      {#each deck as c}
        <li>
          <span class="card"><Card value={c.value} size="sm" /></span>
          <span class="what">{CREATURES[c.value]}</span>
          <span class="count">{c.count} × {formatValue(c.value)}</span>
        </li>
      {/each}
    </ul>
  </article>
</dialog>

<style>
  .practice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  dialog {
    width: min(40rem, 94vw);
    max-height: 90dvh;
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
  article {
    padding: 1.2rem 1.4rem 1.6rem;
    line-height: 1.55;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  h2 {
    font-size: 1.6rem;
  }
  h3 {
    margin: 1.4rem 0 0.3rem;
    font-size: 1.1rem;
  }
  p,
  li {
    max-width: 62ch;
    color: #d6e9ef;
  }
  p {
    margin: 0.4rem 0;
  }
  .goal {
    font-size: 1.1rem;
    color: var(--foam);
  }
  ul {
    padding-left: 1.2rem;
  }
  li + li {
    margin-top: 0.4rem;
  }
  .deck {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
    gap: 0.8rem;
    padding: 0;
    list-style: none;
  }
  .deck li {
    display: grid;
    justify-items: center;
    gap: 0.15rem;
    margin: 0;
    text-align: center;
  }
  .deck .card {
    width: 3.2rem;
  }
  .what {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .count {
    color: var(--mist);
    font-size: 0.8rem;
  }
</style>
