/** Instagram DMs → `threads`, `thread/<id>` and `messageIndex` datasets. */
import { loadThreads, type ExportDir } from "@mev/core/node";
import { previewText } from "@mev/core/client/chat.ts";
import type { MediaItem, Thread, ThreadSummary } from "@mev/core/types";
import { mediaUrl } from "./media.ts";

const MESSAGES = "your_instagram_activity/messages";

/** [threadId, messageIndex, searchable text, timestamp ms] */
export type MessageIndexRow = [string, number, string, number];

export function buildDirect(ex: ExportDir, resolveUri: (uri: string) => string | undefined, ownerName?: string) {
  const toMedia = (uri: string, kind: MediaItem["kind"]): MediaItem | undefined => {
    const rel = resolveUri(uri);
    if (!rel) return undefined;
    const size = kind === "audio" ? undefined : ex.size(rel);
    return { src: mediaUrl(rel), kind, width: size?.width, height: size?.height };
  };

  const { me, threads } = loadThreads(
    ex,
    [
      { dir: `${MESSAGES}/inbox`, box: "inbox" },
      { dir: `${MESSAGES}/message_requests`, box: "requests" },
    ],
    { toMedia, ownerName },
  );
  if (!threads.length) ex.warn(`no message threads found in ${MESSAGES}`);

  const lastTs = (t: Thread) => t.messages.at(-1)?.ts ?? 0;
  threads.sort((a, b) => lastTs(b) - lastTs(a));

  const items: ThreadSummary[] = threads.map((t) => {
    const last = t.messages.at(-1);
    return {
      id: t.id,
      box: t.box,
      title: t.title,
      participants: t.participants,
      isGroup: t.isGroup,
      count: t.messages.length,
      last: last && { text: previewText(last, me), ts: last.ts, fromMe: last.sender === me },
    };
  });

  const messageIndex: MessageIndexRow[] = [];
  const out: Record<string, unknown> = {};
  for (const t of threads) {
    out[`thread/${t.id}`] = t;
    t.messages.forEach((m, i) => {
      if (m.notice) return;
      const text = [m.text, m.share?.text, m.share?.owner && `@${m.share.owner}`].filter(Boolean).join(" · ");
      if (text) messageIndex.push([t.id, i, text, m.ts]);
    });
  }

  const total = threads.reduce((n, t) => n + t.messages.length, 0);
  const requests = threads.filter((t) => t.box === "requests").length;
  ex.info(`direct: ${threads.length} threads (${requests} requests), ${total} messages`);
  return { threads: { me, items }, messageIndex, ...out };
}
