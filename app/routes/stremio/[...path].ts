import { Handlers } from "$fresh/server.ts";

const STREMIO_BASE_URL = "https://web.stremio.com/";
const STREMIO_API_URL = "https://api.stremio.com/";
const API_PATHS = ["/login", "/login/v2", "/logout", "/register"];

const proxyRequestHandler = async (req: Request, path: string) => {
  const stremioPath = `/${path}`;
  const isApiCall = API_PATHS.some((p) => stremioPath.startsWith(p));
  const baseUrl = isApiCall ? STREMIO_API_URL : STREMIO_BASE_URL;
  const targetUrl = new URL(stremioPath, baseUrl);

  const body = req.method === "POST" ? await req.blob() : null;

  try {
    const requestHeaders = new Headers({
      "User-Agent": "StremioHub-Deno-Proxy/1.0",
      "Accept": req.headers.get("Accept") || "*/*",
      "Content-Type": req.headers.get("Content-Type") || "application/json",
    });

    if (req.headers.has("Authorization")) {
      requestHeaders.set("Authorization", req.headers.get("Authorization")!);
    }

    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers: requestHeaders,
      body: body,
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

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
  OPTIONS(_req, _ctx) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  },
};
