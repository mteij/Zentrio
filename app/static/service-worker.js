const CACHE_NAME = "stremiohub-cache-v1";
const ASSETS = [
  "/static/styles.css",
  "/static/css/background.css",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  // Add more assets as needed
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Only add assets that exist and can be fetched successfully
      await Promise.all(
        ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "no-store" });
            if (
              response.ok &&
              response.type !== "opaqueredirect" &&
              !response.redirected &&
              response.status === 200
            ) {
              await cache.put(url, response);
            } else {
              // eslint-disable-next-line no-console
              console.warn("Service worker: Skipped caching (not found or redirected):", url);
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Service worker: Failed to cache:", url, e);
          }
        })
      );
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
  if (event.request.method !== "GET") return;

  // For navigation requests (like "/"), always fetch from network
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache redirects or non-200 responses
          if (
            response &&
            response.status === 200 &&
            response.type === "basic" &&
            !response.redirected
          ) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          }
          return response;
        })
        .catch(() => caches.match("/static/styles.css")) // fallback to a static asset if needed
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === "basic" &&
            !response.redirected
          ) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          }
          return response;
        })
        .catch(() => {
          // Optionally, return a fallback asset here
          return caches.match("/static/styles.css");
        });
    })
  );
});
