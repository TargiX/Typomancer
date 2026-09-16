/**
 * App-shell service worker. The game must stay playable offline — the local
 * campaign fallback covers story generation, so only static assets need
 * caching. Navigations are network-first so a deploy never strands players on
 * a stale index.html; hashed Vite assets are stale-while-revalidate.
 * /api/ is never intercepted.
 */
const CACHE = 'typomancer-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
                    }
                    return response;
                })
                .catch(() => caches.match(request).then((hit) => hit || caches.match('/')))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((hit) => {
            const refresh = fetch(request).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            }).catch(() => hit || new Response('', {
                status: 503,
                statusText: 'Offline'
            }));
            return hit || refresh;
        })
    );
});
