<script lang="ts">
  import { MAX_TARGET_SCORE, MIN_TARGET_SCORE } from "@shoalow/game";

  let {
    value = 100,
    humans = 2,
    bots = 0,
    disabled = false,
    onchange,
  }: {
    value?: number;
    humans?: number;
    bots?: number;
    disabled?: boolean;
    onchange: (score: number) => void;
  } = $props();
  // A planning estimate, not a timer: roughly 15–30 points gained per round.
  const minutes = $derived.by(() => {
    const pace = 2 + Math.max(2 - bots, humans) * 1.2 + bots * 0.3;
    const low = Math.max(5, Math.round((Math.ceil(value / 30) * pace) / 5) * 5);
    const high = Math.max(low + 5, Math.round((Math.ceil(value / 15) * pace) / 5) * 5);
    return `${low}–${high}`;
  });
</script>

<div class="goal">
  <div class="heading"><label for="game-goal">Game goal</label><span class="value"><strong>{value}</strong> points</span></div>
  <input id="game-goal" type="range" min={MIN_TARGET_SCORE} max={MAX_TARGET_SCORE} step="1" {value} {disabled}
    aria-describedby="goal-estimate goal-rule" oninput={(event) => onchange(Number(event.currentTarget.value))} />
  <div class="presets" aria-label="Game length presets">
    {#each [{ score: 50, label: "Quick" }, { score: 100, label: "Classic" }, { score: 200, label: "Long" }] as preset}
      <button type="button" class:chosen={value === preset.score} aria-pressed={value === preset.score} {disabled} onclick={() => onchange(preset.score)}>
        {preset.label} <span>{preset.score}</span>
      </button>
    {/each}
  </div>
  <p id="goal-estimate" class="estimate">About <strong>{minutes} minutes</strong> <span>· rough estimate{humans + bots < 2 ? " for 2 players" : ""}</span></p>
  <p id="goal-rule" class="rule">The game ends after a round brings someone to {value} points. Lowest total wins.</p>
</div>

<style>
  .goal { display: grid; gap: 0.75rem; text-align: left; }
  .heading { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  label { font-weight: 700; }
  .value { color: var(--mist); font-size: 0.9rem; }
  .value strong { color: var(--lantern); font-size: 1.6rem; font-variant-numeric: tabular-nums; }
  input { width: 100%; height: 28px; margin: 0; accent-color: var(--lantern); cursor: pointer; }
  input:disabled { cursor: default; opacity: 0.6; }
  .presets { display: flex; gap: 0.4rem; }
  button { flex: 1; min-height: 44px; border: 1px solid rgb(168 201 214 / 0.3); border-radius: 10px; background: rgb(6 25 40 / 0.3); cursor: pointer; font-weight: 650; }
  button span { margin-left: 0.25rem; opacity: 0.7; font-variant-numeric: tabular-nums; }
  button.chosen { color: var(--lantern); background: rgb(255 226 122 / 0.1); border-color: var(--lantern); }
  button:disabled { cursor: default; }
  p { margin: 0; font-size: 0.9rem; }
  .estimate { color: var(--glass); }
  .estimate span, .rule { color: var(--mist); }
</style>
