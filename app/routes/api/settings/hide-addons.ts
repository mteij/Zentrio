import { Handlers } from "$fresh/server.ts";
import { AppState } from "../../_middleware.ts";
import { updateUserHideAddonsButtonSetting, getUserById } from "../../../utils/db.ts";

export const handler: Handlers<null, AppState> = {
  // Get hide addons button setting
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
        hideAddonsButton: user.settings?.hideAddonsButton || false
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Failed to get hide addons button setting:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  // Update hide addons button setting
  async PUT(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { hideAddonsButton } = await req.json();
      
      if (typeof hideAddonsButton !== 'boolean') {
        return new Response("Invalid hideAddonsButton value", { status: 400 });
      }

      await updateUserHideAddonsButtonSetting(userId, hideAddonsButton);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Failed to update hide addons button setting:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }
};