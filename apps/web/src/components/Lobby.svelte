<script lang="ts">
  import { MAX_PLAYERS, MAX_TARGET_SCORE, MIN_TARGET_SCORE, type RoomView } from "@shoalow/game";
  import type { Connection } from "../lib/connection.svelte.ts";
  import { router } from "../lib/router.svelte.ts";
  import Logo from "./Logo.svelte";

  let { room, conn, onrules }: { room: RoomView; conn: Connection; onrules: () => void } = $props();

  const isHost = $derived(room.you === room.host);
  const full = $derived(room.seats.length >= MAX_PLAYERS);
  const link = $derived(`${location.origin}/r/${room.code}`);
  let copied = $state(false);
  let target = $state(0);

  $effect(() => {
    target = room.settings.targetScore;
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch {
      copied = false;
    }
  }

  function setTarget() {
    const score = Math.round(Number(target));
    if (score !== room.settings.targetScore) conn.send({ t: "setTarget", score });
  }

  function leave() {
    conn.send({ t: "leave" });
    router.go("/");
  }
</script>

<main class="lobby">
  <header>
    <Logo />
    <button class="btn quiet" onclick={onrules}>How to play</button>
  </header>

  <section class="invite">
    <p class="label">Table code</p>
    <p class="code">{room.code}</p>
    <div class="share">
      <button class="btn" onclick={copy}>{copied ? "Link copied" : "Copy invite link"}</button>
    </div>
    <p class="hint">Anyone with the link can sit down until the game starts.</p>
  </section>

  <section>
    <h2>Seats <span class="count">{room.seats.length} of {MAX_PLAYERS}</span></h2>
    <ol class="seats">
      {#each room.seats as seat, i (seat.name)}
        <li class:me={i === room.you} class:away={!seat.connected}>
          <span class="name">{seat.name}</span>
          <span class="tags">
            {#if i === room.host}<span class="tag">host</span>{/if}
            {#if seat.kind === "bot"}<span class="tag">{seat.level === "easy" ? "easy bot" : "normal bot"}</span>{/if}
            {#if i === room.you}<span class="tag you">you</span>{/if}
            {#if seat.kind === "human" && !seat.connected}<span class="tag">away</span>{/if}
          </span>
          {#if isHost && i !== room.host}
            <button class="remove" aria-label="Remove {seat.name}" onclick={() => conn.send({ t: "removeSeat", seat: i })}
              >Remove</button
            >
          {/if}
        </li>
      {/each}
    </ol>

    {#if isHost}
      <div class="bots">
        <button class="btn" disabled={full} onclick={() => conn.send({ t: "addBot", level: "easy" })}>Add easy bot</button>
        <button class="btn" disabled={full} onclick={() => conn.send({ t: "addBot", level: "normal" })}
          >Add normal bot</button
        >
      </div>
    {/if}
  </section>

  <section class="settings">
    <label class="field">
      Play until someone reaches
      <input
        type="number"
        min={MIN_TARGET_SCORE}
        max={MAX_TARGET_SCORE}
        step="10"
        bind:value={target}
        disabled={!isHost}
        onchange={setTarget}
      />
    </label>
    <p class="hint">points. The lowest total then wins.</p>
  </section>

  <footer>
    {#if isHost}
      <button class="btn primary big" disabled={room.seats.length < 2} onclick={() => conn.send({ t: "start" })}>
        {room.seats.length < 2 ? "Add a player or bot to start" : `Start with ${room.seats.length} players`}
      </button>
    {:else}
      <p class="waiting">Waiting for {room.seats[room.host]?.name ?? "the host"} to start the game…</p>
    {/if}
    <button class="btn quiet" onclick={leave}>Leave table</button>
  </footer>
</main>

<style>
  .lobby {
    display: grid;
    gap: 2rem;
    max-width: 34rem;
    margin: 0 auto;
    padding: 1.25rem 1.25rem 3rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.75rem;
    font-size: 1.35rem;
  }
  .count {
    color: var(--mist);
    font-size: 1rem;
    font-weight: 500;
  }
  .invite {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    padding: 1.5rem 1rem;
    border-radius: var(--radius);
    background: rgb(6 25 40 / 0.45);
    text-align: center;
  }
  .invite p {
    margin: 0;
  }
  .label {
    color: var(--mist);
    font-weight: 600;
  }
  .code {
    font-size: clamp(2.8rem, 12vw, 4rem);
    font-weight: 800;
    letter-spacing: 0.12em;
    font-variation-settings: "wdth" 75;
    color: var(--lantern);
    line-height: 1;
  }
  .hint {
    margin: 0;
    color: var(--mist);
    font-size: 0.95rem;
  }
  .seats {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: seat;
  }
  .seats li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 3rem;
    padding: 0.4rem 0.5rem 0.4rem 0.9rem;
    border-radius: 12px;
    background: rgb(18 74 99 / 0.55);
    counter-increment: seat;
  }
  .seats li::before {
    content: counter(seat);
    width: 1.2rem;
    color: var(--mist);
    font-weight: 700;
  }
  .seats li.me {
    box-shadow: inset 0 0 0 2px var(--glass);
  }
  .seats li.away .name {
    opacity: 0.55;
  }
  .name {
    font-weight: 700;
  }
  .tags {
    display: flex;
    gap: 0.3rem;
    flex: 1;
  }
  .tag {
    padding: 0.05rem 0.5rem;
    border-radius: 999px;
    background: rgb(168 201 214 / 0.16);
    color: var(--mist);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .tag.you {
    background: rgb(127 216 200 / 0.2);
    color: var(--glass);
  }
  .remove {
    min-height: 36px;
    padding: 0 0.8rem;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--mist);
    cursor: pointer;
  }
  .remove:hover {
    color: var(--foam);
    background: rgb(226 87 76 / 0.3);
  }
  .bots {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 0.9rem;
  }
  .settings {
    display: flex;
    align-items: end;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .settings .field {
    flex: 0 0 auto;
  }
  .settings input {
    width: 7rem;
  }
  .settings .hint {
    padding-bottom: 0.7rem;
  }
  footer {
    display: grid;
    gap: 0.5rem;
  }
  .big {
    min-height: 56px;
    font-size: 1.15rem;
  }
  .waiting {
    margin: 0;
    padding: 1rem;
    border-radius: var(--radius);
    background: rgb(6 25 40 / 0.45);
    text-align: center;
    color: var(--mist);
  }
</style>
