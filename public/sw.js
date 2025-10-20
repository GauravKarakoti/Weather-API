// Use fixed app version (from package.json)
const CACHE_VERSION = "app-cache-v1.0.0";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  // Prefer optimized WebP assets where available
  "/optimized/assets/WeatherBackground.webp",
  "/optimized/Favicon/Favicon.webp",
  "/optimized/fallback.webp",
];

// Install event: Cache core assets with partial success logging
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.allSettled(
          CORE_ASSETS.map((url) =>
            fetch(url)
              .then((response) => {
                if (response.ok) return cache.put(url, response);
                console.warn(`Skipped caching: ${url} - ${response.status}`);
              })
              .catch((err) => console.warn(`Fetch failed for: ${url}`, err)),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

// Activate event: Remove outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((oldKey) => caches.delete(oldKey)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (event.request.method === "GET" && response.status === 200) {
            // Cache optimized assets and common static folders
            if (
              event.request.url.includes("/optimized/") ||
              event.request.url.includes("/images/") ||
              event.request.url.includes("/assets/") ||
              event.request.url.includes("/fonts/")
            ) {
              caches.open(CACHE_VERSION).then((cache) =>
                cache.put(event.request, response.clone()),
              );
            }
          }
          return response;
        });
      })
      .catch(() => {
        if (event.request.destination === "image") {
          // ===== FIX: Chain the promises properly =====
          return caches.match("/optimized/fallback.webp").then((response) => {
            if (response) return response;
            return caches.match("/fallback.png");
          });
          // ==============================================
        }
        // For non-image requests (like navigation), return index.html
        return caches.match("/index.html");
      })
  );
});

// Helper: Update weather cache for recent searches
async function updateWeatherCache(source = "") {
  const cache = await caches.open(CACHE_VERSION);
  const recentSearches = await getRecentSearches();
  const logSuffix = source ? ` (${source})` : "";
  
  if (recentSearches && recentSearches.length > 0) {
    await Promise.all(
      recentSearches.slice(0, 3).map(async (city) => {
        try {
          const encodedCity = encodeURIComponent(city);
          const url = `https://weather-api-ex1z.onrender.com/api/weather/${encodedCity}`;
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response.clone());
            console.log(`✅ Updated weather cache for ${city}${logSuffix}`);
          } else {
            console.warn(
              `Failed to update weather for ${city} - Status: ${response.status}`
            );
          }
        } catch (err) {
          console.error(
            `Network error while updating weather for ${city}${logSuffix}`,
            err
          );
        }
      })
    );
  }
  
  try {
    const configResponse = await fetch(
      "https://weather-api-ex1z.onrender.com/config"
    );
    if (configResponse.ok) {
      await cache.put(
        "https://weather-api-ex1z.onrender.com/config",
        configResponse.clone()
      );
      console.log(`✅ Updated config cache${logSuffix}`);
    }
  } catch (err) {
    console.error(`Failed to update config cache${logSuffix}`, err);
  }
}

// Periodic Sync: Refresh dynamic content (not core assets)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "weather-sync") {
    event.waitUntil(updateWeatherCache("sync"));
  }
});

// Message-based fallback: trigger the same update flow when client requests a navigation sync
self.addEventListener("message", (event) => {
  // Verify the origin of the received message
  if (!event.origin || event.origin !== self.location.origin) {
    console.warn(`Rejected message from unauthorized origin: ${event.origin}`);
    return;
  }
  
  try {
    if (event.data && event.data.type === "NAVIGATION_SYNC") {
      event.waitUntil(updateWeatherCache("nav"));
    }
  } catch (err) {
    console.error("Error handling NAVIGATION_SYNC message", err);
  }
});

// Helper: Get recent searches from clients
async function getRecentSearches() {
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      const client = clients[0];
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.recentSearches) {
            resolve(event.data.recentSearches);
          } else {
            resolve(["London", "New York", "Tokyo"]);
          }
        };
        client.postMessage({ type: "GET_RECENT_SEARCHES" }, [
          messageChannel.port2,
        ]);
        setTimeout(() => {
          resolve(["London", "New York", "Tokyo"]);
        }, 5000);
      });
    }
    return ["London", "New York", "Tokyo"];
  } catch (err) {
    console.error("Failed to get recent searches", err);
    return [];
  }
}
