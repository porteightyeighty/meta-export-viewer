/** Accent- and case-insensitive text matching shared by the search UIs. */

const MARKS = /[̀-ͯ]/g;

/** "Café" → "cafe". */
export const fold = (s: string) => s.normalize("NFKD").replace(MARKS, "").toLowerCase();

/** Folded text plus, for each folded char, the index of the original char it came from. */
function foldWithMap(s: string) {
  let out = "";
  const map: number[] = [];
  let i = 0;
  for (const ch of s) {
    const f = fold(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    out += f;
    i += ch.length;
  }
  map.push(s.length);
  return { out, map };
}

/** Does `text` contain `query`, ignoring case and accents? */
export const matches = (text: string | undefined, query: string) => !!text && !!query && fold(text).includes(fold(query));

export interface Segment {
  text: string;
  hit: boolean;
}

/** Split `text` into plain/hit segments for highlighting every match of `query`. */
export function highlight(text: string, query: string): Segment[] {
  const q = fold(query.trim());
  if (!q) return [{ text, hit: false }];
  const { out, map } = foldWithMap(text);
  const segs: Segment[] = [];
  let from = 0, at = out.indexOf(q);
  while (at !== -1) {
    const s = map[at], e = map[at + q.length];
    if (s > from) segs.push({ text: text.slice(from, s), hit: false });
    if (e > s) segs.push({ text: text.slice(s, e), hit: true });
    from = Math.max(from, e);
    at = out.indexOf(q, at + q.length);
  }
  if (from < text.length) segs.push({ text: text.slice(from), hit: false });
  return segs;
}

/** Short excerpt around the first match, for search result lists. */
export function snippet(text: string, query: string, radius = 40) {
  const q = fold(query.trim());
  const { out, map } = foldWithMap(text);
  const at = q ? out.indexOf(q) : -1;
  if (at < 0 || text.length <= radius * 2) return text;
  // Folding can change length ("…" → "..."), so map back to original positions.
  const start = Math.max(0, map[at] - radius);
  const end = Math.min(text.length, map[at + q.length] + radius);
  return (start ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}
