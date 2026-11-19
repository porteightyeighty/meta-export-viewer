const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR, WEEK = 7 * DAY;

/** Compact relative time like "5m", "3h", "2d", "4w". */
export function shortAgo(ms: number, now = Date.now()) {
  const d = Math.max(0, now - ms);
  if (d < HOUR) return `${Math.max(1, Math.floor(d / MIN))}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < WEEK) return `${Math.floor(d / DAY)}d`;
  if (d < 52 * WEEK) return `${Math.floor(d / WEEK)}w`;
  return `${Math.floor(d / (365.25 * DAY))}y`;
}

/** "July 1, 2025", or "July 1" in the current year. */
export function longDate(ms: number, now = Date.now()) {
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Heading for a day-separator in chat views. */
export function dayLabel(ms: number, now = Date.now()) {
  const startOf = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((startOf(now) - startOf(ms)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(ms).toLocaleDateString("en-US", { weekday: "long" });
  return longDate(ms, now);
}

/** 1234 → "1,234"; 12345 → "12.3K"; 1.2M style beyond that. */
export function compactCount(n: number) {
  if (n < 10_000) return n.toLocaleString("en-US");
  if (n < 1_000_000) return `${+(n / 1000).toFixed(1)}K`;
  return `${+(n / 1_000_000).toFixed(1)}M`;
}
