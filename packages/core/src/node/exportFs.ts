import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fixMojibake } from "./fixMojibake.ts";
import { mediaSize, type Size } from "./mediaSize.ts";

export class ExportError extends Error {}

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
}

export const consoleLogger: Logger = {
  info: (m) => console.log(`[export] ${m}`),
  warn: (m) => console.warn(`[export] ⚠ ${m}`),
};

/**
 * Read-only view of an extracted Meta export folder. Nothing in here writes to
 * the export.
 */
export class ExportDir {
  readonly root: string;
  readonly warnings: string[] = [];
  private log: Logger;

  constructor(root: string, log: Logger = consoleLogger) {
    this.root = path.resolve(root);
    this.log = log;
  }

  abs(rel: string) {
    const p = path.resolve(this.root, rel);
    if (p !== this.root && !p.startsWith(this.root + path.sep)) throw new ExportError(`path escapes export: ${rel}`);
    return p;
  }

  exists(rel: string) {
    try {
      return fs.existsSync(this.abs(rel));
    } catch {
      return false;
    }
  }

  /** First of the candidate paths that exists, or undefined. */
  first(...candidates: string[]) {
    return candidates.find((c) => this.exists(c));
  }

  /** Parse JSON (mojibake repaired) from the first candidate that exists. */
  readJson<T = any>(...candidates: string[]): T | undefined {
    const rel = this.first(...candidates);
    if (!rel) return undefined;
    try {
      return fixMojibake(JSON.parse(fs.readFileSync(this.abs(rel), "utf8"))) as T;
    } catch (e) {
      this.warn(`could not parse ${rel}: ${(e as Error).message}`);
      return undefined;
    }
  }

  /** Like readJson, but logs a warning when the section is absent. */
  section<T = any>(what: string, ...candidates: string[]): T | undefined {
    const v = this.readJson<T>(...candidates);
    if (v === undefined && !this.first(...candidates)) this.warn(`${what} not found (looked for ${candidates.join(", ")})`);
    return v;
  }

  list(rel: string, opts: { dirs?: boolean; match?: RegExp } = {}): string[] {
    if (!this.exists(rel)) return [];
    return fs
      .readdirSync(this.abs(rel), { withFileTypes: true })
      .filter((d) => (opts.dirs === undefined ? true : d.isDirectory() === opts.dirs))
      .map((d) => d.name)
      .filter((n) => !opts.match || opts.match.test(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /** `message_1.json, message_2.json …` style split files, in numeric order. */
  parts(dir: string, base: string): string[] {
    const re = new RegExp(`^${base}_(\\d+)\\.json$`);
    return this.list(dir, { dirs: false, match: re }).map((n) => path.posix.join(dir, n));
  }

  /** Pixel size of an image/video inside the export (header sniffing). */
  size(rel: string): Size | undefined {
    return mediaSize(this.abs(rel));
  }

  /** md5 of a file inside the export. */
  hash(rel: string) {
    return crypto.createHash("md5").update(fs.readFileSync(this.abs(rel))).digest("hex");
  }

  *walk(rel: string): Generator<string> {
    if (!this.exists(rel)) return;
    for (const d of fs.readdirSync(this.abs(rel), { withFileTypes: true })) {
      const p = path.posix.join(rel, d.name);
      if (d.isDirectory()) yield* this.walk(p);
      else yield p;
    }
  }

  warn(msg: string) {
    this.warnings.push(msg);
    this.log.warn(msg);
  }
  info(msg: string) {
    this.log.info(msg);
  }
}

/**
 * Find the export root: `META_EXPORT` env, else the repo drop-zone, else the
 * bundled fixture. Descends up to two levels so dropping the unzipped folder
 * (which usually has one wrapper directory) just works.
 */
export function resolveExportDir(opts: {
  env?: string;
  dropZone: string;
  fixture: string;
  markers: string[];
}): { dir: string; source: "env" | "drop-zone" | "fixture" } {
  const find = (start: string, depth = 2): string | undefined => {
    if (!fs.existsSync(start) || !fs.statSync(start).isDirectory()) return undefined;
    if (opts.markers.some((m) => fs.existsSync(path.join(start, m)))) return start;
    if (depth === 0) return undefined;
    for (const d of fs.readdirSync(start, { withFileTypes: true })) {
      if (d.isDirectory()) {
        const hit = find(path.join(start, d.name), depth - 1);
        if (hit) return hit;
      }
    }
    return undefined;
  };

  if (opts.env) {
    if (/\.zip$/i.test(opts.env)) throw new ExportError(`META_EXPORT points at a .zip — extract it first and point at the folder.`);
    const hit = find(opts.env);
    if (!hit) throw new ExportError(describeMiss(opts.env, opts.markers));
    return { dir: hit, source: "env" };
  }
  const drop = find(opts.dropZone);
  if (drop) return { dir: drop, source: "drop-zone" };
  return { dir: opts.fixture, source: "fixture" };
}

function describeMiss(dir: string, markers: string[]) {
  if (!fs.existsSync(dir)) return `export folder not found: ${dir}`;
  const htmlish = fs.readdirSync(dir).some((n) => /\.html?$/i.test(n)) || fs.existsSync(path.join(dir, "start_here.html"));
  if (htmlish)
    return `${dir} looks like an HTML export. Request a new download with Format = JSON (Accounts Center → Your information and permissions → Download your information).`;
  return `${dir} doesn't look like a Meta JSON export (expected one of: ${markers.join(", ")}).`;
}
