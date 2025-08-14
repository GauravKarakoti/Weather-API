const Redis = require("ioredis");
const LZString = require("lz-string");
const { logger } = require("../utils/logger");

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // 1 second
    this.compressionThreshold = 1024; // Compress data larger than 1KB

    // Cache analytics
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      compressionSaved: 0,
    };

    // Initialize synchronously - async operations will be handled separately
    this.initializeSync();
  }

  initializeSync() {
    // Check if Redis is disabled
    if (
      process.env.REDIS_HOST === "disabled" ||
      process.env.CACHE_WARMING_ENABLED === "false"
    ) {
      logger.info("Redis caching disabled via environment configuration");
      return;
    }

    // Schedule async initialization for next tick to avoid blocking constructor
    setImmediate(() => {
      this.initializeAsync().catch(error => {
        logger.error("Redis initialization failed", { error: error.message });
      });
    });
  }

  async initializeAsync() {
    // Quick check - if we can't connect to Redis, disable it
    await this.testConnectionAndDisable();
  }

  async testConnectionAndDisable() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
        lazyConnect: true,
        connectTimeout: 2000, // Very short timeout
        commandTimeout: 1000,
        enableOfflineQueue: false,
      };

      this.client = new Redis(redisConfig);
      
      // Quick connection test
      await this.client.connect();
      await this.client.ping();
      
      this.isConnected = true;
      logger.info("Redis connection successful - caching enabled");
      this.setupEventHandlers();
      
    } catch (error) {
      logger.warn("Redis connection failed - disabling cache", { error: error.message });
      this.disableRedis();
    }
  }

  disableRedis() {
    this.client = null;
    this.isConnected = false;
    logger.info("Redis disabled - operating without cache");
  }

  setupEventHandlers() {
    if (!this.client) return;
    
    this.client.on("connect", () => {
      logger.info("Redis connecting...");
    });

    this.client.on("ready", () => {
      this.isConnected = true;
      logger.info("Redis connection established successfully");
    });

    this.client.on("error", (error) => {
      this.isConnected = false;
      this.stats.errors++;
      logger.warn("Redis connection error - disabling cache", { error: error.message });
      this.disableRedis();
    });

    this.client.on("close", () => {
      this.isConnected = false;
      logger.warn("Redis connection closed");
    });

    this.client.on("end", () => {
      this.isConnected = false;
      logger.warn("Redis connection ended");
    });
  }

  // Compression utilities
  compressData(data) {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > this.compressionThreshold) {
      const compressed = LZString.compress(jsonString);
      this.stats.compressionSaved += jsonString.length - compressed.length;
      return { compressed: true, data: compressed };
    }
    return { compressed: false, data: jsonString };
  }

  decompressData(cachedData) {
    if (typeof cachedData === "string") {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.compressed) {
          return JSON.parse(LZString.decompress(parsed.data));
        }
        return parsed.data ? JSON.parse(parsed.data) : parsed;
      } catch {
        // If parsing fails, try direct decompression (backward compatibility)
        try {
          return JSON.parse(LZString.decompress(cachedData));
        } catch {
          return JSON.parse(cachedData);
        }
      }
    }
    return cachedData;
  }

  // Core caching methods
  async get(key) {
    if (!this.client || !this.isConnected) {
      this.stats.misses++;
      return null;
    }

    try {
      const cachedData = await this.client.get(key);
      if (cachedData) {
        this.stats.hits++;
        return this.decompressData(cachedData);
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      this.isConnected = false;
      logger.error("Redis GET error", { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttlSeconds = 1800) {
    // Default 30 minutes TTL
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const processedData = this.compressData(value);
      const dataToStore = JSON.stringify(processedData);

      await this.client.setex(key, ttlSeconds, dataToStore);
      return true;
    } catch (error) {
      this.stats.errors++;
      this.isConnected = false;
      logger.error("Redis SET error", {
        key,
        ttl: ttlSeconds,
        error: error.message,
      });
      return false;
    }
  }

  async del(key) {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.stats.errors++;
      this.isConnected = false;
      logger.error("Redis DEL error", { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      this.isConnected = false;
      logger.error("Redis EXISTS error", { key, error: error.message });
      return false;
    }
  }

  async ttl(key) {
    if (!this.client || !this.isConnected) {
      return -1;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.stats.errors++;
      this.isConnected = false;
      logger.error("Redis TTL error", { key, error: error.message });
      return -1;
    }
  }

  // Pattern-based operations
  async keys(pattern) {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.stats.errors++;
      this.isConnected = false;
      logger.error("Redis KEYS error", { pattern, error: error.message });
      return [];
    }
  }

  async deletePattern(pattern) {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        return keys.length;
      }
      return 0;
    } catch (error) {
      this.stats.errors++;
      this.isConnected = false;
      logger.error("Redis DELETE PATTERN error", {
        pattern,
        error: error.message,
      });
      return 0;
    }
  }

  // Health check
  async ping() {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      this.stats.errors++;
      this.isConnected = false;
      logger.error("Redis PING error", { error: error.message });
      return false;
    }
  }

  // Analytics and monitoring
  getStats() {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (
            (this.stats.hits / (this.stats.hits + this.stats.misses)) *
            100
          ).toFixed(2)
        : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      isConnected: this.isConnected,
      compressionSavedKB: (this.stats.compressionSaved / 1024).toFixed(2),
    };
  }

  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      compressionSaved: 0,
    };
  }

  // Graceful shutdown
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info("Redis connection closed gracefully");
      } catch (error) {
        logger.error("Error during Redis disconnect", { error: error.message });
      }
    }
  }
}

// Singleton instance
const redisService = new RedisService();

module.exports = redisService;
