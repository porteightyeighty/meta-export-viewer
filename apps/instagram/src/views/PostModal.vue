<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Lightbox, Carousel, MediaView, useData, longDate, shortAgo } from "@mev/core/client";
import type { Post } from "@mev/core/types";
import type { Profile } from "../../build/index.ts";
import Icon from "../components/Icon.vue";
import Avatar from "../components/Avatar.vue";

const props = defineProps<{ source: "posts" | "archived" }>();
const route = useRoute();
const router = useRouter();
const { data: posts } = useData<Post[]>(props.source);
const { data: profile } = useData<Profile>("profile");

const i = computed(() => posts.value?.findIndex((p) => p.id === route.params.id) ?? -1);
const post = computed(() => (i.value >= 0 ? posts.value![i.value] : undefined));
const slide = ref(0);
watch(() => route.params.id, () => (slide.value = 0));

const routeName = computed(() => (props.source === "posts" ? "post" : "archived-post"));
const go = (d: number) => {
  const p = posts.value?.[i.value + d];
  if (p) router.replace({ name: routeName.value, params: { id: p.id }, query: route.query });
};
const close = () => router.push({ path: props.source === "posts" ? "/" : "/archive", query: route.query });

/** Like Instagram: the first item sets the frame, clamped between 4:5 portrait and 1.91:1 landscape. */
const aspect = computed(() => {
  const m = post.value?.media[0];
  if (!m?.width || !m?.height) return 0.8;
  return Math.min(Math.max(m.width / m.height, 0.8), 1.91);
});

/** Split caption into text and #hashtag / @mention parts; those link to search (#tag as typed, @name as the name). */
const captionParts = computed(() =>
  (post.value?.caption ?? "")
    .split(/([#@][\p{L}\p{N}_.]+)/u)
    // split() with a capture group puts the matches at odd indexes
    .map((t, i) => ({ t, q: i % 2 === 0 ? undefined : t.startsWith("#") ? t : t.slice(1) })),
);
const mapUrl = computed(() => {
  const l = post.value?.location;
  return l ? `https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=14/${l.lat}/${l.lng}` : undefined;
});
</script>

<template>
  <Lightbox class="ig-modal" :has-prev="i > 0" :has-next="!!posts && i < posts.length - 1" @close="close" @prev="go(-1)" @next="go(1)">
    <template #close><Icon name="close" :size="28" /></template>
    <template #prev><Icon name="left" /></template>
    <template #next><Icon name="right" /></template>

    <article v-if="post" class="ig-post">
      <div class="ig-post-media" :style="{ '--ar': aspect }">
        <Carousel v-model:index="slide" :items="post.media">
          <template #default="{ item, active }"><MediaView :item="item" :active="active" /></template>
          <template #prev><Icon name="left" :size="16" /></template>
          <template #next><Icon name="right" :size="16" /></template>
        </Carousel>
      </div>
      <aside class="ig-post-side">
        <header class="ig-post-head">
          <Avatar :src="profile?.avatar" :label="profile?.username" :size="32" ring />
          <div>
            <b>{{ profile?.username }}</b>
            <a v-if="post.place" class="ig-post-place" :href="mapUrl" target="_blank" rel="noreferrer">{{ post.place.name }}</a>
            <a v-else-if="mapUrl" class="ig-post-place" :href="mapUrl" target="_blank" rel="noreferrer">
              <Icon name="pin" :size="12" /> {{ post.location!.lat.toFixed(3) }}, {{ post.location!.lng.toFixed(3) }}
            </a>
          </div>
          <Icon class="ig-post-more" name="more" />
        </header>
        <div class="ig-post-comments">
          <div v-if="post.caption" class="ig-caption">
            <Avatar :src="profile?.avatar" :label="profile?.username" :size="32" />
            <div>
              <p><b>{{ profile?.username }}</b>&nbsp;<template v-for="(c, k) in captionParts" :key="k"><RouterLink v-if="c.q" class="ig-link" :to="{ name: 'search', query: { q: c.q } }">{{ c.t }}</RouterLink><template v-else>{{ c.t }}</template></template></p>
              <time class="ig-muted">{{ shortAgo(post.timestamp) }}</time>
            </div>
          </div>
          <p v-else class="ig-muted ig-no-comments">No caption.</p>
          <p v-if="post.crossPostedFrom" class="ig-muted ig-small">Shared from {{ post.crossPostedFrom === "FB" ? "Facebook" : post.crossPostedFrom }}</p>
        </div>
        <footer class="ig-post-foot">
          <div class="ig-actions">
            <Icon name="heart" /><Icon name="comment" /><Icon name="share" /><Icon class="ig-actions-save" name="bookmark" />
          </div>
          <time class="ig-post-date" :datetime="new Date(post.timestamp).toISOString()" :title="new Date(post.timestamp).toLocaleString()">
            {{ longDate(post.timestamp) }}
          </time>
        </footer>
      </aside>
    </article>
    <p v-else-if="posts" class="ig-post-missing">Post not found.</p>
  </Lightbox>
</template>
