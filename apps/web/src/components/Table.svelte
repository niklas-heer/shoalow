<script lang="ts">
  import type { Action, GameEvent, RoomView } from "@shoalow/game";
  import { formatValue } from "../lib/cards.ts";
  import type { Connection } from "../lib/connection.svelte.ts";
  import { lastMove, prompt, seatName } from "../lib/describe.ts";
  import Board from "./Board.svelte";
  import Logo from "./Logo.svelte";
  import Piles from "./Piles.svelte";
  import RoundSummary from "./RoundSummary.svelte";
  import Scoreboard from "./Scoreboard.svelte";
  import SeatDialog from "./SeatDialog.svelte";

  let { room, conn, onrules }: { room: RoomView; conn: Connection; onrules: () => void } = $props();

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

  /** Opponents in turn order, starting with the player after me. */
  const opponents = $derived(room.seats.map((_, i) => (me + 1 + i) % room.seats.length).filter((i) => i !== me));

  const clearedFor = (player: number, list: GameEvent[]) =>
    list.flatMap((e) => (e.type === "columnCleared" && e.player === player ? [e.column] : []));

  let scoresOpen = $state(false);
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
  const tileWidth = $derived(room.seats.length <= 4 ? 9.5 : room.seats.length <= 7 ? 8 : 7);
</script>

{#if game && myBoard}
  <div class="table" class:my-turn={banner.yours}>
    <header class="bar">
      <Logo size={22} />
      <span class="meta">{room.code}, round {game.round}</span>
      <span class="actions">
        <button class="btn quiet small scores-toggle" onclick={() => (scoresOpen = !scoresOpen)} aria-expanded={scoresOpen}
          >Scores</button
        >
        <button class="btn quiet small" onclick={onrules}>Rules</button>
      </span>
    </header>

    <section class="opponents" aria-label="Other players" style:--tile="{tileWidth}rem">
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
            <Board board={board} size="sm" owner={seat.name} bursting={clearedFor(p, events)} />
            <span class="sub">
              {#if seat.takenOver}bot is playing{:else if seat.kind === "human" && !seat.connected}away{:else if game.endedBy === p}revealed all{:else}total {formatValue(game.totals[p] ?? 0)}{/if}
            </span>
          </button>
        {/if}
      {/each}
    </section>

    <section class="center">
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
    </section>

    <section class="mine" aria-label="Your cards">
      <div class="mine-head">
        <span class="name">You</span>
        <span class="stat"><strong>{formatValue(myBoard.visibleSum)}</strong> showing</span>
        <span class="stat"><strong>{formatValue(game.totals[me] ?? 0)}</strong> total</span>
      </div>
      <Board board={myBoard} owner="Your" selectable={canPick} onpick={pick} bursting={clearedFor(me, events)} />
    </section>

    <aside class="scores" class:open={scoresOpen} aria-label="Scoreboard">
      <div class="scores-head">
        <h2>Scores</h2>
        <button class="btn quiet small close" onclick={() => (scoresOpen = false)}>Close</button>
      </div>
      <Scoreboard {room} />
    </aside>
  </div>

  {#if summaryOpen}
    <RoundSummary {room} {conn} onhide={() => (hiddenSummaryRound = game.round)} />
  {/if}

  {#if focused !== null}
    <SeatDialog {room} {conn} seat={focused} onclose={() => (focused = null)} />
  {/if}
{/if}

<style>
  .table {
    --board-w: clamp(16rem, min(92vw, 50dvh), 28rem);
    display: grid;
    grid-template-areas: "bar" "opponents" "center" "mine";
    gap: 1rem;
    max-width: 90rem;
    min-height: 100dvh;
    margin: 0 auto;
    padding: 0.5rem 0.75rem calc(1.5rem + env(safe-area-inset-bottom));
  }
  .bar {
    grid-area: bar;
    display: flex;
    align-items: center;
    gap: 1rem;
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
    gap: 0.25rem;
  }
  :global(.btn.small) {
    min-height: 38px;
    padding: 0.3em 0.8em;
  }
  .opponents {
    grid-area: opponents;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-content: start;
    gap: 0.6rem;
  }
  .tile {
    display: grid;
    gap: 0.3rem;
    width: var(--tile);
    padding: 0.45rem;
    border: 2px solid transparent;
    border-radius: 12px;
    background: rgb(6 25 40 / 0.4);
    cursor: pointer;
    text-align: left;
    transition: border-color 200ms, box-shadow 200ms;
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
  .who .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .who .sum {
    font-variant-numeric: tabular-nums;
  }
  .sub {
    color: var(--mist);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .center {
    grid-area: center;
    display: grid;
    justify-items: center;
    gap: 0.9rem;
  }
  .banner {
    display: grid;
    gap: 0.15rem;
    min-height: 3.6rem;
    text-align: center;
  }
  .banner p {
    margin: 0;
  }
  .prompt {
    font-size: 1.25rem;
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
  .final {
    color: #ffc9a8;
    font-weight: 600;
  }
  .mine {
    grid-area: mine;
    display: grid;
    justify-content: center;
    align-content: start;
    gap: 0.5rem;
  }
  .mine :global(.board) {
    width: var(--board-w);
    --gap: 10px;
  }
  .mine-head {
    display: flex;
    align-items: baseline;
    gap: 1rem;
  }
  .mine-head .name {
    flex: 1;
    font-size: 1.2rem;
    font-weight: 800;
  }
  .stat {
    color: var(--mist);
  }
  .stat strong {
    color: var(--foam);
    font-size: 1.2rem;
    font-variant-numeric: tabular-nums;
  }
  .scores {
    position: fixed;
    inset: 0 0 0 auto;
    z-index: 30;
    width: min(24rem, 92vw);
    padding: 1rem;
    overflow-y: auto;
    background: #0b3147;
    box-shadow: -12px 0 40px rgb(0 0 0 / 0.45);
    transform: translateX(105%);
    transition: transform 240ms ease;
  }
  .scores.open {
    transform: none;
  }
  .scores-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .scores h2 {
    font-size: 1.2rem;
  }

  @media (min-width: 1100px) {
    .table {
      --board-w: clamp(18rem, 44dvh, 28rem);
      grid-template-columns: minmax(0, 1fr) auto 20rem;
      grid-template-areas:
        "bar bar bar"
        "opponents center scores"
        "opponents mine scores";
      grid-template-rows: auto auto 1fr;
      column-gap: 2rem;
    }
    .opponents {
      justify-content: flex-end;
    }
    .scores {
      grid-area: scores;
      position: static;
      width: auto;
      align-self: start;
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
  }
</style>
