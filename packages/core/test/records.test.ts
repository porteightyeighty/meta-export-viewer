import { describe, expect, it } from "vitest";
import { prettyKey, toRecords } from "../src/node/records.ts";

describe("toRecords", () => {
  it("reads label_values entries with nested dicts and vecs", () => {
    const recs = toRecords([
      {
        timestamp: 1_700_000_000,
        media: [],
        label_values: [
          { label: "Name", value: "Pat Example" },
          { label: "Link", value: "pat", href: "https://www.example.com/pat" },
          { label: "Bad link", value: "x", href: "javascript:alert(1)" },
          { label: "When", timestamp_value: 1_700_000_100 },
          { label: "Empty", value: "" },
          { title: "Owner", dict: [{ title: "", dict: [{ label: "Username", value: "owner.one" }] }] },
          { label: "Options", vec: [{ value: "Yes" }, { value: "No" }] },
        ],
      },
    ]);
    expect(recs).toHaveLength(1);
    const [r] = recs;
    expect(r.time).toBe(1_700_000_000_000);
    expect(r.fields.find((f) => f.label === "Name")?.value).toBe("Pat Example");
    expect(r.fields.find((f) => f.label === "Link")?.href).toBe("https://www.example.com/pat");
    expect(r.fields.find((f) => f.label === "Bad link")?.href).toBeUndefined();
    expect(r.fields.find((f) => f.label === "When")?.time).toBe(1_700_000_100_000);
    expect(r.fields.find((f) => f.label === "Empty")).toEqual({ label: "Empty" });
    expect(r.fields.find((f) => f.label === "Owner")?.items?.[0].fields[0]).toEqual({ label: "Username", value: "owner.one" });
    expect(r.fields.find((f) => f.label === "Options")?.items?.[0].fields.map((f) => f.value)).toEqual(["Yes", "No"]);
  });

  it("treats a single label_values object as one record", () => {
    expect(toRecords({ media: [], label_values: [{ label: "Setting", value: "On" }] })).toEqual([{ fields: [{ label: "Setting", value: "On" }] }]);
  });

  it("unwraps a single-key wrapper of string_map_data records", () => {
    const recs = toRecords({ account_history_login_history: [{ title: "2024-01-01", media_map_data: {}, string_map_data: { "IP address": { value: "192.0.2.1" }, Time: { timestamp: 1_700_000_000 } } }] });
    expect(recs).toEqual([{ title: "2024-01-01", fields: [{ label: "IP address", value: "192.0.2.1" }, { label: "Time", time: 1_700_000_000_000 }] }]);
  });

  it("reads string_list_data and resolves local media only", () => {
    const recs = toRecords(
      { tags: [{ title: "", media_list_data: [{ uri: "media/a.jpg" }, { uri: "https://cdn.example.com/b.jpg" }], string_list_data: [{ value: "hiking", href: "https://www.example.com/hiking", timestamp: 1_700_000_000 }] }] },
      { media: (u) => (u.startsWith("media/") ? `/export/${u}` : undefined) },
    );
    expect(recs[0].fields).toEqual([
      { label: "Media", media: ["/export/media/a.jpg"], href: "https://cdn.example.com/b.jpg", value: "https://cdn.example.com/b.jpg" },
      { label: "", value: "hiking", href: "https://www.example.com/hiking", time: 1_700_000_000_000 },
    ]);
  });

  it("falls back to key/value pairs for unknown shapes", () => {
    const recs = toRecords({ items: [{ item: "Hat", type: "headwear", acquisition_time: 1_700_000_000, extra: { colour: "red" } }] });
    expect(recs[0].fields).toEqual([
      { label: "Item", value: "Hat" },
      { label: "Type", value: "headwear" },
      { label: "Acquisition time", time: 1_700_000_000_000 },
      { label: "Extra", items: [{ fields: [{ label: "Colour", value: "red" }] }] },
    ]);
    expect(toRecords({})).toEqual([]);
    expect(toRecords(["a", 2])).toEqual([{ fields: [{ label: "", value: "a" }] }, { fields: [{ label: "", value: "2" }] }]);
  });

  it("prettifies file keys", () => {
    expect(prettyKey("follow_requests_you_ve_received")).toBe("Follow requests you've received");
    expect(prettyKey("posts_1")).toBe("Posts 1");
  });
});
