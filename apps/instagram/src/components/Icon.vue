<script setup lang="ts">
/** Original line icons drawn for this project (not Meta's assets). 24×24, stroke = currentColor. */
const props = withDefaults(defineProps<{ name: string; size?: number; filled?: boolean }>(), { size: 24 });
const P: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  search: "M10.5 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zM16 16l5 5",
  explore: "M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zM15.5 8.5l-2 5-5 2 2-5z",
  reels: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM3 8h18M8 3l3 5M14 3l3 5M10 11.5v6l5-3z",
  messages: "M12 3c5 0 9 3.6 9 8.2s-4 8.2-9 8.2c-1 0-2-.1-2.9-.4L4 21l1.3-4.2A7.9 7.9 0 0 1 3 11.2C3 6.6 7 3 12 3zM7.5 13.5l3-3 2.5 2 3.5-3",
  heart: "M12 20.5S3 15 3 8.8A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 9 2.5C21 15 12 20.5 12 20.5z",
  create: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 7.5v9M7.5 12h9",
  menu: "M3 6h18M3 12h18M3 18h18",
  grid: "M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18",
  bookmark: "M6 3h12v18l-6-5-6 5z",
  tag: "M12 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM4.5 21a7.5 7.5 0 0 1 15 0zM3 3h4M3 3v4M21 3h-4M21 3v4",
  comment: "M20.5 12a8.5 8.5 0 1 1-3.4-6.8 8.4 8.4 0 0 1 3.4 6.8zM20.5 12l.5 9-5-2.6",
  share: "M21.5 2.5 10.5 13.5M21.5 2.5 15 21l-4.5-7.5L3 9z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  close: "M5 5l14 14M19 5 5 19",
  left: "M15 4l-8 8 8 8",
  right: "M9 4l8 8-8 8",
  settings: "M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1",
  archive: "M12 3a9 9 0 1 1-8.5 6M3 3v6h6M12 7.5V12l3 2",
  carousel: "M7 3h12a2 2 0 0 1 2 2v12M3 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  play: "M7 4v16l13-8z",
  phone: "M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z",
  info: "M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zM12 11v5.5M12 7.5h.01",
  up: "M4 15l8-8 8 8",
  down: "M4 9l8 8 8-8",
  warn: "M12 3 2 20.5h20zM12 10v4.5M12 17.5h.01",
  image: "M4 4h16v16H4zM4 16l5-5 4 4 2.5-2.5L20 16M15.5 8.5h.01",
  sun: "M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z",
  auto: "M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zM12 2.5v19M12 7h4.5M12 12h6.5M12 17h4.5",
  pin: "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
};
</script>

<template>
  <svg
    class="ig-icon"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="P[name] ?? P.more" />
  </svg>
</template>
