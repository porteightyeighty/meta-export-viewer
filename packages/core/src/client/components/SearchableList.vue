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
function onScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (el.scrollTop + el.clientHeight > el.scrollHeight - 200) shown.value += props.limit;
}
</script>

<template>
  <div class="mev-search">
    <div class="mev-search-box">
      <slot name="input" :query="query">
        <input v-model="query" type="search" :placeholder="placeholder" autocomplete="off" spellcheck="false" />
      </slot>
    </div>
    <div class="mev-search-results" @scroll.passive="onScroll">
      <slot v-for="(item, i) in visible" :key="i" :item="item" :index="i" />
      <slot v-if="!filtered.length" name="empty"><p class="mev-search-empty">No results found.</p></slot>
    </div>
  </div>
</template>

<style>
.mev-search { display: flex; flex-direction: column; min-height: 0; }
.mev-search-results { overflow-y: auto; min-height: 0; flex: 1; }
</style>
