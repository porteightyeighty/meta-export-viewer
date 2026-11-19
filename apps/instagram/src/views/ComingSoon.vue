<script setup lang="ts">
import { useRoute } from "vue-router";
const route = useRoute();
</script>

<template>
  <div class="ig-empty ig-soon">
    <h3>Not built yet</h3>
    <p class="ig-muted"><code>{{ route.path.replace(/^\/soon/, "") }}</code> is on the roadmap (Direct, Stories, Settings…).</p>
    <RouterLink class="ig-btn primary" to="/">Back to profile</RouterLink>
  </div>
</template>
