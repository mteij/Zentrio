import { Handlers } from "$fresh/server.ts";
import { AppState } from "../../_middleware.ts";
import { User } from "../../../utils/db.ts";
import { settingsRegistry } from "../../../shared/services/settings.ts";

export const handler: Handlers<unknown, AppState> = {
  async GET(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const key = ctx.params.key;
    const settingHandler = settingsRegistry[key];

    if (!settingHandler) {
      return new Response("Setting not found", { status: 404 });
    }

    try {
      const user = await User.findById(userId);
      if (!user) {
        return new Response("User not found", { status: 404 });
      }
      const value = await settingHandler.get(user);
      return new Response(JSON.stringify(value), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  async PUT(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const key = ctx.params.key;
    const settingHandler = settingsRegistry[key];

    if (!settingHandler) {
      return new Response("Setting not found", { status: 404 });
    }

    try {
      const { value } = await req.json();

      if (settingHandler.validate && !settingHandler.validate(value)) {
        return new Response("Invalid value", { status: 400 });
      }

      await settingHandler.set(userId, value);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);
      return new Response("Internal server error", { status: 500 });
    }
  },
};