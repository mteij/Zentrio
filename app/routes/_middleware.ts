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
  
  // Add security headers to all responses
  const securityHeaders = sessionSecurity.createSecurityHeaders();
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  
  return response;
}