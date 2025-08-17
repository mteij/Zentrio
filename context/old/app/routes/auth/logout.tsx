import { Handlers } from "$fresh/server.ts";
import { deleteCookie } from "$std/http/cookie.ts";

export const handler: Handlers = {
  GET(_req) {
    const headers = new Headers();
    deleteCookie(headers, "sessionId", { path: "/" });
    headers.set("location", "/auth/login");
    return new Response(null, {
      status: 307,
      headers,
    });
  },
};
