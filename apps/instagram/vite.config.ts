import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { metaExport, resolveExportDir } from "@mev/core/node";
import { buildInstagram, IG_MARKERS } from "./build/index.ts";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { dir, source } = resolveExportDir({
  env: process.env.META_EXPORT,
  dropZone: path.join(repo, "exports/instagram"),
  fixture: path.join(repo, "fixtures/instagram-sample"),
  markers: IG_MARKERS,
});

export default defineConfig({
  plugins: [vue(), metaExport({ dir, source, build: buildInstagram })],
  // Local only: bind to loopback so the export is never exposed on the network.
  server: { host: "127.0.0.1", port: 5173, fs: { allow: [repo] } },
  preview: { host: "127.0.0.1" },
});
