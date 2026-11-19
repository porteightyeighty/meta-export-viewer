/**
 * Any Meta export JSON → a flat list of records for generic display. Knows the
 * recurring shapes (label_values, string_map_data, string_list_data,
 * media_*_data) and falls back to plain key/value pairs, so no file is dropped.
 */
import type { Rec, RecField } from "../types/meta.ts";
import { lvName, toMs, webUrl, type LVItem } from "./flatten.ts";

export interface RecordOptions {
  /** Export-relative media uri → served url, or undefined if not local. */
  media?: (uri: string) => string | undefined;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const isItem = (v: unknown): v is LVItem => isObj(v);
const SHAPED = ["label_values", "string_map_data", "string_list_data", "media_map_data", "media_list_data"];

/** "follow_requests_you_ve_received" → "Follow requests you've received" */
export function prettyKey(k: string) {
  const s = k.replace(/_(ve|re|s|t|ll|d)(?=_|$)/g, "'$1").replace(/_+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function toRecords(json: unknown, opts: RecordOptions = {}): Rec[] {
  if (Array.isArray(json)) return json.map((v) => (isObj(v) ? recordOf(v, opts) : { fields: scalar("", v) })).filter((r) => r.fields.length || r.title);
  if (!isObj(json)) return json === undefined || json === null ? [] : [{ fields: scalar("", json) }];
  if (SHAPED.some((k) => k in json)) return [recordOf(json, opts)];
  // `{ some_wrapper_key: [...] }` → the list inside.
  const vals = Object.values(json);
  if (vals.length === 1 && Array.isArray(vals[0])) return toRecords(vals[0], opts);
  const r = recordOf(json, opts);
  return r.fields.length ? [r] : [];
}

function recordOf(o: Obj, opts: RecordOptions): Rec {
  const title = typeof o.title === "string" && o.title.trim() ? o.title : undefined;
  const time = typeof o.timestamp === "number" ? toMs(o.timestamp) : undefined;
  const fields: RecField[] = [];
  for (const [k, v] of Object.entries(o)) {
    if ((k === "title" && typeof v === "string") || (k === "timestamp" && typeof v === "number")) continue;
    if (k === "label_values" && Array.isArray(v)) fields.push(...lvFields(v, opts));
    else if (k === "string_map_data" && isObj(v))
      for (const [label, d] of Object.entries(v)) fields.push(clean({ label, ...valueOf(d as Obj) }));
    else if (k === "string_list_data" && Array.isArray(v)) for (const d of v) fields.push(clean({ label: "", ...valueOf(d) }));
    else if (k === "media_map_data" && isObj(v))
      for (const [label, m] of Object.entries(v)) fields.push(clean({ label, ...mediaOf([m], opts) }));
    else if ((k === "media_list_data" || k === "media") && Array.isArray(v)) fields.push(clean({ label: k === "media" ? "" : "Media", ...mediaOf(v, opts) }));
    else if (Array.isArray(v) || isObj(v)) fields.push(clean({ label: prettyKey(k), items: toRecords(v, opts) }));
    else fields.push(...scalar(prettyKey(k), v));
  }
  return { title, time, fields: fields.filter(keep) };
}

/** label_values items; `dict`/`vec` nest. */
function lvFields(items: LVItem[], opts: RecordOptions): RecField[] {
  return items
    .filter(isItem)
    .map((it) => {
      const label = lvName(it);
      if (it.dict) return clean({ label, items: lvSub(it.dict, opts) });
      if (it.vec) return clean({ label, items: lvSub(it.vec, opts) });
      if (it.media) return clean({ label, ...mediaOf(it.media, opts) });
      return clean({ label, ...valueOf(it as Obj), time: toMs(it.timestamp_value) });
    })
    .filter(keep);
}

/** Children of a dict/vec: titled `{title, dict}` children become their own records, loose items share one. */
function lvSub(list: LVItem[], opts: RecordOptions): Rec[] {
  const recs: Rec[] = [];
  const loose: LVItem[] = [];
  for (const c of list.filter(isItem)) {
    if (c.dict && !c.label) recs.push({ title: c.title || undefined, fields: lvFields(c.dict, opts) });
    else loose.push(c);
  }
  if (loose.length) recs.unshift({ fields: lvFields(loose, opts) });
  return recs.filter((r) => r.fields.length || r.title);
}

function valueOf(d: Obj | undefined) {
  if (!isObj(d)) return {};
  const href = webUrl(typeof d.href === "string" ? d.href : undefined);
  const value = typeof d.value === "string" && d.value !== "" ? d.value : typeof d.href === "string" ? d.href : undefined;
  return { value, href, time: typeof d.timestamp === "number" ? toMs(d.timestamp) : undefined };
}

function mediaOf(list: unknown[], opts: RecordOptions) {
  const media: string[] = [];
  let href: string | undefined;
  for (const m of list) {
    const uri = isObj(m) && typeof m.uri === "string" ? m.uri : undefined;
    if (!uri) continue;
    const src = opts.media?.(uri);
    if (src) media.push(src);
    else href ??= webUrl(uri);
  }
  return { media: media.length ? media : undefined, href, value: href };
}

function scalar(label: string, v: unknown): RecField[] {
  if (v === null || v === undefined || v === "") return [];
  if (typeof v === "number" && /time|date|timestamp/i.test(label)) return [{ label, time: toMs(v) }];
  return [{ label, value: String(v) }];
}

/** Drop undefined keys so datasets stay small. */
function clean(f: RecField): RecField {
  for (const k of Object.keys(f) as (keyof RecField)[]) if (f[k] === undefined) delete f[k];
  return f;
}
const keep = (f: RecField) => !!(f.label || f.value || f.time || f.media || f.items?.length);
