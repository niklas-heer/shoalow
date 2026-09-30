<script lang="ts">
  import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
  import Check from "@lucide/svelte/icons/check";
  import Eye from "@lucide/svelte/icons/eye";
  import HandGrab from "@lucide/svelte/icons/hand-grab";
  import type { GameView } from "@shoalow/game";

  let { game, who, mine }: { game: GameView /** Whose turn it is, as shown to you. */; who: string; mine: boolean } =
    $props();

  type State = "done" | "current" | "upcoming" | "optional" | "skipped";

  /** Outside turns the bar keeps its space but hides, so the cards below never move. */
  const active = $derived(game.phase === "turn");

  // A turn is draw, then place; only a dropped card leads on to reveal.
  const steps = $derived.by(() => {
    const stage = game.stage;
    const draw: State = stage === "choose" ? "current" : "done";
    const place: State = stage === "choose" ? "upcoming" : stage === "mustFlip" ? "done" : "current";
    const reveal: State = stage === "mustFlip" ? "current" : stage === "fromDiscard" ? "skipped" : "optional";
    return [
      { label: "Draw", icon: HandGrab, state: draw, note: "" },
      { label: "Place", icon: ArrowLeftRight, state: place, note: "" },
      {
        label: "Reveal",
        icon: Eye,
        state: reveal,
        note: reveal === "optional" ? "only if the card is dropped" : reveal === "skipped" ? "not this turn" : "",
      },
    ];
  });
</script>

<div class="steps" class:mine class:idle={!active} aria-hidden={!active}>
  <span class="whose">{mine ? "Your turn" : `${who}'s turn`}</span>
  <ol aria-label="{mine ? 'Your' : `${who}'s`} turn steps">
    {#each steps as step (step.label)}
      <li class={step.state} aria-current={step.state === "current" ? "step" : undefined} title={step.note || undefined}>
        {#if step.state === "done"}<Check aria-hidden="true" />{:else}<step.icon aria-hidden="true" />{/if}
        <span class="label">{step.label}</span>
        {#if step.state === "done" || step.note}
          <span class="visually-hidden">, {step.state === "done" ? "done" : step.note}</span>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  /* Sized by where it sits, not by its steps: the steps then fit themselves to that width. */
  .steps {
    container-type: inline-size;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: var(--steps-justify, start);
    gap: 0.6rem;
    min-width: 0;
  }
  .idle {
    visibility: hidden;
  }
  /* Shown when there is room; the prompt says whose turn it is as well. */
  .whose {
    display: none;
    overflow: hidden;
    color: var(--mist);
    font-size: 0.85rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mine .whose {
    color: var(--lantern);
  }
  ol {
    display: flex;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    height: 1.7rem;
    padding: 0 0.55rem 0 0.45rem;
    border: 1.5px solid rgb(168 201 214 / 0.35);
    border-radius: 999px;
    color: var(--mist);
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
    transition:
      background-color 200ms,
      border-color 200ms,
      color 200ms,
      opacity 200ms;
  }
  /* A short line joins each step to the one before. */
  li + li {
    position: relative;
    margin-left: 0.55rem;
  }
  li + li::before {
    content: "";
    position: absolute;
    top: 50%;
    right: calc(100% + 1.5px);
    width: 0.55rem;
    height: 2px;
    margin-top: -1px;
    background: rgb(168 201 214 / 0.35);
  }
  li :global(svg) {
    flex: none;
    width: 0.95rem;
    height: 0.95rem;
  }
  .done {
    border-color: rgb(127 216 200 / 0.45);
    background: rgb(127 216 200 / 0.12);
    color: var(--glass);
  }
  .current {
    border-color: var(--glass);
    background: var(--glass);
    color: var(--deep);
  }
  .mine .current {
    border-color: var(--lantern);
    background: var(--lantern);
    box-shadow: 0 0 12px rgb(255 226 122 / 0.3);
  }
  .optional {
    border-style: dashed;
    opacity: 0.6;
  }
  .skipped {
    opacity: 0.3;
  }
  /* When space is tight, only the current step keeps its name; the others show their icon. */
  @container (max-width: 15rem) {
    li:not(.current) {
      padding: 0 0.4rem;
    }
    li:not(.current) .label {
      display: none;
    }
  }
  @container (min-width: 21rem) {
    .whose {
      display: block;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    li {
      transition: none;
    }
  }
</style>
