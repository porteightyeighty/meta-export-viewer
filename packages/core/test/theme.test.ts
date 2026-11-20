import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, nextTheme, readTheme } from "../src/client/theme.ts";

const store = (data: Record<string, string> = {}) => ({
  getItem: (k: string) => data[k] ?? null,
  setItem: (k: string, v: string) => void (data[k] = v),
  removeItem: (k: string) => void delete data[k],
  data,
});
const doc = () => ({ documentElement: { dataset: {} as Record<string, string> } });

afterEach(() => vi.unstubAllGlobals());

describe("theme", () => {
  it("cycles auto → light → dark → auto", () => {
    expect(nextTheme("auto")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("auto");
  });

  it("reads a saved theme and ignores junk", () => {
    vi.stubGlobal("localStorage", store({ "mev-theme": "dark" }));
    expect(readTheme()).toBe("dark");
    vi.stubGlobal("localStorage", store({ "mev-theme": "purple" }));
    expect(readTheme()).toBe("auto");
  });

  it("sets data-theme and persists; auto clears both", () => {
    const s = store(), d = doc();
    vi.stubGlobal("localStorage", s);
    vi.stubGlobal("document", d);
    applyTheme("light");
    expect(d.documentElement.dataset.theme).toBe("light");
    expect(s.data["mev-theme"]).toBe("light");
    applyTheme("auto");
    expect(d.documentElement.dataset.theme).toBeUndefined();
    expect(s.data["mev-theme"]).toBeUndefined();
  });

  it("survives storage that throws", () => {
    const boom = () => { throw new Error("blocked"); };
    const d = doc();
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom });
    vi.stubGlobal("document", d);
    expect(readTheme()).toBe("auto");
    applyTheme("dark");
    expect(d.documentElement.dataset.theme).toBe("dark");
  });
});
