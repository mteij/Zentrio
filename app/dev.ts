#!/usr/bin/env -S deno run -A --unstable-kv --watch=static/,routes/

import dev from "$fresh/dev.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import "jsr:@std/dotenv/load";

await dev(import.meta.url, "./main.ts", {
    server: {
    port: 8000
  },
  plugins: [twindPlugin(twindConfig)],
});