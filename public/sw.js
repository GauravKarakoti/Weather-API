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
  if (event.tag === "weather-sync") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);

        // Get recent searches from storage to refresh their weather data
        const recentSearches = await getRecentSearches();
        
        if (recentSearches && recentSearches.length > 0) {
          await Promise.all(
            recentSearches.slice(0, 3).map(async (city) => { // Limit to 3 most recent
              try {
                const encodedCity = encodeURIComponent(city);
                const url = `https://weather-api-ex1z.onrender.com/api/weather/${encodedCity}`;
                const response = await fetch(url);
                if (response.ok) {
                  await cache.put(url, response.clone());
                  console.log(`✅ Updated weather cache for ${city}`);
                } else {
                  console.warn(`Failed to update weather for ${city} - Status: ${response.status}`);
                }
              } catch (err) {
                console.error(`Network error while updating weather for ${city}`, err);
              }
            })
          );
        }

        // Also refresh config
        try {
          const configResponse = await fetch('https://weather-api-ex1z.onrender.com/config');
          if (configResponse.ok) {
            await cache.put('https://weather-api-ex1z.onrender.com/config', configResponse.clone());
            console.log('✅ Updated config cache');
          }
        } catch (err) {
          console.error('Failed to update config cache', err);
        }
      })()
    );
  }
});

// Helper function to get recent searches from clients
async function getRecentSearches() {
  try {
    // Try to get recent searches from clients using MessageChannel
    const clients = await self.clients.matchAll();
    
    if (clients.length > 0) {
      const client = clients[0]; // Use the first available client
      
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        
        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.recentSearches) {
            resolve(event.data.recentSearches);
          } else {
            resolve(['London', 'New York', 'Tokyo']); // Fallback
          }
        };
        
        client.postMessage(
          { type: 'GET_RECENT_SEARCHES' },
          [messageChannel.port2]
        );
        
        // Timeout after 5 seconds
        setTimeout(() => {
          resolve(['London', 'New York', 'Tokyo']);
        }, 5000);
      });
    }
    
    // Fallback: return some default cities if no clients
    return ['London', 'New York', 'Tokyo'];
  } catch (err) {
    console.error('Failed to get recent searches', err);
    return [];
  }
}
