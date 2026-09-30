<script lang="ts">
  import type { Action, GameEvent, RoomView } from "@shoalow/game";
  import { onMount, type Snippet, untrack } from "svelte";
  import { formatValue } from "../lib/cards.ts";
  import { confetti } from "../lib/confetti.ts";
  import type { TableLink } from "../lib/connection.svelte.ts";
  import { lastMove, prompt, seatName, won } from "../lib/describe.ts";
  import { playFlights } from "../lib/flights.ts";
  import { motion } from "../lib/motion.ts";
  import { sound } from "../lib/sound.svelte.ts";
  import Board from "./Board.svelte";
  import Logo from "./Logo.svelte";
  import Piles from "./Piles.svelte";
  import RoundSummary from "./RoundSummary.svelte";
  import RoundsDialog from "./RoundsDialog.svelte";
  import SeatDialog from "./SeatDialog.svelte";
  import Standings from "./Standings.svelte";
  import Trophy from "./Trophy.svelte";
  import TurnSteps from "./TurnSteps.svelte";

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

  // The table fills the screen; a game started from the bottom of the lobby should open at the top.
  onMount(() => scrollTo(0, 0));

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
      if (list.some((e) => e.type === "gameOver")) confetti();
    });
  });

  /** Opponents in turn order, starting with the player after me. */
  const opponents = $derived(room.seats.map((_, i) => (me + 1 + i) % room.seats.length).filter((i) => i !== me));

  // Fit every opponent on one row where possible, otherwise on as many rows as the screen height
  // allows. Tiles never go below a readable size: past that the strip scrolls sideways.
  let stripWidth = $state(0);
  let viewHeight = $state(900);
  const TILE_MIN = 76;
  const TILE_MAX = 150;
  const TILE_GAP = 8;
  const strip = $derived.by(() => {
    const n = Math.max(1, opponents.length);
    const width = stripWidth || 900;
    // Phones keep one swipeable row so your own cards stay large.
    const maxRows = viewHeight < 500 || width < 600 ? 1 : viewHeight < 950 ? 2 : 3;
    const maxTile = Math.min(width < 600 ? 120 : TILE_MAX, Math.max(90, viewHeight * 0.14));
    for (let rows = 1; rows <= maxRows; rows++) {
      const cols = Math.ceil(n / rows);
      const tile = (width - (cols - 1) * TILE_GAP) / cols;
      if (tile >= TILE_MIN || cols === 1) return { cols, tile: Math.min(maxTile, tile) };
    }
    return { cols: Math.ceil(n / maxRows), tile: TILE_MIN };
  });

  // When the strip scrolls, keep the player whose turn it is in view.
  let stripEl = $state<HTMLElement>();
  $effect(() => {
    const current = game?.phase === "turn" ? game.current : null;
    const tile = current === null ? null : stripEl?.querySelector<HTMLElement>(`[data-seat="${current}"]`);
    if (!stripEl || !tile || stripEl.scrollWidth <= stripEl.clientWidth) return;
    const left = tile.offsetLeft - (stripEl.clientWidth - tile.offsetWidth) / 2;
    stripEl.scrollTo({ left, behavior: motion(1) ? "smooth" : "auto" });
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

  // With a mouse or keyboard, the card you point at shows the held card over it and the card it
  // would replace on the discard pile.
  let hovered = $state<number | null>(null);
  const preview = $derived.by(() => {
    if (hovered === null || !game || game.hand === null || !canPick(hovered)) return null;
    if (game.stage !== "drawn" && game.stage !== "fromDiscard") return null;
    return { index: hovered, value: game.hand };
  });
  const outgoing = $derived.by(() => {
    const card = preview && myBoard?.cards[preview.index];
    return card ? { value: card.faceUp ? card.value : null } : null;
  });
</script>

<svelte:window bind:innerHeight={viewHeight} />

{#if game && myBoard}
  <div class="table" class:my-turn={banner.yours} class:coached={!!coach}>
    <header class="bar">
      <Logo size={22} />
      <span class="meta"><span class="code">{`${room.code}, `}</span>round {game.round}</span>
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

    <section class="opponents" aria-label="Other players" bind:this={stripEl} bind:clientWidth={stripWidth}>
      <div
        class="strip"
        class:compact={strip.tile < 110}
        style:--cols={strip.cols}
        style:--tile="{strip.tile}px"
        style:--tile-gap="{TILE_GAP}px"
      >
        {#each opponents as p (p)}
          {@const seat = room.seats[p]}
          {@const board = game.boards[p]}
          {#if seat && board}
            <button
              data-seat={p}
              class="tile"
              class:current={game.phase === "turn" && game.current === p}
              class:away={seat.kind === "human" && !seat.connected && !seat.takenOver}
              onclick={() => (focused = p)}
              aria-label="{seat.name}{won(game, p) ? ', winner' : ''}, {board.visibleSum} showing, {game.totals[p]} total. Show larger"
            >
              <span class="who">
                <span class="name">{seat.name}</span>
                {#if won(game, p)}<Trophy />{/if}
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
      </div>
    </section>

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

    <div class="turn-steps"><TurnSteps {game} who={holder} mine={game.current === me} /></div>

    {#if coach}<div class="coach">{@render coach()}</div>{/if}

    <div class="left">
      <Piles
        {game}
        {holder}
        canDraw={myTurn && game.stage === "choose"}
        canTake={myTurn && game.stage === "choose" && game.discardTop !== null}
        canDrop={myTurn && game.stage === "drawn" && myBoard.faceDown > 0}
        ondraw={() => act({ type: "drawDeck" })}
        ontake={() => act({ type: "takeDiscard" })}
        ondrop={() => act({ type: "discardHand" })}
        {outgoing}
      />
    </div>

    <section class="mine" aria-label="Your cards">
      <div class="mine-head">
        <span class="name">You{#if won(game, me)}<Trophy />{/if}</span>
        <span class="stat"><strong>{formatValue(myBoard.visibleSum)}</strong> showing</span>
        <span class="stat"><strong>{formatValue(game.totals[me] ?? 0)}</strong> total</span>
      </div>
      <p class="board-hint" class:active={banner.yours}>
        {#if game.phase === "initialFlip" && myBoard.initialFlips < 2}{myBoard.initialFlips === 0 ? "Tap any two cards to reveal" : "Tap one more card to reveal"}
        {:else if game.phase !== "turn"}Match three in a column to clear them{/if}
      </p>
      <Board
        board={myBoard}
        owner="Your"
        anchor="slot-{me}"
        selectable={canPick}
        action={game.phase === "initialFlip" || game.stage === "mustFlip" ? "Reveal this card" : `Swap with your ${game.hand}`}
        onpick={pick}
        bursting={clearedFor(me, events)}
        {preview}
        onhover={(i) => (hovered = i)}
      />
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
  /*
   * The table always fits the screen: the bar, the other players, the prompt and the piles
   * take what they need, and your own cards get the rest, sized by height as well as width.
   * Phones (the default) put the prompt beside the piles. Landscape phones move your cards
   * into their own column. Tablets and desktops put the piles beside your cards, and wide
   * screens add the score column.
   */
  .table {
    --card-gap: clamp(6px, 1.6vw, 10px);
    --head-h: 2.5rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto auto auto minmax(15rem, 1fr);
    grid-template-areas: "bar bar" "opponents opponents" "banner left" "steps steps" "mine mine";
    gap: 0.6rem 0.75rem;
    max-width: 100rem;
    min-height: calc(100dvh - env(safe-area-inset-top));
    margin: 0 auto;
    padding: 0.4rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
  /* The practice game has a single opponent, so on phones the coach sits beside it. */
  .table.coached {
    grid-template-columns: minmax(0, 1fr) auto 6.5rem;
    grid-template-areas: "bar bar bar" "coach coach opponents" "banner left left" "steps steps steps" "mine mine mine";
  }
  .bar {
    grid-area: bar;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  .bar :global(.logo .word) {
    display: none;
  }
  .meta {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--mist);
    font-size: 0.95rem;
    font-weight: 600;
  }
  .meta .code {
    display: none;
  }
  @media (max-width: 380px) {
    .meta {
      visibility: hidden;
    }
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.1rem;
  }
  :global(.btn.small) {
    min-height: 44px;
    padding: 0.3em 0.6em;
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
    position: relative;
    grid-area: opponents;
    min-width: 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  .strip {
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--tile));
    gap: var(--tile-gap);
    width: max-content;
    margin-inline: auto;
  }
  .tile {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 0.3rem;
    min-width: 0;
    padding: 0.4rem;
    border: 2px solid transparent;
    border-radius: 12px;
    background: rgb(6 25 40 / 0.4);
    cursor: pointer;
    text-align: left;
    touch-action: manipulation;
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
    align-items: center;
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
    margin-left: auto;
    padding-left: 0.3rem;
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

  .banner {
    grid-area: banner;
    display: grid;
    align-content: center;
    gap: 0.3rem;
    min-width: 0;
  }
  .banner p {
    margin: 0;
  }
  .banner .btn {
    justify-self: start;
    padding-inline: 0.9em;
    font-size: 0.9rem;
  }
  .prompt {
    font-size: 1.05rem;
    font-weight: 750;
    letter-spacing: -0.01em;
    line-height: 1.25;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }
  /* A filter glow, unlike text-shadow, is not cut off by the line clamp's overflow. */
  .yours .prompt {
    color: var(--lantern);
    filter: drop-shadow(0 0 14px rgb(255 226 122 / 0.4));
  }
  .move,
  .final {
    color: var(--mist);
    font-size: 0.85rem;
    line-height: 1.3;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .prompt,
  .move,
  .final {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .final {
    color: #ffc9a8;
    font-weight: 600;
  }
  .coach {
    grid-area: coach;
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  /* Phones give the steps their own row above your cards: a fixed height, so nothing moves. */
  .turn-steps {
    --steps-justify: center;
    grid-area: steps;
    align-self: start;
    min-width: 0;
  }
  .left {
    grid-area: left;
    align-self: center;
    min-width: 0;
  }
  .left :global(.piles) {
    --pile-w: clamp(3.3rem, 15vw, 4.6rem);
    gap: 0.45rem;
  }

  /* Your grid is as large as the space below the head allows, in both directions. */
  .mine {
    --above: calc(var(--head-h) + 0.4rem);
    --board-w: min(
      100cqw,
      36rem,
      calc((100cqh - var(--above) - 2 * var(--card-gap)) / 1.05 + 3 * var(--card-gap))
    );
    grid-area: mine;
    container-type: size;
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 0.4rem;
    min-width: 0;
  }
  .mine > :global(*) {
    width: var(--board-w);
  }
  .mine > .mine-head {
    width: max(var(--board-w), min(100%, 19rem));
  }
  .mine :global(.board) {
    --gap: var(--card-gap);
  }
  .mine-head {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    height: var(--head-h);
    padding: 0.35rem 0.75rem;
    border-radius: 12px;
    background: rgb(127 216 200 / 0.08);
    white-space: nowrap;
  }
  .mine-head .name {
    flex: 1;
    font-size: 1.15rem;
    font-weight: 800;
  }
  .stat {
    color: var(--mist);
    font-size: 0.9rem;
  }
  .stat strong {
    color: var(--foam);
    font-size: 1.15rem;
    font-variant-numeric: tabular-nums;
  }
  .board-hint {
    display: none;
    align-items: center;
    justify-content: center;
    height: 2rem;
    margin: 0;
    color: var(--mist);
    font-size: 1rem;
    text-align: center;
  }
  .board-hint.active {
    color: var(--lantern);
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
    padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
      calc(1rem + env(safe-area-inset-bottom)) 1rem;
    overflow-y: auto;
    background: #0b3147;
    box-shadow: -12px 0 40px rgb(0 0 0 / 0.45);
    transform: translateX(105%);
    transition: transform 240ms ease;
    -webkit-user-select: text;
    user-select: text;
  }
  .side.open {
    visibility: visible;
    transform: none;
  }
  .close {
    justify-self: end;
  }

  /* Landscape phones: everything else on the left, your cards on the right. */
  @media (min-width: 640px) and (max-height: 500px) {
    .table,
    .table.coached {
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 0.9fr);
      grid-template-rows: auto auto auto auto 1fr;
      grid-template-areas:
        "bar bar mine"
        "opponents opponents mine"
        "banner left mine"
        "steps left mine"
        ". . mine";
      column-gap: 1rem;
    }
    .table.coached {
      grid-template-areas:
        "bar bar mine"
        "coach opponents mine"
        "banner left mine"
        "steps left mine"
        ". . mine";
    }
    .sub {
      display: none;
    }
    .turn-steps {
      --steps-justify: start;
    }
    .left :global(.piles) {
      --pile-w: min(4.2rem, 16dvh);
    }
  }

  /* Tablets and desktops: the prompt spans the table, the piles sit beside your cards. */
  @media (min-width: 700px) and (min-height: 501px) {
    .table,
    .table.coached {
      grid-template-columns: minmax(13rem, 22rem) minmax(0, 36rem);
      grid-template-rows: auto auto auto auto minmax(12rem, 1fr);
      grid-template-areas:
        "bar bar"
        "opponents opponents"
        "banner banner"
        "coach mine"
        "left mine";
      --head-h: 3rem;
      justify-content: center;
      gap: 0.9rem 1.5rem;
      padding-top: 0.5rem;
    }
    .bar {
      gap: 0.75rem;
    }
    .bar :global(.logo .word),
    .meta .code {
      display: inline;
    }
    :global(.btn.small) {
      padding-inline: 0.8em;
    }
    .banner {
      grid-template-rows: 3.6rem 1.6rem;
      justify-items: center;
      width: min(100%, 55rem);
      justify-self: center;
      text-align: center;
    }
    .banner .btn {
      justify-self: center;
      font-size: 1rem;
    }
    .prompt {
      font-size: clamp(1.15rem, 2.3vw, 1.55rem);
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }
    .move,
    .final {
      font-size: 0.95rem;
      -webkit-line-clamp: 1;
      line-clamp: 1;
    }
    .coach {
      justify-items: stretch;
      align-self: start;
    }
    .left {
      align-self: start;
    }
    .left :global(.piles) {
      --pile-w: min(7rem, calc((100% - 2rem) / 3));
      justify-content: start;
      gap: 1rem;
    }
    .mine {
      justify-items: start;
      --above: calc(var(--head-h) + 2rem + 0.8rem);
    }
    .mine-head .name {
      font-size: 1.4rem;
    }
    .stat {
      font-size: 0.95rem;
    }
    .stat strong {
      font-size: 1.4rem;
    }
    .board-hint {
      display: flex;
    }
    /* During turns the steps take the hint's row above your cards, so they cost no height. */
    .turn-steps {
      --steps-justify: start;
      grid-area: mine;
      display: flex;
      align-items: center;
      height: 2rem;
      margin-top: calc(var(--head-h) + 0.4rem);
    }
  }

  @media (min-width: 1200px) and (min-height: 501px) {
    .table,
    .table.coached {
      grid-template-columns: minmax(13rem, 22rem) minmax(0, 36rem) 19rem;
      grid-template-areas:
        "bar bar bar"
        "opponents opponents side"
        "banner banner side"
        "coach mine side"
        "left mine side";
    }
    .side {
      visibility: visible;
      grid-area: side;
      position: static;
      contain: size;
      width: auto;
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
