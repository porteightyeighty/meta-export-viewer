<script setup lang="ts">
/** One conversation: bubbles, media, shares, in-chat search and an info pane. */
import { computed, nextTick, reactive, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { Lightbox, MediaView, breakLabel, callLength, fetchData, findMatches, isEmojiOnly, layoutThread, useData } from "@mev/core/client";
import type { ChatMessage, MediaItem, Share, Thread } from "@mev/core/types";
import Avatar from "../components/Avatar.vue";
import Icon from "../components/Icon.vue";
import MsgText from "../components/MsgText.vue";

const props = defineProps<{ id: string }>();
const route = useRoute();
const { data: threads } = useData<{ me: string }>("threads");
const me = computed(() => threads.value?.me ?? "");

const thread = shallowRef<Thread>();
const error = ref<string>();
fetchData<Thread>(`thread/${props.id}`)
  .then((t) => (thread.value = t))
  .catch((e) => (error.value = String(e.message ?? e)));
const messages = computed(() => thread.value?.messages ?? []);

// ── paging: render the newest PAGE messages, add older ones on scroll-up ──
const PAGE = 200;
const from = ref(0);
const scroller = ref<HTMLElement>();
const rows = computed(() => layoutThread(messages.value, { me: me.value, isGroup: thread.value?.isGroup, from: from.value }));

function onScroll() {
  const el = scroller.value;
  if (!el || from.value === 0 || el.scrollTop > 300) return;
  const before = el.scrollHeight;
  from.value = Math.max(0, from.value - PAGE);
  nextTick(() => (el.scrollTop += el.scrollHeight - before));
}

async function scrollToMessage(i: number) {
  if (i < from.value) {
    from.value = Math.max(0, i - 50);
    await nextTick();
  }
  scroller.value?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "center" });
}

// ── in-chat search ──
const searching = ref(false);
const q = ref("");
const hits = computed(() => (searching.value ? findMatches(messages.value, q.value) : []));
const cur = ref(-1);
const hitSet = computed(() => new Set(hits.value));
const activeQuery = computed(() => (searching.value ? q.value : ""));
watch(hits, (h) => {
  cur.value = h.length - 1;
  if (h.length) scrollToMessage(h[cur.value]);
});
function step(d: number) {
  if (!hits.value.length) return;
  cur.value = (cur.value + d + hits.value.length) % hits.value.length;
  scrollToMessage(hits.value[cur.value]);
}
const searchInput = ref<HTMLInputElement>();
function toggleSearch() {
  searching.value = !searching.value;
  if (searching.value) nextTick(() => searchInput.value?.focus());
}

// Initial position: a search hit from the inbox (?m=&q=), else the bottom.
watch(thread, async (t) => {
  if (!t) return;
  const target = Number(route.query.m);
  from.value = Math.max(0, t.messages.length - PAGE);
  await nextTick();
  if (Number.isInteger(target) && target >= 0 && target < t.messages.length) {
    if (typeof route.query.q === "string" && route.query.q) {
      q.value = route.query.q;
      searching.value = true;
      await nextTick();
      const k = hits.value.indexOf(target);
      if (k >= 0) cur.value = k;
    }
    await scrollToMessage(target);
  } else if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
});

// ── media viewer ──
const viewable = computed(() =>
  messages.value.flatMap((m) => (m.media ?? []).filter((x) => x.kind !== "audio")),
);
const viewing = ref(-1);
const openMedia = (item: MediaItem) => (viewing.value = viewable.value.findIndex((x) => x.src === item.src));

const tileStyle = (x: MediaItem) => {
  const ar = x.width && x.height ? x.width / x.height : 1;
  return { width: `${Math.round(Math.min(240, 360 * ar))}px`, aspectRatio: String(ar) };
};

// Remote images are only fetched after an explicit click; nothing leaves localhost by default.
const allowed = reactive(new Set<string>());

// ── labels ──
const firstName = (n: string) => n.split(/\s+/)[0] || n;
function noticeText(m: ChatMessage) {
  const text = m.text ?? "";
  if (text.startsWith(m.sender)) return text;
  const who = m.sender === me.value ? "You" : firstName(m.sender);
  return `${who} ${text.charAt(0).toLowerCase()}${text.slice(1)}`.trim();
}
const SHARE_LABEL: Record<Share["kind"], string> = { post: "Post", reel: "Reel", story: "Story", profile: "Profile", gif: "GIF", link: "Link" };
const SHARE_ICON: Record<Share["kind"], string> = { post: "grid", reel: "reels", story: "archive", profile: "tag", gif: "image", link: "share" };
const fullTime = (ts: number) => new Date(ts).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const isRequest = computed(() => thread.value?.box === "requests");
const others = computed(() => thread.value?.participants.filter((p) => p !== me.value) ?? []);

const showInfo = ref(false);
</script>

<template>
  <div class="ig-dm-thread">
    <div class="ig-dm-chat">
      <header class="ig-dm-head">
        <RouterLink :to="isRequest ? '/direct/requests' : '/direct'" class="ig-icon-btn ig-dm-back" aria-label="Back"><Icon name="left" /></RouterLink>
        <Avatar :label="thread?.title" :size="44" />
        <div class="ig-dm-head-text">
          <b>{{ thread?.title }}</b>
          <span v-if="thread?.isGroup" class="ig-muted ig-small">{{ thread.participants.length }} members</span>
          <span v-else-if="isRequest" class="ig-muted ig-small">Message request</span>
        </div>
        <button class="ig-icon-btn" :class="{ on: searching }" title="Search in conversation" @click="toggleSearch"><Icon name="search" /></button>
        <button class="ig-icon-btn" :class="{ on: showInfo }" title="Conversation information" @click="showInfo = !showInfo"><Icon name="info" /></button>
      </header>

      <div v-if="searching" class="ig-dm-searchbar">
        <input
          ref="searchInput"
          v-model="q"
          type="search"
          placeholder="Search in conversation"
          @keydown.enter.exact.prevent="step(-1)"
          @keydown.shift.enter.prevent="step(1)"
          @keydown.esc="toggleSearch"
        />
        <span class="ig-muted ig-small">{{ q.trim() ? (hits.length ? `${cur + 1} of ${hits.length}` : "No results") : "" }}</span>
        <button class="ig-icon-btn" title="Older (Enter)" :disabled="!hits.length" @click="step(-1)"><Icon name="up" :size="18" /></button>
        <button class="ig-icon-btn" title="Newer (Shift+Enter)" :disabled="!hits.length" @click="step(1)"><Icon name="down" :size="18" /></button>
        <button class="ig-icon-btn" title="Close" @click="toggleSearch"><Icon name="close" :size="18" /></button>
      </div>

      <div ref="scroller" class="ig-dm-scroll" @scroll.passive="onScroll">
        <p v-if="error" class="ig-dm-notice">Couldn't load this conversation: {{ error }}</p>
        <div v-if="thread" class="ig-dm-intro">
          <Avatar :label="thread.title" :size="96" />
          <h2>{{ thread.title }}</h2>
          <p class="ig-muted ig-small">{{ thread.messages.length.toLocaleString() }} {{ thread.messages.length === 1 ? "message" : "messages" }}<template v-if="thread.messages[0]"> since {{ fullTime(thread.messages[0].ts) }}</template></p>
          <p v-if="from > 0" class="ig-muted ig-small">Scroll up for older messages</p>
        </div>

        <template v-for="r in rows" :key="r.key">
          <div v-if="r.kind === 'time'" class="ig-dm-time">{{ breakLabel(r.ts) }}</div>
          <div v-else-if="r.kind === 'notice'" class="ig-dm-notice" :data-i="r.i" :title="fullTime(r.m.ts)">{{ noticeText(r.m) }}</div>
          <div
            v-else
            class="ig-dm-msg"
            :class="{ mine: r.mine, first: r.first, last: r.last, hit: hitSet.has(r.i), current: hits[cur] === r.i }"
            :data-i="r.i"
          >
            <div v-if="r.showSender" class="ig-dm-sender">{{ r.m.sender }}</div>
            <div class="ig-dm-line">
              <span v-if="!r.mine" class="ig-dm-av"><Avatar v-if="r.last" :label="r.m.sender" :size="28" /></span>
              <div class="ig-dm-stack" :title="fullTime(r.m.ts)">
                <template v-for="x in r.m.media ?? []" :key="x.src">
                  <audio v-if="x.kind === 'audio'" class="ig-dm-audio" :src="x.src" controls preload="none" />
                  <button v-else class="ig-dm-tile" :style="tileStyle(x)" @click="openMedia(x)">
                    <MediaView :item="x" :active="false" :controls="false" fit="cover" />
                    <Icon v-if="x.kind === 'video'" class="ig-dm-tile-play" name="play" :size="32" filled />
                  </button>
                </template>

                <template v-for="x in r.m.remote ?? []" :key="x.url">
                  <img v-if="allowed.has(x.url)" class="ig-dm-remote-img" :src="x.url" alt="" referrerpolicy="no-referrer" />
                  <button v-else class="ig-dm-remote" @click="allowed.add(x.url)">
                    <Icon name="image" :size="28" />
                    <span>Remote image</span>
                    <span class="ig-muted ig-small">Load from {{ x.host }}</span>
                  </button>
                </template>

                <template v-if="r.m.share">
                  <template v-if="r.m.share.kind === 'gif' && r.m.share.url">
                    <img v-if="allowed.has(r.m.share.url)" class="ig-dm-remote-img" :src="r.m.share.url" alt="GIF" referrerpolicy="no-referrer" />
                    <button v-else class="ig-dm-remote" @click="allowed.add(r.m.share.url)">
                      <Icon name="image" :size="28" />
                      <span>GIF</span>
                      <span class="ig-muted ig-small">Load from {{ r.m.share.host }}</span>
                    </button>
                  </template>
                  <component
                    :is="r.m.share.url ? 'a' : 'div'"
                    v-else
                    class="ig-dm-share"
                    :href="r.m.share.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span v-if="r.m.share.owner" class="ig-dm-share-head"><Avatar :label="r.m.share.owner" :size="24" /><b>{{ r.m.share.owner }}</b></span>
                    <span class="ig-dm-share-kind"><Icon :name="SHARE_ICON[r.m.share.kind]" :size="20" />{{ SHARE_LABEL[r.m.share.kind] }}<template v-if="r.m.share.kind === 'story'"> · may have expired</template></span>
                    <span v-if="r.m.share.text" class="ig-dm-share-text"><MsgText :text="r.m.share.text" :query="activeQuery" /></span>
                    <span v-if="r.m.share.host" class="ig-dm-share-foot ig-muted">{{ r.m.share.host }}</span>
                  </component>
                  <span v-if="isRequest && r.m.share.kind === 'link'" class="ig-dm-warn"><Icon name="warn" :size="14" /> Link from someone you don't follow. Be careful.</span>
                </template>

                <span v-if="r.m.text && isEmojiOnly(r.m.text)" class="ig-dm-emoji">{{ r.m.text }}</span>
                <span v-else-if="r.m.text" class="ig-dm-bubble"><MsgText :text="r.m.text" :query="activeQuery" /></span>

                <span v-if="r.m.callSec !== undefined" class="ig-dm-bubble ig-dm-call">
                  <Icon name="phone" :size="18" />{{ r.m.callSec ? `Audio call · ${callLength(r.m.callSec)}` : "Missed call" }}
                </span>
                <span v-if="r.m.unavailable" class="ig-dm-bubble ig-dm-unavailable">Message unavailable</span>

                <span v-if="r.m.reactions" class="ig-dm-reactions" :title="r.m.reactions.map((x) => `${x.emoji} ${x.actors.join(', ')}`).join('\n')">
                  <template v-for="x in r.m.reactions" :key="x.emoji">{{ x.emoji }}<small v-if="x.actors.length > 1">{{ x.actors.length }}</small></template>
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <aside v-if="showInfo && thread" class="ig-dm-info">
      <h3>Details</h3>
      <h4 class="ig-muted">Members</h4>
      <div v-for="p in others" :key="p" class="ig-person">
        <Avatar :label="p" :size="44" />
        <span class="ig-person-text"><b>{{ p }}</b></span>
      </div>
      <div class="ig-person">
        <Avatar :label="me" :size="44" />
        <span class="ig-person-text"><b>{{ me }}</b><span class="ig-muted">You</span></span>
      </div>
      <p v-if="!thread.stillParticipant" class="ig-muted ig-small">You're no longer in this conversation.</p>
      <h4 class="ig-muted">Photos and videos <span v-if="viewable.length">· {{ viewable.length }}</span></h4>
      <div v-if="viewable.length" class="ig-dm-info-grid">
        <button v-for="(x, k) in viewable" :key="x.src" class="ig-dm-info-tile" @click="viewing = k">
          <MediaView :item="x" :active="false" :controls="false" fit="cover" />
        </button>
      </div>
      <p v-else class="ig-muted ig-small">None in this conversation.</p>
    </aside>

    <Lightbox
      v-if="viewing >= 0"
      class="ig-modal"
      :has-prev="viewing > 0"
      :has-next="viewing < viewable.length - 1"
      @close="viewing = -1"
      @prev="viewing--"
      @next="viewing++"
    >
      <template #close><Icon name="close" :size="28" /></template>
      <template #prev><Icon name="left" /></template>
      <template #next><Icon name="right" /></template>
      <div class="ig-dm-viewer"><MediaView :key="viewable[viewing].src" :item="viewable[viewing]" /></div>
    </Lightbox>
  </div>
</template>
