import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(req) {
    const url = new URL(req.url);
    const proxyUrl = url.searchParams.get("url");

    if (!proxyUrl) {
      return new Response("Missing url parameter", { status: 400 });
    }

    try {
      const response = await fetch(proxyUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          "Connection": "keep-alive"
        }
      });

      if (!response.ok) {
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
          } finally {
            controller.close();
          }
        },
      });

      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Connection", "keep-alive");
      
      return new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(message, { status: 500 });
    }
  },
};