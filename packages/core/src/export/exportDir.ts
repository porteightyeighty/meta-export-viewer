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
 * Read-only storage behind an ExportDir: the file system in Node, picked Files in
 * the browser. Paths are export-relative, "/"-separated, "" is the root, and
 * already checked by `normRel`.
 */
export interface ExportSource {
  kind(rel: string): "file" | "dir" | undefined;
  list(rel: string): { name: string; dir: boolean }[];
  /** Bytes [start, end) of a file; fewer at end of file. */
  bytes(rel: string, start?: number, end?: number): Uint8Array;
  byteLength(rel: string): number;
}

/** Normalise an export-relative path; anything reaching outside the export throws. */
export function normRel(rel: string): string {
  if (/^([\\/]|[a-z]:)/i.test(rel)) throw new ExportError(`path escapes export: ${rel}`);
  const out: string[] = [];
  for (const part of rel.split(/[\\/]/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") throw new ExportError(`path escapes export: ${rel}`);
    out.push(part);
  }
  return out.join("/");
}

export const joinRel = (...parts: string[]) => parts.filter(Boolean).join("/");
export const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);
export const dirname = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ".");

/** View of `src` rooted at `prefix` (the export root inside a picked folder). */
export function subSource(src: ExportSource, prefix: string): ExportSource {
  if (!prefix) return src;
  const at = (rel: string) => joinRel(prefix, rel);
  return {
    kind: (rel) => src.kind(at(rel)),
    list: (rel) => src.list(at(rel)),
    bytes: (rel, s, e) => src.bytes(at(rel), s, e),
    byteLength: (rel) => src.byteLength(at(rel)),
  };
}

// ignoreBOM: decode exactly like Node's Buffer.toString("utf8").
const utf8 = new TextDecoder("utf-8", { ignoreBOM: true });

/**
 * Read-only view of an extracted Meta export folder. Nothing in here writes to
 * the export.
 */
export class ExportDir {
  readonly warnings: string[] = [];
  readonly src: ExportSource;
  private log: Logger;

  constructor(src: ExportSource, log: Logger = consoleLogger) {
    this.src = src;
    this.log = log;
  }

  private kind(rel: string) {
    try {
      return this.src.kind(normRel(rel));
    } catch {
      return undefined;
    }
  }

  exists(rel: string) {
    return this.kind(rel) !== undefined;
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
      return fixMojibake(JSON.parse(utf8.decode(this.src.bytes(normRel(rel))))) as T;
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
    if (this.kind(rel) !== "dir") return [];
    return this.src
      .list(normRel(rel))
      .filter((d) => (opts.dirs === undefined ? true : d.dir === opts.dirs))
      .map((d) => d.name)
      .filter((n) => !opts.match || opts.match.test(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /** `message_1.json, message_2.json …` style split files, in numeric order. */
  parts(dir: string, base: string): string[] {
    const re = new RegExp(`^${base}_(\\d+)\\.json$`);
    return this.list(dir, { dirs: false, match: re }).map((n) => joinRel(normRel(dir), n));
  }

  /** Pixel size of an image/video inside the export (header sniffing). */
  size(rel: string): Size | undefined {
    try {
      const r = normRel(rel);
      return mediaSize((pos, len) => this.src.bytes(r, pos, pos + len), this.src.byteLength(r));
    } catch {
      return undefined;
    }
  }

  /** Content fingerprint of a file (size + 53-bit hash), for matching identical files within one export. */
  hash(rel: string) {
    const b = this.src.bytes(normRel(rel));
    return `${b.length}:${cyrb53(b).toString(36)}`;
  }

  /** Every file under `rel`, depth first, in sorted order (the same on every platform). */
  *walk(rel: string): Generator<string> {
    if (this.kind(rel) !== "dir") return;
    const base = normRel(rel);
    for (const name of this.list(rel)) {
      const p = joinRel(base, name);
      if (this.kind(p) === "dir") yield* this.walk(p);
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

/** cyrb53 (public domain): fast, synchronous, good enough to tell files apart. */
export function cyrb53(b: Uint8Array, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < b.length; i++) {
    h1 = Math.imul(h1 ^ b[i], 2654435761);
    h2 = Math.imul(h2 ^ b[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Find the export root: `src` itself or a folder up to `depth` levels down that
 * holds one of `markers` (unzipping usually adds one wrapper folder). Returns
 * the root's path relative to `src`, or a message saying what's wrong.
 */
export function findRoot(src: ExportSource, markers: string[], depth = 2): { root: string } | { error: string } {
  const find = (rel: string, d: number): string | undefined => {
    if (markers.some((m) => src.kind(joinRel(rel, m)))) return rel;
    if (d === 0) return undefined;
    for (const e of src.list(rel).filter((e) => e.dir).sort((a, b) => a.name.localeCompare(b.name))) {
      const hit = find(joinRel(rel, e.name), d - 1);
      if (hit !== undefined) return hit;
    }
    return undefined;
  };
  if (src.kind("") !== "dir") return { error: "export folder not found" };
  const root = find("", depth);
  if (root !== undefined) return { root };
  const htmlish = src.list("").some((e) => /\.html?$/i.test(e.name));
  if (htmlish)
    return {
      error:
        "this looks like an HTML export. Request a new download with Format = JSON (Accounts Center → Your information and permissions → Download your information).",
    };
  return { error: `this doesn't look like a Meta JSON export (expected one of: ${markers.join(", ")}).` };
}

export type DataSet = Record<string, unknown>;

/** Run an app's build and attach the `meta` dataset the UI reads (source, warnings, error). */
export async function buildDatasets(ex: ExportDir, build: (ex: ExportDir) => DataSet | Promise<DataSet>, source: string): Promise<DataSet> {
  const started = Date.now();
  try {
    const data = await build(ex);
    data.meta = { source, warnings: ex.warnings, builtAt: Date.now() };
    ex.info(`built ${Object.keys(data).length} datasets in ${Date.now() - started}ms`);
    return data;
  } catch (e) {
    ex.warn(`build failed: ${(e as Error).stack ?? e}`);
    return { meta: { source, warnings: ex.warnings, error: String((e as Error).message ?? e) } };
  }
}
