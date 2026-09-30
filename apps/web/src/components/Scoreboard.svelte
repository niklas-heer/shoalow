<script lang="ts">
  import type { RoomView } from "@shoalow/game";
  import { formatValue } from "../lib/cards.ts";
  import { won } from "../lib/describe.ts";
  import Trophy from "./Trophy.svelte";

  let { room }: { room: RoomView } = $props();

  const game = $derived(room.game);
  const low = $derived(game ? Math.min(...game.totals) : 0);
  const live = $derived(game?.phase === "turn" || game?.phase === "initialFlip");
</script>

{#if game}
  <div class="scroll">
    <table>
      <caption>Every round's score. Underlined: who ended the round. ×2: doubled.</caption>
      <thead>
        <tr>
          <th scope="col">Player</th>
          {#each game.rounds as _, r}<th scope="col">{r + 1}</th>{/each}
          {#if live}<th scope="col" class="live" title="Face-up cards this round">now</th>{/if}
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {#each room.seats as seat, p}
          <tr class:me={p === room.you}>
            <th scope="row">
              <span class="who"><span class="text">{p === room.you ? "You" : seat.name}</span>{#if won(game, p)}<Trophy />{/if}</span>
            </th>
            {#each game.rounds as round}
              <td class:ender={round.endedBy === p}>
                {formatValue(round.scores[p] ?? 0)}{#if round.doubled === p}<span class="x2">×2</span>{/if}
              </td>
            {/each}
            {#if live}<td class="live">{formatValue(game.boards[p]?.visibleSum ?? 0)}</td>{/if}
            <td class="total" class:leader={game.rounds.length > 0 && game.totals[p] === low}
              >{formatValue(game.totals[p] ?? 0)}</td
            >
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  caption {
    padding-bottom: 0.6rem;
    color: var(--mist);
    font-size: 0.9rem;
    text-align: left;
  }
  th,
  td {
    padding: 0.4rem 0.55rem;
    text-align: right;
    white-space: nowrap;
  }
  thead th {
    color: var(--mist);
    font-size: 0.85rem;
    font-weight: 700;
  }
  th:first-child {
    max-width: 9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }
  tbody tr {
    border-top: 1px solid rgb(168 201 214 / 0.12);
  }
  tbody th {
    font-weight: 700;
  }
  .who {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    vertical-align: bottom;
  }
  .who .text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tr.me th {
    color: var(--glass);
  }
  td.ender {
    text-decoration: underline;
    text-decoration-color: rgb(168 201 214 / 0.6);
    text-underline-offset: 3px;
  }
  .x2 {
    margin-left: 0.2rem;
    padding: 0 0.3rem;
    border-radius: 6px;
    background: var(--coral);
    font-size: 0.75rem;
    font-weight: 800;
  }
  .live {
    color: var(--mist);
    font-style: italic;
  }
  .total {
    border-left: 2px solid rgb(168 201 214 / 0.3);
    font-size: 1.05rem;
    font-weight: 800;
  }
  .leader {
    color: var(--lantern);
  }
</style>
