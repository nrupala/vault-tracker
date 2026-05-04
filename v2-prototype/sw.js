const CACHE_NAME = 'sovereign-vault-v2-cache';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './favicon.ico',
  './ui/SovereignApp.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});
