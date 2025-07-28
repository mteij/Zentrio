import { Handlers } from "$fresh/server.ts";
import { AppState } from "../../_middleware.ts";
import { setUserDownloadsEnabled, getUserDownloadsEnabled } from "../../../utils/db.ts";

export const handler: Handlers<any, AppState> = {
  async GET(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const enabled = await getUserDownloadsEnabled(userId);
    return new Response(JSON.stringify({ enabled }));
  },
  async PUT(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const { enabled } = await req.json();
    await setUserDownloadsEnabled(userId, enabled);
    return new Response(JSON.stringify({ success: true }));
  },
};