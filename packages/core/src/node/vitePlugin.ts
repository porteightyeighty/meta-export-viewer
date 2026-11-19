import fs from "node:fs";
import type { Plugin, ViteDevServer } from "vite";
import sirv from "sirv";
import { ExportDir, consoleLogger } from "./exportFs.ts";

export type DataSet = Record<string, unknown>;

export interface MetaExportOptions {
  /** Absolute path of the export root (already resolved). */
  dir: string;
  /** Where the dir came from — shown in the UI so a demo isn't mistaken for real data. */
  source?: string;
  /** Map the raw export to named JSON datasets served at /api/data/<name>.json. */
  build: (ex: ExportDir) => DataSet | Promise<DataSet>;
}

/**
 * Dev-server plugin: builds datasets from the export in Node, serves them from
 * memory, and serves the export's media read-only at /export/*. Nothing is
 * written to disk and nothing leaves localhost.
 */
export function metaExport(opts: MetaExportOptions): Plugin {
  let data: DataSet = {};
  let building: Promise<void> | undefined;

  const rebuild = async () => {
    const started = Date.now();
    const ex = new ExportDir(opts.dir, consoleLogger);
    ex.info(`reading ${opts.source ?? "export"}: ${opts.dir}`);
    try {
      data = await opts.build(ex);
      data.meta = { source: opts.source ?? "export", warnings: ex.warnings, builtAt: Date.now() };
      ex.info(`built ${Object.keys(data).length} datasets in ${Date.now() - started}ms`);
    } catch (e) {
      ex.warn(`build failed: ${(e as Error).stack ?? e}`);
      data = { meta: { source: opts.source, warnings: ex.warnings, error: String((e as Error).message ?? e) } };
    }
  };

  return {
    name: "meta-export",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      building = rebuild();
      const media = sirv(opts.dir, { dev: true, dotfiles: false, etag: true });

      server.middlewares.use("/export", (req, res, next) => media(req, res, next));
      server.middlewares.use("/api/data", async (req, res) => {
        await building;
        const name = decodeURIComponent((req.url ?? "").replace(/^\//, "").replace(/\.json(\?.*)?$/, ""));
        if (!(name in data)) {
          res.statusCode = 404;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: `no dataset "${name}"` }));
          return;
        }
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify(data[name]));
      });

      watchJson(opts.dir, () => {
        building = rebuild().then(() => server.ws.send({ type: "full-reload" }));
      });
    },
  };
}

/** Rebuild when a .json file in the export changes (debounced). Media changes are served live anyway. */
function watchJson(dir: string, onChange: () => void) {
  let t: NodeJS.Timeout | undefined;
  try {
    const w = fs.watch(dir, { recursive: true }, (_ev, file) => {
      if (!file || !String(file).endsWith(".json")) return;
      clearTimeout(t);
      t = setTimeout(onChange, 300);
    });
    w.on("error", () => w.close());
  } catch {
    /* recursive watch unsupported: fine, restart the dev server to reload */
  }
}
