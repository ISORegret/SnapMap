// Root-level SW: always fetch from network so / serves the landing page.
// Replaces any legacy SW that cached the app at root.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (e) {
  e.respondWith(fetch(e.request));
});
