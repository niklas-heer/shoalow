<script lang="ts">
  import type { RoomView } from "@shoalow/game";
  import { onMount } from "svelte";
  import Scoreboard from "./Scoreboard.svelte";

  let { room, onclose }: { room: RoomView; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  onMount(() => dialog.showModal());
</script>

<dialog bind:this={dialog} {onclose} onclick={(e) => e.target === dialog && dialog.close()} aria-labelledby="rounds-title">
  <div class="inner">
    <header>
      <h2 id="rounds-title">Round by round</h2>
      <button class="btn quiet small" onclick={() => dialog.close()}>Close</button>
    </header>
    <Scoreboard {room} />
  </div>
</dialog>

<style>
  dialog {
    width: min(44rem, 94vw);
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
  h2 {
    font-size: 1.3rem;
  }
</style>
