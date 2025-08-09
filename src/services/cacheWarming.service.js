const cacheService = require("./cache.service");
const { logger } = require("../utils/logger");
const axios = require("axios");

class CacheWarmingService {
  constructor() {
    this.isWarming = false;
    this.warmingInterval = null;
    this.warmingIntervalMs = 6 * 60 * 60 * 1000; // 6 hours
    this.baseUrl = process.env.BASE_URL || "http://localhost:5000";
    this.maxConcurrentRequests = 3;
    this.requestDelay = 2000; // 2 seconds between requests
  }

  /**
   * Start the cache warming scheduler
   */
  start() {
    // Check if caching is disabled
    if (
      process.env.REDIS_HOST === "disabled" ||
      process.env.CACHE_WARMING_ENABLED === "false"
    ) {
      logger.info("Cache warming disabled via environment configuration");
      return;
    }

    if (this.warmingInterval) {
      logger.warn("Cache warming scheduler already running");
      return;
    }

    logger.info("Starting cache warming scheduler", {
      interval: `${this.warmingIntervalMs / (1000 * 60 * 60)} hours`,
      popularCities: cacheService.popularCities.length,
    });

    // Run initial warming after 5 minutes
    setTimeout(
      () => {
        this.performCacheWarming();
      },
      5 * 60 * 1000,
    );

    // Schedule periodic warming
    this.warmingInterval = setInterval(() => {
      this.performCacheWarming();
    }, this.warmingIntervalMs);
  }

  /**
   * Stop the cache warming scheduler
   */
  stop() {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      logger.info("Cache warming scheduler stopped");
    }
  }

  /**
   * Perform cache warming for popular cities
   */
  async performCacheWarming() {
    if (this.isWarming) {
      logger.warn("Cache warming already in progress, skipping");
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();

    try {
      logger.info("Starting cache warming process");

      // Get cities that need warming
      const warmingAnalysis = await cacheService.warmCache();
      const citiesToWarm = warmingAnalysis.citiesToWarm;

      if (citiesToWarm.length === 0) {
        logger.info("No cities need cache warming");
        return;
      }

      logger.info(`Warming cache for ${citiesToWarm.length} cities`, {
        cities: citiesToWarm,
      });

      // Warm cities in batches to avoid overwhelming the system
      const results = await this.warmCitiesInBatches(citiesToWarm);

      const duration = Date.now() - startTime;
      const successful = results.filter((r) => r.success).length;
      const failed = results.length - successful;

      logger.info("Cache warming completed", {
        duration: `${Math.round(duration / 1000)}s`,
        total: results.length,
        successful,
        failed,
        successRate: `${((successful / results.length) * 100).toFixed(1)}%`,
      });

      // Log any failures for debugging
      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        logger.warn("Cache warming failures", { failures });
      }
    } catch (error) {
      logger.error("Cache warming process failed", { error: error.message });
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm cities in controlled batches
   */
  async warmCitiesInBatches(cities) {
    const results = [];

    for (let i = 0; i < cities.length; i += this.maxConcurrentRequests) {
      const batch = cities.slice(i, i + this.maxConcurrentRequests);

      logger.debug(
        `Warming batch ${Math.floor(i / this.maxConcurrentRequests) + 1}`,
        {
          cities: batch,
          remaining: cities.length - i - batch.length,
        },
      );

      // Process batch concurrently
      const batchPromises = batch.map((city) => this.warmCityData(city));
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      batchResults.forEach((result, index) => {
        const city = batch[index];
        if (result.status === "fulfilled") {
          results.push({ city, success: true, ...result.value });
        } else {
          results.push({
            city,
            success: false,
            error: result.reason?.message || "Unknown error",
          });
        }
      });

      // Delay between batches to be respectful to external APIs
      if (i + this.maxConcurrentRequests < cities.length) {
        await this.delay(this.requestDelay);
      }
    }

    return results;
  }

  /**
   * Warm cache data for a specific city
   */
  async warmCityData(city) {
    const results = { weather: null, forecast: null };

    try {
      // Warm weather data
      const weatherResult = await this.fetchAndCacheWeather(city);
      results.weather = weatherResult;

      // Small delay between requests
      await this.delay(500);

      // Warm forecast data
      const forecastResult = await this.fetchAndCacheForecast(city);
      results.forecast = forecastResult;

      return results;
    } catch (error) {
      logger.error("Failed to warm city data", { city, error: error.message });
      throw error;
    }
  }

  /**
   * Common method to fetch and cache data for a city
   * @param {string} city - City name
   * @param {string} endpoint - API endpoint (weather or weather-forecast)
   * @param {string} dataType - Type of data for logging
   */
  async fetchAndCacheData(city, endpoint, dataType) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/${endpoint}/${encodeURIComponent(city)}`,
        {
          timeout: 10000,
          headers: {
            "User-Agent": "Weather-API-Cache-Warmer/1.0",
            "X-Cache-Warming": "true",
          },
        },
      );

      if (response.status === 200 && response.data) {
        logger.debug(`${dataType} data warmed successfully`, { city });
        return { success: true, cached: !response.data.cached };
      } else {
        throw new Error(`Invalid response: ${response.status}`);
      }
    } catch (error) {
      logger.warn(`Failed to warm ${dataType} data`, {
        city,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch and cache weather data for a city
   */
  async fetchAndCacheWeather(city) {
    return this.fetchAndCacheData(city, "weather", "Weather");
  }

  /**
   * Fetch and cache forecast data for a city
   */
  async fetchAndCacheForecast(city) {
    return this.fetchAndCacheData(city, "weather-forecast", "Forecast");
  }

  /**
   * Manual cache warming trigger
   */
  async manualWarmCache(cities = null) {
    if (this.isWarming) {
      throw new Error("Cache warming already in progress");
    }

    const citiesToWarm = cities || cacheService.popularCities;
    logger.info("Manual cache warming triggered", { cities: citiesToWarm });

    return await this.warmCitiesInBatches(citiesToWarm);
  }

  /**
   * Get cache warming status
   */
  getStatus() {
    return {
      isRunning: this.warmingInterval !== null,
      isWarming: this.isWarming,
      intervalHours: this.warmingIntervalMs / (1000 * 60 * 60),
      popularCitiesCount: cacheService.popularCities.length,
      maxConcurrentRequests: this.maxConcurrentRequests,
      requestDelayMs: this.requestDelay,
    };
  }

  /**
   * Utility method for delays
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
const cacheWarmingService = new CacheWarmingService();

module.exports = cacheWarmingService;
