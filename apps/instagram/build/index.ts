/**
 * Instagram export → datasets for the viewer. Runs in Node inside the Vite
 * plugin, and in a Web Worker on the static site. Tolerates missing sections and both known post formats.
 */
import {
  ExportDir,
  fromStringList,
  fromStringMap,
  lvFind,
  lvFindAll,
  lvTop,
  lvValue,
  toMs,
  type LVItem,
  type StringListEntry,
  basename,
} from "@mev/core/export";
import type { MediaItem, Person, Post } from "@mev/core/types";
import { makeResolver, mediaUrl, VIDEO } from "./media.ts";
import { buildDirect } from "./direct.ts";
import { buildSettings } from "./settings.ts";

/** Folders whose presence identifies an Instagram export root. */
export const IG_MARKERS = ["your_instagram_activity", "personal_information", "connections"];

const ACT = "your_instagram_activity";
const MEDIA_DIR = `${ACT}/media`;
const CONN = "connections/followers_and_following";

export interface Profile {
  username: string;
  name: string;
  bio: string;
  pronouns: string[];
  avatar?: string;
  isPrivate: boolean;
  counts: { posts: number; followers: number; following: number };
}

interface RawMedia {
  uri: string;
  creation_timestamp?: number;
  title?: string;
  media_metadata?: { photo_metadata?: { exif_data?: { latitude?: number; longitude?: number }[] } };
  cross_post_source?: { source_app?: string };
}
interface RawPost {
  media: RawMedia[];
  title?: string;
  creation_timestamp?: number;
}

export function buildInstagram(ex: ExportDir) {
  const resolveUri = makeResolver(ex);
  const enrich = loadPostDetails(ex);

  const toMedia = (m: RawMedia): MediaItem | undefined => {
    const rel = resolveUri(m.uri);
    if (!rel) return undefined;
    const d = enrich.byUri.get(m.uri) ?? enrich.lookupByContent(rel);
    // posts.json dimensions are often 0, so fall back to reading the file header.
    const size = d?.width && d?.height ? { width: d.width, height: d.height } : ex.size(rel);
    return {
      src: mediaUrl(rel),
      kind: VIDEO.test(rel) ? "video" : "image",
      takenAt: toMs(m.creation_timestamp),
      width: size?.width,
      height: size?.height,
    };
  };

  const toPost = (p: RawPost, idPrefix = ""): Post | undefined => {
    const media = (p.media ?? []).map(toMedia).filter((m): m is MediaItem => !!m);
    if (!media.length) return undefined;
    const first = p.media[0];
    // Carousels keep the caption on the post; single posts on the media item.
    const caption = (p.title || (p.media.length === 1 ? first.title : "") || "").trim();
    const details = p.media.map((m) => enrich.byUri.get(m.uri) ?? enrich.lookupByContent(resolveUri(m.uri))).find(Boolean);
    const exif = p.media.flatMap((m) => m.media_metadata?.photo_metadata?.exif_data ?? []).find((e) => e.latitude && e.longitude);
    const location = details?.location ?? (exif ? { lat: exif.latitude!, lng: exif.longitude! } : undefined);
    return {
      id: idPrefix + basename(first.uri).replace(/\.\w+$/, ""),
      timestamp: toMs(p.creation_timestamp ?? first.creation_timestamp) ?? 0,
      caption,
      media,
      place: details?.place,
      location,
      hashtags: details?.hashtags?.length ? details.hashtags : undefined,
      crossPostedFrom: first.cross_post_source?.source_app,
    };
  };

  const newestFirst = (a: Post, b: Post) => b.timestamp - a.timestamp;

  // ── posts ────────────────────────────────────────────────────────────
  const postFiles = ex.parts(MEDIA_DIR, "posts");
  let rawPosts: RawPost[] = postFiles.flatMap((f) => ex.readJson<RawPost[]>(f) ?? []);
  if (!postFiles.length) {
    if (enrich.entries.length) {
      ex.info("no posts_N.json; using posts.json (one media per post)");
      rawPosts = enrich.entries.map((e) => e.raw);
    } else ex.warn(`no posts found in ${MEDIA_DIR}`);
  }
  const posts = rawPosts.map((p) => toPost(p)).filter((p): p is Post => !!p).sort(newestFirst);

  // ── archive ──────────────────────────────────────────────────────────
  const arch = ex.readJson<{ ig_archived_post_media?: RawPost[] }>(`${MEDIA_DIR}/archived_posts.json`);
  const archived = (arch?.ig_archived_post_media ?? []).map((p) => toPost(p, "a")).filter((p): p is Post => !!p).sort(newestFirst);

  // ── stories ──────────────────────────────────────────────────────────
  // Not via toMedia: its posts.json content-hash fallback would hash every story file.
  const rawStories = ex.readJson<{ ig_stories?: RawMedia[] }>(`${MEDIA_DIR}/stories.json`)?.ig_stories ?? [];
  const stories = rawStories
    .flatMap((m): Post[] => {
      const rel = resolveUri(m.uri);
      if (!rel) return [];
      const size = ex.size(rel);
      const timestamp = toMs(m.creation_timestamp) ?? 0;
      const media: MediaItem = { src: mediaUrl(rel), kind: VIDEO.test(rel) ? "video" : "image", takenAt: timestamp, width: size?.width, height: size?.height };
      return [{ id: "s" + basename(m.uri).replace(/\.\w+$/, ""), timestamp, caption: (m.title ?? "").trim(), media: [media] }];
    })
    .sort(newestFirst);

  // ── connections ──────────────────────────────────────────────────────
  const toPerson = (e: StringListEntry): Person => {
    const r = fromStringList(e);
    return { username: r.value, href: r.href, timestamp: r.timestamp };
  };
  const followerFiles = ex.parts(CONN, "followers");
  const followers = (followerFiles.length ? followerFiles : [`${CONN}/followers.json`])
    .flatMap((f) => unwrapList(ex.readJson(f)))
    .map(toPerson);
  if (!followers.length) ex.warn("no followers found");
  const following = unwrapList(ex.section("following", `${CONN}/following.json`, `${CONN}/following_1.json`)).map(toPerson);

  // ── profile ──────────────────────────────────────────────────────────
  const pi = ex.section<any>("profile", "personal_information/personal_information/personal_information.json");
  const user = pi?.profile_user?.[0] ?? {};
  const sm = fromStringMap(user.string_map_data);
  let avatarUri: string | undefined = user.media_map_data?.["Profile Photo"]?.uri;
  if (!avatarUri) {
    const pics = ex.readJson<{ ig_profile_picture?: RawMedia[] }>(`${MEDIA_DIR}/profile_photos.json`)?.ig_profile_picture ?? [];
    avatarUri = pics.sort((a, b) => (b.creation_timestamp ?? 0) - (a.creation_timestamp ?? 0))[0]?.uri;
  }
  const avatarRel = avatarUri ? resolveUri(avatarUri) : undefined;
  const profile: Profile = {
    username: sm["Username"] ?? "unknown",
    name: sm["Name"] ?? "",
    bio: sm["Bio"] ?? "",
    pronouns: (sm["Pronouns"] ?? "").split(/[,/]/).map((s) => s.trim()).filter(Boolean),
    avatar: avatarRel ? mediaUrl(avatarRel) : undefined,
    isPrivate: /true|yes/i.test(sm["Private Account"] ?? ""),
    counts: { posts: posts.length, followers: followers.length, following: following.length },
  };

  ex.info(`profile @${profile.username}: ${posts.length} posts, ${archived.length} archived, ${stories.length} stories, ${followers.length} followers, ${following.length} following`);

  const direct = buildDirect(ex, resolveUri, profile.name);
  return { profile, posts, archived, stories, followers, following, ...direct, ...buildSettings(ex, resolveUri) };
}

/** Lists are either bare arrays or wrapped in a single `relationships_*` key. */
function unwrapList(v: unknown): StringListEntry[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    const arr = Object.values(v).find(Array.isArray);
    if (arr) return arr as StringListEntry[];
  }
  return [];
}

interface PostDetails {
  raw: RawPost;
  width?: number;
  height?: number;
  location?: { lat: number; lng: number };
  place?: { name: string; description?: string };
  hashtags: string[];
}

/**
 * `posts.json` (label_values format): one entry per media item with extra
 * fields (place, hashtags, location, dimensions). Its file copies sometimes
 * have different names from posts_N.json, so we also match on file content.
 */
function loadPostDetails(ex: ExportDir) {
  const rows = ex.readJson<{ timestamp?: number; label_values?: LVItem[] }[]>(`${MEDIA_DIR}/posts.json`) ?? [];
  const entries: PostDetails[] = [];
  const byUri = new Map<string, PostDetails>();
  const byHash = new Map<string, PostDetails>();

  for (const row of rows) {
    const lv = row.label_values ?? [];
    const m = lvTop(lv, "Media")?.media?.[0] as RawMedia | undefined;
    if (!m?.uri) continue;
    const num = (k: string) => {
      const v = Number(lvValue(lv, k));
      return Number.isFinite(v) && v !== 0 ? v : undefined;
    };
    const placeItem = lvTop(lv, "Place");
    const placeName = lvFind(placeItem?.dict, "Name")?.value;
    const lat = num("Latitude"), lng = num("Longitude");
    const d: PostDetails = {
      raw: { media: [m], title: lvValue(lv, "Caption") ?? m.title, creation_timestamp: row.timestamp ?? m.creation_timestamp },
      width: num("Original width"),
      height: num("Original height"),
      location: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
      place: placeName ? { name: placeName, description: lvFind(placeItem?.dict, "Description")?.value } : undefined,
      hashtags: lvFindAll(lvTop(lv, "Hashtags")?.dict, "Name").map((i) => i.value!).filter(Boolean),
    };
    entries.push(d);
    byUri.set(m.uri, d);
  }

  let hashed = false;
  // Hashing reads the whole file, and toMedia + toPost ask for the same file, so remember answers.
  const seen = new Map<string, PostDetails | undefined>();
  const lookupByContent = (rel: string | undefined) => {
    if (!rel || !entries.length) return undefined;
    if (seen.has(rel)) return seen.get(rel);
    if (!hashed) {
      hashed = true;
      for (const [uri, d] of byUri) {
        const r = ex.exists(uri) ? uri : undefined;
        if (r) byHash.set(ex.hash(r), d);
      }
    }
    const hit = byHash.get(ex.hash(rel));
    seen.set(rel, hit);
    return hit;
  };
  return { entries, byUri, lookupByContent };
}
