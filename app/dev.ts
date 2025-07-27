#!/usr/bin/env -S deno run -A --unstable-kv --watch=static/,routes/

import dev from "$fresh/dev.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import { loadSync } from "$std/dotenv/mod.ts";

const envPath = `${Deno.cwd()}/.env`;
loadSync({ envPath, export: true }); // Do not allow empty values

await dev(import.meta.url, "./main.ts", {
    server: {
    port: 8000
  },
  plugins: [twindPlugin(twindConfig)],
});