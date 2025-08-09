const redisService = require("./redis.service");
const { logger } = require("../utils/logger");

class CacheService {
  constructor() {
    this.defaultTTL = 1800; // 30 minutes
    this.forecastTTL = 900; // 15 minutes for forecasts
    this.popularCitiesTTL = 3600; // 1 hour for popular cities

    // Popular cities for cache warming
    this.popularCities = [
      "London",
      "New York",
      "Tokyo",
      "Paris",
      "Sydney",
      "Mumbai",
      "Delhi",
      "Shanghai",
      "Los Angeles",
      "Chicago",
      "Toronto",
      "Berlin",
      "Madrid",
      "Rome",
      "Amsterdam",
      "Singapore",
      "Hong Kong",
      "Dubai",
      "Moscow",
      "Seoul",
    ];

    // Cache key prefixes
    this.prefixes = {
      weather: "weather:",
      forecast: "forecast:",
      popular: "popular:",
      analytics: "analytics:",
    };
  }

  // Generate cache keys
  generateKey(type, city, additional = "") {
    const normalizedCity = city.toLowerCase().trim();
    const prefix = this.prefixes[type] || "cache:";
    return `${prefix}${normalizedCity}${additional ? ":" + additional : ""}`;
  }

  // Weather data caching
  async getWeatherData(city) {
    const key = this.generateKey("weather", city);
    const cachedData = await redisService.get(key);

    if (cachedData) {
      logger.debug("Cache hit for weather data", { city, key });
      await this.recordCacheHit(city, "weather");
      return cachedData;
    }

    logger.debug("Cache miss for weather data", { city, key });
    await this.recordCacheMiss(city, "weather");
    return null;
  }

  async setWeatherData(city, data, isPopular = false) {
    const key = this.generateKey("weather", city);
    const ttl = isPopular ? this.popularCitiesTTL : this.defaultTTL;

    const success = await redisService.set(
      key,
      {
        ...data,
        cached_at: new Date().toISOString(),
        is_popular: isPopular,
      },
      ttl,
    );

    if (success) {
      logger.debug("Weather data cached", { city, key, ttl, isPopular });
    }

    return success;
  }

  // Forecast data caching
  async getForecastData(city) {
    const key = this.generateKey("forecast", city);
    const cachedData = await redisService.get(key);

    if (cachedData) {
      logger.debug("Cache hit for forecast data", { city, key });
      await this.recordCacheHit(city, "forecast");
      return cachedData;
    }

    logger.debug("Cache miss for forecast data", { city, key });
    await this.recordCacheMiss(city, "forecast");
    return null;
  }

  async setForecastData(city, data, isPopular = false) {
    const key = this.generateKey("forecast", city);
    const ttl = isPopular ? this.popularCitiesTTL : this.forecastTTL;

    const success = await redisService.set(
      key,
      {
        ...data,
        cached_at: new Date().toISOString(),
        is_popular: isPopular,
      },
      ttl,
    );

    if (success) {
      logger.debug("Forecast data cached", { city, key, ttl, isPopular });
    }

    return success;
  }

  // Cache invalidation
  async invalidateCity(city) {
    const weatherKey = this.generateKey("weather", city);
    const forecastKey = this.generateKey("forecast", city);

    const results = await Promise.allSettled([
      redisService.del(weatherKey),
      redisService.del(forecastKey),
    ]);

    const success = results.every(
      (result) => result.status === "fulfilled" && result.value,
    );

    if (success) {
      logger.info("Cache invalidated for city", { city });
    } else {
      logger.warn("Partial cache invalidation for city", { city, results });
    }

    return success;
  }

  async invalidatePattern(pattern) {
    const deletedCount = await redisService.deletePattern(pattern);
    logger.info("Cache pattern invalidated", { pattern, deletedCount });
    return deletedCount;
  }

  async invalidateExpiredData() {
    // This method can be called periodically to clean up expired data
    // Redis handles TTL automatically, but we can add custom logic here
    const patterns = [
      `${this.prefixes.weather}*`,
      `${this.prefixes.forecast}*`,
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      const keys = await redisService.keys(pattern);
      for (const key of keys) {
        const ttl = await redisService.ttl(key);
        if (ttl === -2) {
          // Key doesn't exist
          totalDeleted++;
        }
      }
    }

    logger.info("Expired data cleanup completed", { totalDeleted });
    return totalDeleted;
  }

  // Cache warming
  async warmCache() {
    logger.info("Starting cache warming for popular cities");
    const results = [];

    for (const city of this.popularCities) {
      try {
        // Check if data is already cached and fresh
        const weatherExists = await redisService.exists(
          this.generateKey("weather", city),
        );
        const forecastExists = await redisService.exists(
          this.generateKey("forecast", city),
        );

        if (!weatherExists || !forecastExists) {
          results.push({
            city,
            needsWeather: !weatherExists,
            needsForecast: !forecastExists,
            status: "needs_warming",
          });
        } else {
          results.push({
            city,
            status: "already_cached",
          });
        }
      } catch (error) {
        logger.error("Error checking cache for city during warming", {
          city,
          error: error.message,
        });
        results.push({
          city,
          status: "error",
          error: error.message,
        });
      }
    }

    const citiesToWarm = results.filter((r) => r.status === "needs_warming");
    logger.info("Cache warming analysis complete", {
      totalCities: this.popularCities.length,
      needsWarming: citiesToWarm.length,
      alreadyCached: results.filter((r) => r.status === "already_cached")
        .length,
    });

    return {
      analysis: results,
      citiesToWarm: citiesToWarm.map((r) => r.city),
    };
  }

  async warmCityData(city, weatherData = null, forecastData = null) {
    const results = {};

    if (weatherData) {
      results.weather = await this.setWeatherData(city, weatherData, true);
    }

    if (forecastData) {
      results.forecast = await this.setForecastData(city, forecastData, true);
    }

    logger.debug("City cache warming completed", { city, results });
    return results;
  }

  // Analytics and monitoring
  async recordCacheHit(city, type) {
    const key = this.generateKey(
      "analytics",
      "hits",
      `${type}:${new Date().toISOString().split("T")[0]}`,
    );
    try {
      await redisService.client?.incr(key);
      await redisService.client?.expire(key, 86400 * 7); // Keep for 7 days
    } catch (error) {
      // Silently fail analytics to not impact main functionality
    }
  }

  async recordCacheMiss(city, type) {
    const key = this.generateKey(
      "analytics",
      "misses",
      `${type}:${new Date().toISOString().split("T")[0]}`,
    );
    try {
      await redisService.client?.incr(key);
      await redisService.client?.expire(key, 86400 * 7); // Keep for 7 days
    } catch (error) {
      // Silently fail analytics to not impact main functionality
    }
  }

  async getCacheAnalytics(days = 7) {
    const analytics = {
      hits: {},
      misses: {},
      summary: { totalHits: 0, totalMisses: 0, hitRate: 0 },
    };

    try {
      const today = new Date();

      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        // Get hits and misses for weather and forecast
        const [weatherHits, weatherMisses, forecastHits, forecastMisses] =
          await Promise.all([
            redisService.get(
              this.generateKey("analytics", "hits", `weather:${dateStr}`),
            ) || 0,
            redisService.get(
              this.generateKey("analytics", "misses", `weather:${dateStr}`),
            ) || 0,
            redisService.get(
              this.generateKey("analytics", "hits", `forecast:${dateStr}`),
            ) || 0,
            redisService.get(
              this.generateKey("analytics", "misses", `forecast:${dateStr}`),
            ) || 0,
          ]);

        analytics.hits[dateStr] = {
          weather: parseInt(weatherHits) || 0,
          forecast: parseInt(forecastHits) || 0,
        };

        analytics.misses[dateStr] = {
          weather: parseInt(weatherMisses) || 0,
          forecast: parseInt(forecastMisses) || 0,
        };

        analytics.summary.totalHits +=
          analytics.hits[dateStr].weather + analytics.hits[dateStr].forecast;
        analytics.summary.totalMisses +=
          analytics.misses[dateStr].weather +
          analytics.misses[dateStr].forecast;
      }

      const total = analytics.summary.totalHits + analytics.summary.totalMisses;
      analytics.summary.hitRate =
        total > 0
          ? ((analytics.summary.totalHits / total) * 100).toFixed(2)
          : 0;
    } catch (error) {
      logger.error("Error retrieving cache analytics", {
        error: error.message,
      });
    }

    return analytics;
  }

  // Health check
  async healthCheck() {
    const health = {
      redis: await redisService.ping(),
      stats: redisService.getStats(),
      cacheKeys: {
        weather: 0,
        forecast: 0,
        analytics: 0,
      },
    };

    try {
      // Count cache keys
      const weatherKeys = await redisService.keys(`${this.prefixes.weather}*`);
      const forecastKeys = await redisService.keys(
        `${this.prefixes.forecast}*`,
      );
      const analyticsKeys = await redisService.keys(
        `${this.prefixes.analytics}*`,
      );

      health.cacheKeys.weather = weatherKeys.length;
      health.cacheKeys.forecast = forecastKeys.length;
      health.cacheKeys.analytics = analyticsKeys.length;
    } catch (error) {
      logger.error("Error during cache health check", { error: error.message });
      health.error = error.message;
    }

    return health;
  }

  // Utility methods
  isPopularCity(city) {
    return this.popularCities.some(
      (popular) => popular.toLowerCase() === city.toLowerCase(),
    );
  }

  async getCacheInfo(city) {
    const weatherKey = this.generateKey("weather", city);
    const forecastKey = this.generateKey("forecast", city);

    const [weatherTTL, forecastTTL, weatherExists, forecastExists] =
      await Promise.all([
        redisService.ttl(weatherKey),
        redisService.ttl(forecastKey),
        redisService.exists(weatherKey),
        redisService.exists(forecastKey),
      ]);

    return {
      city,
      weather: {
        cached: weatherExists,
        ttl: weatherTTL,
        expiresIn:
          weatherTTL > 0
            ? `${Math.floor(weatherTTL / 60)}m ${weatherTTL % 60}s`
            : "N/A",
      },
      forecast: {
        cached: forecastExists,
        ttl: forecastTTL,
        expiresIn:
          forecastTTL > 0
            ? `${Math.floor(forecastTTL / 60)}m ${forecastTTL % 60}s`
            : "N/A",
      },
      isPopular: this.isPopularCity(city),
    };
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
