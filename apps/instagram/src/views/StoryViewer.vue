<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Lightbox, MediaView, useData, shortAgo } from "@mev/core/client";
import type { Post } from "@mev/core/types";
import type { Profile } from "../../build/index.ts";
import Icon from "../components/Icon.vue";
import Avatar from "../components/Avatar.vue";

const IMAGE_MS = 5000;
const props = defineProps<{ id: string }>();
const router = useRouter();
const { data: stories } = useData<Post[]>("stories");
const { data: profile } = useData<Profile>("profile");

/** Play back oldest → newest, like watching them as posted (the dataset is newest first). */
const ordered = computed(() => [...(stories.value ?? [])].reverse());
const i = computed(() => ordered.value.findIndex((s) => s.id === props.id));
const story = computed(() => ordered.value[i.value]);
const dayKey = (ms: number) => new Date(ms).toDateString();
/** Progress segments: the stories posted the same day as this one. */
const segments = computed(() => (story.value ? ordered.value.filter((s) => dayKey(s.timestamp) === dayKey(story.value!.timestamp)) : []));
const cur = computed(() => segments.value.indexOf(story.value!));

const paused = ref(false);
const duration = ref(IMAGE_MS);
/** Videos hold the bar until their length is known. shortcut: buffering stalls don't pause the bar; track `waiting` if that bites. */
const ready = ref(true);
const mediaBox = ref<HTMLElement>();
watch(
  story,
  (s) => {
    paused.value = false;
    duration.value = IMAGE_MS;
    ready.value = s?.media[0].kind !== "video";
  },
  { immediate: true },
);
const onMeta = (e: Event) => {
  const d = (e.target as HTMLVideoElement).duration;
  duration.value = Number.isFinite(d) && d > 0 ? d * 1000 : IMAGE_MS;
  ready.value = true;
};

const close = () => router.push("/archive/stories");
const go = (d: number) => {
  const s = ordered.value[i.value + d];
  s ? router.replace({ name: "story", params: { id: s.id } }) : d > 0 && close();
};
const tap = (e: MouseEvent) => go(e.offsetX < (e.currentTarget as HTMLElement).clientWidth / 3 ? -1 : 1);
const togglePause = () => {
  paused.value = !paused.value;
  const v = mediaBox.value?.querySelector("video");
  if (v) paused.value ? v.pause() : v.play().catch(() => {});
};

function onKey(e: KeyboardEvent) {
  if (e.key !== " ") return;
  e.preventDefault();
  togglePause();
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Lightbox class="ig-modal ig-story-modal" :has-prev="i > 0" :has-next="i >= 0 && i < ordered.length - 1" @close="close" @prev="go(-1)" @next="go(1)">
    <template #close><Icon name="close" :size="28" /></template>
    <template #prev><Icon name="left" /></template>
    <template #next><Icon name="right" /></template>

    <article v-if="story" :key="story.id" class="ig-story">
      <div class="ig-story-bars">
        <span v-for="(s, k) in segments" :key="s.id" class="ig-story-bar">
          <i
            :class="k < cur ? 'done' : k === cur ? 'run' : ''"
            :style="k === cur ? { animationDuration: duration + 'ms', animationPlayState: paused || !ready ? 'paused' : 'running' } : undefined"
            @animationend="k === cur && go(1)"
          />
        </span>
      </div>
      <header class="ig-story-head">
        <Avatar :src="profile?.avatar" :label="profile?.username" :size="32" />
        <b>{{ profile?.username }}</b>
        <time class="ig-story-ago" :title="new Date(story.timestamp).toLocaleString()">{{ shortAgo(story.timestamp) }}</time>
        <button class="ig-story-pause" :aria-label="paused ? 'Play' : 'Pause'" @click.stop="togglePause">{{ paused ? "▶" : "❚❚" }}</button>
      </header>
      <div ref="mediaBox" class="ig-story-media" @click="tap">
        <MediaView
          :item="story.media[0]"
          :controls="false"
          :loop="false"
          @loadedmetadata="onMeta"
        />
      </div>
      <p v-if="story.caption" class="ig-story-caption">{{ story.caption }}</p>
    </article>
    <p v-else-if="stories" class="ig-post-missing">Story not found.</p>
  </Lightbox>
</template>
