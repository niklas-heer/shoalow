<script lang="ts">
  import type { BotSpeed, RoomView } from "@shoalow/game";
  import type { TableLink } from "../lib/connection.svelte.ts";
  import Choice from "./Choice.svelte";

  let { room, link }: { room: RoomView; link: TableLink } = $props();

  const isHost = $derived(room.you === room.host);
  const hints: Record<BotSpeed, string> = {
    slow: "Bots wait about 2½ seconds per step, so every move is easy to follow.",
    normal: "Bots wait about 1½ seconds per step.",
    fast: "Bots move quickly; good once everyone knows the game.",
  };
</script>

<div class="speed">
  <Choice
    legend="Bot speed"
    options={[
      { value: "slow", label: "Slow" },
      { value: "normal", label: "Normal" },
      { value: "fast", label: "Fast" },
    ]}
    value={room.botSpeed}
    disabled={!isHost}
    onchange={(speed) => link.send({ t: "setBotSpeed", speed })}
  />
  <p class="hint">{hints[room.botSpeed]}{#if !isHost} Only the host can change it.{/if}</p>
</div>

<style>
  .speed {
    display: grid;
    gap: 0.4rem;
  }
  .hint {
    margin: 0;
    color: var(--mist);
    font-size: 0.9rem;
  }
</style>
