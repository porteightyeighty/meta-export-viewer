/** Runs the real pre-commit leak check against a throwaway git repo and a fake export. */
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "leak-check.mjs");
const USER = "zz_fake_owner_42";
const MEDIA_ID = "17999999999999999";

const tmps: string[] = [];
afterEach(() => tmps.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

/** Fresh repo with `files` staged, plus a fake export that names USER and MEDIA_ID. */
function check(files: Record<string, string>, profile: Record<string, string> = { Username: USER }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "leakcheck-"));
  tmps.push(tmp);
  const repo = path.join(tmp, "repo"), ex = path.join(tmp, "export");
  fs.mkdirSync(path.join(ex, "personal_information/personal_information"), { recursive: true });
  fs.mkdirSync(path.join(ex, "media/posts/202501"), { recursive: true });
  fs.writeFileSync(
    path.join(ex, "personal_information/personal_information/personal_information.json"),
    JSON.stringify({
      profile_user: [{ string_map_data: Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, { value: v }])) }],
    }),
  );
  fs.writeFileSync(path.join(ex, `media/posts/202501/${MEDIA_ID}.jpg`), "");
  fs.mkdirSync(repo);
  execFileSync("git", ["init", "-q"], { cwd: repo });
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
    fs.writeFileSync(path.join(repo, f), text);
  }
  execFileSync("git", ["add", "-A"], { cwd: repo });
  const r = spawnSync(process.execPath, [script], { cwd: repo, encoding: "utf8", env: { ...process.env, META_EXPORT: ex } });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe("leak-check (staged)", () => {
  it("passes clean files", () => {
    expect(check({ "src/a.ts": "export const x = 1;\n" }).code).toBe(0);
  });

  it("blocks the owner's username (any case) without printing it", () => {
    const r = check({ "src/a.ts": `// by ${USER.toUpperCase()}\n` });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/src\/a\.ts: matches personal identifier/);
    expect(r.out.toLowerCase()).not.toContain(USER);
  });

  it("blocks real media IDs, exports/ files and stray media", () => {
    const r = check({ "notes.md": `see ${MEDIA_ID}\n`, "exports/instagram/x.json": "{}", "img/p.jpg": "" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("notes.md: contains a real media ID");
    expect(r.out).toContain("exports/instagram/x.json: files under exports/");
    expect(r.out).toContain("img/p.jpg: media file outside fixtures/");
    expect(r.out).not.toContain(MEDIA_ID);
  });

  it("blocks files named after the owner", () => {
    const r = check({ [`notes/${USER}.md`]: "nothing here\n" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("matches personal identifier");
  });

  it("joins multi-word names but not single words across gaps", () => {
    // Username "Theo" must not match "the old"; Name "Zed Quill" must match "ZedQuill".
    expect(check({ "a.md": "the old one\n" }, { Username: "Theo" }).code).toBe(0);
    expect(check({ "a.md": "by ZedQuill\n" }, { Name: "Zed Quill" }).code).toBe(1);
  });

  it("repairs mojibake names from the export before matching", () => {
    // Exports store "Zoë" as UTF-8 bytes read as latin-1.
    expect(check({ "a.md": "thanks Zoë Quill\n" }, { Name: "Zo\u00c3\u00ab Quill" }).code).toBe(1);
  });
});
