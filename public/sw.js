const CACHE = 'newanki-shell-v2';
const OFFLINE = '/offline.html';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png', OFFLINE];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('newanki-') && key !== CACHE).map(key => caches.delete(key)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          void caches.open(CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')) || caches.match(OFFLINE)),
    );
    return;
  }

  const cacheable = request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image' || url.pathname === '/manifest.webmanifest';
  if (!cacheable) return;
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        const copy = response.clone();
        void caches.open(CACHE).then(cache => cache.put(request, copy));
        return response;
      });
      return cached || network;
    }),
  );
});
