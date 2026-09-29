<script lang="ts" generics="T extends string | number">
  /** A small set of mutually exclusive options, as radio buttons styled like a segmented switch. */
  let {
    legend,
    options,
    value,
    disabled = false,
    onchange,
  }: {
    legend: string;
    options: { value: T; label: string }[];
    value: T;
    disabled?: boolean;
    onchange: (value: T) => void;
  } = $props();

  const uid = $props.id();
</script>

<fieldset class="choice" {disabled}>
  <legend>{legend}</legend>
  <div class="options">
    {#each options as option (option.value)}
      <label class:on={option.value === value}>
        <input
          type="radio"
          name={uid}
          value={option.value}
          checked={option.value === value}
          onchange={() => onchange(option.value)}
        />
        {option.label}
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .choice {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 0.4rem;
    padding: 0;
    color: var(--mist);
    font-weight: 600;
  }
  .options {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 3px;
    padding: 3px;
    border-radius: 999px;
    background: rgb(6 25 40 / 0.6);
  }
  label {
    position: relative;
    min-height: 38px;
    padding: 0.4em 1em;
    border-radius: 999px;
    color: var(--mist);
    font-weight: 650;
    cursor: pointer;
    transition:
      background 150ms,
      color 150ms;
  }
  label:hover {
    color: var(--foam);
  }
  label.on {
    background: var(--glass);
    color: var(--deep);
  }
  label:has(:focus-visible) {
    outline: 3px solid var(--lantern);
    outline-offset: 2px;
  }
  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  fieldset:disabled label {
    cursor: default;
  }
  fieldset:disabled label:not(.on) {
    opacity: 0.5;
  }
</style>
