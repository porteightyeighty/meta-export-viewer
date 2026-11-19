<script setup lang="ts" generic="T">
/** Horizontal pager with prev/next buttons and dots. Slot receives each item. */
import { computed } from "vue";

const props = defineProps<{ items: T[] }>();
const index = defineModel<number>("index", { default: 0 });
const count = computed(() => props.items.length);
const go = (d: number) => (index.value = Math.min(count.value - 1, Math.max(0, index.value + d)));
defineExpose({ go });
</script>

<template>
  <div class="mev-carousel">
    <div class="mev-carousel-track" :style="{ transform: `translateX(-${index * 100}%)` }">
      <div v-for="(item, i) in items" :key="i" class="mev-carousel-slide" :aria-hidden="i !== index">
        <slot :item="item" :index="i" :active="i === index" />
      </div>
    </div>
    <template v-if="count > 1">
      <button v-if="index > 0" class="mev-carousel-btn mev-carousel-prev" aria-label="Previous media" @click.stop="go(-1)">
        <slot name="prev">‹</slot>
      </button>
      <button v-if="index < count - 1" class="mev-carousel-btn mev-carousel-next" aria-label="Next media" @click.stop="go(1)">
        <slot name="next">›</slot>
      </button>
      <div class="mev-carousel-dots">
        <span v-for="i in count" :key="i" :class="{ active: i - 1 === index }" />
      </div>
    </template>
  </div>
</template>

<style>
.mev-carousel { position: relative; overflow: hidden; width: 100%; height: 100%; }
.mev-carousel-track { display: flex; height: 100%; transition: transform 0.25s ease; }
.mev-carousel-slide { flex: 0 0 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.mev-carousel-btn { position: absolute; top: 50%; transform: translateY(-50%); cursor: pointer; border: 0; }
.mev-carousel-prev { left: 8px; }
.mev-carousel-next { right: 8px; }
.mev-carousel-dots { position: absolute; bottom: 12px; left: 0; right: 0; display: flex; justify-content: center; gap: 4px; pointer-events: none; }
.mev-carousel-dots span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.4); }
.mev-carousel-dots span.active { background: #fff; }
</style>
