import { Handlers } from "$fresh/server.ts";

const STREMIO_WEB_URL = "https://web.stremio.com/";
const STREMIO_API_URL = "https://api.strem.io/";

const proxyRequestHandler = async (req: Request, path: string) => {
  const stremioPath = `/${path || ""}`;
  // Determine the target URL based on the path
  const isApiCall = stremioPath.startsWith("/api/");
  const baseUrl = isApiCall ? STREMIO_API_URL : STREMIO_WEB_URL;
  const targetUrl = new URL(stremioPath, baseUrl);

  // A HEAD request cannot have a body.
  const body = req.method === "HEAD" ? null : (req.method === "POST" || req.method === "PUT" ? await req.blob() : null);

  try {
    // --- Unrestrictive Header Forwarding ---
    // Clone all headers from the original request.
    const requestHeaders = new Headers(req.headers);
    // The only header we MUST change is Host to match the target.
    requestHeaders.set("Host", new URL(baseUrl).host);

    // To prevent 304 Not Modified responses, which can interfere with our login flow,
    // we remove caching headers. This forces Stremio to send a fresh response.
    requestHeaders.delete("if-modified-since");
    requestHeaders.delete("if-none-match");

    console.log(`[PROXY] Requesting ${req.method} ${targetUrl.href}`);
    // console.log("[PROXY] Forwarding request headers:", Object.fromEntries(requestHeaders.entries()));

    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers: requestHeaders,
      body: body,
      redirect: "manual", // Handle redirects manually
    });

    console.log(`[PROXY] Received ${response.status} from ${targetUrl.href}`);
    // console.log("[PROXY] Received response headers:", Object.fromEntries(response.headers.entries()));

    // Handle redirects by rewriting the Location header
    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      const location = response.headers.get("location")!;
      const newLocation = location.replace(STREMIO_WEB_URL, "/stremio/");
      const headers = new Headers(response.headers);
      headers.set("location", newLocation);
      return new Response(null, { status: response.status, headers });
    }

    // --- Unrestrictive CORS Headers ---
    // Clone all headers from the original response.
    const responseHeaders = new Headers(response.headers);
    // Set the most permissive CORS headers possible.
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Credentials", "true");
    const requestHeadersHeader = req.headers.get("Access-Control-Request-Headers");
    if (requestHeadersHeader) {
      responseHeaders.set("Access-Control-Allow-Headers", requestHeadersHeader);
    }

    // Remove Content-Security-Policy to allow our script injection to work.
    responseHeaders.delete("content-security-policy");

    // Rewrite Set-Cookie headers to remove the Domain attribute
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      // Deno's fetch combines set-cookie headers with ", ". We need to handle this.
      const cookies = setCookieHeader.split(/,(?=[^;]+=[^;]+;)/g);
      responseHeaders.delete("set-cookie");
      for (const cookie of cookies) {
        let rewrittenCookie = cookie.trim()
          .replace(/; domain=[^;]+(?=;|$)/gi, "")
          .replace(/; samesite=(strict|lax|none)(?=;|$)/gi, "");
        
        // If the request to our server is not secure, we must remove the Secure flag
        if (new URL(req.url).protocol !== "https:") {
          rewrittenCookie = rewrittenCookie.replace(/; secure/gi, "");
        }

        responseHeaders.append("set-cookie", rewrittenCookie);
      }
    }

    // Do not attempt to read the body for HEAD requests.
    if (req.method === "HEAD") {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    // If the response is HTML, inject a <base> tag to fix relative paths
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      let body = await response.text();
      // Inject the base tag right after the <head> tag.
      // This ensures all relative paths on the page are resolved from /stremio/
      body = body.replace(/<head[^>]*>/i, `$&<base href="/stremio/">`);

      // Check if sessionData was passed for injection
      const url = new URL(req.url);
      const sessionData = url.searchParams.get("sessionData");
      if (sessionData) {
        // The data is a URL-encoded JSON string. We decode it and inject it.
        const decodedSessionData = decodeURIComponent(sessionData);
        const injectionScript = `
          <script>
            // This script runs before Stremio's own scripts to set up the session.
            try {
              const session = JSON.parse(\`${decodedSessionData.replace(/`/g, "\\`")}\`);
              // Iterate over the session object and set each key in localStorage.
              // Stremio expects some values to be JSON.stringified (like strings), and others not (like numbers).
              for (const key in session) {
                const value = session[key];
                if (typeof value === 'object') {
                  localStorage.setItem(key, JSON.stringify(value));
                } else if (typeof value === 'string') {
                  // Strings like authKey and installation_id must be stored as JSON strings (i.e., with quotes).
                  localStorage.setItem(key, JSON.stringify(value));
                } else {
                  // Numbers like schema_version are stored as plain strings.
                  localStorage.setItem(key, value);
                }
              }
              // Clean the URL in the browser's history.
              history.replaceState(null, '', '/stremio/');
            } catch (e) {
              console.error('StremioHub: Failed to inject session.', e);
            }
          </script>
        `;
        // Inject the script at the beginning of the head.
        body = body.replace(/<head[^>]*>/i, `$&${injectionScript}`);
      }

      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    const errorMessage = typeof error === "object" && error !== null && "message" in error
      ? (error as { message: string }).message
      : String(error);
    return new Response(`Proxy error: ${errorMessage}`, { status: 502 });
  }
};

export const handler: Handlers = {
  async GET(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  async POST(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  async PUT(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  async DELETE(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  async HEAD(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  OPTIONS(req, _ctx) {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, HEAD, OPTIONS",
      "Access-Control-Allow-Credentials": "true",
    });
    // Allow whatever headers the client is asking for.
    const requestedHeaders = req.headers.get("Access-Control-Request-Headers");
    if (requestedHeaders) {
      headers.set("Access-Control-Allow-Headers", requestedHeaders);
    }
    
    return new Response(null, {
      status: 204,
      headers: headers,
    });
  },
};