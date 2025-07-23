#!/usr/bin/env -S deno run -A --unstable-kv --watch=static/,routes/

import dev from "$fresh/dev.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import { loadSync } from "$std/dotenv/mod.ts";
import { serveDir } from "$std/http/file_server.ts";

const envPath = `${Deno.cwd()}/.env`;
loadSync({ envPath, export: true }); // Do not allow empty values

await dev(import.meta.url, "./main.ts", {
  plugins: [twindPlugin(twindConfig)],
  // Add static file handler for development
  handler: (req, ctx) => {
    const url = new URL(req.url);
    
    // Serve static files at root level (e.g., /styles.css, /manifest.json)
    if (url.pathname === "/styles.css" || 
        url.pathname === "/manifest.json" || 
        url.pathname === "/service-worker.js" ||
        url.pathname.startsWith("/css/") ||
        url.pathname.startsWith("/icons/")) {
      return serveDir(req, {
        fsRoot: `${Deno.cwd()}/app/static`,
        urlRoot: "/",
      });
    }
    
    return ctx.next();
  },
});