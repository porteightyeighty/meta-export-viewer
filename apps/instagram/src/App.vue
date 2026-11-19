<script setup lang="ts">
import { useData } from "@mev/core/client";
import type { DataMeta } from "@mev/core/types";
import NavRail from "./components/NavRail.vue";

const { data: meta } = useData<DataMeta>("meta");
</script>

<template>
  <div class="ig-app">
    <NavRail />
    <main class="ig-main">
      <div v-if="meta?.source === 'fixture'" class="ig-banner">
        Demo data. Point <code>META_EXPORT</code> at your own export, or drop it into <code>exports/instagram/</code>.
      </div>
      <div v-if="meta?.error" class="ig-banner error">Couldn't read the export: {{ meta.error }}</div>
      <RouterView />
    </main>
  </div>
</template>
