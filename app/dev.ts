#!/usr/bin/env -S deno run -A --unstable-kv --watch=static/,routes/

import dev from "$fresh/dev.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import { loadSync } from "$std/dotenv/mod.ts";

console.log("--- Running dev.ts ---");
// Load environment variables from .env file in the parent directory
loadSync({ envPath: "../.env", export: true });
console.log("--- Environment variables loaded by dev.ts ---");

// Import mongo connection to ensure it runs on startup
import "./utils/mongo.ts";

await dev(import.meta.url, "./main.ts", {
  plugins: [twindPlugin(twindConfig)],
});
