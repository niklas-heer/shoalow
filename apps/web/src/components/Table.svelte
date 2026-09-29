<script lang="ts">
  import type { Action, GameEvent, RoomView } from "@shoalow/game";
  import { type Snippet, untrack } from "svelte";
  import { formatValue } from "../lib/cards.ts";
  import type { TableLink } from "../lib/connection.svelte.ts";
  import { lastMove, prompt, seatName } from "../lib/describe.ts";
  import { playFlights } from "../lib/flights.ts";
  import { sound } from "../lib/sound.svelte.ts";
  import Board from "./Board.svelte";
  import Logo from "./Logo.svelte";
  import Piles from "./Piles.svelte";
  import RoundSummary from "./RoundSummary.svelte";
  import RoundsDialog from "./RoundsDialog.svelte";
  import SeatDialog from "./SeatDialog.svelte";
  import Standings from "./Standings.svelte";

  let {
    room,
    conn,
    onrules,
    coach,
    exit,
  }: {
    room: RoomView;
    conn: TableLink;
    onrules: () => void;
    /** Extra guidance shown under the banner, used by the tutorial. */
    coach?: Snippet;
    /** Extra control at the end of the top bar. */
    exit?: Snippet;
  } = $props();

  const game = $derived(room.game);
  const me = $derived(room.you);
  const myBoard = $derived(game?.boards[me]);
  const myTurn = $derived(game?.phase === "turn" && game.current === me);
  const banner = $derived(prompt(room));
  const events = $derived(conn.events.list);
  let moveLine = $state<string | null>(null);
  $effect(() => {
    const line = lastMove(room, events);
    if (line) moveLine = line;
  });

  // Animate and sound each update once, after the DOM shows the new state.
  let seenSeq = 0;
  $effect(() => {
    const { seq, list } = conn.events;
    if (seq === seenSeq) return;
    const first = seenSeq === 0;
    seenSeq = seq;
    if (first) return;
    untrack(() => {
      playFlights(list);
      sound.play(list, me);
    });
  });

  /** Opponents in turn order, starting with the player after me. */
  const opponents = $derived(room.seats.map((_, i) => (me + 1 + i) % room.seats.length).filter((i) => i !== me));

  // Fit every opponent on one row where possible, otherwise two or three, never below a readable size.
  let stripWidth = $state(0);
  const TILE_MIN = 76;
  const TILE_MAX = 150;
  const TILE_GAP = 8;
  const strip = $derived.by(() => {
    const n = Math.max(1, opponents.length);
    const width = stripWidth || 900;
    for (let rows = 1; ; rows++) {
      const cols = Math.ceil(n / rows);
      const tile = (width - (cols - 1) * TILE_GAP) / cols;
      if (tile >= TILE_MIN || cols === 1) return { cols, tile: Math.min(width < 600 ? 120 : TILE_MAX, tile) };
    }
  });

  const clearedFor = (player: number, list: GameEvent[]) =>
    list.flatMap((e) => (e.type === "columnCleared" && e.player === player ? [e.column] : []));

  let scoresOpen = $state(false);
  let roundsOpen = $state(false);
  let focused = $state<number | null>(null);
  let hiddenSummaryRound = $state<number | null>(null);
  const summaryOpen = $derived(
    !!game && (game.phase === "roundOver" || game.phase === "gameOver") && hiddenSummaryRound !== game.round,
  );

  $effect(() => {
    document.title = myTurn || banner.yours ? "Your turn! Shoalow" : "Shoalow";
    return () => {
      document.title = "Shoalow";
    };
  });

  function act(action: Action) {
    conn.send({ t: "action", action });
  }

  function canPick(i: number): boolean {
    if (!game || !myBoard) return false;
    const card = myBoard.cards[i];
    if (!card) return false;
    if (game.phase === "initialFlip") return myBoard.initialFlips < 2 && !card.faceUp;
    if (!myTurn) return false;
    if (game.stage === "mustFlip") return !card.faceUp;
    return game.stage === "drawn" || game.stage === "fromDiscard";
  }

  function pick(i: number) {
    if (!game || !canPick(i)) return;
    if (game.phase === "initialFlip" || game.stage === "mustFlip") act({ type: "flip", index: i });
    else act({ type: "swap", index: i });
  }

  const holder = $derived(game ? seatName(room, game.current) : "");
</script>

{#if game && myBoard}
  <div class="table" class:my-turn={banner.yours}>
    <header class="bar">
      <Logo size={22} />
      <span class="meta">{room.code}, round {game.round}</span>
      <span class="actions">
        <button
          class="btn quiet small icon"
          onclick={() => sound.toggle()}
          aria-pressed={sound.enabled}
          aria-label="Sound"
          title={sound.enabled ? "Sound on" : "Sound off"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
            {#if sound.enabled}
              <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            {:else}
              <path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            {/if}
          </svg>
        </button>
        <button class="btn quiet small scores-toggle" onclick={() => (scoresOpen = !scoresOpen)} aria-expanded={scoresOpen}
          >Scores</button
        >
        <button class="btn quiet small" onclick={onrules}>Rules</button>
        {@render exit?.()}
      </span>
    </header>

    <section
      class="opponents"
      class:compact={strip.tile < 110}
      aria-label="Other players"
      bind:clientWidth={stripWidth}
      style:--cols={strip.cols}
      style:--tile="{strip.tile}px"
      style:--tile-gap="{TILE_GAP}px"
    >
      {#each opponents as p (p)}
        {@const seat = room.seats[p]}
        {@const board = game.boards[p]}
        {#if seat && board}
          <button
            class="tile"
            class:current={game.phase === "turn" && game.current === p}
            class:away={seat.kind === "human" && !seat.connected && !seat.takenOver}
            onclick={() => (focused = p)}
            aria-label="{seat.name}, {board.visibleSum} showing, {game.totals[p]} total. Show larger"
          >
            <span class="who">
              <span class="name">{seat.name}</span>
              <span class="sum">{formatValue(board.visibleSum)}</span>
            </span>
            <Board
              {board}
              size="sm"
              owner={seat.name}
              anchor="slot-{p}"
              bursting={clearedFor(p, events)}
            />
            <span class="sub">
              {#if seat.takenOver}bot is playing{:else if seat.kind === "human" && !seat.connected}away{:else if game.endedBy === p}revealed all{:else}{board.faceDown} hidden{/if}
            </span>
          </button>
        {/if}
      {/each}
    </section>

    <section class="play">
      <div class="banner" class:yours={banner.yours} role="status">
        <p class="prompt">{banner.text}</p>
        {#if game.phase === "roundOver" || game.phase === "gameOver"}
          <button class="btn primary" onclick={() => (hiddenSummaryRound = null)}>
            {game.phase === "gameOver" ? "Show final results" : "Show round results"}
          </button>
        {:else if game.endedBy !== null && game.phase === "turn"}
          <p class="final">{seatName(room, game.endedBy)} revealed every card. Everyone else gets one last turn.</p>
        {:else if moveLine}
          <p class="move">{moveLine}</p>
        {/if}
      </div>

      <div class="field">
        <div class="left">
          {@render coach?.()}
          <Piles
          {game}
          {holder}
          canDraw={myTurn && game.stage === "choose"}
          canTake={myTurn && game.stage === "choose" && game.discardTop !== null}
          canDrop={myTurn && game.stage === "drawn" && myBoard.faceDown > 0}
          ondraw={() => act({ type: "drawDeck" })}
          ontake={() => act({ type: "takeDiscard" })}
          ondrop={() => act({ type: "discardHand" })}
          />
        </div>

        <section class="mine" aria-label="Your cards">
          <div class="mine-head">
            <span class="name">You</span>
            <span class="stat"><strong>{formatValue(myBoard.visibleSum)}</strong> showing</span>
            <span class="stat"><strong>{formatValue(game.totals[me] ?? 0)}</strong> total</span>
          </div>
          <p class="board-hint" class:active={banner.yours}>
            {#if game.phase === "initialFlip" && myBoard.initialFlips < 2}{myBoard.initialFlips === 0 ? "Tap any two cards to reveal" : "Tap one more card to reveal"}
            {:else if myTurn && game.stage === "mustFlip"}Tap a face-down card to reveal it
            {:else if myTurn && (game.stage === "drawn" || game.stage === "fromDiscard")}Tap a card below to swap in your {game.hand}
            {:else}Match three in a column to clear them{/if}
          </p>
          <Board
            board={myBoard}
            owner="Your"
            anchor="slot-{me}"
            selectable={canPick}
            action={game.phase === "initialFlip" || game.stage === "mustFlip" ? "Reveal this card" : `Swap with your ${game.hand}`}
            onpick={pick}
            bursting={clearedFor(me, events)}
          />
        </section>
      </div>
    </section>

    <aside class="side" class:open={scoresOpen}>
      <button class="btn quiet small close" onclick={() => (scoresOpen = false)}>Close</button>
      <Standings {room} link={conn} onrounds={() => (roundsOpen = true)} />
    </aside>
  </div>

  {#if summaryOpen}
    <RoundSummary {room} {conn} onhide={() => (hiddenSummaryRound = game.round)} />
  {/if}

  {#if focused !== null}
    <SeatDialog {room} {conn} seat={focused} onclose={() => (focused = null)} />
  {/if}

  {#if roundsOpen}
    <RoundsDialog {room} onclose={() => (roundsOpen = false)} />
  {/if}
{/if}

<style>
  .table {
    --board-w: min(100%, 36rem);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "bar" "opponents" "play";
    align-content: start;
    gap: 0.9rem;
    max-width: 100rem;
    min-height: 100dvh;
    margin: 0 auto;
    padding: 0.5rem 0.75rem calc(1.5rem + env(safe-area-inset-bottom));
  }
  .bar {
    grid-area: bar;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .meta {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--mist);
    font-size: 0.95rem;
    font-weight: 600;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }
  :global(.btn.small) {
    min-height: 44px;
    padding: 0.3em 0.8em;
  }
  .icon {
    width: 44px;
    padding: 0;
  }
  .icon svg {
    width: 22px;
    height: 22px;
  }
  .icon[aria-pressed="false"] {
    opacity: 0.6;
  }

  .opponents {
    grid-area: opponents;
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--tile));
    justify-content: center;
    gap: var(--tile-gap);
  }
  .tile {
    display: grid;
    align-content: start;
    gap: 0.3rem;
    min-width: 0;
    padding: 0.4rem;
    border: 2px solid transparent;
    border-radius: 12px;
    background: rgb(6 25 40 / 0.4);
    cursor: pointer;
    text-align: left;
    transition:
      border-color 200ms,
      box-shadow 200ms,
      transform 200ms;
  }
  .compact .tile {
    gap: 0.2rem;
    padding: 0.3rem;
    border-radius: 9px;
  }
  .tile:hover {
    border-color: rgb(127 216 200 / 0.35);
  }
  .tile.current {
    border-color: var(--lantern);
    box-shadow: 0 0 20px rgb(255 226 122 / 0.3);
  }
  .tile.away {
    opacity: 0.55;
  }
  .who {
    display: flex;
    justify-content: space-between;
    gap: 0.3rem;
    font-size: 0.85rem;
    font-weight: 700;
  }
  .compact .who {
    font-size: 0.72rem;
  }
  .who .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .who .sum {
    font-variant-numeric: tabular-nums;
  }
  .sub {
    overflow: hidden;
    color: var(--mist);
    font-size: 0.72rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .play {
    grid-area: play;
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 0.9rem;
  }
  .banner {
    display: grid;
    gap: 0.15rem;
    grid-template-rows: 5rem 3.2rem;
    align-items: center;
    width: min(100%, 55rem);
    min-height: 8.5rem;
    text-align: center;
  }
  .banner p {
    margin: 0;
  }
  .prompt {
    font-size: clamp(1.15rem, 2.3vw, 1.55rem);
    font-weight: 750;
    letter-spacing: -0.01em;
  }
  .yours .prompt {
    color: var(--lantern);
    text-shadow: 0 0 22px rgb(255 226 122 / 0.45);
  }
  .move,
  .final {
    color: var(--mist);
    font-size: 0.95rem;
  }
  .prompt, .move, .final {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .final {
    color: #ffc9a8;
    font-weight: 600;
  }
  .field {
    display: grid;
    justify-items: center;
    gap: 1rem;
    width: 100%;
  }
  .left {
    display: grid;
    justify-items: center;
    gap: 1rem;
    width: 100%;
  }
  .field :global(.piles) {
    --pile-w: clamp(5.2rem, 23vw, 6rem);
  }
  .mine {
    display: grid;
    gap: 0.5rem;
    width: var(--board-w);
  }
  .mine :global(.board) {
    --gap: clamp(6px, 1.6vw, 10px);
  }
  .mine-head {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
    border-radius: 12px;
    background: rgb(127 216 200 / 0.08);
  }
  .board-hint { margin: 0; min-height: 3.2rem; display: grid; align-items: center; color: var(--mist); font-size: 1rem; text-align: center; }
  .board-hint.active { color: var(--lantern); }
  .mine-head .name {
    flex: 1;
    font-size: 1.4rem;
    font-weight: 800;
  }
  .stat {
    color: var(--mist);
    font-size: 0.95rem;
  }
  .stat strong {
    color: var(--foam);
    font-size: 1.4rem;
    font-variant-numeric: tabular-nums;
  }

  .side {
    visibility: hidden;
    position: fixed;
    inset: 0 0 0 auto;
    z-index: 30;
    display: grid;
    align-content: start;
    gap: 0.5rem;
    width: min(22rem, 92vw);
    padding: 1rem;
    overflow-y: auto;
    background: #0b3147;
    box-shadow: -12px 0 40px rgb(0 0 0 / 0.45);
    transform: translateX(105%);
    transition: transform 240ms ease;
  }
  .side.open {
    visibility: visible;
    transform: none;
  }
  .close {
    justify-self: end;
  }

  @media (min-width: 1000px) {
    .table {
      grid-template-columns: minmax(0, 1fr) 19rem;
      grid-template-areas:
        "bar bar"
        "opponents side"
        "play side";
      grid-template-rows: auto auto 1fr;
      column-gap: 1.5rem;
    }
    .side {
      visibility: visible;
      grid-area: side;
      position: sticky;
      top: 0.5rem;
      width: auto;
      align-self: start;
      max-height: calc(100dvh - 1rem);
      border-radius: var(--radius);
      background: rgb(6 25 40 / 0.4);
      box-shadow: none;
      transform: none;
      transition: none;
    }
    .scores-toggle,
    .close {
      display: none;
    }
    .field :global(.piles) {
      --pile-w: 7rem;
    }
  }

  @media (max-width: 600px) {
    .bar { flex-wrap: wrap; gap: 0.25rem 0.75rem; }
    .meta { min-width: 0; }
    .actions { flex-basis: 100%; justify-content: flex-end; }
  }

  @media (min-width: 1240px) {
    .field {
      grid-template-columns: minmax(14rem, 23rem) minmax(0, 36rem);
      justify-content: center;
      align-items: start;
      column-gap: 2rem;
    }
    .left {
      justify-items: stretch;
    }
    .mine {
      width: 100%;
    }
    .left :global(.piles) {
      justify-content: start;
    }
  }
</style>
