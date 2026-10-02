const CACHE_NAME = 'fidulync-v1';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, '/manifest.json', '/icon-192x192.png']))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => response || fetch(event.request))
    );
  }
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'FiduLync Update', body: 'Your transaction has been updated.' };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icon-192x192.png' }));
});
