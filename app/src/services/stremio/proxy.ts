import { join } from 'path'
import { promises as fs } from 'fs'

const STREMIO_API_URL = "https://api.strem.io/";

export const proxyRequestHandler = async (req: Request, path: string, _sessionData: string | null) => {
  const stremioPath = `/${path || ''}`;

  // Hard-limit this proxy to Stremio API calls only.
  if (!stremioPath.startsWith('/api/')) {
    return new Response('Stremio proxy only supports /api/* paths', { status: 400 });
  }

  const targetUrl = new URL(stremioPath, STREMIO_API_URL);
  const body =
    req.method === 'HEAD'
      ? null
      : (req.method === 'POST' || req.method === 'PUT'
          ? await req.blob()
          : null);

  try {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('Host', new URL(STREMIO_API_URL).host);
    requestHeaders.delete('if-modified-since');
    requestHeaders.delete('if-none-match');

    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers: requestHeaders,
      body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');
    const requestHeadersHeader = req.headers.get('Access-Control-Request-Headers');
    if (requestHeadersHeader) {
      responseHeaders.set('Access-Control-Allow-Headers', requestHeadersHeader);
    }

    // Relax CSP/X-Frame for proxied API responses; Stremio frontend controls framing & CSP.
    responseHeaders.delete('content-security-policy');
    responseHeaders.delete('Content-Security-Policy');
    responseHeaders.delete('x-frame-options');
    responseHeaders.delete('X-Frame-Options');
    responseHeaders.set(
      'Content-Security-Policy',
      "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "style-src * 'unsafe-inline' data: blob:; " +
        "img-src * data: blob:; " +
        "font-src * data:; " +
        "connect-src * data: blob:; " +
        "media-src * blob:; " +
        "object-src *; " +
        "child-src *; " +
        "frame-src *; " +
        "frame-ancestors *; " +
        "worker-src * blob:; " +
        "manifest-src *;"
    );

    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    responseHeaders.set('Pragma', 'no-cache');
    responseHeaders.set('Expires', '0');

    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      const cookies = setCookieHeader.split(/,(?=[^;]+=[^;]+;)/g);
      responseHeaders.delete('set-cookie');
      for (const cookie of cookies) {
        let rewrittenCookie = cookie
          .trim()
          .replace(/; domain=[^;]+(?=;|$)/gi, '')
          .replace(/; samesite=(strict|lax|none)(?=;|$)/gi, '');

        if (new URL(req.url).protocol !== 'https:') {
          rewrittenCookie = rewrittenCookie.replace(/; secure/gi, '');
        }

        responseHeaders.append('set-cookie', rewrittenCookie);
      }
    }

    if (req.method === 'HEAD') {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    const buffer = await response.arrayBuffer();
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('Content-Encoding');
    responseHeaders.delete('content-length');
    responseHeaders.delete('Content-Length');

    return new Response(buffer, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage =
      typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message: string }).message
        : String(error);
    return new Response(`Proxy error: ${errorMessage}`, { status: 502 });
  }
};
 
export const hasLocalStremioBuild = async (): Promise<boolean> => {
  try {
    const filePath = join(process.cwd(), 'data', 'stremio-web-build', 'index.html');
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};
 
/**
 * Serve the locally built Stremio Web index.html from data/stremio-web-build,
 * with session data injected for the build-time patches to consume.
 * The patches (bootstrap/addon manager/NSFW/downloads) are applied at build time.
 */
export const renderLocalStremioHtml = async (sessionData: string | null) => {
  try {
    const filePath = join(process.cwd(), 'data', 'stremio-web-build', 'index.html');
    let body = await fs.readFile(filePath, 'utf8');
 
    // Ensure a base href so that bundled assets resolve correctly under /stremio/
    body = body.replace(/<head[^>]*>/i, `$&<base href="/stremio/">`);
 
    if (sessionData) {
      // Inject session data as a hidden element that the build-time patched bootstrap code can read
      // This approach is cleaner than runtime script injection
      body = body.replace(
        /<head[^>]*>/i,
        `$&<script id="zentrio-session-data" type="application/json" data-session="${sessionData}"></script>`
      );
    }
 
    const headers = new Headers();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
 
    return new Response(body, { status: 200, headers });
  } catch (err) {
    console.error('Failed to serve local Stremio index.html', err);
    return new Response('Failed to load Stremio', { status: 500 });
  }
};
