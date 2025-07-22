#!/usr/bin/env -S deno run -A --unstable-kv --watch=static/,routes/

import dev from "$fresh/dev.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import { load } from "$std/dotenv/mod.ts";

// Load environment variables from .env file in the parent directory
const env = await load({ envPath: "../.env" });
for (const [key, value] of Object.entries(env)) {
  Deno.env.set(key, value);
}

await dev(import.meta.url, "./main.ts", {
  plugins: [twindPlugin(twindConfig)],
});
