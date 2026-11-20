import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ExportDir, fileSource, findRoot, subSource, type ReadBlob } from "@mev/core/export";
import { fsExport } from "@mev/core/node";
import { buildInstagram, IG_MARKERS } from "../build/index.ts";

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/instagram-sample");
const silent = { info() {}, warn() {} };

describe("buildInstagram (fixture)", () => {
  const ex = fsExport(fixture, silent);
  const d = buildInstagram(ex);

  it("builds the profile without leaking contact details", () => {
    expect(d.profile.username).toBe("sunny.sample");
    expect(d.profile.pronouns).toEqual(["they", "them"]);
    expect(d.profile.bio).toContain("☀️");
    expect(d.profile.avatar).toMatch(/^\/export\/media\/profile\//);
    expect(JSON.stringify(d.profile)).not.toMatch(/example\.com|0000/);
  });

  it("groups carousels, sorts newest first and repairs captions", () => {
    expect(d.posts).toHaveLength(15);
    expect(d.profile.counts.posts).toBe(15);
    expect(d.posts.map((p) => p.media.length).sort()).toContain(3);
    expect([...d.posts].sort((a, b) => b.timestamp - a.timestamp)).toEqual(d.posts);
    expect(d.posts.some((p) => p.caption.includes("🌅"))).toBe(true);
    expect(d.posts.find((p) => p.media.length === 3)?.caption).toMatch(/hike/);
  });

  it("enriches from posts.json and reads media sizes from file headers", () => {
    expect(d.posts.filter((p) => p.place).length).toBeGreaterThan(0);
    expect(d.posts.find((p) => p.hashtags)?.hashtags).toEqual(["outdoors", "hiking"]);
    for (const p of d.posts) for (const m of p.media) expect(m.width! / m.height!).toBeGreaterThan(0);
  });

  it("reads archive and connections", () => {
    expect(d.archived).toHaveLength(2);
    expect(d.archived.find((p) => p.location)?.location).toEqual({ lat: 51.5, lng: -0.12 });
    expect(d.followers).toHaveLength(40);
    expect(d.following).toHaveLength(45);
    expect(d.following[0].username).toBeTruthy();
  });

  it("reads stories newest first with sizes", () => {
    expect(d.stories).toHaveLength(12);
    expect([...d.stories].sort((a, b) => b.timestamp - a.timestamp)).toEqual(d.stories);
    for (const s of d.stories) {
      expect(s.media[0].src).toMatch(/^\/export\/media\/stories\//);
      expect(s.media[0].width! / s.media[0].height!).toBeCloseTo(270 / 480);
    }
    expect(d.stories.some((s) => s.caption === "Golden hour ☀️")).toBe(true);
  });

  it("builds Direct datasets", () => {
    const t = d.threads as { me: string; items: { id: string; box: string; last?: { text: string } }[] };
    expect(t.me).toBe("Sunny Sample");
    expect(t.items).toHaveLength(5);
    expect(t.items.filter((i) => i.box === "requests")).toHaveLength(1);
    expect(t.items.every((i) => (d as Record<string, unknown>)[`thread/${i.id}`])).toBe(true);
    expect(t.items.find((i) => i.id.startsWith("milohikes"))?.last?.text).toBe("see you sunday");
    const ada = (d as any)[`thread/${t.items.find((i) => i.id.startsWith("adalovelace"))!.id}`];
    const photo = ada.messages.find((m: any) => m.media).media[0];
    expect(photo.src).toMatch(/^\/export\/your_instagram_activity\/messages\//);
    expect(photo.width).toBeGreaterThan(0);
    expect((d.messageIndex as unknown[]).length).toBeGreaterThan(300);
  });

  it("groups every other JSON file into Accounts Center sections", () => {
    const sections = d.settings as { title: string; files: { id: string; title: string; count: number }[] }[];
    const where = (id: string) => sections.find((s) => s.files.some((f) => f.id === id))?.title;
    expect(where("connections/followers_and_following/blocked_profiles")).toBe("Connections");
    expect(where("preferences/settings/notification_preferences")).toBe("Preferences");
    expect(where("security_and_login_information/login_and_profile_creation/login_activity")).toBe("Password and security");
    expect(where("personal_information/personal_information/personal_information")).toBe("Personal details");
    expect(where("future_section/mystery_feature")).toBe("Other");
    // Files with their own views stay out.
    const ids = sections.flatMap((s) => s.files.map((f) => f.id));
    expect(ids.some((id) => /messages\/|media\/posts|media\/stories|followers_1|following$/.test(id))).toBe(false);
    for (const id of ids) {
      const recs = (d as any)[`settings/${id}`] as { fields: unknown[] }[];
      expect(recs.length, id).toBeGreaterThan(0);
      expect(recs.every((r) => r.fields.length), id).toBe(true);
    }
    const login = (d as any)["settings/security_and_login_information/login_and_profile_creation/login_activity"];
    expect(login).toHaveLength(3);
    expect(login[0].fields.find((f: any) => f.label === "Time").time).toBeGreaterThan(0);
    expect(sections.flatMap((s) => s.files).find((f) => f.id.endsWith("avatar_items"))?.title).toBe("Avatar items");
  });

  it("indexes one searchable row per Accounts Center record", () => {
    const index = d.recordIndex as [string, string][];
    const files = (d.settings as { files: { id: string; count: number }[] }[]).flatMap((s) => s.files);
    expect(index).toHaveLength(files.reduce((n, f) => n + f.count, 0));
    const logins = index.filter(([id]) => id.endsWith("login_activity"));
    expect(logins).toHaveLength(3);
    expect(logins.every(([, text]) => text.length > 0)).toBe(true);
  });

  it("builds one newest-first activity timeline and keeps its files out of Accounts Center", () => {
    const rows = d.activity;
    const count = (k: string) => rows.filter((r) => r[0] === k).length;
    expect([count("like"), count("comment-like"), count("comment"), count("story-like")]).toEqual([30, 5, 10, 10]);
    // countdowns.json is a single object, not a list
    expect(["poll", "quiz", "question", "slider", "countdown"].map(count)).toEqual([1, 1, 1, 1, 1]);
    expect([...rows].sort((a, b) => b[1] - a[1])).toEqual(rows);
    expect(rows.filter((r) => r[0] === "like" && !r[2])).toHaveLength(1); // the like without an owner
    expect(rows.some((r) => r[3] === "Sunset over the bay 🌅")).toBe(true); // mojibake repaired
    expect(rows.find((r) => r[0] === "question")![3]).toBe("Best book this year? · Piranesi");
    expect(rows.find((r) => r[0] === "quiz")![4]).toMatch(/^https:\/\/www\.instagram\.com\/stories\//);
    const ids = (d.settings as { files: { id: string }[] }[]).flatMap((s) => s.files.map((f) => f.id));
    expect(ids.some((id) => /likes\/|comments\/|story_interactions\//.test(id))).toBe(false);
    expect((d.recordIndex as [string, string][]).some(([id]) => id.includes("likes/"))).toBe(false);
  });

  it("tolerates a missing export without throwing", () => {
    const warnings: string[] = [];
    const empty = buildInstagram(fsExport(path.join(fixture, "nope"), { info() {}, warn: (m) => warnings.push(m) }));
    expect(empty.posts).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("browser reader (fileSource) builds the same as the fs reader", () => {
  it("matches on the fixture, picked with a wrapper folder", () => {
    const bytes = new Map<Blob, Uint8Array>();
    const files: [string, Blob][] = fs.readdirSync(fixture, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => {
      const abs = path.join(d.parentPath, d.name);
      const b = new Uint8Array(fs.readFileSync(abs));
      const blob = new Blob([b]);
      bytes.set(blob, b);
      return ["instagram-sample/" + path.relative(fixture, abs).split(path.sep).join("/"), blob];
    });
    const read: ReadBlob = (blob, s, e) => bytes.get(blob)!.subarray(s, e);
    const src = fileSource(files, read);
    const found = findRoot(src, IG_MARKERS);
    expect(found).toEqual({ root: "instagram-sample" });
    const viaFiles = buildInstagram(new ExportDir(subSource(src, "instagram-sample"), silent));
    expect(viaFiles).toEqual(buildInstagram(fsExport(fixture, silent)));
  });
});
