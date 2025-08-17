import { getSessionScript } from './scripts/session'
import { getAddonManagerScript } from './scripts/addonManager'
import { getNsfwFilterScript } from './scripts/nsfwFilter'

const STREMIO_WEB_URL = "https://web.stremio.com/";
const STREMIO_API_URL = "https://api.strem.io/";

export const proxyRequestHandler = async (req: Request, path: string) => {
  const stremioPath = `/${path || ""}`;
  const isApiCall = stremioPath.startsWith("/api/");
  const baseUrl = isApiCall ? STREMIO_API_URL : STREMIO_WEB_URL;
  const targetUrl = new URL(stremioPath, baseUrl);

  const body = req.method === "HEAD" ? null : (req.method === "POST" || req.method === "PUT" ? await req.blob() : null);

  try {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("Host", new URL(baseUrl).host);
    requestHeaders.delete("if-modified-since");
    requestHeaders.delete("if-none-match");

    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers: requestHeaders,
      body: body,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      const location = response.headers.get("location")!;
      const newLocation = location.replace(STREMIO_WEB_URL, "/stremio/");
      const headers = new Headers(response.headers);
      headers.set("location", newLocation);
      return new Response(null, { status: response.status, headers });
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Credentials", "true");
    const requestHeadersHeader = req.headers.get("Access-Control-Request-Headers");
    if (requestHeadersHeader) {
      responseHeaders.set("Access-Control-Allow-Headers", requestHeadersHeader);
    }

    responseHeaders.delete("content-security-policy");
    responseHeaders.delete("Content-Security-Policy");
    responseHeaders.delete("x-frame-options");
    responseHeaders.delete("X-Frame-Options");

    responseHeaders.set("Content-Security-Policy",
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

    responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    responseHeaders.set("Pragma", "no-cache");
    responseHeaders.set("Expires", "0");

    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      const cookies = setCookieHeader.split(/,(?=[^;]+=[^;]+;)/g);
      responseHeaders.delete("set-cookie");
      for (const cookie of cookies) {
        let rewrittenCookie = cookie.trim()
          .replace(/; domain=[^;]+(?=;|$)/gi, "")
          .replace(/; samesite=(strict|lax|none)(?=;|$)/gi, "");

        if (new URL(req.url).protocol !== "https:") {
          rewrittenCookie = rewrittenCookie.replace(/; secure/gi, "");
        }

        responseHeaders.append("set-cookie", rewrittenCookie);
      }
    }

    if (req.method === "HEAD") {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      let body = await response.text();
      body = body.replace(/<head[^>]*>/i, `$&<base href="/stremio/">`);

      const url = new URL(req.url);
      const sessionData = url.searchParams.get("sessionData");
      if (sessionData) {
        const decodedSessionData = decodeURIComponent(sessionData);

        const sessionScript = getSessionScript(decodedSessionData);
        body = body.replace(/<head[^>]*>/i, `$&<script>${sessionScript}</script>`);

        const addonManagerScript = getAddonManagerScript();
        const nsfwFilterScript = getNsfwFilterScript();
        body = body.replace(/<\/head>/i, `<script>${addonManagerScript}</script><script>${nsfwFilterScript}</script>$&`);
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
