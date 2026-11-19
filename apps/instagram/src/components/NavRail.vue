<script setup lang="ts">
import { useData } from "@mev/core/client";
import Icon from "./Icon.vue";
import Avatar from "./Avatar.vue";
import type { Profile } from "../../build/index.ts";

const { data: profile } = useData<Profile>("profile");
const items = [
  { to: "/", icon: "home", label: "Home", soon: true },
  { to: "/search", icon: "search", label: "Search", soon: true },
  { to: "/explore", icon: "explore", label: "Explore", soon: true },
  { to: "/reels", icon: "reels", label: "Reels", soon: true },
  { to: "/direct", icon: "messages", label: "Messages" },
  { to: "/activity", icon: "heart", label: "Notifications", soon: true },
  { to: "/archive", icon: "archive", label: "Archive" },
];
</script>

<template>
  <nav class="ig-rail">
    <RouterLink to="/" class="ig-rail-brand"><span class="ig-wordmark">Insta Archive</span><Icon class="ig-rail-brand-icon" name="create" /></RouterLink>
    <div class="ig-rail-items">
      <RouterLink v-for="it in items" :key="it.label" :to="it.soon ? `/soon${it.to}` : it.to" class="ig-rail-item" :title="it.label">
        <Icon :name="it.icon" /><span class="ig-rail-label">{{ it.label }}</span>
      </RouterLink>
      <RouterLink to="/" class="ig-rail-item ig-rail-profile" title="Profile" exact-active-class="active">
        <Avatar :src="profile?.avatar" :label="profile?.username" :size="24" /><span class="ig-rail-label">Profile</span>
      </RouterLink>
    </div>
    <RouterLink to="/soon/accounts" class="ig-rail-item ig-rail-more" title="More">
      <Icon name="menu" /><span class="ig-rail-label">More</span>
    </RouterLink>
  </nav>
</template>
