/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import { loadSync } from "$std/dotenv/mod.ts";
const envPath = `${Deno.cwd()}/.env`;
loadSync({ envPath, export: true }); // Do not allow empty values

import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import { serveDir } from "$std/http/file_server.ts";

await start(manifest, {
  plugins: [twindPlugin(twindConfig)],
  // Add a custom handler to serve static files from /app/static
  handler: (req, ctx) => {
    const url = new URL(req.url);
    if (url.pathname === "/static/service-worker.js") {
      // Always serve service worker with correct headers
      return serveDir(req, {
        fsRoot: `${Deno.cwd()}/app/static`,
        urlRoot: "/static",
        // Set correct content type for service worker
        headers: {
          "Content-Type": "application/javascript",
          "Service-Worker-Allowed": "/",
        },
      });
    }
    if (url.pathname.startsWith("/static/")) {
      // Serve from app/static
      return serveDir(req, {
        fsRoot: `${Deno.cwd()}/app/static`,
        urlRoot: "/static",
      });
    }
    return ctx.next();
  },
});