import { ref, shallowRef, type Ref } from "vue";

const cache = new Map<string, Promise<unknown>>();

export function fetchData<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    const p = fetch(`/api/data/${encodeURIComponent(name)}.json`).then(async (r) => {
      if (!r.ok) throw new Error(`${name}: ${r.status} ${(await r.json().catch(() => ({}))).error ?? r.statusText}`);
      return r.json();
    });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return cache.get(name) as Promise<T>;
}

/** Reactive handle on a dataset served by the metaExport plugin. */
export function useData<T>(name: string): { data: Ref<T | undefined>; error: Ref<string | undefined>; loading: Ref<boolean> } {
  const data = shallowRef<T>();
  const error = ref<string>();
  const loading = ref(true);
  fetchData<T>(name)
    .then((d) => (data.value = d))
    .catch((e) => (error.value = String(e.message ?? e)))
    .finally(() => (loading.value = false));
  return { data, error, loading };
}
