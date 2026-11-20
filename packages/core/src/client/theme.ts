/** Auto / light / dark theme. Sets `data-theme` on <html>; the app's CSS maps it to `color-scheme`. */
import { ref, watch } from "vue";

export type Theme = "auto" | "light" | "dark";
const KEY = "mev-theme";
const ORDER: Theme[] = ["auto", "light", "dark"];

export const nextTheme = (t: Theme): Theme => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length];

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY) as Theme;
    return ORDER.includes(t) ? t : "auto";
  } catch {
    return "auto";
  }
}

export function applyTheme(t: Theme) {
  if (t === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    t === "auto" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, t);
  } catch {
    // storage blocked (private window): the choice just won't persist
  }
}

const theme = ref<Theme>("auto");
let started = false;

export function useTheme() {
  if (!started) {
    started = true;
    theme.value = readTheme();
    watch(theme, applyTheme, { immediate: true });
  }
  return { theme, cycle: () => (theme.value = nextTheme(theme.value)) };
}
