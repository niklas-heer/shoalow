<script lang="ts">
  import type { RoomView } from "@shoalow/game";
  import { formatValue } from "../lib/cards.ts";

  let { room }: { room: RoomView } = $props();

  const game = $derived(room.game);
  const low = $derived(game ? Math.min(...game.totals) : 0);
</script>

{#if game}
  <div class="scroll">
    <table>
      <caption>Scores, first to {game.settings.targetScore} ends the game</caption>
      <thead>
        <tr>
          <th scope="col">Round</th>
          {#each room.seats as seat, i}
            <th scope="col" class:me={i === room.you}>{i === room.you ? "You" : seat.name}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each game.rounds as round, r}
          <tr>
            <th scope="row">{r + 1}</th>
            {#each round.scores as score, p}
              <td class:ender={round.endedBy === p}>
                {formatValue(score)}{#if round.doubled === p}<span class="x2" title="Doubled: ended the round without the lowest score">×2</span>{/if}
              </td>
            {/each}
          </tr>
        {:else}
          <tr><td class="none" colspan={room.seats.length + 1}>No rounds finished yet</td></tr>
        {/each}
        {#if game.phase === "turn" || game.phase === "initialFlip"}
          <tr class="live">
            <th scope="row" title="Face-up cards this round">Now</th>
            {#each game.boards as board}
              <td>{formatValue(board.visibleSum)}</td>
            {/each}
          </tr>
        {/if}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total</th>
          {#each game.totals as total}
            <td class:leader={game.rounds.length > 0 && total === low}>{formatValue(total)}</td>
          {/each}
        </tr>
      </tfoot>
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
    padding: 0.35rem 0.5rem;
    text-align: right;
    white-space: nowrap;
  }
  thead th {
    max-width: 6rem;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--mist);
    font-size: 0.85rem;
    font-weight: 700;
  }
  thead th.me {
    color: var(--glass);
  }
  tbody th {
    color: var(--mist);
    font-weight: 600;
  }
  th:first-child {
    text-align: left;
  }
  tbody tr {
    border-top: 1px solid rgb(168 201 214 / 0.12);
  }
  td.ender {
    text-decoration: underline;
    text-decoration-color: rgb(168 201 214 / 0.5);
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
  .live td,
  .live th {
    color: var(--mist);
    font-style: italic;
  }
  tfoot {
    border-top: 2px solid rgb(168 201 214 / 0.35);
    font-size: 1.1rem;
    font-weight: 800;
  }
  .leader {
    color: var(--lantern);
  }
  .none {
    color: var(--mist);
    text-align: center;
  }
</style>
