<script lang="ts">
  import { onMount } from "svelte";
  import { CHANGES, markChangesSeen } from "../lib/changes.ts";
  import { router } from "../lib/router.svelte.ts";

  onMount(markChangesSeen);

  const format = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
</script>

<main class="news">
  <header>
    <button class="btn quiet" onclick={() => router.go("/")}>← Back to Shoalow</button>
    <h1>What's new</h1>
    <p>Changes to Shoalow, newest first.</p>
  </header>
  {#each CHANGES as release (release.date)}
    <article aria-labelledby="release-{release.date}">
      <h2 id="release-{release.date}">{release.title}</h2>
      <time datetime={release.date}>{format(release.date)}</time>
      <ul>
        {#each release.notes as note}
          <li>{note}</li>
        {/each}
      </ul>
    </article>
  {/each}
</main>

<style>
  .news {
    display: grid;
    gap: 1.5rem;
    max-width: 40rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
  }
  h1 {
    margin: 1rem 0 0.5rem;
    font-size: clamp(2rem, 5vw, 3rem);
  }
  header p {
    margin: 0;
    color: var(--mist);
    font-size: 1.1rem;
  }
  article {
    display: grid;
    gap: 0.4rem;
    padding: 1.1rem 1.25rem;
    border: 1px solid rgb(127 216 200 / 0.2);
    border-radius: 20px;
    background: rgb(6 25 40 / 0.35);
  }
  h2 {
    margin: 0;
    font-size: 1.3rem;
  }
  time {
    color: var(--glass);
    font-size: 0.9rem;
    font-weight: 650;
  }
  ul {
    display: grid;
    gap: 0.5rem;
    margin: 0.4rem 0 0;
    padding-left: 1.2rem;
    line-height: 1.45;
  }
</style>
