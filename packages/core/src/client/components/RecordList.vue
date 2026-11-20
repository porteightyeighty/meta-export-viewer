<script setup lang="ts">
/** Searchable list of normalised export records. */
import type { Rec } from "../../types/meta.ts";
import SearchableList from "./SearchableList.vue";
import RecordView from "./RecordView.vue";

defineProps<{ records: Rec[] }>();
const text = (r: Rec): string[] => [r.title ?? "", ...r.fields.flatMap((f) => [f.label, f.value ?? "", ...(f.items ?? []).flatMap(text)])];
</script>

<template>
  <SearchableList class="mev-records" :items="records" :keys="text" :limit="100">
    <template #default="{ item }"><RecordView :rec="item" /></template>
  </SearchableList>
</template>
