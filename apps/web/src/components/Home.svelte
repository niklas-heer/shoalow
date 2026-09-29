<script lang="ts">
  import { ApiError, createRoom } from "../lib/api.ts";
  import { router } from "../lib/router.svelte.ts";
  import { savedName, saveName, saveSeat } from "../lib/session.ts";
  import Card from "./Card.svelte";
  import GameGoal from "./GameGoal.svelte";
  import Logo from "./Logo.svelte";

  let { onrules }: { onrules: () => void } = $props();

  let name = $state(savedName());
  let code = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let targetScore = $state(100);

  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = "Enter your name first.";
      return;
    }
    busy = true;
    error = null;
    try {
      const room = await createRoom(name, targetScore);
      saveName(name.trim());
      saveSeat(room.code, room.token);
      router.go(`/r/${room.code}`);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
    } finally {
      busy = false;
    }
  }

  function join(event: SubmitEvent) {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(clean)) {
      error = "A table code has 5 letters and digits, like KX4PM.";
      return;
    }
    if (name.trim()) saveName(name.trim());
    router.go(`/r/${clean}`);
  }
</script>

<main class="home">
  <div class="fan" aria-hidden="true">
    <div class="c c1"><Card value={-2} /></div>
    <div class="c c2"><Card value={5} /></div>
    <div class="c c3"><Card value={12} /></div>
  </div>

  <h1><Logo size={56} /></h1>
  <p class="pitch">
    A card game for 2 to 10 players. Swap and reveal cards to keep your score low; pearls help, anglerfish hurt.
  </p>

  <form class="panel create" onsubmit={create}>
    <label class="field">
      Your name
      <input bind:value={name} maxlength="20" autocomplete="nickname" placeholder="e.g. Anna" />
    </label>
    <GameGoal value={targetScore} onchange={(score) => (targetScore = score)} />
    <button class="btn primary" disabled={busy}>Create a table</button>
  </form>

  <form class="panel join" onsubmit={join}>
    <label class="field">
      Got a code?
      <input bind:value={code} maxlength="5" autocapitalize="characters" placeholder="KX4PM" class="code" />
    </label>
    <button class="btn">Join table</button>
  </form>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="learn">
    <button class="btn" onclick={() => router.go("/learn")}>Learn with a practice game</button>
    <button class="btn quiet" onclick={onrules}>Read the rules</button>
  </div>
</main>

<style>
  .home {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    max-width: 30rem;
    margin: 0 auto;
    padding: 3rem 1.25rem 4rem;
    text-align: center;
  }
  .fan {
    position: relative;
    width: 15rem;
    height: 10.5rem;
    margin-bottom: 0.5rem;
  }
  .c {
    position: absolute;
    top: 0;
    left: 50%;
    width: 6.4rem;
    transform-origin: 50% 120%;
    filter: drop-shadow(0 10px 18px rgb(0 0 0 / 0.35));
  }
  .c1 {
    transform: translateX(-50%) rotate(-16deg) translateX(-2.2rem);
  }
  .c2 {
    transform: translateX(-50%) translateY(-0.6rem);
  }
  .c3 {
    transform: translateX(-50%) rotate(16deg) translateX(2.2rem);
  }
  .pitch {
    max-width: 26rem;
    margin: 0;
    color: var(--mist);
    font-size: 1.1rem;
  }
  .panel {
    display: flex;
    gap: 0.75rem;
    align-items: end;
    width: 100%;
    text-align: left;
  }
  .panel .field {
    flex: 1;
  }
  .join {
    padding-top: 1.25rem;
    border-top: 1px solid rgb(168 201 214 / 0.2);
  }
  .create { display: grid; gap: 1rem; padding: 1.25rem; border: 1px solid rgb(127 216 200 / 0.2); border-radius: 20px; background: rgb(6 25 40 / 0.35); }
  .code {
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }
  .learn {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
  .error {
    margin: 0;
    color: #ffb3aa;
    font-weight: 600;
  }
  @media (max-width: 420px) {
    .panel {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
