/**
 * Swap media URLs in built datasets for in-browser ones: any string that is
 * exactly a key of `urls` (e.g. "/export/media/x.jpg" → "blob:…"). Exact matches
 * only, so captions and messages are never touched. Mutates and returns `data`.
 */
export function resolveMedia<T>(data: T, urls: (s: string) => string | undefined): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return urls(v) ?? v;
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) v[i] = walk(v[i]);
    } else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k in o) o[k] = walk(o[k]);
    }
    return v;
  };
  return walk(data) as T;
}
