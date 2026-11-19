<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{ src?: string; size?: number; ring?: boolean; label?: string }>(), { size: 32 });
const initial = computed(() => (props.label ?? "?").replace(/^[^\p{L}\p{N}]+/u, "").slice(0, 1).toUpperCase() || "?");
/** Stable per-name tint so placeholder avatars are distinguishable. */
const hue = computed(() => [...(props.label ?? "")].reduce((h, c) => (h * 31 + c.codePointAt(0)!) % 360, 7));
</script>

<template>
  <span class="ig-avatar" :class="{ ring }" :style="{ width: size + 'px', height: size + 'px', '--hue': hue }">
    <img v-if="src" :src="src" alt="" />
    <span v-else class="ig-avatar-fallback" :style="{ fontSize: size * 0.42 + 'px' }">{{ initial }}</span>
  </span>
</template>
