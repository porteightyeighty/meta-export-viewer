/**
 * Generates fixtures/instagram-sample/: a small, entirely invented Instagram
 * export that mirrors the real JSON layout (including Meta's latin-1 mojibake
 * escaping) with procedurally drawn placeholder images. Deterministic.
 *
 *   npm run fixture
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "instagram-sample");

// ── helpers ────────────────────────────────────────────────────────────
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

/** Encode like Meta does: UTF-8 bytes as \u00xx escapes. */
const metaJson = (v: unknown) =>
  JSON.stringify(v, null, 2).replace(/[^\x00-\x7f]/gu, (ch) =>
    [...Buffer.from(ch, "utf8")].map((b) => "\\u00" + b.toString(16).padStart(2, "0")).join(""),
  );

function write(rel: string, data: unknown) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof data === "string" || Buffer.isBuffer(data) ? data : metaJson(data));
}

// ── tiny PNG encoder + scene painter ───────────────────────────────────
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (b: Buffer) => {
  let c = -1;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function png(w: number, h: number, px: (x: number, y: number) => [number, number, number]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

type RGB = [number, number, number];
const PALETTES: RGB[][] = [
  [[255, 183, 77], [255, 112, 67], [94, 53, 177], [255, 241, 118]],
  [[129, 212, 250], [41, 121, 255], [27, 94, 32], [255, 255, 255]],
  [[248, 187, 208], [186, 104, 200], [49, 27, 146], [255, 224, 130]],
  [[200, 230, 201], [102, 187, 106], [62, 39, 35], [255, 245, 157]],
  [[255, 224, 178], [255, 138, 101], [55, 71, 79], [255, 255, 255]],
];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

/** Sky gradient, a sun, two rolling hills. Flat-ish colours keep the PNGs small. */
function scene(w: number, h: number) {
  const [top, bottom, hill, sun] = pick(PALETTES);
  const sx = w * (0.2 + rand() * 0.6), sy = h * (0.2 + rand() * 0.25), sr = Math.min(w, h) * (0.08 + rand() * 0.08);
  const f1 = 1 + rand() * 2, p1 = rand() * 6, f2 = 2 + rand() * 3, p2 = rand() * 6;
  const far = mix(hill, bottom, 0.5);
  return png(w, h, (x, y) => {
    const u = x / w;
    const h1 = h * (0.62 + 0.06 * Math.sin(u * f1 * Math.PI + p1));
    const h2 = h * (0.75 + 0.05 * Math.sin(u * f2 * Math.PI + p2));
    if (y > h2) return hill;
    if (y > h1) return far;
    if ((x - sx) ** 2 + (y - sy) ** 2 < sr * sr) return sun;
    return mix(top, bottom, Math.floor((y / h1) * 12) / 12);
  });
}

function avatar(size: number) {
  const bg: RGB = [255, 213, 79], face: RGB = [94, 53, 177];
  const c = size / 2;
  return png(size, size, (x, y) => {
    const head = (x - c) ** 2 + (y - c * 0.8) ** 2 < (size * 0.2) ** 2;
    const body = (x - c) ** 2 + ((y - size * 1.05) * 0.9) ** 2 < (size * 0.42) ** 2;
    return head || body ? face : bg;
  });
}

// ── people ─────────────────────────────────────────────────────────────
const FIRST = ["river", "jun", "ada", "milo", "noor", "tess", "kofi", "lena", "ravi", "ines", "otto", "yara", "finn", "suki", "omar", "bea", "theo", "zara", "ezra", "maya"];
const LAST = ["okafor", "bakes", "lovelace", "hikes", "draws", "plays", "cooks", "runs", "reads", "travels"];
const SEP = [".", "_", ""];
const people = Array.from({ length: 60 }, (_, i) => `${FIRST[i % FIRST.length]}${pick(SEP)}${LAST[(i * 7) % LAST.length]}${i >= 20 ? i : ""}`);

const BASE = Date.UTC(2025, 9, 1) / 1000; // all timestamps count back from here
const ago = (days: number) => Math.round(BASE - days * 86400 - rand() * 86400);

const ME = "sunny.sample";

// ── profile ────────────────────────────────────────────────────────────
write("media/profile/202401/avatar_001.png", avatar(320));
write("personal_information/personal_information/personal_information.json", {
  profile_user: [
    {
      title: "",
      media_map_data: { "Profile Photo": { uri: "media/profile/202401/avatar_001.png", creation_timestamp: ago(600), title: "" } },
      string_map_data: {
        Email: { href: "", value: "sunny@example.com", timestamp: 0 },
        "Phone Number": { href: "", value: "+00 0000 000000", timestamp: 0 },
        Username: { href: "", value: ME, timestamp: 0 },
        Name: { href: "", value: "Sunny Sample", timestamp: 0 },
        Bio: { href: "", value: "Made-up account for the demo ☀️\nPhotos are procedurally generated 🎨", timestamp: 0 },
        Pronouns: { href: "", value: "they, them", timestamp: 0 },
        "Private Account": { href: "", value: "False", timestamp: 0 },
      },
    },
  ],
});
write("your_instagram_activity/media/profile_photos.json", {
  ig_profile_picture: [{ uri: "media/profile/202401/avatar_001.png", creation_timestamp: ago(600), title: "" }],
});

// ── posts ──────────────────────────────────────────────────────────────
const CAPTIONS = [
  "Golden hour never misses 🌅",
  "Weekend hike with @river.okafor ⛰️ #outdoors #hiking",
  "Tried a new café — 10/10 would croissant again 🥐",
  "",
  "Sunday reset ✨",
  "Can't believe this view is real 😍 #travel",
  "Throwback to summer ☀️",
  "Little things 🌼",
  "Road trip, day 3. Still haven't agreed on the playlist 🎶",
  "First snow of the year ❄️",
  "Café crème & good company ☕",
  "",
];
const PLACES = [
  { name: "Example Park", description: "A large public park with a lake and woodland trails." },
  { name: "Fictional Falls", description: "A waterfall at the end of a short forest walk." },
  { name: "Imaginary Bay", description: "A sandy bay popular with swimmers." },
];
const SHAPES: [number, number][] = [[480, 480], [480, 480], [432, 540], [540, 360]];

let n = 1000;
const nextId = () => `1790000000000${n++}`;
const month = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 7).replace("-", "");

interface Media { uri: string; creation_timestamp: number; title: string; media_metadata?: unknown; cross_post_source?: unknown }

function makeMedia(dir: string, ts: number, title: string, shape = pick(SHAPES)): Media {
  const uri = `media/${dir}/${month(ts)}/${nextId()}.png`;
  write(uri, scene(...shape));
  return { uri, creation_timestamp: ts, title, media_metadata: { camera_metadata: { has_camera_metadata: false } } };
}

const posts: { media: Media[]; title?: string; creation_timestamp?: number }[] = [];
const details: unknown[] = [];
for (let i = 0; i < 15; i++) {
  const ts = ago(i * 23 + 2);
  const caption = CAPTIONS[i % CAPTIONS.length];
  const count = i === 1 ? 3 : i === 6 ? 2 : 1;
  if (count === 1) {
    const m = makeMedia("posts", ts, caption);
    posts.push({ media: [m] });
  } else {
    const media = Array.from({ length: count }, () => makeMedia("posts", ts, "", [480, 480]));
    posts.push({ media, title: caption, creation_timestamp: ts });
  }
  // posts.json: one label_values row per media item, some with place/location/hashtags
  for (const m of posts.at(-1)!.media) {
    const place = i % 3 === 0 ? PLACES[(i / 3) % PLACES.length] : undefined;
    const tags = [...caption.matchAll(/#(\w+)/g)].map((x) => x[1]);
    details.push({
      timestamp: ts,
      media: [],
      label_values: [
        { label: "Media", media: [m] },
        { label: "Caption", value: caption },
        { label: "Latitude", value: place ? String(51 + rand()) : "0" },
        { label: "Longitude", value: place ? String(-1 + rand()) : "0" },
        { label: "Original width", value: "0" },
        { label: "Original height", value: "0" },
        { label: "Creation time", timestamp_value: ts },
        { title: "Hashtags", dict: tags.map((t) => ({ title: "", dict: [{ label: "Name", value: t }] })) },
        { title: "Place", dict: place ? [{ title: "", dict: [{ label: "Name", value: place.name }, { label: "Description", value: place.description }] }] : [] },
      ],
    });
  }
}
write("your_instagram_activity/media/posts_1.json", posts);
write("your_instagram_activity/media/posts.json", details);

const archived = [0, 1].map((i) => {
  const m = makeMedia("archived_posts", ago(400 + i * 40), i ? "Not my best angle 🙈" : "Old haircut era");
  if (!i) m.media_metadata = { photo_metadata: { exif_data: [{ latitude: 51.5, longitude: -0.12 }] } };
  return { media: [m] };
});
write("your_instagram_activity/media/archived_posts.json", { ig_archived_post_media: archived });

// ── connections ────────────────────────────────────────────────────────
const followers = people.slice(0, 40);
const following = people.slice(15, 60);
const href = (u: string) => `https://www.instagram.com/${u}`;
write(
  "connections/followers_and_following/followers_1.json",
  followers.map((u, i) => ({ title: "", media_list_data: [], string_list_data: [{ href: href(u), value: u, timestamp: ago(i * 9) }] })),
);
write("connections/followers_and_following/following.json", {
  relationships_following: following.map((u, i) => ({ title: u, string_list_data: [{ href: `https://www.instagram.com/_u/${u}`, timestamp: ago(i * 8) }] })),
});

// ── direct messages ────────────────────────────────────────────────────
const MY_NAME = "Sunny Sample";
const DM = "your_instagram_activity/messages";
const msAgo = (days: number, minutes = 0) => (BASE - days * 86400) * 1000 + minutes * 60_000;

interface RawMsg {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  share?: Record<string, string>;
  photos?: { uri: string; creation_timestamp?: number }[];
  reactions?: { reaction: string; actor: string; timestamp?: number }[];
  call_duration?: number;
  is_geoblocked_for_viewer: boolean;
  is_unsent_image_by_messenger_kid_parent: boolean;
}
const msg = (sender: string, ts: number, extra: Partial<RawMsg> = {}): RawMsg => ({
  sender_name: sender,
  timestamp_ms: ts,
  ...extra,
  is_geoblocked_for_viewer: false,
  is_unsent_image_by_messenger_kid_parent: false,
});

/** Writes a thread folder; messages newest first like the real export, split into parts of `per`. */
function thread(box: "inbox" | "message_requests", folder: string, others: string[], messages: RawMsg[], opts: { title?: string; per?: number } = {}) {
  const sorted = [...messages].sort((a, b) => b.timestamp_ms - a.timestamp_ms);
  const per = opts.per ?? 10_000;
  for (let k = 0; k * per < sorted.length; k++) {
    write(`${DM}/${box}/${folder}/message_${k + 1}.json`, {
      participants: [...others, MY_NAME].map((name) => ({ name })),
      messages: sorted.slice(k * per, (k + 1) * per),
      title: opts.title ?? others[0],
      is_still_participant: true,
      thread_path: `${box}/${folder}`,
      magic_words: [],
    });
  }
}

// 1) A long 1:1 chat, split across two parts, to exercise paging, time breaks and search.
const RIVER = "River Okafor";
const LINES_THEM = [
  "are you around this weekend?", "haha yes", "omg 😂", "did you see the match", "running late, 10 mins",
  "that café on the corner is open again", "Zoë says hi", "can't wait for the trip ⛰️", "ok sounds good",
  "send me the photos when you can", "lol", "brb", "what time works?", "I'm so tired today", "🙌",
];
const LINES_ME = [
  "yes! what's the plan?", "hahaha", "on my way", "no I missed it, who won?", "all good, take your time",
  "the croissants there are unreal", "say hi back!", "same!! packing tonight", "👍", "will do", "❤️",
  "7ish?", "same honestly", "let's do saturday", "nice one",
];
const river: RawMsg[] = [];
for (let day = 160; day >= 1; day -= 1 + Math.floor(rand() * 3)) {
  let minute = Math.floor(rand() * 600) + 480;
  for (let k = 0, n = 2 + Math.floor(rand() * 8); k < n; k++) {
    const mine = rand() < 0.5;
    const m = msg(mine ? MY_NAME : RIVER, msAgo(day, minute), { content: pick(mine ? LINES_ME : LINES_THEM) });
    if (rand() < 0.08) m.reactions = [{ reaction: pick(["❤️", "😂", "😮"]), actor: mine ? RIVER : MY_NAME }];
    river.push(m);
    minute += Math.floor(rand() * 4) + (rand() < 0.15 ? 90 : 0);
  }
}
river.push(msg(RIVER, msAgo(30, 700), { content: "", call_duration: 754 }));
thread("inbox", "riverokafor_1790000000000001", [RIVER], river, { per: 150 });

// 2) A group chat.
const CREW = ["Jun Bakes", "Ada Lovelace", "Milo Hikes"];
const group: RawMsg[] = [
  msg("Jun Bakes", msAgo(12, 600), { content: "who's in for sunday?" }),
  msg("Ada Lovelace", msAgo(12, 603), { content: "me!" }),
  msg("Milo Hikes", msAgo(12, 605), { content: "depends on the weather tbh" }),
  msg(MY_NAME, msAgo(12, 640), { content: "I'm in, Fictional Falls?" }),
  msg("Jun Bakes", msAgo(12, 641), { content: "yesss", reactions: [{ reaction: "🔥", actor: "Ada Lovelace" }, { reaction: "🔥", actor: MY_NAME }] }),
  msg("Jun Bakes", msAgo(12, 642), { content: "I'll bring snacks 🥐" }),
  msg("Milo Hikes", msAgo(11, 500), { content: "forecast looks fine, count me in" }),
  msg("Ada Lovelace", msAgo(10, 900), { content: "meet at the car park at 9" }),
  msg(MY_NAME, msAgo(10, 905), { content: "👍" }),
];
thread("inbox", "hikecrew_1790000000000002", CREW, group, { title: "Hike crew 🥾" });

// 3) Photos, legacy "liked"/"reacted" notices and a remote-only image.
const ADA = "Ada Lovelace";
const adaDir = `${DM}/inbox/adalovelace_1790000000000003`;
const photo = (i: number, ts: number) => {
  const uri = `${adaDir}/photos/${1790000000000100 + i}.png`;
  write(uri, scene(...pick(SHAPES)));
  return { uri, creation_timestamp: Math.floor(ts / 1000) };
};
thread("inbox", "adalovelace_1790000000000003", [ADA], [
  msg(ADA, msAgo(6, 600), { content: "look what I found" }),
  msg(ADA, msAgo(6, 601), { photos: [photo(1, msAgo(6, 601))] }),
  msg(ADA, msAgo(6, 601.5), { photos: [photo(2, msAgo(6, 601.5))] }),
  msg(MY_NAME, msAgo(6, 620), { content: "Liked a message" }),
  msg(MY_NAME, msAgo(6, 621), { content: "where is that?!" }),
  msg(ADA, msAgo(6, 630), { content: "Imaginary Bay 🌊" }),
  msg(MY_NAME, msAgo(5, 400), { photos: [photo(3, msAgo(5, 400))] }),
  msg(ADA, msAgo(5, 410), { content: "Reacted 😂 to your message " }),
  msg(ADA, msAgo(4, 300), { content: "this one only exists online", photos: [{ uri: "https://cdn.example.com/remote-photo.jpg" }] }),
  msg(ADA, msAgo(4, 310)), // no content at all: deleted/unsupported in the real export
]);

// 4) Shared posts, reels, stories, a profile and a GIF.
const MILO = "Milo Hikes";
thread("inbox", "milohikes_1790000000000004", [MILO], [
  msg(MILO, msAgo(3, 500), { content: `${MILO} sent an attachment.`, share: { link: "https://www.instagram.com/reel/EXAMPLEreel1/", share_text: "When the trail mix runs out halfway up 😩 #hiking", original_content_owner: "trail.memes" } }),
  msg(MY_NAME, msAgo(3, 520), { content: "😂😂😂" }),
  msg(MY_NAME, msAgo(3, 521), { content: "You sent an attachment.", share: { link: "https://www.instagram.com/p/EXAMPLEpost1/", share_text: "Golden hour never misses 🌅", original_content_owner: ME } }),
  msg(MILO, msAgo(2, 800), { content: "", share: { link: "https://www.instagram.com/stories/noor.reads/1790000000000200", original_content_owner: "noor.reads" }, reactions: [{ reaction: "😍", actor: MY_NAME }] }),
  msg(MILO, msAgo(2, 801), { content: "you have to follow her", share: { link: "https://www.instagram.com/_u/noor.reads", profile_share_username: "noor.reads", profile_share_name: "Noor Reads" } }),
  msg(MY_NAME, msAgo(1, 300), { content: "", share: { link: "https://media1.giphy.com/media/EXAMPLEgif/giphy.gif" } }),
  msg(MILO, msAgo(1, 302), { content: "see you sunday" }),
]);

// 5) A message request with an external link; 6) a folder without any thread JSON.
thread("message_requests", "promodeals4u_1790000000000005", ["Promo Deals"], [
  msg("Promo Deals", msAgo(8, 100), { content: "Congratulations! You won a prize 🎁 claim here", share: { link: "https://prize.example.net/claim", share_text: "Claim your prize" } }),
]);
write(`${DM}/inbox/emptythread_1790000000000006/.gitkeep`, "");

console.log(`wrote ${OUT}`);
