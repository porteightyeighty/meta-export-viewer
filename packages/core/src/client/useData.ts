import { ref, shallowRef, type Ref } from "vue";

const cache = new Map<string, Promise<unknown>>();

/** Where datasets come from: the dev server's /api/data by default, memory on the static site. */
export type DataProvider = (name: string) => Promise<unknown>;

const fromServer: DataProvider = (name) =>
  fetch(`/api/data/${encodeURIComponent(name)}.json`).then(async (r) => {
    if (!r.ok) throw new Error(`${name}: ${r.status} ${(await r.json().catch(() => ({}))).error ?? r.statusText}`);
    return r.json();
  });

let provider = fromServer;

/** Swap the data source (before the app mounts). */
export function setDataProvider(p: DataProvider) {
  provider = p;
  cache.clear();
}

/** Serve datasets already in memory, failing like the server does for unknown names. */
export const fromMemory =
  (data: Record<string, unknown>): DataProvider =>
  async (name) => {
    if (!(name in data)) throw new Error(`${name}: 404 no dataset "${name}"`);
    return data[name];
  };

export function fetchData<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    const p = provider(name);
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
