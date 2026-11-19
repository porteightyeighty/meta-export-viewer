<script setup lang="ts">
withDefaults(defineProps<{ src?: string; size?: number; ring?: boolean; label?: string }>(), { size: 32 });
</script>

<template>
  <span class="ig-avatar" :class="{ ring }" :style="{ width: size + 'px', height: size + 'px' }">
    <img v-if="src" :src="src" alt="" />
    <span v-else class="ig-avatar-fallback" :style="{ fontSize: size * 0.42 + 'px' }">{{ (label ?? '?').replace(/^[^a-z0-9]+/i, '').slice(0, 1).toUpperCase() }}</span>
  </span>
</template>
