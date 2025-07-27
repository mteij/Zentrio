import { Handlers } from "$fresh/server.ts";
import { serveDir } from "$std/http/file_server.ts";

export const handler: Handlers = {
  GET(req, ctx) {
    return serveDir(req, {
      fsRoot: "app/shared/scripts",
      urlRoot: "scripts",
    });
  },
};