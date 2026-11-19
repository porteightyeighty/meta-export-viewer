<script setup lang="ts">
/** Image or video from the export. Videos only autoplay while `active`. */
import { ref, watch } from "vue";
import type { MediaItem } from "../../types/meta.ts";

const props = withDefaults(defineProps<{ item: MediaItem; active?: boolean; controls?: boolean; loop?: boolean; fit?: "cover" | "contain" }>(), {
  active: true,
  controls: true,
  loop: true,
  fit: "contain",
});
const video = ref<HTMLVideoElement>();
watch(
  () => props.active,
  (a) => {
    if (!video.value) return;
    a ? video.value.play().catch(() => {}) : video.value.pause();
  },
);
</script>

<template>
  <video
    v-if="item.kind === 'video'"
    ref="video"
    class="mev-media"
    :src="item.src"
    :controls="controls"
    :autoplay="active"
    playsinline
    :loop="loop"
    preload="metadata"
    :style="{ objectFit: fit }"
  />
  <img v-else class="mev-media" :src="item.src" alt="" decoding="async" :style="{ objectFit: fit }" />
</template>

<style>
.mev-media { display: block; width: 100%; height: 100%; }
</style>
