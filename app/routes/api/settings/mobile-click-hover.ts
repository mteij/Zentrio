import { Handlers } from "$fresh/server.ts";
import { AppState } from "../../_middleware.ts";
import { updateUserMobileClickToHoverSetting, getUserById } from "../../../utils/db.ts";

export const handler: Handlers<null, AppState> = {
  // Get mobile click to hover setting
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
        mobileClickToHover: user.settings?.mobileClickToHover || false
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Failed to get mobile click to hover setting:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  // Update mobile click to hover setting
  async PUT(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { mobileClickToHover } = await req.json();
      
      if (typeof mobileClickToHover !== 'boolean') {
        return new Response("Invalid mobileClickToHover value", { status: 400 });
      }

      await updateUserMobileClickToHoverSetting(userId, mobileClickToHover);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Failed to update mobile click to hover setting:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }
};