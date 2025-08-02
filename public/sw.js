// Use fixed app version (from package.json)
const CACHE_VERSION = 'app-cache-v1.0.0';
const CORE_ASSETS = ["/", "/index.html", "/style.css", "/script.js"];

// Install event: Cache core assets with partial success logging
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(
        CORE_ASSETS.map((url) =>
          fetch(url)
            .then((response) => {
              if (response.ok) return cache.put(url, response);
               // Clone response before caching
              const responseClone = response.clone(); 
              console.warn(`Skipped caching: ${url} - ${response.status}`);
            })
            .catch((err) =>
              console.warn(`Fetch failed for: ${url}`, err)
            )
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// Activate event: Remove outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

// Fetch event: Cache-first strategy, with network fallback and dynamic caching
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
         const clonedResponse = response.clone();
        if (
          event.request.method === "GET" &&
          response.status === 200 &&
          (event.request.url.includes("/images/") ||
           event.request.url.includes("/fonts/"))
        ) {
          caches.open(CACHE_VERSION).then((cache) =>
            cache.put(event.request, response.clone())
          );
        }
        return response;
      });
    }).catch(() => {
      if (event.request.destination === "image") {
        return caches.match("/fallback.png");
      }
      return caches.match("/index.html");
    })
  );
});

// Periodic Sync: Refresh dynamic content (not core assets)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "update-cache") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);

        const dynamicUrls = [
          "/api/data.json",
          // Add more dynamic URLs as needed
        ];

        await Promise.all(
          dynamicUrls.map(async (url) => {
            try {
              const response = await fetch(url);
              if (response.ok) {
                await cache.put(url, response.clone());
                console.log(`✅ Updated cache for ${url}`);
              } else {
                console.warn(`Failed to update ${url} - Status: ${response.status}`);
              }
            } catch (err) {
              console.error(`Network error while updating ${url}`, err);
            }
          })
        );
      })()
    );
  }
});
