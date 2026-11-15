<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getAppInfo } from './bridge.js';
import type { AppInfo } from '../../shared/types.js';

const info = ref<AppInfo | null>(null);

onMounted(() => {
  getAppInfo()
    .then((v) => (info.value = v))
    .catch(() => (info.value = null));
});
</script>

<template>
  <main class="app">
    <h1>{{APP_DISPLAY_NAME}}</h1>
    <p class="tagline">{{DESCRIPTION}}</p>
    <p v-if="info" class="meta">v{{ info.version }} · {{ info.platform }}</p>
    <p v-else class="meta">Running in browser preview (bridge unavailable).</p>
    <p class="hint">
      Edit <code>src/renderer/src/App.vue</code> to build your UI. Hot reload is enabled in dev.
    </p>
  </main>
</template>
