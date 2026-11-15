<script lang="ts">
  import { onMount } from 'svelte';
  import { getAppInfo } from './bridge.js';
  import type { AppInfo } from '../../shared/types.js';

  let info: AppInfo | null = null;

  onMount(() => {
    getAppInfo()
      .then((v) => (info = v))
      .catch(() => (info = null));
  });
</script>

<main class="app">
  <h1>{{APP_DISPLAY_NAME}}</h1>
  <p class="tagline">{{DESCRIPTION}}</p>
  {#if info}
    <p class="meta">v{info.version} · {info.platform}</p>
  {:else}
    <p class="meta">Running in browser preview (bridge unavailable).</p>
  {/if}
  <p class="hint">
    Edit <code>src/renderer/src/App.svelte</code> to build your UI. Hot reload is enabled in dev.
  </p>
</main>
