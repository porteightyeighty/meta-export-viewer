#!/usr/bin/env node
/**
 * Keeps personal data out of the repo.
 *
 *   node scripts/leak-check.mjs            check staged files (pre-commit hook)
 *   node scripts/leak-check.mjs --all      check every tracked file
 *   node scripts/leak-check.mjs --generic  generic rules only (used in CI)
 *
 * Generic rules (everyone): nothing committed under exports/, no media files
 * outside fixtures/, no absolute home-directory paths.
 *
 * Personal rules (your machine only): identifiers are read at runtime and
 * never written to the repo, from
 *   - `.leakcheck.local` (gitignored): one literal string per line, or
 *     `export=/path/to/your/export` to derive them automatically, and
 *   - $META_EXPORT, and any export found under exports/.
 * Derived identifiers: username, name, email, phone from
 * personal_information.json, plus the numeric media IDs from media/ filenames.
 * Matches are reported by file and rule number, never by value.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const mode = args.has("--all") ? "all" : args.has("--generic") ? "generic" : "staged";
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
process.chdir(root);

const git = (...a) => execFileSync("git", a, { encoding: "buffer", maxBuffer: 1 << 28 });
const files =
  mode === "staged"
    ? git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").toString().split("\0").filter(Boolean)
    : git("ls-files", "-z").toString().split("\0").filter(Boolean);
const read = (f) => (mode === "staged" ? git("show", `:${f}`) : fs.readFileSync(f));

const problems = [];

// ── generic rules ──────────────────────────────────────────────────────
const MEDIA = /\.(jpe?g|png|webp|gif|heic|mp4|mov|m4a|mp3|aac|wav|opus)$/i;
const HOME = new RegExp(["/" + "home/[a-z]", "/" + "Users/[A-Za-z]", "[A-Z]:\\\\" + "Users\\\\"].join("|"));
for (const f of files) {
  if (f.startsWith("exports/") && f !== "exports/README.md") problems.push(`${f}: files under exports/ must not be committed`);
  if (MEDIA.test(f) && !f.startsWith("fixtures/")) problems.push(`${f}: media file outside fixtures/`);
  if (MEDIA.test(f)) continue;
  const text = read(f).toString("utf8");
  if (HOME.test(text)) problems.push(`${f}: contains an absolute home-directory path`);
}

// ── personal rules ─────────────────────────────────────────────────────
let needles = [];
if (mode !== "generic") {
  const exportDirs = new Set();
  if (process.env.META_EXPORT) exportDirs.add(process.env.META_EXPORT);
  for (const d of ["exports/instagram", "exports/facebook"]) if (fs.existsSync(d)) exportDirs.add(d);
  if (fs.existsSync(".leakcheck.local")) {
    for (const raw of fs.readFileSync(".leakcheck.local", "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      if (line.startsWith("export=")) exportDirs.add(line.slice(7));
      else needles.push(line);
    }
  }
  for (const dir of exportDirs) needles.push(...deriveFromExport(dir));
  needles = [...new Set(needles.map((n) => n.toLowerCase()).filter((n) => n.length >= 4))];

  if (!needles.length && mode === "staged" && fs.existsSync(".leakcheck.local") === false)
    console.warn("leak-check: no personal identifiers configured (.leakcheck.local / META_EXPORT); generic rules only.");

  const ids = needles.filter((n) => /^\d{12,}$/.test(n));
  const idSet = new Set(ids);
  const words = needles.filter((n) => !idSet.has(n));
  for (const f of files) {
    const text = read(f).toString("utf8").toLowerCase();
    const squashed = text.replace(/\s+/g, "");
    words.forEach((w, i) => {
      if (text.includes(w) || squashed.includes(w.replace(/\s+/g, ""))) problems.push(`${f}: matches personal identifier #${i + 1}`);
    });
    if (idSet.size) for (const m of text.matchAll(/\d{12,}/g)) if (idSet.has(m[0])) { problems.push(`${f}: contains a real media ID from your export`); break; }
  }
}

if (problems.length) {
  console.error(`leak-check: ${problems.length} problem(s), commit blocked:\n  ` + [...new Set(problems)].join("\n  "));
  console.error("If this is a false positive, adjust .leakcheck.local. Do not bypass with --no-verify unless you're sure.");
  process.exit(1);
}
console.log(`leak-check: ${files.length} file(s) clean (${mode}${needles.length ? `, ${needles.length} personal identifiers` : ""}).`);

function deriveFromExport(dir) {
  const out = [];
  const tryJson = (p) => {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      return undefined;
    }
  };
  const fix = (s) => {
    try {
      const d = Buffer.from(s, "latin1").toString("utf8");
      return d.includes("�") ? s : d;
    } catch {
      return s;
    }
  };
  // Instagram profile
  const pi = tryJson(path.join(dir, "personal_information/personal_information/personal_information.json"));
  const sm = pi?.profile_user?.[0]?.string_map_data ?? {};
  for (const k of ["Username", "Name", "Email", "Phone Number"]) {
    const v = sm[k]?.value;
    if (v) out.push(fix(v));
  }
  if (sm["Phone Number"]?.value) out.push(sm["Phone Number"].value.replace(/[^\d+]/g, ""));
  // Folder name usually embeds the username: instagram-<user>-YYYY-MM-DD-xxxx
  const m = path.basename(path.resolve(dir)).match(/^(?:instagram|facebook)-(.+?)-\d{4}-\d{2}-\d{2}/);
  if (m) out.push(m[1]);
  // Numeric media IDs
  const walk = (d, depth = 0) => {
    if (depth > 4 || !fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), depth + 1);
      else {
        const id = e.name.match(/^(\d{12,})/);
        if (id) out.push(id[1]);
      }
    }
  };
  walk(path.join(dir, "media"));
  return out;
}
