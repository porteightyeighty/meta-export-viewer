/** Static site: read the picked folder in a worker, then serve its datasets and media from memory. */
import { fromMemory, resolveMedia, setDataProvider } from "@mev/core/client";
import { mediaUrl } from "../../build/media.ts";
import type { WorkerReply } from "./worker.ts";

export async function loadExport(files: File[]) {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const reply = await new Promise<WorkerReply>((resolve, reject) => {
    worker.onmessage = (e) => resolve(e.data);
    worker.onerror = (e) => reject(new Error(e.message || "the reader stopped unexpectedly"));
    worker.postMessage(files);
  }).finally(() => worker.terminate());
  if ("error" in reply) throw new Error(reply.error);

  // The build points media at /export/<path inside the export>; hand out the picked files instead.
  const prefix = reply.root ? reply.root + "/" : "";
  const byUrl = new Map<string, File>();
  for (const f of files) {
    const path = f.webkitRelativePath || f.name;
    if (path.startsWith(prefix)) byUrl.set(mediaUrl(path.slice(prefix.length)), f);
  }
  const made = new Map<string, string>();
  resolveMedia(reply.data, (s) => {
    const f = byUrl.get(s);
    if (!f) return undefined;
    if (!made.has(s)) made.set(s, URL.createObjectURL(f));
    return made.get(s);
  });
  setDataProvider(fromMemory(reply.data));
}
