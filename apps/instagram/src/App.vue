<script setup lang="ts">
import { useData } from "@mev/core/client";
import type { DataMeta } from "@mev/core/types";
import { computed } from "vue";
import { useRoute } from "vue-router";
import NavRail from "./components/NavRail.vue";

const { data: meta } = useData<DataMeta>("meta");
const route = useRoute();
/** Direct takes the full height and collapses the nav rail to icons, like Instagram. */
const direct = computed(() => route.path.startsWith("/direct"));
</script>

<template>
  <div class="ig-app" :class="{ compact: direct }">
    <NavRail />
    <main class="ig-main" :class="{ direct: direct || route.path.startsWith('/accounts') }">
      <div v-if="meta?.source === 'fixture'" class="ig-banner">
        Demo data. Point <code>META_EXPORT</code> at your own export, or drop it into <code>exports/instagram/</code>.
      </div>
      <div v-if="meta?.error" class="ig-banner error">Couldn't read the export: {{ meta.error }}</div>
      <RouterView />
    </main>
  </div>
</template>
