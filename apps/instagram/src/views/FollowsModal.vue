<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Lightbox, SearchableList, useData, longDate } from "@mev/core/client";
import type { Person } from "@mev/core/types";
import Icon from "../components/Icon.vue";
import Avatar from "../components/Avatar.vue";

const props = defineProps<{ kind: "followers" | "following" }>();
const router = useRouter();
const { data: people } = useData<Person[]>(props.kind);
const { data: other } = useData<Person[]>(props.kind === "followers" ? "following" : "followers");
const otherSet = computed(() => new Set(other.value?.map((p) => p.username)));
const sorted = computed(() => [...(people.value ?? [])].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)));
const close = () => router.push("/");
</script>

<template>
  <Lightbox class="ig-modal ig-modal-plain" @close="close">
    <template #close><span /></template>
    <section class="ig-dialog">
      <header class="ig-dialog-head">
        <h3>{{ kind === "followers" ? "Followers" : "Following" }}</h3>
        <button class="ig-icon-btn" aria-label="Close" @click="close"><Icon name="close" /></button>
      </header>
      <SearchableList class="ig-dialog-list" :items="sorted" :keys="(p) => [p.username]">
        <template #default="{ item }">
          <a class="ig-person" :href="item.href" target="_blank" rel="noreferrer">
            <Avatar :label="item.username" :size="44" />
            <span class="ig-person-text">
              <b>{{ item.username }}</b>
              <span class="ig-muted">{{ item.timestamp ? (kind === "followers" ? "Followed you " : "Followed ") + longDate(item.timestamp) : "" }}</span>
            </span>
            <span v-if="otherSet.has(item.username)" class="ig-chip">{{ kind === "followers" ? "Following" : "Follows you" }}</span>
          </a>
        </template>
      </SearchableList>
    </section>
  </Lightbox>
</template>
