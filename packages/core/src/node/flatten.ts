/** Helpers for the recurring shapes in Meta JSON exports. */

/** Timestamps appear in seconds or milliseconds; normalise to ms. */
export function toMs(t: number | string | undefined | null): number | undefined {
  if (t === undefined || t === null || t === "") return undefined;
  const n = typeof t === "string" ? Number(t) : t;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n < 1e12 ? n * 1000 : n;
}

export interface StringListEntry {
  title?: string;
  string_list_data?: { href?: string; value?: string; timestamp?: number }[];
}

/** `{title, string_list_data:[{href,value,timestamp}]}` → a flat record. */
export function fromStringList(e: StringListEntry) {
  const d = e.string_list_data?.[0] ?? {};
  return {
    value: d.value || e.title || hrefTail(d.href) || "",
    href: d.href,
    timestamp: toMs(d.timestamp),
  };
}

function hrefTail(href?: string) {
  if (!href) return undefined;
  return href.replace(/\/+$/, "").split("/").pop() || undefined;
}

export type StringMap = Record<string, { value?: string; href?: string; timestamp?: number }>;

/** `string_map_data` → `{ key: value }` (empty strings dropped). */
export function fromStringMap(m: StringMap | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(m ?? {})) {
    const val = v?.value ?? v?.href ?? (v?.timestamp ? String(v.timestamp) : undefined);
    if (val) out[k] = val;
  }
  return out;
}

/**
 * The newer `label_values` format: a list of items, each `{label|title, value |
 * timestamp_value | media | vec | dict}`, where `dict` nests further item lists.
 */
export interface LVItem {
  label?: string;
  title?: string;
  value?: string;
  href?: string;
  timestamp_value?: number;
  media?: unknown[];
  vec?: LVItem[];
  dict?: LVItem[];
}

export const lvName = (i: LVItem) => i.label ?? i.title ?? "";

/** Depth-first search for items with the given label/title. */
export function lvFindAll(items: LVItem[] | undefined, name: string, out: LVItem[] = []): LVItem[] {
  for (const it of items ?? []) {
    if (!it || typeof it !== "object") continue;
    if (lvName(it) === name) out.push(it);
    if (it.dict) lvFindAll(it.dict, name, out);
    if (it.vec) lvFindAll(it.vec, name, out);
  }
  return out;
}

export const lvFind = (items: LVItem[] | undefined, name: string) => lvFindAll(items, name)[0];

/** Top-level lookup only (avoids matching nested "Media"/"Name" of other sections). */
export const lvTop = (items: LVItem[] | undefined, name: string) =>
  (items ?? []).find((i) => lvName(i) === name);

/** First non-empty scalar for a top-level label. */
export function lvValue(items: LVItem[] | undefined, name: string): string | undefined {
  for (const it of items ?? []) {
    if (lvName(it) !== name) continue;
    const v = it.value ?? it.href ?? (it.timestamp_value ? String(it.timestamp_value) : undefined);
    if (v) return v;
  }
  return undefined;
}
