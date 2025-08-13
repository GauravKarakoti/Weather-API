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

    this.initialize();
  }

  initialize() {
    // Check if Redis is disabled
    if (
      process.env.REDIS_HOST === "disabled" ||
      process.env.CACHE_WARMING_ENABLED === "false"
    ) {
      logger.info("Redis caching disabled via environment configuration");
      return;
    }

    // Warn if required env vars are missing in production
    if (process.env.NODE_ENV === "production") {
      if (!process.env.REDIS_HOST) {
        logger.warn("REDIS_HOST is not set in production environment.");
      }
      if (!process.env.REDIS_PORT) {
        logger.warn("REDIS_PORT is not set in production environment.");
      }
    }

    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        // Set lazyConnect to false for production for immediate connection
        lazyConnect: process.env.NODE_ENV === "production" ? false : true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        family: 4, // IPv4
        // TLS support for cloud Redis providers (Upstash, Redis Cloud, etc.)
        tls: process.env.REDIS_TLS === "true" ? {} : undefined,
      };

      // Support for Redis Cluster
      if (process.env.REDIS_CLUSTER_NODES) {
        const nodes = process.env.REDIS_CLUSTER_NODES.split(",").map((node) => {
          const [host, port] = node.trim().split(":");
          return { host, port: parseInt(port) || 6379 };
        });

        this.client = new Redis.Cluster(nodes, {
          redisOptions: redisConfig,
          enableOfflineQueue: false,
        });
      } else {
        this.client = new Redis(redisConfig);
      }

      this.setupEventHandlers();
      // For production, connect immediately and log errors
      if (process.env.NODE_ENV === "production") {
        this.client.connect().catch((error) => {
          logger.error("Redis connection failed on startup (production)", { error: error.message });
          this.handleConnectionFailure();
        });
      } else {
        this.connect();
      }
    } catch (error) {
      logger.error("Redis initialization failed", { error: error.message });
      this.handleConnectionFailure();
    }
  }

  setupEventHandlers() {
    this.client.on("connect", () => {
      logger.info("Redis connecting...");
    });

    this.client.on("ready", () => {
      this.isConnected = true;
      this.connectionAttempts = 0;
      logger.info("Redis connection established successfully");
    });

    this.client.on("error", (error) => {
      this.isConnected = false;
      this.stats.errors++;
      logger.error("Redis connection error", {
        error: error.message,
        connectionAttempts: this.connectionAttempts,
      });
    });

    this.client.on("close", () => {
      this.isConnected = false;
      logger.warn("Redis connection closed");
    });

    this.client.on("reconnecting", (delay) => {
      logger.info(`Redis reconnecting in ${delay}ms...`);
    });

    this.client.on("end", () => {
      this.isConnected = false;
      logger.warn("Redis connection ended");
    });
  }

  async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error("Failed to connect to Redis", {
        error: error.message,
        connectionAttempts: this.connectionAttempts,
      });
      this.handleConnectionFailure();
    }
  }

  handleConnectionFailure() {
    this.connectionAttempts++;

    if (this.connectionAttempts >= this.maxRetries) {
      logger.error(
        "Redis max connection attempts reached. Operating without cache.",
      );
      return;
    }

    setTimeout(() => {
      logger.info(
        `Redis reconnection attempt ${this.connectionAttempts}/${this.maxRetries}`,
      );
      this.connect();
    }, this.retryDelay * this.connectionAttempts);
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
    if (!this.isConnected) {
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
      logger.error("Redis GET error", { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttlSeconds = 1800) {
    // Default 30 minutes TTL
    if (!this.isConnected) {
      return false;
    }

    try {
      const processedData = this.compressData(value);
      const dataToStore = JSON.stringify(processedData);

      await this.client.setex(key, ttlSeconds, dataToStore);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error("Redis SET error", {
        key,
        ttl: ttlSeconds,
        error: error.message,
      });
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error("Redis DEL error", { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error("Redis EXISTS error", { key, error: error.message });
      return false;
    }
  }

  async ttl(key) {
    if (!this.isConnected) {
      return -1;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.stats.errors++;
      logger.error("Redis TTL error", { key, error: error.message });
      return -1;
    }
  }

  // Pattern-based operations
  async keys(pattern) {
    if (!this.isConnected) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.stats.errors++;
      logger.error("Redis KEYS error", { pattern, error: error.message });
      return [];
    }
  }

  async deletePattern(pattern) {
    if (!this.isConnected) {
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
      logger.error("Redis DELETE PATTERN error", {
        pattern,
        error: error.message,
      });
      return 0;
    }
  }

  // Health check
  async ping() {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      this.stats.errors++;
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
