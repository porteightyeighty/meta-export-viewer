<script setup lang="ts">
/** Start screen of the static site: pick the unzipped export folder; `load` reads it in this browser. */
import { ref } from "vue";

const props = defineProps<{ title: string; load: (files: File[]) => Promise<void> }>();
const busy = ref(false);
const error = ref<string>();

async function pick(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = "";
  if (!files.length) return;
  busy.value = true;
  error.value = undefined;
  try {
    await props.load(files);
  } catch (err) {
    error.value = String((err as Error).message ?? err);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="mev-picker">
    <h1>{{ title }}</h1>
    <p>Unzip your Meta export (the JSON format), then pick the folder.</p>
    <label class="mev-picker-btn" :class="{ busy }">
      <input type="file" webkitdirectory multiple :disabled="busy" @change="pick" />
      {{ busy ? "Reading export…" : "Choose export folder" }}
    </label>
    <p v-if="error" class="mev-picker-error" role="alert">Couldn't read the export: {{ error }}</p>
    <p class="mev-picker-note">
      Your files never leave this browser. The page reads them on your device and sends nothing anywhere
      (a Content-Security-Policy blocks it), and it works offline after the first visit.
    </p>
  </main>
</template>

<style>
.mev-picker { max-width: 480px; margin: 15vh auto 0; padding: 0 16px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.mev-picker h1 { font-size: 24px; margin: 0; }
.mev-picker p { margin: 0; }
.mev-picker-btn { position: relative; display: inline-flex; align-items: center; height: 40px; padding: 0 20px; border-radius: 8px; background: var(--primary, #0095f6); color: #fff; font-weight: 600; cursor: pointer; }
.mev-picker-btn.busy { opacity: 0.7; cursor: progress; }
.mev-picker-btn:focus-within { outline: 2px solid var(--text, currentColor); outline-offset: 2px; }
/* the native input stays in the tab order but is visually replaced by the label */
.mev-picker-btn input { position: absolute; inset: 0; opacity: 0; cursor: inherit; width: 100%; }
.mev-picker-error { color: #ed4956; }
.mev-picker-note { color: var(--muted, GrayText); font-size: 12px; line-height: 1.5; }
</style>
