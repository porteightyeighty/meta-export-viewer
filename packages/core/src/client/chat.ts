/** Pure helpers for laying out and searching chat threads. No Vue, so Node can use them too. */
import type { ChatMessage, ShareKind } from "../types/meta.ts";
import { dayLabel } from "./format.ts";
import { matches } from "./text.ts";

export type ChatRow =
  | { kind: "time"; key: string; ts: number }
  | { kind: "notice"; key: string; i: number; m: ChatMessage }
  | { kind: "msg"; key: string; i: number; m: ChatMessage; mine: boolean; first: boolean; last: boolean; showSender: boolean };

export interface LayoutOptions {
  me: string;
  isGroup?: boolean;
  /** start a new run of bubbles after this much silence */
  runGapMs?: number;
  /** show a centred timestamp after this much silence */
  breakGapMs?: number;
  /** index of the first message to lay out (for paging) */
  from?: number;
}

/**
 * Turns messages (oldest first) into render rows: centred time breaks, notices,
 * and bubbles that know whether they start or end a same-sender run.
 */
export function layoutThread(messages: ChatMessage[], o: LayoutOptions): ChatRow[] {
  const runGap = o.runGapMs ?? 10 * 60_000;
  const breakGap = o.breakGapMs ?? 60 * 60_000;
  const rows: ChatRow[] = [];
  const from = o.from ?? 0;
  for (let i = from; i < messages.length; i++) {
    const m = messages[i];
    const prev = i > from ? messages[i - 1] : undefined;
    if (!prev || m.ts - prev.ts > breakGap) rows.push({ kind: "time", key: `t${i}`, ts: m.ts });
    if (m.notice) {
      rows.push({ kind: "notice", key: `n${i}`, i, m });
      continue;
    }
    const before = rows.at(-1);
    const continues = before?.kind === "msg" && before.m.sender === m.sender && m.ts - before.m.ts <= runGap;
    if (continues) before.last = false;
    const mine = m.sender === o.me;
    rows.push({ kind: "msg", key: `m${i}`, i, m, mine, first: !continues, last: true, showSender: !!o.isGroup && !mine && !continues });
  }
  return rows;
}

/** "Today 14:05", "Monday 09:12", "March 3, 2024 18:40". */
export function breakLabel(ts: number, now = Date.now()) {
  const time = new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${dayLabel(ts, now)} ${time}`;
}

/** Indices of messages whose text, share text or share owner matches. */
export function findMatches(messages: ChatMessage[], query: string): number[] {
  const q = query.trim();
  if (!q) return [];
  const out: number[] = [];
  messages.forEach((m, i) => {
    if (matches(m.text, q) || matches(m.share?.text, q) || matches(m.share?.owner, q)) out.push(i);
  });
  return out;
}

const SHARE_NOUN: Record<ShareKind, string> = {
  post: "a post",
  reel: "a reel",
  story: "a story",
  profile: "a profile",
  gif: "a GIF",
  link: "a link",
};

/** One-line inbox preview, e.g. "You: see you then", "Sent a reel", "You sent a photo". */
export function previewText(m: ChatMessage | undefined, me: string): string {
  if (!m) return "";
  const mine = m.sender === me;
  if (m.notice) return m.text ?? "";
  if (m.text) return (mine ? "You: " : "") + m.text;
  const sent = mine ? "You sent " : "Sent ";
  if (m.share) return sent + SHARE_NOUN[m.share.kind];
  const media = m.media?.[0];
  if (media?.kind === "audio") return sent + "a voice message";
  if (media?.kind === "video") return sent + "a video";
  if (media || m.remote) return sent + "a photo";
  if (m.callSec !== undefined) return m.callSec ? `Call · ${callLength(m.callSec)}` : "Missed call";
  return "";
}

/** 75 → "1m 15s", 3700 → "1h 1m". */
export function callLength(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return s ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/** True for short messages made only of emoji (shown large, without a bubble). */
export function isEmojiOnly(text: string | undefined) {
  if (!text || text.length > 24) return false;
  return /\p{Extended_Pictographic}/u.test(text) && !/[\p{L}\p{N}]/u.test(text);
}
