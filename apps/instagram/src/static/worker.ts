/** Reads the picked export folder off the main thread (FileReaderSync only exists in workers). */
import { ExportDir, buildDatasets, fileSource, findRoot, subSource } from "@mev/core/export";
import { buildInstagram, IG_MARKERS } from "../../build/index.ts";

export type WorkerReply = { root: string; data: Record<string, unknown> } | { error: string };

self.onmessage = async (e: MessageEvent<File[]>) => {
  let reply: WorkerReply;
  try {
    const all = fileSource(e.data.map((f) => [f.webkitRelativePath || f.name, f] as [string, Blob]));
    const found = findRoot(all, IG_MARKERS);
    if ("error" in found) reply = { error: found.error };
    else {
      const ex = new ExportDir(subSource(all, found.root));
      reply = { root: found.root, data: await buildDatasets(ex, buildInstagram, "folder") };
    }
  } catch (err) {
    reply = { error: String((err as Error).message ?? err) };
  }
  self.postMessage(reply);
};
