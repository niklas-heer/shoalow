<script lang="ts">
  import type { RoomView } from "@shoalow/game";
  import { onMount } from "svelte";
  import { formatValue } from "../lib/cards.ts";
  import type { Connection } from "../lib/connection.svelte.ts";
  import Board from "./Board.svelte";

  let { room, conn, seat, onclose }: { room: RoomView; conn: Connection; seat: number; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  onMount(() => dialog.showModal());

  const info = $derived(room.seats[seat]);
  const board = $derived(room.game?.boards[seat]);
  const isHost = $derived(room.you === room.host);
  const canTakeOver = $derived(isHost && info?.kind === "human" && seat !== room.host);
</script>

<dialog bind:this={dialog} onclose={onclose} onclick={(e) => e.target === dialog && dialog.close()}>
  {#if info && board && room.game}
    <div class="inner">
      <header>
        <h2>{info.name}</h2>
        <button class="btn quiet small" onclick={() => dialog.close()}>Close</button>
      </header>
      <p class="stats">
        <span><strong>{formatValue(board.visibleSum)}</strong> showing</span>
        <span><strong>{board.faceDown}</strong> face down</span>
        <span><strong>{formatValue(room.game.totals[seat] ?? 0)}</strong> total</span>
      </p>
      <div class="board"><Board {board} owner={info.name} /></div>

      {#if canTakeOver}
        <div class="takeover">
          {#if info.takenOver}
            <p>A bot is playing for {info.name}. They get the seat back as soon as they reconnect.</p>
            <button class="btn" onclick={() => conn.send({ t: "takeover", seat, bot: false })}>Stop the bot</button>
          {:else if !info.connected}
            <p>{info.name} is away. A bot can play their cards until they come back.</p>
            <button class="btn primary" onclick={() => conn.send({ t: "takeover", seat, bot: true })}
              >Let a bot play for {info.name}</button
            >
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(26rem, 94vw);
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
    gap: 0.9rem;
    padding: 1.1rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .stats {
    display: flex;
    gap: 1rem;
    margin: 0;
    color: var(--mist);
  }
  .stats strong {
    color: var(--foam);
    font-size: 1.15rem;
  }
  .takeover {
    display: grid;
    gap: 0.6rem;
    padding-top: 0.9rem;
    border-top: 1px solid rgb(168 201 214 / 0.2);
  }
  .takeover p {
    margin: 0;
    color: var(--mist);
  }
</style>
