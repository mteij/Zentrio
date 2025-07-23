import { Handlers } from "$fresh/server.ts";
import { AppState } from "../_middleware.ts";
import { setUserTmdbApiKey, getUserTmdbApiKey, removeUserTmdbApiKey } from "../../utils/db.ts";

export const handler: Handlers<null, AppState> = {
  /**
   * Get the current user's TMDB API key
   */
  async GET(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const apiKey = await getUserTmdbApiKey(userId);
      return new Response(JSON.stringify({ 
        hasApiKey: !!apiKey,
        // Never return the actual API key for security
        apiKey: apiKey ? '***' + apiKey.slice(-4) : null
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error('Error fetching TMDB API key:', error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  /**
   * Set or update the user's TMDB API key
   */
  async POST(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { apiKey } = await req.json();
      
      if (!apiKey || typeof apiKey !== 'string') {
        return new Response("Invalid API key", { status: 400 });
      }

      // Basic validation - TMDB API keys are typically 32 characters
      if (apiKey.length < 20 || apiKey.length > 50) {
        return new Response("Invalid API key format", { status: 400 });
      }

      await setUserTmdbApiKey(userId, apiKey);

      return new Response(JSON.stringify({ 
        success: true,
        message: "TMDB API key saved successfully"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error('Error saving TMDB API key:', error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  /**
   * Remove the user's TMDB API key
   */
  async DELETE(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      await removeUserTmdbApiKey(userId);

      return new Response(JSON.stringify({ 
        success: true,
        message: "TMDB API key removed successfully"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error('Error removing TMDB API key:', error);
      return new Response("Internal server error", { status: 500 });
    }
  },
};