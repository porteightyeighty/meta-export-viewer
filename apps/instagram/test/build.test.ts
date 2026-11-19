import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ExportDir } from "@mev/core/node";
import { buildInstagram } from "../build/index.ts";

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/instagram-sample");
const silent = { info() {}, warn() {} };

describe("buildInstagram (fixture)", () => {
  const ex = new ExportDir(fixture, silent);
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

  it("tolerates a missing export without throwing", () => {
    const warnings: string[] = [];
    const empty = buildInstagram(new ExportDir(path.join(fixture, "nope"), { info() {}, warn: (m) => warnings.push(m) }));
    expect(empty.posts).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
