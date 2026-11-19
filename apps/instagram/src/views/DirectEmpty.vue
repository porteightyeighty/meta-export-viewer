<script setup lang="ts">
import Icon from "../components/Icon.vue";
</script>

<template>
  <div class="ig-dm-empty">
    <span class="ig-dm-empty-icon"><Icon name="messages" :size="48" /></span>
    <h2>Your messages</h2>
    <p class="ig-muted">Pick a conversation to read it.</p>
  </div>
</template>
