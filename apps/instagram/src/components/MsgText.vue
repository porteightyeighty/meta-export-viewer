<script setup lang="ts">
/** Message text with clickable links and search-hit highlighting. */
import { computed } from "vue";
import { highlight } from "@mev/core/client";

const props = defineProps<{ text: string; query?: string }>();
const URL_RE = /(https?:\/\/[^\s]+)/g;

const parts = computed(() =>
  props.text.split(URL_RE).map((t, i) => ({ t, url: i % 2 === 1, segs: highlight(t, props.query ?? "") })),
);
</script>

<template>
  <template v-for="(p, k) in parts" :key="k">
    <a v-if="p.url" class="ig-dm-link" :href="p.t" target="_blank" rel="noopener noreferrer">
      <template v-for="(s, j) in p.segs" :key="j"><mark v-if="s.hit">{{ s.text }}</mark><template v-else>{{ s.text }}</template></template>
    </a>
    <template v-else v-for="(s, j) in p.segs" :key="j"><mark v-if="s.hit">{{ s.text }}</mark><template v-else>{{ s.text }}</template></template>
  </template>
</template>
