<script setup lang="ts">
/** Accounts Center: every remaining export file, grouped by section, shown generically. */
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { RecordList, fetchData, useData } from "@mev/core/client";
import type { Rec } from "@mev/core/types";
import type { SettingsSection } from "../../build/settings.ts";
import Icon from "../components/Icon.vue";

const route = useRoute();
const { data: sections } = useData<SettingsSection[]>("settings");
const fileId = computed(() => (route.params.file ? ([] as string[]).concat(route.params.file).join("/") : undefined));
const file = computed(() => sections.value?.flatMap((s) => s.files).find((f) => f.id === fileId.value));

const records = ref<Rec[]>();
const error = ref<string>();
/** Filter text: empty for each file, unless a search link opened it with `?q=`. */
const query = ref("");
watch(
  () => [fileId.value, route.query.q] as const,
  ([, q]) => (query.value = typeof q === "string" ? q : ""),
  { immediate: true },
);
watch(
  fileId,
  (id) => {
    records.value = error.value = undefined;
    if (id)
      fetchData<Rec[]>(`settings/${id}`)
        .then((r) => fileId.value === id && (records.value = r))
        .catch((e) => (error.value = String(e.message ?? e)));
  },
  { immediate: true },
);
</script>

<template>
  <div class="ig-accounts" :class="{ open: !!fileId }">
    <nav class="ig-accounts-nav">
      <h2>Accounts Center</h2>
      <p class="ig-muted ig-small">Everything else in your export, grouped like Instagram's settings. Read-only.</p>
      <section v-for="s in sections" :key="s.title">
        <h3>{{ s.title }}</h3>
        <RouterLink v-for="f in s.files" :key="f.id" :to="`/accounts/${f.id}`" class="ig-accounts-file" :class="{ active: f.id === fileId }">
          <span>{{ f.title }}</span><span class="ig-muted">{{ f.count }}</span>
        </RouterLink>
      </section>
    </nav>
    <section class="ig-accounts-body">
      <template v-if="fileId">
        <header class="ig-accounts-head">
          <RouterLink to="/accounts" class="ig-icon-btn ig-accounts-back" aria-label="Back"><Icon name="left" /></RouterLink>
          <div>
            <h2>{{ file?.title ?? fileId }}</h2>
            <code class="ig-muted ig-small">{{ fileId }}.json</code>
          </div>
        </header>
        <p v-if="error" class="ig-empty">{{ error }}</p>
        <p v-else-if="!records" class="ig-empty">Loading…</p>
        <p v-else-if="!records.length" class="ig-empty ig-muted">This file is empty.</p>
        <RecordList v-else :key="fileId" v-model:query="query" :records="records" />
      </template>
      <div v-else class="ig-empty">
        <Icon name="settings" :size="48" />
        <h3>Your information</h3>
        <p class="ig-muted">Pick a file on the left. Contact details, logins and locations are shown only here.</p>
      </div>
    </section>
  </div>
</template>
