'use strict';

const VERSION = '%%APP_VERSION%%';
const CACHE_NAME = `zentrio-pwa-${VERSION}`;
console.error('[SW] Script loaded/evaluated');

const ASSETS = [
  '/static/offline.html',
  '/static/js/toast.js',
  '/static/css/styles.css',
  '/static/css/toast.css',
  '/static/logo/icon-192.png',
  '/static/logo/icon-512.png',
  '/static/logo/favicon/apple-touch-icon.png',
  '/static/logo/favicon/favicon-32x32.png',
  '/static/logo/favicon/favicon-16x16.png',
  '/static/logo/favicon/favicon.ico',
  '/static/site.webmanifest'
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

async function staleWhileRevalidate(request) {
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fetch(request);
  }

  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (_) {
    // Always return a Response so event.respondWith never receives undefined
    return cached || new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
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
    // Ensure a valid Response is always returned
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}

async function notifyClients(type, title, message) {
  try {
    const list = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const client of list) {
      if (type === 'zentrio-sw-toast') {
          client.postMessage({ type: 'zentrio-sw-toast', payload: { toastType: type, title, message } });
      } else if (type === 'zentrio-debug') {
          client.postMessage({ type: 'zentrio-debug', message });
      } else {
          // Generic message
          client.postMessage(message);
      }
    }
  } catch (_) {}
}

function log(msg) {
    console.log('[SW]', msg);
    notifyClients('zentrio-debug', null, msg);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

// Ignore extension and non-HTTP(S) schemes (e.g., chrome-extension://)
if (url.protocol !== 'http:' && url.protocol !== 'https:') {
  return;
}

// Bypass cross-origin requests to honor strict CSP (let the browser handle them)
if (url.origin !== self.location.origin) {
  return;
}

  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        return res;
      } catch {
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
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached || new Response('', { status: 504 })))
  );
});

self.addEventListener('message', (event) => {
  try {
      if (!event.data) return;
      const data = event.data;

      log(`Message received: ${data.type}`);

      if (data.type === 'zentrio-ping') {
          log('Pong!');
          notifyClients('zentrio-pong', null, { type: 'zentrio-pong' });
      } else if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
      }
  } catch (e) {
      console.error('[SW] Message handler error', e);
      notifyClients('zentrio-debug', null, `Message handler error: ${e.message}`);
  }
});
