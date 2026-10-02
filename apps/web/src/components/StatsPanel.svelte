<script lang="ts">
  import type { Stats } from "@shoalow/game";
  import { onDestroy, onMount } from "svelte";
  import { fetchStats } from "../lib/api.ts";
  import { formatValue } from "../lib/cards.ts";

  const REFRESH_MS = 30_000;

  let stats = $state<Stats | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;

  async function load() {
    if (document.hidden) return;
    try {
      stats = await fetchStats();
    } catch {
      // Keep the last numbers; the panel simply stays as it was.
    }
  }

  onMount(() => {
    void load();
    timer = setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
  });
  onDestroy(() => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", load);
  });

  const number = new Intl.NumberFormat("en");
  const since = $derived(
    stats ? new Date(stats.since).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "",
  );
  const plural = (n: number, one: string, many: string) => `${number.format(n)} ${n === 1 ? one : many}`;
</script>

{#if stats}
  <aside class="stats" aria-labelledby="stats-title">
    <h2 id="stats-title">In the shallows</h2>
    <p class="live" class:quiet={stats.live.players === 0}>
      <span class="dot" aria-hidden="true"></span>
      {#if stats.live.players === 0}
        Nobody is playing right now
      {:else}
        Now: {plural(stats.live.players, "person", "people")} at {plural(stats.live.tables, "table", "tables")}
      {/if}
    </p>
    <dl>
      <div><dt>Players</dt><dd>{number.format(stats.players)}</dd></div>
      <div><dt>This month</dt><dd>{number.format(stats.playersMonth)}</dd></div>
      <div><dt>Tables opened</dt><dd>{number.format(stats.tables)}</dd></div>
      <div><dt>Games played</dt><dd>{number.format(stats.gamesFinished)}</dd></div>
      <div><dt>Rounds</dt><dd>{number.format(stats.rounds)}</dd></div>
      <div><dt>Columns cleared</dt><dd>{number.format(stats.columnsCleared)}</dd></div>
      <div><dt>Piles reshuffled</dt><dd>{number.format(stats.reshuffles)}</dd></div>
      <div>
        <dt>Best round</dt>
        <dd>{stats.bestRound === null ? "–" : formatValue(stats.bestRound)}</dd>
      </div>
    </dl>
    <p class="since">Counted since {since}. Players are counted per browser; nothing personal is kept.</p>
  </aside>
{/if}

<style>
  .stats {
    display: grid;
    gap: 0.8rem;
    width: 100%;
    padding: 1.1rem 1.2rem;
    border: 1px solid rgb(127 216 200 / 0.2);
    border-radius: 20px;
    background: rgb(6 25 40 / 0.35);
    text-align: left;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .live {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    color: var(--foam);
    font-weight: 650;
  }
  .live.quiet {
    color: var(--mist);
    font-weight: 500;
  }
  .dot {
    flex: none;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--glass);
    box-shadow: 0 0 0 0 rgb(127 216 200 / 0.6);
    animation: ping 2.4s ease-out infinite;
  }
  .quiet .dot {
    background: var(--mist);
    opacity: 0.5;
    animation: none;
  }
  @keyframes ping {
    70% {
      box-shadow: 0 0 0 0.45rem rgb(127 216 200 / 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
  dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem 1rem;
    margin: 0;
  }
  dl div {
    display: grid;
    gap: 0.05rem;
  }
  dt {
    color: var(--mist);
    font-size: 0.85rem;
    white-space: nowrap;
  }
  dd {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
  }
  .since {
    margin: 0;
    color: var(--mist);
    font-size: 0.8rem;
  }
</style>
