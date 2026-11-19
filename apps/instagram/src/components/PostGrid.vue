<script setup lang="ts">
import type { Post } from "@mev/core/types";
import Icon from "./Icon.vue";

defineProps<{ posts: Post[]; routeName: string }>();
</script>

<template>
  <div class="ig-grid">
    <RouterLink v-for="p in posts" :key="p.id" :to="{ name: routeName, params: { id: p.id }, query: $route.query }" class="ig-tile">
      <video v-if="p.media[0].kind === 'video'" :src="p.media[0].src + '#t=0.1'" preload="metadata" muted playsinline />
      <img v-else :src="p.media[0].src" alt="" loading="lazy" decoding="async" />
      <span v-if="p.media.length > 1" class="ig-tile-badge"><Icon name="carousel" :size="20" /></span>
      <span v-else-if="p.media[0].kind === 'video'" class="ig-tile-badge"><Icon name="reels" :size="20" /></span>
      <span class="ig-tile-hover"><span v-if="p.caption">{{ p.caption.slice(0, 80) }}{{ p.caption.length > 80 ? "…" : "" }}</span></span>
    </RouterLink>
  </div>
</template>
