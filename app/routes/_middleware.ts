import { FreshContext } from "$fresh/server.ts";
import { getCookies } from "$std/http/cookie.ts";
import { getSession } from "../utils/db.ts";
import { sessionSecurity } from "../shared/services/sessionSecurity.ts";

export interface AppState {
  userId: string | null;
}

export async function handler(
  req: Request,
  ctx: FreshContext<AppState>,
) {
  const { sessionId } = getCookies(req.headers);
  ctx.state.userId = null;

  if (sessionId) {
    try {
      // Pass request for security validation
      const session = await getSession(sessionId, req);
      if (session && new Date() < session.expiresAt) {
        ctx.state.userId = session.userId.toString();
      }
    } catch (error) {
      console.error('Session validation error:', error);
      // Don't expose error details to client
    }
  }

  const response = await ctx.next();
  
  // Determine security policy based on route
  const url = new URL(req.url);
  const isStremioProxyRoute = url.pathname.startsWith('/stremio/');
  const isPlayerRoute = url.pathname.startsWith('/player');
  const isRootRoute = url.pathname === '/';
  
  // Skip adding security headers for /stremio/ routes as they handle their own
  if (!isStremioProxyRoute) {
    const allowFraming = isPlayerRoute || isRootRoute;
    const allowCORS = isPlayerRoute || isRootRoute;
    
    // Add security headers to all responses except Stremio proxy routes
    const securityHeaders = sessionSecurity.createSecurityHeaders(allowFraming, allowCORS);
    for (const [key, value] of Object.entries(securityHeaders)) {
      response.headers.set(key, value);
    }
  }
  
  return response;
}