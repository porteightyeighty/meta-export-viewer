import fs from "node:fs";
import path from "node:path";
import { ExportDir, ExportError, consoleLogger, findRoot, type ExportSource, type Logger } from "../export/index.ts";

/** Export storage on the local file system, confined to `root`. */
export class FsSource implements ExportSource {
  readonly root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
  }

  abs(rel: string) {
    const p = path.resolve(this.root, rel);
    if (p !== this.root && !p.startsWith(this.root + path.sep)) throw new ExportError(`path escapes export: ${rel}`);
    return p;
  }

  kind(rel: string) {
    try {
      const st = fs.statSync(this.abs(rel));
      return st.isDirectory() ? "dir" : st.isFile() ? "file" : undefined;
    } catch {
      return undefined;
    }
  }

  list(rel: string) {
    return fs.readdirSync(this.abs(rel), { withFileTypes: true }).map((d) => ({ name: d.name, dir: d.isDirectory() }));
  }

  bytes(rel: string, start = 0, end?: number) {
    const file = this.abs(rel);
    if (start === 0 && end === undefined) return fs.readFileSync(file);
    const fd = fs.openSync(file, "r");
    try {
      const len = Math.max(0, Math.min(end ?? Infinity, fs.fstatSync(fd).size) - start);
      const b = Buffer.alloc(len);
      return b.subarray(0, fs.readSync(fd, b, 0, len, start));
    } finally {
      fs.closeSync(fd);
    }
  }

  byteLength(rel: string) {
    return fs.statSync(this.abs(rel)).size;
  }
}

/** ExportDir over a folder on disk. */
export const fsExport = (root: string, log: Logger = consoleLogger) => new ExportDir(new FsSource(root), log);

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
  if (opts.env) {
    if (/\.zip$/i.test(opts.env)) throw new ExportError(`META_EXPORT points at a .zip — extract it first and point at the folder.`);
    const hit = findRoot(new FsSource(opts.env), opts.markers);
    if ("error" in hit) throw new ExportError(`${opts.env}: ${hit.error}`);
    return { dir: path.join(opts.env, hit.root), source: "env" };
  }
  const drop = findRoot(new FsSource(opts.dropZone), opts.markers);
  if ("root" in drop) return { dir: path.join(opts.dropZone, drop.root), source: "drop-zone" };
  return { dir: opts.fixture, source: "fixture" };
}
