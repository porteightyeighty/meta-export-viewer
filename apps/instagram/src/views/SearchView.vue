<script setup lang="ts">
/** One box over everything: accounts, posts, chats, messages and Accounts Center records, grouped by type. */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import { MIN_CHARS, SearchableList, highlight, longDate, matches, snippet, useData, useIndexSearch } from "@mev/core/client";
import type { Person, Post, ThreadSummary } from "@mev/core/types";
import type { MessageIndexRow } from "../../build/direct.ts";
import type { RecordIndexRow, SettingsSection } from "../../build/settings.ts";
import Avatar from "../components/Avatar.vue";
import PostGrid from "../components/PostGrid.vue";
import type { ActivityRow } from "../../build/activity.ts";
import { VERB } from "../activity.ts";

const route = useRoute();
const router = useRouter();

// The query lives in the URL (?q=), so Back, Refresh and #tag links land on the same results.
const urlQuery = () => (typeof route.query.q === "string" ? route.query.q : "");
const query = ref(urlQuery());
watch(query, (v) => v !== urlQuery() && router.replace({ query: v ? { q: v } : {} }));
watch(urlQuery, (v) => v !== query.value && (query.value = v));
const q = computed(() => query.value.trim());

const PREVIEW = { accounts: 5, posts: 6, chats: 5, messages: 5, activity: 5, info: 5 };
type Group = keyof typeof PREVIEW;
const expanded = reactive(new Set<Group>());
watch(q, () => expanded.clear());
const take = <T,>(g: Group, list: T[]) => (expanded.has(g) ? list : list.slice(0, PREVIEW[g]));
const more = (g: Group, n: number) => !expanded.has(g) && n > PREVIEW[g];

// ── accounts: followers and following, merged ──
const { data: followers } = useData<Person[]>("followers");
const { data: following } = useData<Person[]>("following");
interface Account { username: string; href?: string; followsYou: boolean; youFollow: boolean }
const accounts = computed(() => {
  const all = new Map<string, Account>();
  const add = (p: Person, key: "followsYou" | "youFollow") => {
    const a = all.get(p.username) ?? { username: p.username, href: p.href, followsYou: false, youFollow: false };
    a[key] = true;
    a.href ??= p.href;
    all.set(p.username, a);
  };
  followers.value?.forEach((p) => add(p, "followsYou"));
  following.value?.forEach((p) => add(p, "youFollow"));
  return [...all.values()].sort((a, b) => a.username.localeCompare(b.username));
});
const accountHits = computed(() => (q.value ? accounts.value.filter((a) => matches(a.username, q.value)) : []));

// ── posts, archived posts and stories: caption, #hashtag or place ──
const { data: posts } = useData<Post[]>("posts");
const { data: archived } = useData<Post[]>("archived");
const { data: stories } = useData<Post[]>("stories");
const postRoute = new WeakMap<Post, RouteLocationRaw>();
const postHits = computed(() => {
  if (!q.value) return [];
  const hit = (p: Post) =>
    matches(p.caption, q.value) || matches(p.place?.name, q.value) || (p.hashtags ?? []).some((h) => matches(`#${h}`, q.value));
  const from = (list: Post[] | undefined, name: string) =>
    (list ?? []).filter(hit).map((p) => (postRoute.set(p, { name, params: { id: p.id } }), p));
  return [...from(posts.value, "post"), ...from(archived.value, "archived-post"), ...from(stories.value, "story")].sort(
    (a, b) => b.timestamp - a.timestamp,
  );
});

// ── chats by name or member ──
const { data: threads } = useData<{ me: string; items: ThreadSummary[] }>("threads");
const threadById = computed(() => new Map(threads.value?.items.map((t) => [t.id, t])));
const chatHits = computed(() =>
  q.value ? (threads.value?.items ?? []).filter((t) => [t.title, ...t.participants].some((s) => matches(s, q.value))) : [],
);

// ── message text and Accounts Center records: big indexes, loaded on first 3+ character query ──
const MAX_MESSAGES = 100;
const messages = useIndexSearch<MessageIndexRow>("messageIndex", query, (r) => r[2], { max: MAX_MESSAGES, order: (a, b) => b[3] - a[3] });
const activity = useIndexSearch<ActivityRow>("activity", query, (r) => `${r[2]} ${r[3]}`);
const records = useIndexSearch<RecordIndexRow>("recordIndex", query, (r) => r[1]);
const { data: settings } = useData<SettingsSection[]>("settings");
const files = computed(() => settings.value?.flatMap((s) => s.files) ?? []);
const fileTitle = computed(() => new Map(files.value.map((f) => [f.id, f.title])));
/** One row per file: how many of its records match, and the first match as a snippet. */
const infoHits = computed(() => {
  const byFile = new Map<string, { id: string; count: number; text?: string }>();
  for (const [id, text] of records.hits.value.rows) {
    const f = byFile.get(id);
    if (f) f.count++;
    else byFile.set(id, { id, count: 1, text });
  }
  // Files named like the query ("login" → Login activity) come too, opened unfiltered: their records may not say it.
  if (q.value) for (const f of files.value) if (!byFile.has(f.id) && matches(f.title, q.value)) byFile.set(f.id, { id: f.id, count: f.count });
  return [...byFile.values()];
});

const searching = computed(() => messages.loading.value || activity.loading.value || records.loading.value);
const nothing = computed(
  () =>
    !searching.value &&
    !accountHits.value.length &&
    !postHits.value.length &&
    !chatHits.value.length &&
    !messages.hits.value.total &&
    !activity.hits.value.total &&
    !infoHits.value.length,
);

const root = ref<HTMLElement>();
onMounted(() => root.value?.querySelector<HTMLInputElement>(".mev-search-box input")?.focus());
</script>

<template>
  <div ref="root" class="ig-search-page">
    <h2>Search</h2>
    <SearchableList v-model:query="query" class="ig-search" :items="[]" :keys="() => []" placeholder="Search">
      <template #empty><span /></template>
      <template #after>
        <p v-if="!q" class="mev-search-empty">Posts, hashtags, places, people, chats, messages, your activity and your information.</p>
        <template v-else>
          <section v-if="accountHits.length">
            <h3 class="ig-search-section">Accounts <span class="ig-muted">{{ accountHits.length }}</span></h3>
            <a v-for="a in take('accounts', accountHits)" :key="a.username" class="ig-person" :href="a.href" target="_blank" rel="noreferrer">
              <Avatar :label="a.username" :size="44" />
              <span class="ig-person-text">
                <b>{{ a.username }}</b>
                <span class="ig-muted">{{ [a.youFollow && "Following", a.followsYou && "Follows you"].filter(Boolean).join(" · ") }}</span>
              </span>
            </a>
            <button v-if="more('accounts', accountHits.length)" class="ig-search-more" @click="expanded.add('accounts')">Show all {{ accountHits.length }}</button>
          </section>

          <section v-if="postHits.length">
            <h3 class="ig-search-section">Posts <span class="ig-muted">{{ postHits.length }}</span></h3>
            <PostGrid :posts="take('posts', postHits)" :link="(p) => postRoute.get(p)!" />
            <button v-if="more('posts', postHits.length)" class="ig-search-more" @click="expanded.add('posts')">Show all {{ postHits.length }}</button>
          </section>

          <section v-if="chatHits.length">
            <h3 class="ig-search-section">Chats <span class="ig-muted">{{ chatHits.length }}</span></h3>
            <RouterLink v-for="t in take('chats', chatHits)" :key="t.id" :to="{ name: 'thread', params: { id: t.id } }" class="ig-dm-row">
              <Avatar :label="t.title" :size="44" />
              <span class="ig-dm-row-text">
                <span class="ig-dm-row-title">{{ t.title }}<span v-if="t.box === 'requests'" class="ig-muted"> · request</span></span>
                <span class="ig-dm-row-preview ig-muted"><span class="ig-dm-row-snippet">{{ t.participants.join(", ") }}</span></span>
              </span>
            </RouterLink>
            <button v-if="more('chats', chatHits.length)" class="ig-search-more" @click="expanded.add('chats')">Show all {{ chatHits.length }}</button>
          </section>

          <section v-if="messages.hits.value.total">
            <h3 class="ig-search-section">
              Messages
              <span class="ig-muted">{{ messages.hits.value.total > MAX_MESSAGES && expanded.has("messages") ? `latest ${MAX_MESSAGES} of ${messages.hits.value.total}` : messages.hits.value.total }}</span>
            </h3>
            <RouterLink
              v-for="[id, i, text, ts] in take('messages', messages.hits.value.rows)"
              :key="id + i"
              :to="{ name: 'thread', params: { id }, query: { m: i, q } }"
              class="ig-dm-row"
            >
              <Avatar :label="threadById.get(id)?.title" :size="44" />
              <span class="ig-dm-row-text">
                <span class="ig-dm-row-title">{{ threadById.get(id)?.title }}</span>
                <span class="ig-dm-row-preview ig-muted">
                  <span class="ig-dm-row-snippet"><template v-for="(s, k) in highlight(snippet(text, q), q)" :key="k"><b v-if="s.hit" class="ig-hit">{{ s.text }}</b><template v-else>{{ s.text }}</template></template></span>
                  · {{ longDate(ts) }}
                </span>
              </span>
            </RouterLink>
            <button v-if="more('messages', messages.hits.value.rows.length)" class="ig-search-more" @click="expanded.add('messages')">
              Show {{ messages.hits.value.total > MAX_MESSAGES ? `latest ${MAX_MESSAGES}` : `all ${messages.hits.value.total}` }}
            </button>
          </section>

          <section v-if="activity.hits.value.total">
            <h3 class="ig-search-section">Your activity <span class="ig-muted">{{ activity.hits.value.total }}</span></h3>
            <component
              :is="href ? 'a' : 'div'"
              v-for="[kind, ts, owner, text, href] in take('activity', activity.hits.value.rows)"
              :key="kind + ts + href"
              class="ig-dm-row"
              :href="href || undefined"
              :target="href ? '_blank' : undefined"
              :rel="href ? 'noreferrer' : undefined"
            >
              <Avatar :label="owner || '?'" :size="44" />
              <span class="ig-dm-row-text">
                <span class="ig-dm-row-title">{{ VERB[kind] }} <b><template v-for="(s, k) in highlight(owner || 'someone', q)" :key="k"><span v-if="s.hit" class="ig-hit">{{ s.text }}</span><template v-else>{{ s.text }}</template></template></b></span>
                <span class="ig-dm-row-preview ig-muted">
                  <span v-if="text" class="ig-dm-row-snippet"><template v-for="(s, k) in highlight(snippet(text, q), q)" :key="k"><b v-if="s.hit" class="ig-hit">{{ s.text }}</b><template v-else>{{ s.text }}</template></template></span>
                  <template v-if="text">·</template> {{ longDate(ts) }}
                </span>
              </span>
            </component>
            <button v-if="more('activity', activity.hits.value.total)" class="ig-search-more" @click="expanded.add('activity')">Show all {{ activity.hits.value.total }}</button>
          </section>

          <section v-if="infoHits.length">
            <h3 class="ig-search-section">Your information <span class="ig-muted">{{ infoHits.length }}</span></h3>
            <RouterLink v-for="f in take('info', infoHits)" :key="f.id" :to="{ path: `/accounts/${f.id}`, query: f.text ? { q } : {} }" class="ig-dm-row">
              <Avatar :label="fileTitle.get(f.id) ?? f.id" :size="44" />
              <span class="ig-dm-row-text">
                <span class="ig-dm-row-title">{{ fileTitle.get(f.id) ?? f.id }}<span class="ig-muted"> · {{ f.text ? `${f.count} matching` : `${f.count} ${f.count === 1 ? "entry" : "entries"}` }}</span></span>
                <span v-if="f.text" class="ig-dm-row-preview ig-muted">
                  <span class="ig-dm-row-snippet"><template v-for="(s, k) in highlight(snippet(f.text, q), q)" :key="k"><b v-if="s.hit" class="ig-hit">{{ s.text }}</b><template v-else>{{ s.text }}</template></template></span>
                </span>
              </span>
            </RouterLink>
            <button v-if="more('info', infoHits.length)" class="ig-search-more" @click="expanded.add('info')">Show all {{ infoHits.length }}</button>
          </section>

          <p v-if="searching" class="mev-search-empty">Searching messages, your activity and your information…</p>
          <p v-else-if="nothing" class="mev-search-empty">No results found.</p>
          <p v-if="q.length < MIN_CHARS" class="mev-search-empty ig-small">Type {{ MIN_CHARS }} or more characters to search messages, your activity and your information.</p>
        </template>
      </template>
    </SearchableList>
  </div>
</template>
