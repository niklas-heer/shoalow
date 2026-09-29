<script lang="ts">
  import Home from "./components/Home.svelte";
  import RoomPage from "./components/RoomPage.svelte";
  import Rules from "./components/Rules.svelte";
  import Tutorial from "./components/Tutorial.svelte";
  import { router } from "./lib/router.svelte.ts";

  let rulesOpen = $state(false);
  const openRules = () => {
    rulesOpen = true;
  };
</script>

{#if router.roomCode}
  {#key router.roomCode}
    <RoomPage code={router.roomCode} onrules={openRules} />
  {/key}
{:else if router.learning}
  <Tutorial onrules={openRules} />
{:else}
  <Home onrules={openRules} />
{/if}

<Rules bind:open={rulesOpen} />
