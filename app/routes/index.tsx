import { Handlers, PageProps as _PageProps } from "$fresh/server.ts";
import { AppState } from "./_middleware.ts";

export const handler: Handlers<null, AppState> = {
  GET(_req, ctx) {
    const { userId } = ctx.state;
    const headers = new Headers();

    // Redirect to profiles if logged in, otherwise to login page
    headers.set("location", userId ? "/profiles" : "/login");
    return new Response(null, {
      status: 307, // Use 307 for temporary redirect
      headers,
    });
  },
};