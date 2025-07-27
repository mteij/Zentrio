import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET: (req) => {
    const url = new URL(req.url);
    const orientation = url.searchParams.get("orientation") || "any";

    const manifest = {
      "name": "Zentrio",
      "short_name": "Zentrio",
      "description": "A beautiful, secure, Netflix-inspired profile management system for Stremio Web",
      "id": "/",
      "start_url": "/",
      "scope": "/",
      "display": "standalone",
      "background_color": "#000000",
      "theme_color": "#dc2626",
      "orientation": orientation,
      "lang": "en",
      "categories": ["entertainment", "utilities"],
      "launch_handler": {
        "client_mode": "navigate-existing"
      },
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
      ],
      "screenshots": [
        {
          "src": "/icons/icon-512.png",
          "sizes": "512x512",
          "type": "image/png",
          "form_factor": "wide"
        },
        {
          "src": "/icons/icon-512.png",
          "sizes": "512x512",
          "type": "image/png",
          "form_factor": "narrow"
        }
      ]
    };

    return new Response(JSON.stringify(manifest), {
      headers: { "Content-Type": "application/manifest+json" },
    });
  },
};