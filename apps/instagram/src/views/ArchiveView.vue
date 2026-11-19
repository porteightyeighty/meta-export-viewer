<script setup lang="ts">
import { computed } from "vue";
import { useData } from "@mev/core/client";
import type { Post } from "@mev/core/types";
import Icon from "../components/Icon.vue";
import PostGrid from "../components/PostGrid.vue";

const props = withDefaults(defineProps<{ kind?: "posts" | "stories" }>(), { kind: "posts" });
// Both routes can share one instance, so pick the dataset reactively.
const archived = useData<Post[]>("archived");
const stories = useData<Post[]>("stories");
const items = computed(() => (props.kind === "stories" ? stories : archived).data.value);
const loading = computed(() => (props.kind === "stories" ? stories : archived).loading.value);

/** Stories grouped under "November 2025"-style headings (data is newest first). */
const months = computed(() => {
  const out: { label: string; stories: Post[] }[] = [];
  for (const s of props.kind === "stories" ? items.value ?? [] : []) {
    const label = new Date(s.timestamp).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (out.at(-1)?.label !== label) out.push({ label, stories: [] });
    out.at(-1)!.stories.push(s);
  }
  return out;
});
const day = (ms: number) => new Date(ms).getDate();
const mon = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short" });
</script>

<template>
  <div class="ig-profile">
    <header class="ig-archive-head">
      <RouterLink to="/" class="ig-icon-btn" aria-label="Back"><Icon name="left" /></RouterLink>
      <h2>Archive</h2>
    </header>
    <nav class="ig-tabs ig-archive-tabs">
      <RouterLink to="/archive" :class="{ active: kind === 'posts' }"><Icon name="grid" :size="12" />Posts</RouterLink>
      <RouterLink to="/archive/stories" :class="{ active: kind === 'stories' }"><Icon name="archive" :size="12" />Stories</RouterLink>
    </nav>
    <p class="ig-muted ig-archive-note">Only you can see the {{ kind }} you archive.</p>
    <p v-if="loading" class="ig-empty">Loading…</p>
    <template v-else-if="kind === 'stories' && months.length">
      <section v-for="m in months" :key="m.label">
        <h3 class="ig-month">{{ m.label }}</h3>
        <div class="ig-grid ig-story-grid">
          <RouterLink v-for="s in m.stories" :key="s.id" :to="{ name: 'story', params: { id: s.id } }" class="ig-tile ig-story-tile">
            <video v-if="s.media[0].kind === 'video'" :src="s.media[0].src + '#t=0.1'" preload="metadata" muted playsinline />
            <img v-else :src="s.media[0].src" alt="" loading="lazy" decoding="async" />
            <span class="ig-story-date"><b>{{ day(s.timestamp) }}</b>{{ mon(s.timestamp) }}</span>
          </RouterLink>
        </div>
      </section>
    </template>
    <PostGrid v-else-if="kind === 'posts' && items?.length" :posts="items" route-name="archived-post" />
    <div v-else class="ig-empty"><h3>No archived {{ kind }}</h3></div>
    <RouterView />
  </div>
</template>
