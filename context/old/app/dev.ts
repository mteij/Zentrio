#!/usr/bin/env -S deno run -A --unstable-kv --watch=app/static/,routes/

import dev from "$fresh/dev.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
import "jsr:@std/dotenv/load";
import { join } from "$std/path/mod.ts";

await dev(import.meta.url, "./main.ts", {
    server: {
    port: 8000
  },
  plugins: [twindPlugin(twindConfig)],
  staticDir: join(Deno.cwd(), "app", "static"),
});