import { Handlers } from "$fresh/server.ts";
import { getUserById, updateUserAddonManagerSetting } from "../../../utils/db.ts";
import { AppState } from "../../_middleware.ts";

export const handler: Handlers<unknown, AppState> = {
  // Get addon manager setting
  async GET(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const user = await getUserById(userId);
      if (!user) {
        return new Response("User not found", { status: 404 });
      }

      return new Response(JSON.stringify({
        enabled: user.settings?.addonManagerEnabled || false
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Failed to get addon manager setting:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  // Update addon manager setting
  async PUT(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { enabled } = await req.json();
      
      if (typeof enabled !== 'boolean') {
        return new Response("Invalid enabled value", { status: 400 });
      }

      await updateUserAddonManagerSetting(userId, enabled);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Failed to update addon manager setting:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }
};