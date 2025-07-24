import { Handlers } from "$fresh/server.ts";
import { AppState } from "../_middleware.ts";
import { updateUserHideCalendarButtonSetting, getUserById } from "../../utils/db.ts";

export const handler: Handlers<null, AppState> = {
  // Get hide calendar button setting
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
        hideCalendarButton: user.settings?.hideCalendarButton || false
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Failed to get hide calendar button setting:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  // Update hide calendar button setting
  async PUT(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { hideCalendarButton } = await req.json();
      
      if (typeof hideCalendarButton !== 'boolean') {
        return new Response("Invalid hideCalendarButton value", { status: 400 });
      }

      await updateUserHideCalendarButtonSetting(userId, hideCalendarButton);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Failed to update hide calendar button setting:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }
};
