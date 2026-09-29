<script lang="ts">
</script>

<footer>
  <span>Made by <strong>Niklas Heer</strong></span>
  <a href="https://github.com/niklas-heer/shoalow" target="_blank" rel="noopener noreferrer">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" />
    </svg>
    Explore the code on GitHub
    <span aria-hidden="true">↗</span>
  </a>
</footer>

<style>
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.4rem 1.5rem;
    max-width: 70rem;
    margin: 0 auto;
    padding: 1rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
    color: var(--mist);
    font-size: 0.9rem;
    text-align: center;
  }
  strong { color: var(--foam); font-weight: 650; }
  a { display: inline-flex; align-items: center; gap: 0.5rem; min-height: 44px; color: var(--mist); text-decoration: none; }
  a:hover { color: var(--glass); text-decoration: underline; text-underline-offset: 0.25em; }
  svg { width: 1.15rem; height: 1.15rem; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
</style>
