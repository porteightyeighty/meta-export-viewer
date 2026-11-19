/**
 * Meta's JSON exports encode text as UTF-8 bytes escaped as individual latin-1
 * code points ("â\u0098\u0080" instead of "☀"). Re-interpret those bytes.
 */
const HIGH_BYTE = /[\u0080-ÿ]/;
const BEYOND_LATIN1 = /[^\u0000-ÿ]/;

export function fixString(s: string): string {
  if (!HIGH_BYTE.test(s) || BEYOND_LATIN1.test(s)) return s;
  const decoded = Buffer.from(s, "latin1").toString("utf8");
  // Not valid UTF-8 → the string was genuinely latin-1; leave it alone.
  return decoded.includes("�") ? s : decoded;
}

export function fixMojibake<T>(value: T): T {
  if (typeof value === "string") return fixString(value) as T;
  if (Array.isArray(value)) return value.map(fixMojibake) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[fixString(k)] = fixMojibake(v);
    return out as T;
  }
  return value;
}
