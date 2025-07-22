/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import { loadSync } from "$std/dotenv/mod.ts";

console.log("--- Running main.ts ---");
// Load environment variables from .env file in the parent directory
loadSync({ envPath: "../.env", export: true });

import "./utils/mongo.ts"; // Establish MongoDB connection

import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";

await start(manifest, { plugins: [twindPlugin(twindConfig)] });
