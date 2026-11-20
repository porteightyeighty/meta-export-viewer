<script setup lang="ts">
/** What you did: likes, comments and story interactions, newest first, grouped by month. */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { shortAgo, useData } from "@mev/core/client";
import type { ActivityKind, ActivityRow } from "../../build/activity.ts";
import Avatar from "../components/Avatar.vue";
import { VERB } from "../activity.ts";

const route = useRoute();
const router = useRouter();
const { data, error } = useData<ActivityRow[]>("activity");

const FILTERS = {
  all: { label: "All", kinds: undefined },
  likes: { label: "Likes", kinds: ["like", "comment-like"] },
  comments: { label: "Comments", kinds: ["comment"] },
  stories: { label: "Story interactions", kinds: ["story-like", "poll", "quiz", "question", "slider", "countdown"] },
} satisfies Record<string, { label: string; kinds?: ActivityKind[] }>;
type Filter = keyof typeof FILTERS;
const filter = computed<Filter>(() => (String(route.query.type) in FILTERS ? (route.query.type as Filter) : "all"));
const setFilter = (f: Filter) => router.replace({ query: f === "all" ? {} : { type: f } });

const count = (f: Filter) => {
  const kinds: readonly string[] | undefined = FILTERS[f].kinds;
  return kinds ? (data.value ?? []).filter((r) => kinds.includes(r[0])).length : (data.value?.length ?? 0);
};
const rows = computed(() => {
  const kinds: readonly string[] | undefined = FILTERS[filter.value].kinds;
  return kinds ? (data.value ?? []).filter((r) => kinds.includes(r[0])) : (data.value ?? []);
});

// Render in pages as the sentinel scrolls into view: 3k+ rows at once is slow to lay out.
const PAGE = 100;
const shown = ref(PAGE);
watch(filter, () => (shown.value = PAGE));
const months = computed(() => {
  const out: { label: string; rows: ActivityRow[] }[] = [];
  for (const r of rows.value.slice(0, shown.value)) {
    const label = new Date(r[1]).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (out.at(-1)?.label !== label) out.push({ label, rows: [] });
    out.at(-1)!.rows.push(r);
  }
  return out;
});
const observer = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (shown.value += PAGE), { rootMargin: "600px" });
const sentinel = ref<HTMLElement>();
watch(sentinel, (el, old) => (old && observer.unobserve(old), el && observer.observe(el)));
onBeforeUnmount(() => observer.disconnect());
</script>

<template>
  <div class="ig-search-page ig-activity">
    <h2>Your activity</h2>
    <nav class="ig-dm-tabs ig-activity-tabs">
      <button v-for="(f, key) in FILTERS" :key="key" :class="{ active: filter === key }" @click="setFilter(key)">
        {{ f.label }} <span class="ig-muted">{{ count(key) }}</span>
      </button>
    </nav>
    <p v-if="error" class="mev-search-empty">Couldn't load your activity.</p>
    <p v-else-if="data && !rows.length" class="mev-search-empty">Nothing here. Your export has no {{ filter === "all" ? "activity" : FILTERS[filter].label.toLowerCase() }}.</p>
    <section v-for="m in months" :key="m.label">
      <h3 class="ig-search-section">{{ m.label }}</h3>
      <component
        :is="href ? 'a' : 'div'"
        v-for="[kind, ts, owner, text, href] in m.rows"
        :key="kind + ts + href"
        class="ig-dm-row"
        :href="href || undefined"
        :target="href ? '_blank' : undefined"
        :rel="href ? 'noreferrer' : undefined"
      >
        <Avatar :label="owner || '?'" :size="44" />
        <span class="ig-dm-row-text">
          <span class="ig-activity-line">{{ VERB[kind] }} <b>{{ owner || "someone" }}</b></span>
          <span v-if="text" class="ig-dm-row-preview ig-muted"><span class="ig-dm-row-snippet">{{ text }}</span></span>
        </span>
        <time class="ig-muted ig-small" :datetime="new Date(ts).toISOString()" :title="new Date(ts).toLocaleString()">{{ shortAgo(ts) }}</time>
      </component>
    </section>
    <div v-if="shown < rows.length" ref="sentinel" class="mev-search-empty">Loading more…</div>
  </div>
</template>
