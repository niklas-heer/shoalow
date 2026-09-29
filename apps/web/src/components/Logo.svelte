<script lang="ts">
  import mark from "../assets/shoalow.svg";

  let { size = 28 }: { size?: number } = $props();
</script>

<span class="logo" style:font-size="min({size}px, 13vw)">
  <img src={mark} alt="" width="64" height="64" />
  <span class="word">Shoalow</span>
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    color: var(--foam);
    font-weight: 800;
    letter-spacing: -0.04em;
    font-variation-settings: "wdth" 95;
    line-height: 1;
  }
  img {
    width: 1.3em;
    height: 1.3em;
  }
</style>
