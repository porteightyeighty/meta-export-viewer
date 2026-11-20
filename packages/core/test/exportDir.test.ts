import { describe, expect, it } from "vitest";
import { ExportDir, cyrb53, fileSource, findRoot, normRel, type ReadBlob } from "../src/export/index.ts";
import { resolveMedia } from "../src/client/resolveMedia.ts";

/** fileSource over in-memory files; Node has no FileReaderSync, so read from the bytes we made. */
function memFiles(files: Record<string, string>) {
  const bytes = new Map<Blob, Uint8Array>();
  const entries = Object.entries(files).map(([p, text]) => {
    const b = new TextEncoder().encode(text);
    const blob = new Blob([b]);
    bytes.set(blob, b);
    return [p, blob] as [string, Blob];
  });
  const read: ReadBlob = (blob, s, e) => bytes.get(blob)!.subarray(s, e);
  return fileSource(entries, read);
}

describe("normRel", () => {
  it("normalises and refuses escapes", () => {
    expect(normRel("a//b/./c")).toBe("a/b/c");
    expect(normRel("")).toBe("");
    for (const bad of ["../x", "a/../../x", "/etc/passwd", "C:/x", "a\\..\\..\\x"]) expect(() => normRel(bad)).toThrow(/escapes/);
  });
});

describe("fileSource + ExportDir", () => {
  const src = memFiles({
    "wrap/export/connections/followers_1.json": '[{"a":"Zo\\u00c3\\u00ab"}]',
    "wrap/export/media/b.jpg": "x",
    "wrap/export/media/a_10.json": "{}",
    "wrap/export/media/a_2.json": "{}",
    "../evil.json": "{}",
  });

  it("finds the root through wrapper folders and reads JSON with mojibake repaired", () => {
    const found = findRoot(src, ["connections"]);
    expect(found).toEqual({ root: "wrap/export" });
    expect(src.kind("../evil.json")).toBeUndefined();
    const ex = new ExportDir(memFiles({ "connections/x.json": '[{"a":"Zo\\u00c3\\u00ab"}]', "media/a_10.json": "{}", "media/a_2.json": "{}", "media/b.jpg": "x" }));
    expect(ex.readJson("connections/x.json")).toEqual([{ a: "Zoë" }]);
    expect(ex.parts("media", "a")).toEqual(["media/a_2.json", "media/a_10.json"]);
    expect([...ex.walk("")]).toEqual(["connections/x.json", "media/a_2.json", "media/a_10.json", "media/b.jpg"]);
    expect(ex.exists("../connections")).toBe(false);
    expect(ex.hash("media/b.jpg")).toBe(ex.hash("media/b.jpg"));
    expect(ex.hash("media/b.jpg")).not.toBe(ex.hash("media/a_2.json"));
  });

  it("explains a wrong folder or an HTML export", () => {
    expect(findRoot(memFiles({ "x/y.txt": "" }), ["connections"])).toEqual({ error: expect.stringMatching(/doesn't look like a Meta JSON export/) });
    expect(findRoot(memFiles({ "start_here.html": "" }), ["connections"])).toEqual({ error: expect.stringMatching(/HTML export/) });
  });

  it("cyrb53 tells close inputs apart", () => {
    expect(cyrb53(new Uint8Array([1, 2]))).not.toBe(cyrb53(new Uint8Array([2, 1])));
  });
});

describe("resolveMedia", () => {
  it("rewrites exact matches only, in place", () => {
    const data = { a: "/export/m.jpg", caption: "see /export/m.jpg", list: [{ src: "/export/m.jpg" }, "/export/other.jpg"] };
    const urls = new Map([["/export/m.jpg", "blob:1"]]);
    expect(resolveMedia(data, (s) => urls.get(s))).toEqual({ a: "blob:1", caption: "see /export/m.jpg", list: [{ src: "blob:1" }, "/export/other.jpg"] });
  });
});
