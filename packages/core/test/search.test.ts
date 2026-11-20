import { describe, expect, it } from "vitest";
import { searchIndex } from "../src/client/search.ts";
import { fold } from "../src/client/text.ts";

const rows: [string, number][] = [
  ["Café on Monday", 1],
  ["cafe again", 3],
  ["nothing here", 2],
  ["CAFÉ late", 2],
];
const folded = rows.map((r) => fold(r[0]));

describe("searchIndex", () => {
  it("matches ignoring case and accents, in the given order, capped with the full total", () => {
    const hits = searchIndex(rows, folded, " Cafe ", 2, (a, b) => b[1] - a[1]);
    expect(hits.total).toBe(3);
    expect(hits.rows.map((r) => r[0])).toEqual(["cafe again", "CAFÉ late"]);
  });

  it("needs at least three characters", () => {
    expect(searchIndex(rows, folded, "ca", 10)).toEqual({ rows: [], total: 0 });
  });
});
