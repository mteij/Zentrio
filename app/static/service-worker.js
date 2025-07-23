const CACHE_NAME = "zentrio-cache-v1";
const ASSETS = [
  "/",
  "/static/styles.css",
  "/static/css/background.css",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/manifest.json",
  // Add more assets as needed
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Try to add all assets, but skip any that fail
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          // Ignore missing files or network errors
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (
            response.status === 200 &&
            response.type === "basic" &&
            event.request.url.startsWith(self.location.origin)
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Always return a valid Response object, fallback to a minimal offline page
          return new Response(
            "<h1>Offline</h1><p>This page is not available offline.</p>",
            { headers: { "Content-Type": "text/html" }, status: 503 }
          );
        });
    })
  );
});
