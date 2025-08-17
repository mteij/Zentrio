import { Handlers } from "$fresh/server.ts";
import { AppState } from "../_middleware.ts";
import { 
  getUserActiveSessions, 
  invalidateSession, 
  invalidateAllUserSessions,
  cleanupExpiredSessions 
} from "../../utils/db.ts";

export const handler: Handlers<null, AppState> = {
  /**
   * Get all active sessions for the current user
   */
  async GET(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const sessions = await getUserActiveSessions(userId);
      
      // Return sanitized session data (no sensitive info)
      const sanitizedSessions = sessions.map(session => ({
        id: (session as { _id: { toString(): string } })._id.toString(),
        createdAt: (session as { createdAt: Date }).createdAt,
        lastActivity: (session as { lastActivity: Date }).lastActivity,
        ipAddress: (session as { ipAddress?: string }).ipAddress ?
          (session as { ipAddress: string }).ipAddress.replace(/\.\d+$/, '.***') : // Mask last octet
          'Unknown',
        userAgent: (session as { userAgent?: string }).userAgent ?
          (session as { userAgent: string }).userAgent.slice(0, 100) + '...' : // Truncate user agent
          'Unknown',
        isCurrentSession: false // Will be determined client-side
      }));

      return new Response(JSON.stringify({
        sessions: sanitizedSessions,
        total: sanitizedSessions.length
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  /**
   * Invalidate specific session or all sessions
   */
  async DELETE(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get('sessionId');
      const all = url.searchParams.get('all') === 'true';

      if (all) {
        // Invalidate all sessions for the user
        await invalidateAllUserSessions(userId);
        
        return new Response(JSON.stringify({
          success: true,
          message: "All sessions invalidated successfully"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } else if (sessionId) {
        // Invalidate specific session
        await invalidateSession(sessionId);
        
        return new Response(JSON.stringify({
          success: true,
          message: "Session invalidated successfully"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } else {
        return new Response(JSON.stringify({
          error: "Missing sessionId or all parameter"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    } catch (error) {
      console.error('Error invalidating sessions:', error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  /**
   * Cleanup expired sessions (admin endpoint)
   */
  async POST(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const body = await req.json();
      
      if (body.action === 'cleanup') {
        const cleanedCount = await cleanupExpiredSessions();
        
        return new Response(JSON.stringify({
          success: true,
          message: `Cleaned up ${cleanedCount} expired sessions`
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        error: "Invalid action"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error('Error in session management:', error);
      return new Response("Internal server error", { status: 500 });
    }
  }
};