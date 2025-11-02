'use strict';

const VERSION = '%%APP_VERSION%%';
const CACHE_NAME = `zentrio-pwa-${VERSION}`;
const ASSETS = [
  '/static/downloads-offline.html',
  '/static/offline.html',
  '/static/js/downloads.js',
  '/static/js/toast.js',
  '/static/css/styles.css',
  '/static/css/toast.css',
  '/static/logo/icon-192.png',
  '/static/logo/icon-512.png',
  '/static/logo/favicon/apple-touch-icon.png',
  '/static/logo/favicon/favicon-32x32.png',
  '/static/logo/favicon/favicon-16x16.png',
  '/static/logo/favicon/favicon.ico',
  '/static/logo/favicon/site.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('zentrio-pwa-') && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function staleWhileRevalidate(request) {
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fetch(request);
  }
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
}

async function networkFirst(request) {
  const url = new URL(request.url);
  try {
    const res = await fetch(request);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && res && res.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    throw e;
  }
}

async function notifyClients(type, title, message) {
  try {
    const list = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const client of list) {
      client.postMessage({ type: 'zentrio-sw-toast', payload: { toastType: type, title, message } });
    }
  } catch (_) {}
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

// Ignore extension and non-HTTP(S) schemes (e.g., chrome-extension://)
if (url.protocol !== 'http:' && url.protocol !== 'https:') {
  return;
}

  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        return res;
      } catch {
        if (url.pathname === '/downloads') {
          const cache = await caches.open(CACHE_NAME);
          const offline = await cache.match('/static/downloads-offline.html');
          if (offline) notifyClients('info', 'Offline', 'Downloads available offline.');
          return offline || new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match('/static/offline.html');
        if (fallback) notifyClients('info', 'Offline', 'You are offline.');
        return fallback || new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    })());
    return;
  }

  const dest = req.destination;
  if (['style', 'script', 'image', 'font'].includes(dest)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached))
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});