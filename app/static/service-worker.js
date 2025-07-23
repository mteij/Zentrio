const CACHE_NAME = "zentrio-pwa-v1";
const STATIC_ASSETS = [
  "/static/styles.css",
  "/static/css/background.css",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/manifest.json",
  // ...add more static assets if needed, but do not include "/"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          // Ignore individual asset failures to avoid breaking the install
          // Optionally, log: console.warn("SW failed to cache:", asset, e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            // Only cache successful (status 200) and basic (same-origin) responses
            if (
              response &&
              response.status === 200 &&
              response.type === "basic"
            ) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => {
            // Always return a valid Response object with a string body and headers
            return new Response("Network error", {
              status: 408,
              statusText: "Network Error",
              headers: { "Content-Type": "text/plain" },
            });
          });
      }).catch(() => {
        // In case caches.match itself fails, return a fallback response
        return new Response("Network error", {
          status: 408,
          statusText: "Network Error",
          headers: { "Content-Type": "text/plain" },
        });
      })
    );
  }
});
