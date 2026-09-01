/* Shell-only service worker: installable PWA without offline chat.
 * API and dynamic routes always hit the network. Push hooks can land later. */
const SHELL_CACHE = 'okhana-shell-v2';
const SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/brand/okhana-mark.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache API / auth — chat stays online-only.
  if (
    url.pathname.startsWith('/api/')
    || url.pathname.includes('/sign-in')
    || url.pathname.includes('/sign-up')
  ) {
    return;
  }

  // Navigation: network-first so locale/auth stay fresh.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)).then((response) => response),
    );
    return;
  }

  // Static shell icons/brand: cache-first.
  if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        return response;
      })),
    );
  }
});
