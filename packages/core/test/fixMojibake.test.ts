import { describe, expect, it } from "vitest";
import { fixMojibake, fixString } from "../src/export/fixMojibake.ts";

const mangle = (s: string) => Buffer.from(s, "utf8").toString("latin1");

describe("fixMojibake", () => {
  it("repairs UTF-8 stored as latin-1 escapes", () => {
    expect(fixString("Fun in the sun â\u0098\u0080ï¸\u008f")).toBe("Fun in the sun ☀️");
    expect(fixString(mangle("Café 🥐 naïve"))).toBe("Café 🥐 naïve");
  });
  it("leaves plain ASCII, real unicode and genuine latin-1 alone", () => {
    expect(fixString("hello")).toBe("hello");
    expect(fixString("already ☀️ fine")).toBe("already ☀️ fine");
    expect(fixString("café")).toBe("café"); // lone 0xE9 is not valid UTF-8
  });
  it("recurses through objects, arrays and keys", () => {
    expect(fixMojibake({ [mangle("ké")]: [mangle("ñ"), 3, null, { t: mangle("✨") }] })).toEqual({ ké: ["ñ", 3, null, { t: "✨" }] });
  });
});

describe("fixString without Buffer", () => {
  it("matches Buffer's UTF-8 decoding, BOM included", () => {
    const mangled = (s: string) => Buffer.from(s, "utf8").toString("latin1");
    for (const s of ["☀️ Zoë", "\uFEFFhi", "日本語 🥾"]) expect(fixString(mangled(s))).toBe(s);
    expect(fixString("caf\u00e9")).toBe("caf\u00e9"); // genuine latin-1 stays
  });
});
