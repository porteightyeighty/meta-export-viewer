import { describe, expect, it } from "vitest";
import { fromStringList, fromStringMap, lvFind, lvFindAll, lvTop, lvValue, toMs, type LVItem } from "../src/export/flatten.ts";

describe("flatten helpers", () => {
  it("normalises timestamps to ms", () => {
    expect(toMs(1_600_000_000)).toBe(1_600_000_000_000);
    expect(toMs(1_600_000_000_000)).toBe(1_600_000_000_000);
    expect(toMs(0)).toBeUndefined();
    expect(toMs(undefined)).toBeUndefined();
  });

  it("reads string_list_data with value, title or href fallback", () => {
    expect(fromStringList({ string_list_data: [{ value: "a", href: "https://h.example", timestamp: 1 }] })).toEqual({ value: "a", href: "https://h.example", timestamp: 1000 });
    expect(fromStringList({ title: "b", string_list_data: [{ href: "x" }] }).value).toBe("b");
    expect(fromStringList({ string_list_data: [{ href: "https://example.com/_u/c/" }] }).value).toBe("c");
  });

  it("drops non-http hrefs", () => {
    expect(fromStringList({ string_list_data: [{ href: "javascript:x", value: "v" }] }).href).toBeUndefined();
    expect(fromStringList({ string_list_data: [{ href: "https://instagram.com/v" }] }).href).toBe("https://instagram.com/v");
  });

  it("reads string_map_data and drops empties", () => {
    expect(fromStringMap({ Name: { value: "N" }, Bio: { value: "" } })).toEqual({ Name: "N" });
  });

  it("searches nested label_values", () => {
    const lv: LVItem[] = [
      { label: "Caption", value: "hi" },
      { label: "Latitude", value: "" },
      { title: "Place", dict: [{ title: "", dict: [{ label: "Name", value: "Somewhere" }] }] },
      { title: "Hashtags", dict: [{ dict: [{ label: "Name", value: "a" }] }, { dict: [{ label: "Name", value: "b" }] }] },
    ];
    expect(lvValue(lv, "Caption")).toBe("hi");
    expect(lvValue(lv, "Latitude")).toBeUndefined();
    expect(lvFind(lvTop(lv, "Place")?.dict, "Name")?.value).toBe("Somewhere");
    expect(lvFindAll(lvTop(lv, "Hashtags")?.dict, "Name").map((i) => i.value)).toEqual(["a", "b"]);
  });
});
