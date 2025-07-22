import { Handlers } from "$fresh/server.ts";

const STREMIO_WEB_URL = "https://web.stremio.com/";
const STREMIO_API_URL = "https://api.strem.io/";

const proxyRequestHandler = async (req: Request, path: string) => {
  const stremioPath = `/${path || ""}`;
  // Determine the target URL based on the path
  const isApiCall = stremioPath.startsWith("/api/");
  const baseUrl = isApiCall ? STREMIO_API_URL : STREMIO_WEB_URL;
  const targetUrl = new URL(stremioPath, baseUrl);

  const body = req.method === "POST" || req.method === "PUT" ? await req.blob() : null;

  try {
    const requestHeaders = new Headers(req.headers);
    // Make the proxy more transparent by cleaning up headers
    requestHeaders.set("Host", new URL(baseUrl).host);
    requestHeaders.set("Origin", baseUrl);
    requestHeaders.set("Referer", baseUrl);
    // Remove headers that might reveal the proxy or cause issues
    requestHeaders.delete("if-none-match");
    requestHeaders.delete("if-modified-since");

    console.log(`[PROXY] -> ${req.method} ${targetUrl.href}`);

    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers: requestHeaders,
      body: body,
      redirect: "manual", // Handle redirects manually
    });

    console.log(`[PROXY] <- ${response.status} ${response.statusText} from ${targetUrl.href}`);

    // Handle redirects by rewriting the Location header
    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      const location = response.headers.get("location")!;
      const newLocation = location.replace(STREMIO_WEB_URL, "/stremio/");
      const headers = new Headers(response.headers);
      headers.set("location", newLocation);
      return new Response(null, { status: response.status, headers });
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    // Dynamically allow requested headers, and always allow Range for video streaming
    const requestHeadersHeader = req.headers.get("Access-Control-Request-Headers") || "";
    responseHeaders.set("Access-Control-Allow-Headers", `${requestHeadersHeader}, Range`);

    // Rewrite Set-Cookie headers to remove the Domain attribute
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      // Deno's fetch combines set-cookie headers with ", ". We need to handle this.
      const cookies = setCookieHeader.split(/,(?=[^;]+=[^;]+;)/g);
      responseHeaders.delete("set-cookie");
      for (const cookie of cookies) {
        let rewrittenCookie = cookie.trim().replace(/; domain=[^;]+(?=;|$)/gi, "");
        
        // If the request to our server is not secure, we must remove the Secure flag
        if (new URL(req.url).protocol !== "https:") {
          rewrittenCookie = rewrittenCookie.replace(/; secure/gi, "");
        }

        responseHeaders.append("set-cookie", rewrittenCookie);
      }
    }

    // If the response is HTML, inject a <base> tag to fix relative paths
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      let body = await response.text();
      // Inject the base tag right after the <head> tag.
      // This ensures all relative paths on the page are resolved from /stremio/
      body = body.replace(/<head[^>]*>/i, `$&<base href="/stremio/">`);
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
  OPTIONS(req, _ctx) {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    });
    // Allow whatever headers the client is asking for, and always include Range.
    const requestedHeaders = req.headers.get("Access-Control-Request-Headers") || "";
    headers.set("Access-Control-Allow-Headers", `${requestedHeaders}, Range`);
    
    return new Response(null, {
      status: 204,
      headers: headers,
    });
  },
};