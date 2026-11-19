<script setup lang="ts">
/** Full-screen modal overlay. Esc closes, ←/→ emit prev/next. Styled by the app via .mev-lightbox* classes. */
import { onMounted, onBeforeUnmount } from "vue";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ hasPrev?: boolean; hasNext?: boolean }>();
const emit = defineEmits<{ close: []; prev: []; next: [] }>();

function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.closest?.("input, textarea")) return;
  if (e.key === "Escape") emit("close");
  else if (e.key === "ArrowLeft" && props.hasPrev) emit("prev");
  else if (e.key === "ArrowRight" && props.hasNext) emit("next");
}
onMounted(() => {
  window.addEventListener("keydown", onKey);
  document.documentElement.style.overflow = "hidden";
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  document.documentElement.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div v-bind="$attrs" class="mev-lightbox" role="dialog" aria-modal="true" @click.self="emit('close')">
      <button class="mev-lightbox-close" aria-label="Close" @click="emit('close')"><slot name="close">×</slot></button>
      <button v-if="hasPrev" class="mev-lightbox-nav mev-lightbox-prev" aria-label="Previous" @click="emit('prev')">
        <slot name="prev">‹</slot>
      </button>
      <div class="mev-lightbox-body"><slot /></div>
      <button v-if="hasNext" class="mev-lightbox-nav mev-lightbox-next" aria-label="Next" @click="emit('next')">
        <slot name="next">›</slot>
      </button>
    </div>
  </Teleport>
</template>

<style>
.mev-lightbox { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; }
.mev-lightbox-body { max-width: 100%; max-height: 100%; display: flex; }
.mev-lightbox-close, .mev-lightbox-nav { position: absolute; cursor: pointer; border: 0; background: none; }
.mev-lightbox-close { top: 12px; right: 12px; }
.mev-lightbox-prev { left: 12px; top: 50%; transform: translateY(-50%); }
.mev-lightbox-next { right: 12px; top: 50%; transform: translateY(-50%); }
</style>
