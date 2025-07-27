/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import "jsr:@std/dotenv/load";
import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import { startSyncScheduler } from "./shared/services/syncScheduler.ts";

// Start the addon sync scheduler
startSyncScheduler();

await start(manifest, {
  server: {
    port: 8000
  },
  plugins: [twindPlugin(twindConfig)],
  staticDir: "./app/static",
});