/* Shell + Web Push service worker.
 * API and dynamic routes always hit the network. */
const SHELL_CACHE = 'okhana-shell-v3';
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

self.addEventListener('push', (event) => {
  let title = 'Okhana';
  let body = '';
  let url = '/dashboard';
  let tag = 'okhana-task';

  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data === 'object') {
      if (typeof data.title === 'string') title = data.title;
      if (typeof data.body === 'string') body = data.body;
      if (typeof data.url === 'string') url = data.url;
      if (typeof data.tag === 'string') tag = data.tag;
    }
  } catch {
    body = event.data ? event.data.text() : '';
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          void client.focus();
          if ('navigate' in client) {
            void client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
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

  if (
    url.pathname.startsWith('/api/')
    || url.pathname.includes('/sign-in')
    || url.pathname.includes('/sign-up')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)).then((response) => response),
    );
    return;
  }

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
