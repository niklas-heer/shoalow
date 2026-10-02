<script lang="ts">
  import type { RoomView } from "@shoalow/game";
  import { onMount } from "svelte";
  import type { Connection } from "../lib/connection.svelte.ts";

  let { room, conn, onleave, onclose }: { room: RoomView; conn: Connection; onleave: () => void; onclose: () => void } =
    $props();
  let dialog: HTMLDialogElement;
  let stopping = $state(false);
  const isHost = $derived(room.you === room.host);
  onMount(() => dialog.showModal());
</script>

<dialog bind:this={dialog} aria-labelledby="game-menu-title" onclose={onclose} onclick={(event) => event.target === dialog && dialog.close()}>
  <div class="inner">
    <header><h2 id="game-menu-title">Your game</h2><button class="btn quiet small" onclick={() => dialog.close()}>Close</button></header>
    <p class="table-code">Table {room.code} · goal {room.settings.targetScore} points{room.settings.showSums ? "" : " · no running sums"}</p>
    {#if isHost}
      <section>
        <h3>{stopping ? "Stop this game?" : "Stop the game"}</h3>
        <p>Everyone returns to the lobby. This game's scores are cleared, and you can change the goal or players before starting again.</p>
        {#if stopping}
          <div class="buttons">
            <button class="btn danger" disabled={conn.status !== "open"} onclick={() => conn.send({ t: "stopGame" })}>Stop and return to lobby</button>
            <button class="btn quiet" onclick={() => (stopping = false)}>Keep playing</button>
          </div>
        {:else}
          <button class="btn" onclick={() => (stopping = true)}>Stop game…</button>
        {/if}
      </section>
    {/if}
    <section>
      <h3>Exit the game</h3>
      <p>A bot takes over your cards so the others can keep playing.{isHost ? " The next player becomes host." : ""} To rejoin, wait until the table returns to the lobby.</p>
      <button class="btn" disabled={conn.status !== "open"} onclick={onleave}>Exit game</button>
    </section>
    {#if conn.status !== "open"}<p role="status">Reconnecting. Game controls will be available when you're connected.</p>{/if}
  </div>
</dialog>

<style>
  dialog { width: min(30rem, 94vw); padding: 0; border: 1px solid rgb(127 216 200 / 0.25); border-radius: 20px; background: #0b3147; color: var(--foam); box-shadow: 0 20px 60px rgb(0 0 0 / 0.5); }
  dialog::backdrop { background: rgb(4 18 28 / 0.75); }
  .inner { display: grid; gap: 1rem; padding: 1.25rem; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .table-code { margin: -0.5rem 0 0; font-size: 0.9rem; }
  section { display: grid; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid rgb(168 201 214 / 0.2); }
  h3 { font-size: 1.1rem; }
  p { margin: 0; color: var(--mist); }
  section > button { justify-self: start; }
  .buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .danger { border-color: #ffb3aa; background: rgb(226 87 76 / 0.15); color: #ffd7d1; }
</style>
