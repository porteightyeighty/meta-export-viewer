<script setup lang="ts">
/** Full-screen modal overlay. Esc closes, ←/→ emit prev/next. Styled by the app via .mev-lightbox* classes. */
import { onMounted, onBeforeUnmount, ref } from "vue";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ hasPrev?: boolean; hasNext?: boolean }>();
const emit = defineEmits<{ close: []; prev: []; next: [] }>();

const box = ref<HTMLElement>();
let opener: HTMLElement | null = null;
const FOCUSABLE = "a[href], button:not(:disabled), input, textarea, select, video[controls], audio[controls], [tabindex]:not([tabindex='-1'])";

/** Keep Tab inside the dialog: the page behind it is still in the tab order. */
function trapTab(e: KeyboardEvent) {
  const els = [...box.value!.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (!els.length) return e.preventDefault();
  const first = els[0], last = els[els.length - 1], cur = document.activeElement;
  if (e.shiftKey && (cur === first || cur === box.value)) (e.preventDefault(), last.focus());
  else if (!e.shiftKey && (cur === last || !box.value!.contains(cur))) (e.preventDefault(), first.focus());
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Tab") return trapTab(e);
  if ((e.target as HTMLElement)?.closest?.("input, textarea")) return;
  if (e.key === "Escape") emit("close");
  else if (e.key === "ArrowLeft" && props.hasPrev) emit("prev");
  else if (e.key === "ArrowRight" && props.hasNext) emit("next");
}
onMounted(() => {
  window.addEventListener("keydown", onKey);
  document.documentElement.style.overflow = "hidden";
  opener = document.activeElement as HTMLElement | null;
  box.value?.focus();
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  document.documentElement.style.overflow = "";
  opener?.focus?.();
});
</script>

<template>
  <Teleport to="body">
    <div v-bind="$attrs" ref="box" class="mev-lightbox" role="dialog" aria-modal="true" tabindex="-1" @click.self="emit('close')">
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
.mev-lightbox { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; outline: none; }
.mev-lightbox-body { max-width: 100%; max-height: 100%; display: flex; }
.mev-lightbox-close, .mev-lightbox-nav { position: absolute; cursor: pointer; border: 0; background: none; }
.mev-lightbox-close { top: 12px; right: 12px; }
.mev-lightbox-prev { left: 12px; top: 50%; transform: translateY(-50%); }
.mev-lightbox-next { right: 12px; top: 50%; transform: translateY(-50%); }
</style>
