import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FsSource, fsExport, inferMe, loadThreads, toShare } from "../src/node/index.ts";

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/instagram-sample");
const silent = { info() {}, warn() {} };
const M = "your_instagram_activity/messages";

describe("loadThreads (fixture)", () => {
  const ex = fsExport(fixture, silent);
  const resolved: string[] = [];
  const { me, threads } = loadThreads(
    ex,
    [
      { dir: `${M}/inbox`, box: "inbox" },
      { dir: `${M}/message_requests`, box: "requests" },
    ],
    { toMedia: (uri, kind) => (resolved.push(uri), { src: "/export/" + uri, kind }) },
  );
  const byId = (prefix: string) => threads.find((t) => t.id.startsWith(prefix))!;

  it("infers the owner and skips folders without thread JSON", () => {
    expect(me).toBe("Sunny Sample");
    expect(threads).toHaveLength(5);
    expect(threads.some((t) => t.id.startsWith("emptythread"))).toBe(false);
    expect(byId("promodeals").box).toBe("requests");
  });

  it("merges message_N parts oldest first and repairs mojibake", () => {
    const river = byId("riverokafor");
    expect(river.messages.length).toBeGreaterThan(300);
    const ts = river.messages.map((m) => m.ts);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(river.messages.some((m) => m.text?.includes("Zoë"))).toBe(true);
    expect(river.messages.find((m) => m.callSec)?.callSec).toBe(754);
  });

  it("handles groups, titles and owner ordering", () => {
    const g = byId("hikecrew");
    expect(g.isGroup).toBe(true);
    expect(g.title).toBe("Hike crew 🥾");
    expect(g.participants.at(-1)).toBe(me);
    const fire = g.messages.flatMap((m) => m.reactions ?? []).find((r) => r.emoji === "🔥");
    expect(fire?.actors).toHaveLength(2);
  });

  it("flags notices, keeps remote media out of the resolver", () => {
    const ada = byId("adalovelace");
    expect(ada.messages.filter((m) => m.notice).map((m) => m.text?.trim())).toEqual(["Liked a message", "Reacted 😂 to your message"]);
    expect(ada.messages.filter((m) => m.media).length).toBe(3);
    expect(ada.messages.find((m) => m.remote)?.remote?.[0].host).toBe("cdn.example.com");
    expect(ada.messages.at(-1)?.unavailable).toBe(true);
    expect(resolved.some((u) => /^https?:/.test(u))).toBe(false);
  });

  it("classifies shares and drops 'sent an attachment' text", () => {
    const kinds = byId("milohikes").messages.map((m) => m.share?.kind).filter(Boolean);
    expect(kinds).toEqual(["reel", "post", "story", "profile", "gif"]);
    expect(byId("milohikes").messages.some((m) => /attachment/.test(m.text ?? ""))).toBe(false);
  });
});

describe("helpers", () => {
  it("FsSource.abs refuses paths outside the export", () => {
    const src = new FsSource(fixture);
    const ex = fsExport(fixture, silent);
    expect(src.abs("media/x.png")).toBe(path.join(fixture, "media/x.png"));
    expect(() => src.abs("../outside")).toThrow(/escapes/);
    expect(() => src.abs("/etc/passwd")).toThrow(/escapes/);
    expect(() => src.abs("media/../../instagram-sample-evil/x")).toThrow(/escapes/);
    expect(ex.exists("../../package.json")).toBe(false);
  });

  it("toShare", () => {
    expect(toShare({ link: "https://www.instagram.com/reels/abc/" }).kind).toBe("reel");
    expect(toShare({ link: "https://www.instagram.com/someone" }).kind).toBe("profile");
    expect(toShare({ link: "https://example.org/x" })).toMatchObject({ kind: "link", host: "example.org" });
    expect(toShare({ share_text: "hi" })).toMatchObject({ kind: "link", text: "hi" });
    // Links become hrefs: only http(s) gets through.
    expect(toShare({ link: "javascript:alert(1)" }).url).toBeUndefined();
  });

  it("inferMe prefers a known fallback and won't guess from one thread", () => {
    const ts = [{ participants: ["A", "Me"] }, { participants: ["B", "Me"] }];
    expect(inferMe(ts)).toBe("Me");
    expect(inferMe([{ participants: ["A", "Me"] }])).toBe("");
    expect(inferMe([{ participants: ["A", "Me"] }], "Me")).toBe("Me");
  });
});
