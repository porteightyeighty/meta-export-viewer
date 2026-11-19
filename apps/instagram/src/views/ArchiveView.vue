<script setup lang="ts">
import { useData } from "@mev/core/client";
import type { Post } from "@mev/core/types";
import Icon from "../components/Icon.vue";
import PostGrid from "../components/PostGrid.vue";

const { data: archived, loading } = useData<Post[]>("archived");
</script>

<template>
  <div class="ig-profile">
    <header class="ig-archive-head">
      <RouterLink to="/" class="ig-icon-btn" aria-label="Back"><Icon name="left" /></RouterLink>
      <h2>Archive</h2>
    </header>
    <p class="ig-muted ig-archive-note">Only you can see the posts you archive.</p>
    <p v-if="loading" class="ig-empty">Loading…</p>
    <PostGrid v-else-if="archived?.length" :posts="archived" route-name="archived-post" />
    <div v-else class="ig-empty"><h3>No archived posts</h3></div>
    <RouterView />
  </div>
</template>
