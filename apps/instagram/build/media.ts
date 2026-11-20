import { basename, type ExportDir } from "@mev/core/export";

export const VIDEO = /\.(mp4|mov|webm|m4v)$/i;

export const mediaUrl = (rel: string) => "/export/" + rel.split("/").map(encodeURIComponent).join("/");

/**
 * Media URIs are relative to the export root; older exports sometimes put files
 * in dated subfolders the JSON doesn't mention, so fall back to a basename index.
 */
export function makeResolver(ex: ExportDir) {
  let byName: Map<string, string> | undefined;
  const missing: string[] = [];
  return (uri: string | undefined): string | undefined => {
    if (!uri) return undefined;
    if (/^https?:/i.test(uri)) return undefined;
    const clean = uri.replace(/^\/+/, "");
    if (ex.exists(clean)) return clean;
    byName ??= new Map([...ex.walk("media")].map((p) => [basename(p), p]));
    const hit = byName.get(basename(clean));
    if (!hit && missing.push(clean) <= 5) ex.warn(`media file missing: ${clean}`);
    return hit;
  };
}

