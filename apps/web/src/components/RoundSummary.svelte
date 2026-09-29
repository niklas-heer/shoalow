<script lang="ts">
  import type { RoomView } from "@shoalow/game";
  import { fly } from "svelte/transition";
  import { formatValue } from "../lib/cards.ts";
  import type { Connection } from "../lib/connection.svelte.ts";
  import { motion } from "../lib/motion.ts";
  import Board from "./Board.svelte";

  let { room, conn, onhide }: { room: RoomView; conn: Connection; onhide: () => void } = $props();

  const game = $derived(room.game);
  const result = $derived(game?.rounds.at(-1));
  const over = $derived(game?.phase === "gameOver");
  const name = (p: number) => (p === room.you ? "You" : (room.seats[p]?.name ?? ""));

  /** Seats sorted by what matters now: the round score, or the final total. */
  const order = $derived(
    game && result
      ? room.seats
          .map((_, p) => p)
          .sort((a, b) =>
            over ? (game.totals[a] ?? 0) - (game.totals[b] ?? 0) : (result.scores[a] ?? 0) - (result.scores[b] ?? 0),
          )
      : [],
  );

  const headline = $derived.by(() => {
    if (!game || !result) return "";
    if (over) {
      const winners = game.winners.map(name);
      const low = formatValue(Math.min(...game.totals));
      if (winners.length === 1) return winners[0] === "You" ? `You win with ${low}!` : `${winners[0]} wins with ${low}`;
      return `${winners.slice(0, -1).join(", ")} and ${winners.at(-1)} share the win with ${low}`;
    }
    return `Round ${game.round} is over`;
  });

  const endLine = $derived.by(() => {
    if (!result) return "";
    const who = name(result.endedBy);
    if (result.doubled === null) return `${who} ended the round.`;
    const whose = who === "You" ? "your" : "their";
    return `${who} ended the round without the lowest score, so ${whose} points doubled.`;
  });
</script>

{#if game && result}
  <div class="overlay">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="summary-title" in:fly={{ y: 30, duration: motion(280) }}>
      <h2 id="summary-title">{headline}</h2>
      <p class="sub">{endLine} {#if !over}First to {game.settings.targetScore} ends the game.{/if}</p>

      <ol class="rows">
        {#each order as p, rank (p)}
          {@const board = game.boards[p]}
          <li class:me={p === room.you} class:winner={over && game.winners.includes(p)}>
            <span class="rank">{rank + 1}</span>
            <span class="who">{name(p)}</span>
            {#if board}<span class="mini"><Board {board} size="sm" owner={name(p)} /></span>{/if}
            <span class="round">
              {formatValue(result.scores[p] ?? 0)}{#if result.doubled === p}<span class="x2">×2</span>{/if}
            </span>
            <span class="total">{formatValue(game.totals[p] ?? 0)}</span>
          </li>
        {/each}
      </ol>
      <p class="legend"><span>round</span><span>total</span></p>

      <div class="buttons">
        <button class="btn quiet" onclick={onhide}>Look at the table</button>
        {#if over}
          <button class="btn primary" onclick={() => conn.send({ t: "playAgain" })}>Play again</button>
        {:else}
          <button class="btn primary" onclick={() => conn.send({ t: "nextRound" })}>Start round {game.round + 1}</button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 1rem;
    overflow-y: auto;
    background: rgb(4 18 28 / 0.72);
  }
  .sheet {
    display: grid;
    gap: 0.9rem;
    width: min(34rem, 100%);
    padding: 1.4rem;
    border-radius: var(--radius);
    background: #0b3147;
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
  }
  h2 {
    font-size: clamp(1.5rem, 5vw, 2rem);
  }
  .sub {
    margin: 0;
    color: var(--mist);
  }
  .rows {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: 1.4rem 1fr 4.2rem 3.4rem 3.4rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0.6rem;
    border-radius: 10px;
    background: rgb(6 25 40 / 0.45);
    font-variant-numeric: tabular-nums;
  }
  li.me {
    box-shadow: inset 0 0 0 2px var(--glass);
  }
  li.winner {
    box-shadow: inset 0 0 0 2px var(--lantern);
  }
  .rank {
    color: var(--mist);
    font-weight: 700;
  }
  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 700;
  }
  .mini {
    width: 4.2rem;
  }
  .round,
  .total {
    text-align: right;
    font-weight: 700;
  }
  .total {
    font-size: 1.15rem;
    font-weight: 800;
  }
  .winner .total {
    color: var(--lantern);
  }
  .x2 {
    margin-left: 0.2rem;
    padding: 0 0.25rem;
    border-radius: 6px;
    background: var(--coral);
    font-size: 0.75rem;
  }
  .legend {
    display: flex;
    justify-content: flex-end;
    gap: 1.6rem;
    margin: -0.5rem 0.7rem 0 0;
    color: var(--mist);
    font-size: 0.8rem;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
</style>
