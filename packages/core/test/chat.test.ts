import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../src/types/meta.ts";
import { callLength, findMatches, isEmojiOnly, layoutThread, previewText } from "../src/client/chat.ts";
import { fold, highlight, snippet } from "../src/client/text.ts";

const MIN = 60_000;
const m = (sender: string, min: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({ sender, ts: min * MIN, text: "hi", ...extra });

describe("layoutThread", () => {
  it("groups same-sender runs and inserts time breaks", () => {
    const rows = layoutThread([m("a", 0), m("a", 1), m("me", 2), m("me", 200), m("a", 201, { notice: true, text: "Liked a message" })], { me: "me" });
    expect(rows.map((r) => r.kind)).toEqual(["time", "msg", "msg", "msg", "time", "msg", "notice"]);
    const msgs = rows.filter((r) => r.kind === "msg");
    expect(msgs.map((r) => [r.first, r.last])).toEqual([[true, false], [false, true], [true, true], [true, true]]);
    expect(msgs.map((r) => r.mine)).toEqual([false, false, true, true]);
  });

  it("shows sender names only at the start of others' runs in groups", () => {
    const rows = layoutThread([m("a", 0), m("a", 1), m("b", 2), m("me", 3)], { me: "me", isGroup: true });
    expect(rows.filter((r) => r.kind === "msg").map((r) => r.showSender)).toEqual([true, false, true, false]);
  });

  it("supports paging from an index", () => {
    const rows = layoutThread([m("a", 0), m("a", 1), m("a", 2)], { me: "me", from: 2 });
    expect(rows.map((r) => r.key)).toEqual(["t2", "m2"]);
  });
});

describe("search + preview", () => {
  it("matches accent-insensitively in text and shares", () => {
    const msgs = [m("a", 0, { text: "the Café" }), m("a", 1, { text: undefined, share: { kind: "reel", owner: "trail.memes" } })];
    expect(findMatches(msgs, "cafe")).toEqual([0]);
    expect(findMatches(msgs, "TRAIL")).toEqual([1]);
    expect(findMatches(msgs, "  ")).toEqual([]);
  });

  it("highlights original characters", () => {
    expect(highlight("Zoë says hi", "zoe")).toEqual([{ text: "Zoë", hit: true }, { text: " says hi", hit: false }]);
    expect(highlight("abab", "b").filter((s) => s.hit)).toHaveLength(2);
    expect(fold("ÉCOLE")).toBe("ecole");
    expect(snippet("x".repeat(100) + "needle" + "y".repeat(100), "needle", 5)).toBe("…xxxxxneedleyyyyy…");
  });

  it("previews", () => {
    expect(previewText(m("me", 0, { text: "yo" }), "me")).toBe("You: yo");
    expect(previewText(m("a", 0, { text: undefined, share: { kind: "reel" } }), "me")).toBe("Sent a reel");
    expect(previewText(m("me", 0, { text: undefined, media: [{ src: "", kind: "image" }] }), "me")).toBe("You sent a photo");
    expect(previewText(m("a", 0, { text: undefined, callSec: 0 }), "me")).toBe("Missed call");
    expect(previewText(m("a", 0, { text: undefined, unavailable: true }), "me")).toBe("Sent a message");
    expect(callLength(754)).toBe("12m 34s");
  });

  it("detects emoji-only messages", () => {
    expect(isEmojiOnly("😂😂😂")).toBe(true);
    expect(isEmojiOnly("❤️")).toBe(true);
    expect(isEmojiOnly("ok 👍")).toBe(false);
    expect(isEmojiOnly("123")).toBe(false);
  });
});
