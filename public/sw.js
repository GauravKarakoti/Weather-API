const CACHE_VERSION = `app-cache-v${new Date().toISOString().slice(0, 10)}`;
const CORE_ASSETS = ["/", "/index.html", "/style.css", "/script.js"];

// Install event: Cache core assets with partial success
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.allSettled(
          CORE_ASSETS.map((url) =>
            fetch(url)
              .then((response) => {
                if (response.ok) cache.put(url, response);
              })
              .catch((error) => console.warn(`Failed to cache: ${url}`, error)),
          ),
        ),
      )
      .then(() => self.skipWaiting())
      .catch((error) => console.error("Cache addAll failed:", error)),
  );
});

// Activate event: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

// Fetch event: Cache-first with network fallback + dynamic caching
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then((response) => {
          if (event.request.method === "GET" && response.status === 200) {
            const cacheable =
              event.request.url.includes("/images/") ||
              event.request.url.includes("/fonts/");
            if (cacheable) {
              caches
                .open(CACHE_VERSION)
                .then((cache) => cache.put(event.request, response.clone()));
            }
          }
          return response;
        });
      })
      .catch(() => {
        if (event.request.destination === "image") {
          return caches.match("/fallback.png"); // Image fallback
        }
        return caches.match("/index.html"); // Default fallback
      }),
  );
});

// Periodic cache update (every 24 hours)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "update-cache") {
    event.waitUntil(
      caches
        .open(CACHE_VERSION)
        .then((cache) =>
          Promise.all(
            CORE_ASSETS.map((url) =>
              fetch(url).then((response) => cache.put(url, response)),
            ),
          ),
        ),
    );
  }
});
