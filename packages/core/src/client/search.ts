/** Search over big index datasets (messages, records) that load only on first use. */
import { computed, shallowRef, watch, type Ref } from "vue";
import { fetchData } from "./useData.ts";
import { fold } from "./text.ts";

/** Shorter queries would match most of a big index; the small lists filter from the first character. */
export const MIN_CHARS = 3;

export interface Hits<R> {
  rows: R[];
  total: number;
}

/** Rows whose pre-folded text contains the query, sorted by `order`, at most `max`. */
export function searchIndex<R>(rows: R[], folded: string[], query: string, max: number, order?: (a: R, b: R) => number): Hits<R> {
  const q = fold(query.trim());
  if (q.length < MIN_CHARS) return { rows: [], total: 0 };
  const all = rows.filter((_, i) => folded[i].includes(q));
  if (order) all.sort(order);
  return { rows: all.slice(0, max), total: all.length };
}

/** Load dataset `name` once the query reaches MIN_CHARS, then search it as the query changes. */
export function useIndexSearch<R>(name: string, query: Ref<string>, text: (r: R) => string, opts: { max?: number; order?: (a: R, b: R) => number } = {}) {
  const index = shallowRef<R[]>();
  let requested = false;
  watch(
    query,
    (q) => {
      if (requested || q.trim().length < MIN_CHARS) return;
      requested = true;
      fetchData<R[]>(name)
        .then((d) => (index.value = d))
        .catch(() => (index.value = [])); // dataset missing: nothing to find, stop "Searching…"
    },
    { immediate: true },
  );
  // Fold once per load, not once per row per keystroke.
  const folded = computed(() => index.value?.map((r) => fold(text(r))));
  const hits = computed(() => (index.value && folded.value ? searchIndex(index.value, folded.value, query.value, opts.max ?? Infinity, opts.order) : { rows: [], total: 0 }));
  const loading = computed(() => query.value.trim().length >= MIN_CHARS && !index.value);
  return { hits, loading };
}
