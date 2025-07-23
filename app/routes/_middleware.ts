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
  const isEmbeddableRoute = isPlayerRoute || isRootRoute || url.pathname.startsWith('/profiles');
  
  // Skip adding security headers for /stremio/ routes as they handle their own
  if (!isStremioProxyRoute) {
    const allowFraming = isEmbeddableRoute;
    const allowCORS = isEmbeddableRoute;
    
    // Add security headers to all responses except Stremio proxy routes
    const securityHeaders = sessionSecurity.createSecurityHeaders(allowFraming, allowCORS);
    
    // Security headers configured based on route type
    
    for (const [key, value] of Object.entries(securityHeaders)) {
      // If we're allowing framing, don't set any frame-blocking headers
      if (allowFraming && (key === 'X-Frame-Options' || key.toLowerCase() === 'x-frame-options')) {
        continue;
      }
      response.headers.set(key, value);
    }
    
    // If allowing framing, aggressively remove any frame-blocking headers that might exist
    if (allowFraming) {
      response.headers.delete('X-Frame-Options');
      response.headers.delete('x-frame-options');
      
      // Ensure we have the most permissive CSP for framing
      response.headers.set('Content-Security-Policy', 
        "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; " +
        "img-src * data: blob:; font-src *; connect-src *; media-src * blob:; object-src *; " +
        "frame-src *; frame-ancestors *; worker-src * blob:; child-src *; manifest-src *;"
      );
    }
  }
  
  return response;
}