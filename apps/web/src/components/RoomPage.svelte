<script lang="ts">
  import { onDestroy } from "svelte";
  import { ApiError, joinRoom, type RoomInfo, roomInfo } from "../lib/api.ts";
  import { Connection } from "../lib/connection.svelte.ts";
  import { router } from "../lib/router.svelte.ts";
  import { forgetSeat, savedName, saveName, saveSeat, seatToken } from "../lib/session.ts";
  import GameMenu from "./GameMenu.svelte";
  import Lobby from "./Lobby.svelte";
  import Logo from "./Logo.svelte";
  import Table from "./Table.svelte";

  let { code, onrules }: { code: string; onrules: () => void } = $props();

  let conn = $state<Connection | null>(null);
  let info = $state<RoomInfo | null>(null);
  let missing = $state(false);
  let name = $state(savedName());
  let error = $state<string | null>(null);
  let busy = $state(false);
  let menuOpen = $state(false);
  let leaving = $state(false);

  // svelte-ignore state_referenced_locally
  const token = seatToken(code);
  if (token) {
    // svelte-ignore state_referenced_locally
    conn = new Connection(code, token);
  } else {
    // svelte-ignore state_referenced_locally
    roomInfo(code)
      .then((r) => {
        info = r;
      })
      .catch(() => {
        missing = true;
      });
  }

  onDestroy(() => conn?.close());

  $effect(() => {
    if (conn?.removed) {
      forgetSeat(code);
      if (leaving) router.go("/");
    }
    if (conn?.room?.status === "lobby") menuOpen = false;
  });

  async function join(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = "Enter your name first.";
      return;
    }
    busy = true;
    error = null;
    try {
      const seat = await joinRoom(code, name);
      saveName(name.trim());
      saveSeat(code, seat.token);
      conn = new Connection(code, seat.token);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
    } finally {
      busy = false;
    }
  }
</script>

{#if conn?.removed}
  <main class="notice">
    <Logo />
    <h1>You're no longer at table {code}</h1>
    <p>You left, the host removed your seat, or the table was closed.</p>
    <button class="btn primary" onclick={() => location.reload()}>Try to sit down again</button>
    <button class="btn quiet" onclick={() => router.go("/")}>Back to the start</button>
  </main>
{:else if conn?.room}
  {#if conn.room.status === "lobby"}
    <Lobby room={conn.room} {conn} {onrules} />
  {:else}
    <Table room={conn.room} {conn} {onrules}>
      {#snippet exit()}
        <button class="btn quiet small" onclick={() => (menuOpen = true)}>Game menu</button>
      {/snippet}
    </Table>
    {#if menuOpen}
      <GameMenu room={conn.room} {conn} onclose={() => (menuOpen = false)} onleave={() => {
        if (conn?.status !== "open") return;
        leaving = true;
        conn.send({ t: "leave" });
      }} />
    {/if}
  {/if}
{:else if conn}
  <main class="notice"><Logo /><p>Connecting to table {code}…</p></main>
{:else if missing}
  <main class="notice">
    <Logo />
    <h1>There's no table {code}</h1>
    <p>Check the code with whoever invited you. Tables close after 30 days without play.</p>
    <button class="btn primary" onclick={() => router.go("/")}>Back to the start</button>
  </main>
{:else if info?.status === "playing"}
  <main class="notice">
    <Logo />
    <h1>This game has already started</h1>
    <p>New players can join between games. Ask the host to start a new table, or wait for this one to finish.</p>
    <button class="btn" onclick={() => router.go("/")}>Back to the start</button>
  </main>
{:else if info}
  <main class="notice">
    <Logo />
    <h1>Join table {code}</h1>
    <p>{info.players} {info.players === 1 ? "player is" : "players are"} waiting.</p>
    <form onsubmit={join}>
      <label class="field">
        Your name
        <input bind:value={name} maxlength="20" autocomplete="nickname" />
      </label>
      <button class="btn primary" disabled={busy}>Take a seat</button>
    </form>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </main>
{:else}
  <main class="notice"><Logo /><p>Looking for table {code}…</p></main>
{/if}

{#if conn?.status === "reconnecting" && !conn.removed}
  <div class="toast" role="status">Connection lost. Reconnecting…</div>
{/if}
{#if conn?.error}
  <div class="toast warn" role="alert">{conn.error}</div>
{/if}

<style>
  .notice {
    display: grid;
    justify-items: center;
    gap: 1rem;
    max-width: 28rem;
    margin: 0 auto;
    padding: 4rem 1.25rem;
    text-align: center;
  }
  .notice p {
    margin: 0;
    color: var(--mist);
  }
  form {
    display: grid;
    gap: 0.75rem;
    width: 100%;
    text-align: left;
  }
  .error {
    color: #ffb3aa;
    font-weight: 600;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(1rem + env(safe-area-inset-bottom));
    z-index: 50;
    transform: translateX(-50%);
    padding: 0.6rem 1.1rem;
    border-radius: 999px;
    background: var(--shelf);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
    font-weight: 600;
  }
  .toast.warn {
    background: #7a2a24;
  }
</style>
