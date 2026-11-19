/** Normalised shapes the builders emit and the UIs consume (platform-neutral). */

export interface MediaItem {
  /** URL to fetch it from the dev server, e.g. /export/media/posts/123.jpg */
  src: string;
  kind: "image" | "video" | "audio";
  takenAt?: number;
  width?: number;
  height?: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Post {
  id: string;
  timestamp: number;
  caption: string;
  media: MediaItem[];
  place?: { name: string; description?: string };
  location?: GeoPoint;
  hashtags?: string[];
  crossPostedFrom?: string;
}

export interface Person {
  username: string;
  href?: string;
  /** when they followed / were followed, ms */
  timestamp?: number;
}

export interface DataMeta {
  source: string;
  warnings: string[];
  builtAt?: number;
  error?: string;
}

// ── messages (Messenger-style threads; shared by Instagram and Facebook) ──

export type ShareKind = "post" | "reel" | "story" | "profile" | "gif" | "link";

export interface Share {
  kind: ShareKind;
  url?: string;
  host?: string;
  /** account that owns the shared post/reel/story */
  owner?: string;
  text?: string;
}

export interface RemoteMedia {
  url: string;
  host: string;
}

export interface Reaction {
  emoji: string;
  actors: string[];
}

export interface ChatMessage {
  sender: string;
  ts: number;
  text?: string;
  /** system-style line ("Liked a message", "Reacted 😂 to your message") */
  notice?: boolean;
  media?: MediaItem[];
  /** media that only exists on a remote server; never loaded automatically */
  remote?: RemoteMedia[];
  share?: Share;
  reactions?: Reaction[];
  callSec?: number;
  /** nothing displayable survived in the export (deleted, unsupported, or missing media) */
  unavailable?: boolean;
}

export type ThreadBox = "inbox" | "requests";

export interface Thread {
  id: string;
  box: ThreadBox;
  title: string;
  participants: string[];
  isGroup: boolean;
  stillParticipant: boolean;
  /** oldest first */
  messages: ChatMessage[];
}

export interface ThreadSummary {
  id: string;
  box: ThreadBox;
  title: string;
  participants: string[];
  isGroup: boolean;
  count: number;
  last?: { text: string; ts: number; fromMe: boolean };
}

/** One entry of any export file, normalised by `toRecords` (core/node/records.ts). */
export interface Rec {
  title?: string;
  time?: number;
  fields: RecField[];
}

export interface RecField {
  label: string;
  value?: string;
  /** http(s) only */
  href?: string;
  time?: number;
  /** /export/... urls of local media */
  media?: string[];
  items?: Rec[];
}
