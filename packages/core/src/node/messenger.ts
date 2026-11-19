/**
 * Loader for Messenger-style DM threads: `<box>/<thread>/message_N.json` with
 * `{participants, messages, title, ...}`. Instagram and Facebook exports share
 * this schema; the caller supplies how media URIs map to served files.
 */
import type { ExportDir } from "./exportFs.ts";
import { webUrl } from "./flatten.ts";
import type { ChatMessage, MediaItem, Reaction, Share, ShareKind, Thread, ThreadBox } from "../types/meta.ts";

interface RawMediaRef {
  uri?: string;
  creation_timestamp?: number;
}
interface RawMessage {
  sender_name?: string;
  timestamp_ms?: number;
  content?: string;
  photos?: RawMediaRef[];
  videos?: RawMediaRef[];
  audio_files?: RawMediaRef[];
  gifs?: RawMediaRef[];
  files?: RawMediaRef[];
  share?: {
    link?: string;
    share_text?: string;
    original_content_owner?: string;
    profile_share_username?: string;
    profile_share_name?: string;
  };
  reactions?: { reaction?: string; actor?: string }[];
  call_duration?: number;
}
interface RawThread {
  participants?: { name?: string }[];
  messages?: RawMessage[];
  title?: string;
  is_still_participant?: boolean;
}

export interface ThreadSource {
  /** folder holding one subfolder per thread, relative to the export root */
  dir: string;
  box: ThreadBox;
}

export interface LoadThreadsOptions {
  /** Map an export-relative URI to a served media item; undefined when missing. */
  toMedia: (uri: string, kind: MediaItem["kind"]) => MediaItem | undefined;
  /** Used to recognise the account owner when it can't be inferred. */
  ownerName?: string;
}

const NOTICE = [/liked a message$/i, /^reacted .+ to (your|a) message\s*$/i];
const ATTACHMENT = /sent an attachment\.?$/i;

export function loadThreads(ex: ExportDir, sources: ThreadSource[], opts: LoadThreadsOptions) {
  const threads: Thread[] = [];
  for (const src of sources) {
    for (const id of ex.list(src.dir, { dirs: true })) {
      const dir = `${src.dir}/${id}`;
      const parts = ex.parts(dir, "message");
      if (!parts.length) continue;
      const raws = parts.map((p) => ex.readJson<RawThread>(p)).filter((r): r is RawThread => !!r);
      if (!raws.length) continue;
      const head = raws[0];
      const msgs = raws
        .flatMap((r) => r.messages ?? [])
        .map((m) => toMessage(m, opts))
        .filter((m): m is ChatMessage => !!m)
        .sort((a, b) => a.ts - b.ts);
      const participants = [...new Set((head.participants ?? []).map((p) => p.name ?? "").filter(Boolean))];
      threads.push({
        id,
        box: src.box,
        title: head.title ?? "",
        participants,
        isGroup: participants.length > 2,
        stillParticipant: head.is_still_participant !== false,
        messages: msgs,
      });
    }
  }

  const me = inferMe(threads, opts.ownerName);
  for (const t of threads) {
    // Put the owner last and give untitled threads a name.
    t.participants = [...t.participants.filter((p) => p !== me), ...t.participants.filter((p) => p === me)];
    if (!t.title) t.title = t.participants.filter((p) => p !== me).join(", ") || me;
  }
  return { me, threads };
}

/** The name present in the most threads; the export never marks the owner explicitly. */
export function inferMe(threads: Pick<Thread, "participants">[], fallback?: string) {
  const counts = new Map<string, number>();
  for (const t of threads) for (const p of t.participants) counts.set(p, (counts.get(p) ?? 0) + 1);
  if (fallback && counts.has(fallback)) return fallback;
  // With a single thread every name ties, so don't guess.
  if (threads.length < 2) return fallback ?? "";
  let best = "", n = 0;
  for (const [name, c] of counts) if (c > n) [best, n] = [name, c];
  return best;
}

function toMessage(m: RawMessage, opts: LoadThreadsOptions): ChatMessage | undefined {
  if (typeof m.timestamp_ms !== "number") return undefined;
  const out: ChatMessage = { sender: m.sender_name ?? "", ts: m.timestamp_ms };

  const media: MediaItem[] = [];
  const remote: { url: string; host: string }[] = [];
  const take = (refs: RawMediaRef[] | undefined, kind: MediaItem["kind"]) => {
    for (const r of refs ?? []) {
      if (!r.uri) continue;
      if (/^https?:/i.test(r.uri)) {
        remote.push({ url: r.uri, host: hostOf(r.uri) });
        continue;
      }
      const item = opts.toMedia(r.uri, kind);
      if (item) media.push(item);
    }
  };
  take(m.photos, "image");
  take(m.gifs, "image");
  take(m.videos, "video");
  take(m.audio_files, "audio");
  if (media.length) out.media = media;
  if (remote.length) out.remote = remote;

  if (m.share) out.share = toShare(m.share);
  if (typeof m.call_duration === "number") out.callSec = m.call_duration;

  const text = m.content?.trim();
  if (text) {
    const hasAttachment = !!(out.share || out.media || out.remote);
    if (ATTACHMENT.test(text) && hasAttachment) {
      // "You sent an attachment." just describes the share/media itself.
    } else {
      out.text = text;
      if (NOTICE.some((re) => re.test(text)) || ATTACHMENT.test(text)) out.notice = true;
    }
  }

  if (m.reactions?.length) {
    const by = new Map<string, Reaction>();
    for (const r of m.reactions) {
      if (!r.reaction) continue;
      const g = by.get(r.reaction) ?? { emoji: r.reaction, actors: [] };
      if (r.actor) g.actors.push(r.actor);
      by.set(r.reaction, g);
    }
    if (by.size) out.reactions = [...by.values()];
  }

  // Deleted or unsupported content (or media missing from the export) still took place in the chat.
  if (!out.text && !out.media && !out.remote && !out.share && out.callSec === undefined) out.unavailable = true;
  return out;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function toShare(s: NonNullable<RawMessage["share"]>): Share {
  const url = webUrl(s.link);
  const host = url ? hostOf(url) : undefined;
  let kind: ShareKind = "link";
  if (s.profile_share_username) kind = "profile";
  else if (host && /(^|\.)giphy\.com$/.test(host)) kind = "gif";
  else if (host === "instagram.com" && url) {
    const seg = new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
    kind = seg === "p" ? "post" : /^reels?$/.test(seg) ? "reel" : seg === "stories" ? "story" : seg ? "profile" : "link";
  }
  const owner = s.original_content_owner || s.profile_share_username || undefined;
  return {
    kind,
    url,
    host,
    owner,
    text: (s.share_text || s.profile_share_name || "").trim() || undefined,
  };
}
