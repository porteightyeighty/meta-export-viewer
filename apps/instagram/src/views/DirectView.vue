<script setup lang="ts">
/** Two-pane Direct inbox: searchable thread list on the left, the open chat on the right. */
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { SearchableList, fetchData, highlight, longDate, matches, shortAgo, snippet, useData } from "@mev/core/client";
import type { ThreadBox, ThreadSummary } from "@mev/core/types";
import type { Profile } from "../../build/index.ts";
import type { MessageIndexRow } from "../../build/direct.ts";
import Avatar from "../components/Avatar.vue";

const route = useRoute();
const { data: threads } = useData<{ me: string; items: ThreadSummary[] }>("threads");
const { data: profile } = useData<Profile>("profile");

const openId = computed(() => (route.name === "thread" ? String(route.params.id) : undefined));
const byId = computed(() => new Map(threads.value?.items.map((t) => [t.id, t])));

const tab = ref<ThreadBox>(route.name === "direct-requests" ? "requests" : "inbox");
// Opening a request (e.g. from search) switches to the Requests tab.
watch(
  () => openId.value && byId.value.get(openId.value)?.box,
  (box) => box && (tab.value = box),
  { immediate: true },
);
const items = computed(() => threads.value?.items.filter((t) => t.box === tab.value) ?? []);
const requestCount = computed(() => threads.value?.items.filter((t) => t.box === "requests").length ?? 0);

// ── search across every chat's messages (index loaded on first use) ──
const query = ref("");
const index = ref<MessageIndexRow[]>();
const MIN_CHARS = 3, MAX_HITS = 50;
watch(query, (q) => {
  if (q.trim().length >= MIN_CHARS && !index.value) fetchData<MessageIndexRow[]>("messageIndex").then((d) => (index.value = d));
});
const messageHits = computed(() => {
  const q = query.value.trim();
  if (q.length < MIN_CHARS || !index.value) return { rows: [], total: 0 };
  const all = index.value.filter((r) => matches(r[2], q)).sort((a, b) => b[3] - a[3]);
  return { rows: all.slice(0, MAX_HITS), total: all.length };
});
</script>

<template>
  <div class="ig-dm" :class="{ 'has-thread': !!openId }">
    <section class="ig-dm-list">
      <header class="ig-dm-list-head">
        <h1>{{ profile?.username }}</h1>
      </header>
      <nav class="ig-dm-tabs">
        <button :class="{ active: tab === 'inbox' }" @click="tab = 'inbox'">Messages</button>
        <button :class="{ active: tab === 'requests' }" @click="tab = 'requests'">Requests<span v-if="requestCount"> ({{ requestCount }})</span></button>
      </nav>
      <SearchableList
        v-model:query="query"
        class="ig-dm-search"
        :items="items"
        :keys="(t) => [t.title, ...t.participants]"
        placeholder="Search"
        :limit="60"
      >
        <template #default="{ item: t }">
          <RouterLink :to="{ name: 'thread', params: { id: t.id } }" class="ig-dm-row" :class="{ open: t.id === openId }">
            <Avatar :label="t.title" :size="56" />
            <span class="ig-dm-row-text">
              <span class="ig-dm-row-title">{{ t.title }}</span>
              <span class="ig-dm-row-preview ig-muted">
                <span class="ig-dm-row-snippet">{{ t.last?.text }}</span>
                <template v-if="t.last"> · {{ shortAgo(t.last.ts) }}</template>
              </span>
            </span>
          </RouterLink>
        </template>
        <template #empty>
          <p v-if="!messageHits.total" class="mev-search-empty">{{ query ? "No chats match." : "No conversations." }}</p>
        </template>
        <template #after>
          <template v-if="messageHits.total">
            <h3 class="ig-dm-section">
              Messages <span class="ig-muted">{{ messageHits.total > MAX_HITS ? `latest ${MAX_HITS} of ${messageHits.total}` : messageHits.total }}</span>
            </h3>
            <RouterLink
              v-for="[id, i, text, ts] in messageHits.rows"
              :key="id + i"
              :to="{ name: 'thread', params: { id }, query: { m: i, q: query.trim() } }"
              class="ig-dm-row ig-dm-hit"
            >
              <Avatar :label="byId.get(id)?.title" :size="44" />
              <span class="ig-dm-row-text">
                <span class="ig-dm-row-title">{{ byId.get(id)?.title }}<span v-if="byId.get(id)?.box === 'requests'" class="ig-muted"> · request</span></span>
                <span class="ig-dm-row-preview ig-muted">
                  <span class="ig-dm-row-snippet"><template v-for="(s, k) in highlight(snippet(text, query), query)" :key="k"><b v-if="s.hit" class="ig-hit">{{ s.text }}</b><template v-else>{{ s.text }}</template></template></span>
                  · {{ longDate(ts) }}
                </span>
              </span>
            </RouterLink>
          </template>
          <p v-else-if="query.trim().length >= MIN_CHARS && !index" class="mev-search-empty">Searching messages…</p>
        </template>
      </SearchableList>
    </section>
    <section class="ig-dm-main">
      <RouterView :key="openId" />
    </section>
  </div>
</template>
