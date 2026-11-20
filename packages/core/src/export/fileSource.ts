import { normRel, type ExportSource } from "./exportDir.ts";

// FileReaderSync is in the WebWorker lib, not DOM.
declare const FileReaderSync: { new (): { readAsArrayBuffer(b: Blob): ArrayBuffer } };

/** Synchronous Blob read. Only works in a Web Worker (FileReaderSync); tests pass their own. */
export type ReadBlob = (blob: Blob, start?: number, end?: number) => Uint8Array;
const readSync: ReadBlob = (b, s, e) => new Uint8Array(new FileReaderSync().readAsArrayBuffer(b.slice(s, e)));

/**
 * Export storage over files picked in the browser, keyed by their path inside
 * the picked folder (`File.webkitRelativePath`). Directories are implied by paths.
 */
export function fileSource(files: Iterable<[path: string, blob: Blob]>, read: ReadBlob = readSync): ExportSource {
  const blobs = new Map<string, Blob>();
  const kids = new Map<string, Map<string, boolean>>([["", new Map()]]);
  for (const [path, blob] of files) {
    let rel: string;
    try {
      rel = normRel(path);
    } catch {
      continue; // a browser never hands us these; skip rather than trust them
    }
    if (!rel) continue;
    const parts = rel.split("/");
    let dir = "";
    parts.forEach((name, i) => {
      const isDir = i < parts.length - 1;
      kids.get(dir)!.set(name, isDir);
      dir = dir ? `${dir}/${name}` : name;
      if (isDir && !kids.has(dir)) kids.set(dir, new Map());
    });
    blobs.set(rel, blob);
  }
  const blob = (rel: string) => {
    const b = blobs.get(rel);
    if (!b) throw new Error(`not a file: ${rel}`);
    return b;
  };
  return {
    kind: (rel) => (blobs.has(rel) ? "file" : kids.has(rel) ? "dir" : undefined),
    list: (rel) => [...(kids.get(rel) ?? [])].map(([name, dir]) => ({ name, dir })),
    bytes: (rel, s, e) => read(blob(rel), s, e),
    byteLength: (rel) => blob(rel).size,
  };
}
