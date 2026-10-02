<script lang="ts">
  import type { RoomView } from "@shoalow/game";
  import { flip } from "svelte/animate";
  import { formatValue } from "../lib/cards.ts";
  import type { TableLink } from "../lib/connection.svelte.ts";
  import { won } from "../lib/describe.ts";
  import { motion } from "../lib/motion.ts";
  import BotSpeed from "./BotSpeed.svelte";
  import Trophy from "./Trophy.svelte";

  let { room, link, onrounds }: { room: RoomView; link: TableLink; onrounds: () => void } = $props();

  const game = $derived(room.game);
  const order = $derived(
    game ? room.seats.map((_, p) => p).sort((a, b) => (game.totals[a] ?? 0) - (game.totals[b] ?? 0) || a - b) : [],
  );
  const low = $derived(game ? Math.min(...game.totals) : 0);
  const hasBots = $derived(room.seats.some((s) => s.kind === "bot" || s.takenOver));
  /** The running sum of face-up cards, unless the table plays without it. */
  const showing = $derived(!!game?.settings.showSums && (game.phase === "turn" || game.phase === "initialFlip"));
</script>

{#if game}
  <section class="standings" aria-label="Scores">
    <header>
      <h2>Scores</h2>
      <p>Round {game.round}. The game ends when someone reaches {game.settings.targetScore}.</p>
    </header>

    <div class="cols" aria-hidden="true"><span>{showing ? "showing" : ""}</span><span>total</span></div>
    <ol>
      {#each order as p, rank (p)}
        {@const seat = room.seats[p]}
        <li
          animate:flip={{ duration: motion(400) }}
          class:me={p === room.you}
          class:current={game.phase === "turn" && game.current === p}
          class:leader={game.rounds.length > 0 && game.totals[p] === low}
        >
          <span class="rank">{rank + 1}</span>
          <span class="name"
            ><span class="text">{p === room.you ? "You" : seat?.name}</span>{#if won(game, p)}<Trophy />{/if}</span
          >
          <span class="now" title="Face-up cards this round">{showing ? formatValue(game.boards[p]?.visibleSum ?? 0) : ""}</span>
          <span class="total">{formatValue(game.totals[p] ?? 0)}</span>
        </li>
      {/each}
    </ol>

    {#if game.rounds.length > 0}
      <button class="btn small rounds" onclick={onrounds}>Round by round</button>
    {/if}

    {#if hasBots}
      <div class="bots"><BotSpeed {room} {link} /></div>
    {/if}
  </section>
{/if}

<style>
  .standings {
    display: grid;
    gap: 0.6rem;
  }
  header {
    display: grid;
    gap: 0.2rem;
  }
  h2 {
    font-size: 1.2rem;
  }
  header p {
    margin: 0;
    color: var(--mist);
    font-size: 0.9rem;
  }
  .cols,
  li {
    display: grid;
    grid-template-columns: 1.3rem minmax(0, 1fr) 3.4rem 3.2rem;
    align-items: center;
    gap: 0.4rem;
  }
  .cols {
    padding: 0 0.6rem;
    color: var(--mist);
    font-size: 0.75rem;
    font-weight: 600;
    text-align: right;
  }
  .cols span:first-child {
    grid-column: 3;
  }
  ol {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    min-height: 2.3rem;
    padding: 0.2rem 0.6rem;
    border-radius: 10px;
    background: rgb(6 25 40 / 0.35);
    font-variant-numeric: tabular-nums;
  }
  li.me {
    box-shadow: inset 0 0 0 2px rgb(127 216 200 / 0.6);
  }
  li.current {
    background: rgb(255 226 122 / 0.14);
  }
  li.current .name::after {
    content: "";
    display: inline-block;
    width: 0.45rem;
    height: 0.45rem;
    margin-left: 0.4rem;
    border-radius: 50%;
    background: var(--lantern);
    vertical-align: 0.1em;
  }
  .rank {
    color: var(--mist);
    font-size: 0.85rem;
    font-weight: 700;
  }
  .name {
    display: flex;
    align-items: center;
    min-width: 0;
    font-weight: 700;
  }
  .name .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .now {
    color: var(--mist);
    text-align: right;
  }
  .total {
    font-size: 1.1rem;
    font-weight: 800;
    text-align: right;
  }
  .leader .total {
    color: var(--lantern);
  }
  .rounds {
    justify-self: start;
  }
  .bots {
    padding-top: 0.8rem;
    border-top: 1px solid rgb(168 201 214 / 0.18);
  }
</style>
