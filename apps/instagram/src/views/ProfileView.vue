<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useData, compactCount } from "@mev/core/client";
import type { Post } from "@mev/core/types";
import type { Profile } from "../../build/index.ts";
import Icon from "../components/Icon.vue";
import Avatar from "../components/Avatar.vue";
import PostGrid from "../components/PostGrid.vue";

const { data: profile } = useData<Profile>("profile");
const { data: posts, loading } = useData<Post[]>("posts");
const route = useRoute();
const tab = computed(() => (route.query.tab as string) || "posts");
const reels = computed(() => posts.value?.filter((p) => p.media.length === 1 && p.media[0].kind === "video") ?? []);
const shown = computed(() => (tab.value === "reels" ? reels.value : tab.value === "posts" ? posts.value ?? [] : []));
</script>

<template>
  <div class="ig-profile">
    <header v-if="profile" class="ig-profile-header">
      <div class="ig-profile-avatar"><Avatar :src="profile.avatar" :label="profile.username" :size="150" /></div>
      <section class="ig-profile-info">
        <div class="ig-profile-row">
          <h2 class="ig-username">{{ profile.username }}</h2>
          <RouterLink class="ig-btn" to="/soon/accounts/edit">Edit profile</RouterLink>
          <RouterLink class="ig-btn" to="/archive">View archive</RouterLink>
          <RouterLink class="ig-icon-btn" to="/soon/accounts" aria-label="Settings"><Icon name="settings" /></RouterLink>
        </div>
        <ul class="ig-counts">
          <li><b>{{ compactCount(profile.counts.posts) }}</b> posts</li>
          <li><RouterLink :to="{ name: 'followers' }"><b>{{ compactCount(profile.counts.followers) }}</b> followers</RouterLink></li>
          <li><RouterLink :to="{ name: 'following' }"><b>{{ compactCount(profile.counts.following) }}</b> following</RouterLink></li>
        </ul>
        <div class="ig-bio">
          <span class="ig-name">{{ profile.name }}</span>
          <span v-if="profile.pronouns.length" class="ig-pronouns">{{ profile.pronouns.join("/") }}</span>
          <p v-if="profile.bio">{{ profile.bio }}</p>
        </div>
      </section>
    </header>

    <nav class="ig-tabs">
      <RouterLink :to="{ query: {} }" :class="{ active: tab === 'posts' }"><Icon name="grid" :size="12" />Posts</RouterLink>
      <RouterLink :to="{ query: { tab: 'reels' } }" :class="{ active: tab === 'reels' }"><Icon name="reels" :size="12" />Reels</RouterLink>
      <RouterLink :to="{ query: { tab: 'saved' } }" :class="{ active: tab === 'saved' }"><Icon name="bookmark" :size="12" />Saved</RouterLink>
      <RouterLink :to="{ query: { tab: 'tagged' } }" :class="{ active: tab === 'tagged' }"><Icon name="tag" :size="12" />Tagged</RouterLink>
    </nav>

    <p v-if="loading" class="ig-empty">Loading…</p>
    <PostGrid v-else-if="shown.length" :posts="shown" route-name="post" />
    <div v-else class="ig-empty">
      <h3>{{ tab === "saved" ? "Saved posts" : tab === "tagged" ? "Photos of you" : "No posts yet" }}</h3>
      <p v-if="tab === 'saved' || tab === 'tagged'">Coming in a later version: see ROADMAP.md.</p>
    </div>

    <RouterView />
  </div>
</template>
