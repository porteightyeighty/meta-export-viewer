<script setup lang="ts">
/** One normalised export record (see core/node/records.ts); nested items render recursively. Styled via .mev-rec* classes. */
import type { Rec } from "../../types/meta.ts";

defineProps<{ rec: Rec }>();
const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const isVideo = (src: string) => /\.(mp4|mov|webm|m4v)$/i.test(src);
</script>

<template>
  <div class="mev-rec">
    <div v-if="rec.title || rec.time" class="mev-rec-head">
      <b v-if="rec.title">{{ rec.title }}</b>
      <time v-if="rec.time" :datetime="new Date(rec.time).toISOString()">{{ when(rec.time) }}</time>
    </div>
    <dl v-if="rec.fields.length">
      <template v-for="(f, i) in rec.fields" :key="i">
        <dt v-if="f.label">{{ f.label }}</dt>
        <dd :class="{ 'mev-rec-full': !f.label }">
          <a v-if="f.href" :href="f.href" target="_blank" rel="noreferrer">{{ f.value ?? f.href }}</a>
          <span v-else-if="f.value !== undefined" class="mev-rec-value">{{ f.value }}</span>
          <time v-if="f.time" :datetime="new Date(f.time).toISOString()">{{ when(f.time) }}</time>
          <span v-if="f.media" class="mev-rec-media">
            <template v-for="src in f.media" :key="src">
              <video v-if="isVideo(src)" :src="src + '#t=0.1'" preload="metadata" muted controls />
              <a v-else :href="src" target="_blank" rel="noreferrer"><img :src="src" alt="" loading="lazy" decoding="async" /></a>
            </template>
          </span>
          <div v-if="f.items?.length" class="mev-rec-items"><RecordView v-for="(r, k) in f.items" :key="k" :rec="r" /></div>
        </dd>
      </template>
    </dl>
  </div>
</template>
