/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import { loadSync } from "$std/dotenv/mod.ts";
const envPath = `${Deno.cwd()}/.env`;
loadSync({ envPath, export: true });

import { start, FreshContext } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import { serveDir } from "$std/http/file_server.ts";

await start(manifest, {
  server: {
    port: 8000
  },
  plugins: [twindPlugin(twindConfig)],
  staticDir: "./app/static",
});