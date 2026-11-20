<script setup lang="ts">
/** Searchable list of normalised export records. */
import type { Rec } from "../../types/meta.ts";
import { recordText } from "../../export/records.ts";
import SearchableList from "./SearchableList.vue";
import RecordView from "./RecordView.vue";

defineProps<{ records: Rec[] }>();
const query = defineModel<string>("query", { default: "" });
</script>

<template>
  <SearchableList v-model:query="query" class="mev-records" :items="records" :keys="recordText" :limit="100">
    <template #default="{ item }"><RecordView :rec="item" /></template>
  </SearchableList>
</template>
