<script lang="ts">
  let { size = 28 }: { size?: number } = $props();
</script>

<span class="logo" style:font-size="{size}px">
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M30 40 Q26 18 14 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    <circle cx="13" cy="16" r="10" fill="var(--lantern)" opacity=".3" />
    <circle cx="13" cy="16" r="6" fill="var(--lantern)" />
    <path d="M18 44 C18 30 34 26 46 30 C58 34 60 44 56 52 C50 60 30 60 22 56 C19 54 18 49 18 44Z" fill="currentColor" />
    <path d="M18 46 C26 44 34 46 40 50 C34 56 24 56 18 52Z" fill="var(--deep)" />
    <circle cx="34" cy="38" r="3" fill="var(--deep)" />
  </svg>
  <span class="word">Shoalow</span>
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    color: var(--foam);
    font-weight: 800;
    letter-spacing: -0.04em;
    font-variation-settings: "wdth" 85;
    line-height: 1;
  }
  svg {
    width: 1.3em;
    height: 1.3em;
  }
</style>
