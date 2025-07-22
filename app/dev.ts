#!/usr/bin/env -S deno run -A --unstable-kv --watch=static/,routes/

import dev from "$fresh/dev.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import { loadSync } from "$std/dotenv/mod.ts";

// Load environment variables for the development server process.
console.log("dev.ts: Loading environment variables...");
loadSync({ envPath: "../.env", export: true });

// The main.ts file is the single entry point for the application.
// It is also responsible for loading environment variables for the runtime context.
await dev(import.meta.url, "./main.ts", {
  plugins: [twindPlugin(twindConfig)],
});
