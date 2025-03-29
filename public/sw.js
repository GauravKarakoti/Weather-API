const CACHE_NAME = 'app-cache-v1';
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
];

// Install event: Cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return Promise.all(
                    CORE_ASSETS.map((url) =>
                        fetch(url).then((response) => {
                            if (!response.ok) throw new Error(`Failed to fetch ${url}`);
                            return cache.put(url, response);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
            .catch((error) => console.error('Cache addAll failed:', error))
    );
});


// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch event: Cache-first with network fallback
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;  // Return cached asset
                }
                return fetch(event.request)  // Fallback to network
                    .then((response) => {
                        // Cache fetched assets dynamically (optional)
                        if (event.request.method === 'GET' && response.status === 200) {
                            return caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, response.clone());
                                    return response;
                                });
                        }
                        return response;
                    });
            })
            .catch(() => {
                // Fallback for offline pages (optional)
                return caches.match('/index.html');
            })
    );
});

// Periodic cache update (every 24 hours)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-cache') {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then((cache) => {
                    return Promise.all(
                        CORE_ASSETS.map((url) =>
                            fetch(url)
                                .then((response) => cache.put(url, response))
                        )
                    );
                })
        );
    }
});
