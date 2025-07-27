import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET: (req) => {
    const url = new URL(req.url);
    const orientation = url.searchParams.get("orientation") || "auto";

    const manifest = {
      "name": "Zentrio",
      "short_name": "Zentrio",
      "start_url": "/",
      "display": "standalone",
      "background_color": "#000000",
      "theme_color": "#dc2626",
      "orientation": orientation,
      "icons": [
        {
          "src": "/icons/icon-192.png",
          "type": "image/png",
          "sizes": "192x192"
        },
        {
          "src": "/icons/icon-512.png",
          "type": "image/png",
          "sizes": "512x512"
        }
      ]
    };

    return new Response(JSON.stringify(manifest), {
      headers: { "Content-Type": "application/manifest+json" },
    });
  },
};