<script lang="ts">
  import { MAX_PLAYERS, MAX_TARGET_SCORE, MIN_TARGET_SCORE, type RoomView } from "@shoalow/game";
  import type { Connection } from "../lib/connection.svelte.ts";
  import { router } from "../lib/router.svelte.ts";
  import { forgetSeat } from "../lib/session.ts";
  import BotSpeed from "./BotSpeed.svelte";
  import GameGoal from "./GameGoal.svelte";
  import Logo from "./Logo.svelte";

  let { room, conn, onrules }: { room: RoomView; conn: Connection; onrules: () => void } = $props();

  const isHost = $derived(room.you === room.host);
  const full = $derived(room.seats.length >= MAX_PLAYERS);
  const hasBots = $derived(room.seats.some((s) => s.kind === "bot"));
  const link = $derived(`${location.origin}/r/${room.code}`);
  let copied = $state(false);

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

  function setTarget(score: number) {
    if (score >= MIN_TARGET_SCORE && score <= MAX_TARGET_SCORE && score !== room.settings.targetScore)
      conn.send({ t: "setTarget", score });
  }

  function leave() {
    conn.send({ t: "leave" });
    forgetSeat(room.code);
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
    <h2>Players <span class="count">{room.seats.length} of {MAX_PLAYERS} seats</span></h2>
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
      <h3>Add a bot</h3>
      <div class="bots">
        <button class="bot" disabled={full} onclick={() => conn.send({ t: "addBot", level: "easy" })}>
          <strong>Add easy bot</strong>
          <span>Makes loose, beatable choices. Good while you learn.</span>
        </button>
        <button class="bot" disabled={full} onclick={() => conn.send({ t: "addBot", level: "normal" })}>
          <strong>Add normal bot</strong>
          <span>Keeps low cards and hunts for columns. A fair opponent.</span>
        </button>
      </div>
      {#if full}<p class="hint">The table is full.</p>{/if}
    {/if}
  </section>

  <section class="settings">
    <h2>Game settings</h2>
    {#if !isHost}<p class="hint">Only the host can change these.</p>{/if}
    <div class="setting">
      <GameGoal
        value={room.settings.targetScore}
        humans={room.seats.filter((seat) => seat.kind === "human").length}
        bots={room.seats.filter((seat) => seat.kind === "bot").length}
        disabled={!isHost}
        onchange={setTarget}
      />
    </div>
    {#if hasBots}
      <div class="setting"><BotSpeed {room} link={conn} /></div>
    {/if}
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
  h3 {
    margin: 1.2rem 0 0.6rem;
    color: var(--mist);
    font-size: 1rem;
  }
  .bots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.6rem;
  }
  .bot {
    display: grid;
    gap: 0.2rem;
    padding: 0.8rem 1rem;
    border: 2px solid rgb(127 216 200 / 0.5);
    border-radius: var(--radius);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition:
      background 120ms,
      border-color 120ms;
  }
  .bot:hover:not(:disabled) {
    border-color: var(--glass);
    background: rgb(127 216 200 / 0.1);
  }
  .bot strong::before {
    content: "+ ";
    color: var(--glass);
  }
  .bot span {
    color: var(--mist);
    font-size: 0.9rem;
  }
  .bot:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .settings {
    display: grid;
    gap: 1.2rem;
  }
  .settings h2 {
    margin-bottom: 0;
  }
  .setting {
    display: grid;
    gap: 0.4rem;
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
