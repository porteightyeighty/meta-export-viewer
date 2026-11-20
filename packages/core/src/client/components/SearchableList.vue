<script setup lang="ts" generic="T">
/** Filterable list. `keys` picks the searchable text of each item; rendering is up to the slot. */
import { computed, ref } from "vue";
import { fold as norm } from "../text.ts";

const props = withDefaults(defineProps<{ items: T[]; keys: (item: T) => string[]; placeholder?: string; limit?: number }>(), {
  placeholder: "Search",
  limit: 200,
});
const query = defineModel<string>("query", { default: "" });
const shown = ref(props.limit);

const filtered = computed(() => {
  const q = norm(query.value.trim());
  if (!q) return props.items;
  return props.items.filter((it) => props.keys(it).some((k) => k && norm(k).includes(q)));
});
const visible = computed(() => filtered.value.slice(0, shown.value));
const root = ref<HTMLElement>();
/** ↑/↓ move focus between the input and the result links/buttons. */
function onArrow(e: KeyboardEvent) {
  const els = [...root.value!.querySelectorAll<HTMLElement>(".mev-search-box input, .mev-search-results :is(a[href], button)")];
  const at = els.indexOf(document.activeElement as HTMLElement);
  const to = els[at + (e.key === "ArrowDown" ? 1 : -1)];
  if (at < 0 || !to) return;
  e.preventDefault();
  to.focus();
}
function onScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (el.scrollTop + el.clientHeight > el.scrollHeight - 200) shown.value += props.limit;
}
</script>

<template>
  <div ref="root" class="mev-search" @keydown.down="onArrow" @keydown.up="onArrow">
    <div class="mev-search-box">
      <slot name="input" :query="query">
        <input v-model="query" type="search" :placeholder="placeholder" autocomplete="off" spellcheck="false" />
      </slot>
    </div>
    <div class="mev-search-results" @scroll.passive="onScroll">
      <slot v-for="(item, i) in visible" :key="i" :item="item" :index="i" />
      <slot v-if="!filtered.length" name="empty"><p class="mev-search-empty">No results found.</p></slot>
      <slot name="after" :query="query" />
    </div>
  </div>
</template>

<style>
.mev-search { display: flex; flex-direction: column; min-height: 0; }
.mev-search-results { overflow-y: auto; min-height: 0; flex: 1; }
</style>
