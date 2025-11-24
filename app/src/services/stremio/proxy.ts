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

    // Bun's fetch implementation might have issues with some streams or redirects
    // We need to ensure we handle redirects manually if needed, or let fetch handle it.
    // 'follow' is the default, but explicit is better.
    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers: requestHeaders,
      body,
      redirect: 'follow',
      // @ts-ignore - Bun specific option to disable decompression if needed,
      // but we want to handle it via headers.
      // However, for proxying, we might want to disable automatic decompression
      // to pass through the original stream if possible, but fetch usually decompresses.
      // The issue with 502 might be upstream connection closure or timeout.
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
        "media-src * blob: mediastream:; " +
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

    // For video streams and subtitles, we should stream the response body
    // instead of buffering it all in memory. This fixes issues with large files
    // and content decoding errors when the upstream server uses compression.
    // We also need to be careful about which headers we forward.
    
    // Remove headers that might cause issues with the response body stream
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('Content-Encoding');
    responseHeaders.delete('content-length');
    responseHeaders.delete('Content-Length');
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('Transfer-Encoding');

    // Ensure Range headers are forwarded correctly for video seeking
    if (response.status === 206) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    return new Response(response.body, {
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
    const filePath = join(process.cwd(), 'stremio-web-build', 'index.html');
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
    const filePath = join(process.cwd(), 'stremio-web-build', 'index.html');
    let body = await fs.readFile(filePath, 'utf8');
 
    // Ensure a base href so that bundled assets resolve correctly under /stremio/
    body = body.replace(/<head[^>]*>/i, `$&<base href="/stremio/">`);
 
    // Inject spa navigation script and downloads core
    // We inject downloads-core.js so that Stremio Web can handle downloads directly via OPFS
    // even when running as a top-level page.
    body = body.replace(
      /<head[^>]*>/i,
      `$&<script src="/static/js/spa-navigation.js"></script><script src="/static/js/downloads-core.js"></script>`
    );

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

    // Required for SharedArrayBuffer, which Stremio Web uses for its player (audio/video)
    // This enables software decoding for unsupported audio codecs (AC3, EAC3, DTS)
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'credentialless');

    return new Response(body, { status: 200, headers });
  } catch (err) {
    console.error('Failed to serve local Stremio index.html', err);
    
    // Fallback HTML when Stremio Web build is not available
    const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stremio Not Available - Zentrio</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #141414;
            color: #fff;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            text-align: center;
            max-width: 500px;
            padding: 2rem;
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #ff6b6b;
        }
        p {
            font-size: 1.1rem;
            margin-bottom: 2rem;
            opacity: 0.8;
        }
        a {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: #4a9eff;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            transition: background 0.2s;
        }
        a:hover {
            background: #357abd;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚠️ Stremio Not Available</h1>
        <p>The Stremio web interface could not be loaded. This might be due to a build issue or missing dependencies.</p>
        <p>You can still use Zentrio's profile management features.</p>
        <a href="/">Return to Zentrio Home</a>
    </div>
</body>
</html>`;
    
    const headers = new Headers();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    
    return new Response(fallbackHtml, { status: 200, headers });
  }
};
