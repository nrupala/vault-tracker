/**
 * Sovereign Core v2.0 - Service Worker
 * Offline-first PWA: pre-caches the complete buildless asset graph, then serves
 * same-origin GETs stale-while-revalidate.
 */

const CACHE_NAME = 'sovereign-vault-v2-cache-2';
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './favicon.ico',
    './icon-192.png',
    './icon-512.png',
    './ui/SovereignApp.js',
    './ui/SovereignAppShell.js',
    './ui/SovereignCompanionHUD.js',
    './ui/SovereignRouter.js',
    './ui/SovereignVesselList.js',
    './ui/theme.css',
    './core/crypto.js',
    './core/db.js',
    './core/identity.js',
    './core/sync.js',
    './core/double-ratchet.js',
    './core/broker.js',
    './core/chat-db.js',
    './core/companion.js',
    './core/companion-engine.js',
    './core/intelligence.js',
    './core/personality.js',
    './core/scrubber.js',
    './core/voice.js',
    './core/sqlite3.js',
    './core/sqlite3.wasm'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

    // Stale-while-revalidate: serve cached instantly, refresh in background.
    event.respondWith(
        caches.match(req).then(cached => {
            const refresh = fetch(req).then(response => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
                }
                return response;
            }).catch(() => cached);
            return cached || refresh;
        })
    );
});