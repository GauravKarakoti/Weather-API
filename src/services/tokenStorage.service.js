const redis = require("redis");
const oauthConfig = require("../config/oauth");

class TokenStorage {
  constructor() {
    this.type = oauthConfig.storage.type;
    this.memoryStore = new Map();
    this.redisClient = null;
    this.introspectionCache = new Map(); // Cache for introspection results

    if (this.type === "redis") {
      this.initRedis();
    }
  }

  async initRedis() {
    try {
      this.redisClient = redis.createClient({
        url: oauthConfig.storage.redis.url,
        password: oauthConfig.storage.redis.password,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
        },
      });

      this.redisClient.on("error", (err) => {
        console.error("Redis Client Error:", err);
        // Fallback to memory storage
        this.type = "memory";
        this.redisClient = null;
      });

      this.redisClient.on("connect", () => {
        console.log("Connected to Redis for token storage");
      });

      await this.redisClient.connect();
    } catch (error) {
      console.warn(
        "Failed to connect to Redis, falling back to memory storage:",
        error.message,
      );
      this.type = "memory";
      this.redisClient = null;
    }
  }

  // Generate Redis key with prefix
  _getRedisKey(tokenId) {
    return `${oauthConfig.storage.redis.keyPrefix}token:${tokenId}`;
  }

  // Generate user token count key
  _getUserCountKey(userId) {
    return `${oauthConfig.storage.redis.keyPrefix}user:${userId}:count`;
  }

  // Generate introspection cache key
  _getIntrospectionCacheKey(token) {
    const hash = require("crypto")
      .createHash("sha256")
      .update(token)
      .digest("hex");
    return `${oauthConfig.storage.redis.keyPrefix}introspect:${hash}`;
  }

  async storeToken(tokenId, tokenData) {
    const data = {
      ...tokenData,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    if (this.type === "redis" && this.redisClient) {
      try {
        const key = this._getRedisKey(tokenId);
        const ttl = tokenData.expiresIn || oauthConfig.jwt.accessTokenExpiry;

        await this.redisClient.setEx(key, ttl, JSON.stringify(data));

        // Store user token count
        if (tokenData.userId) {
          const countKey = this._getUserCountKey(tokenData.userId);
          await this.redisClient.incr(countKey);
          await this.redisClient.expire(
            countKey,
            oauthConfig.jwt.refreshTokenExpiry,
          );
        }

        return true;
      } catch (error) {
        console.error("Redis store error:", error);
        // Fallback to memory
      }
    }

    // Memory storage
    this.memoryStore.set(tokenId, data);

    // Set expiration for memory storage
    setTimeout(
      () => {
        this.memoryStore.delete(tokenId);
      },
      (tokenData.expiresIn || oauthConfig.jwt.accessTokenExpiry) * 1000,
    );

    return true;
  }

  async getToken(tokenId) {
    if (this.type === "redis" && this.redisClient) {
      try {
        const key = this._getRedisKey(tokenId);
        const data = await this.redisClient.get(key);

        if (data) {
          const parsedData = JSON.parse(data);
          // Update last accessed time
          parsedData.lastAccessed = Date.now();
          await this.redisClient.setEx(
            key,
            parsedData.expiresIn || oauthConfig.jwt.accessTokenExpiry,
            JSON.stringify(parsedData),
          );
          return parsedData;
        }

        return null;
      } catch (error) {
        console.error("Redis get error:", error);
        // Fallback to memory
      }
    }

    // Memory storage
    const data = this.memoryStore.get(tokenId);
    if (
      data &&
      Date.now() - data.createdAt >
        (data.expiresIn || oauthConfig.jwt.accessTokenExpiry) * 1000
    ) {
      this.memoryStore.delete(tokenId);
      return null;
    }

    if (data) {
      data.lastAccessed = Date.now();
    }

    return data || null;
  }

  async revokeToken(tokenId) {
    if (this.type === "redis" && this.redisClient) {
      try {
        const key = this._getRedisKey(tokenId);
        const data = await this.redisClient.get(key);

        if (data) {
          const parsedData = JSON.parse(data);
          // Decrease user token count
          if (parsedData.userId) {
            const countKey = this._getUserCountKey(parsedData.userId);
            await this.redisClient.decr(countKey);
          }

          await this.redisClient.del(key);
          return true;
        }

        return false;
      } catch (error) {
        console.error("Redis delete error:", error);
        // Fallback to memory
      }
    }

    // Memory storage
    const data = this.memoryStore.get(tokenId);
    if (data) {
      this.memoryStore.delete(tokenId);
      return true;
    }

    return false;
  }

  async revokeUserTokens(userId) {
    if (this.type === "redis" && this.redisClient) {
      try {
        const pattern = this._getRedisKey("*");
        const keys = await this.redisClient.keys(pattern);
        const tokens = await Promise.all(
          keys.map(async (key) => {
            const data = await this.redisClient.get(key);
            return { key, data: data ? JSON.parse(data) : null };
          }),
        );

        const userTokens = tokens.filter(
          (t) => t.data && t.data.userId === userId,
        );
        if (userTokens.length > 0) {
          await this.redisClient.del(userTokens.map((t) => t.key));
          // Reset user token count
          const countKey = this._getUserCountKey(userId);
          await this.redisClient.set(countKey, "0");
        }
        return userTokens.length;
      } catch (error) {
        console.error("Redis revoke user tokens error:", error);
        // Fallback to memory
      }
    }

    // Memory storage
    let revokedCount = 0;
    for (const [tokenId, tokenData] of this.memoryStore.entries()) {
      if (tokenData.userId === userId) {
        this.memoryStore.delete(tokenId);
        revokedCount++;
      }
    }
    return revokedCount;
  }

  async getUserTokenCount(userId) {
    if (this.type === "redis" && this.redisClient) {
      try {
        const countKey = this._getUserCountKey(userId);
        const count = await this.redisClient.get(countKey);
        return count ? parseInt(count, 10) : 0;
      } catch (error) {
        console.error("Redis count error:", error);
        // Fallback to memory
      }
    }

    // Memory storage
    let count = 0;
    for (const tokenData of this.memoryStore.values()) {
      if (tokenData.userId === userId) {
        count++;
      }
    }
    return count;
  }

  // Cache introspection results
  async cacheIntrospectionResult(token, result) {
    if (!oauthConfig.introspection.cacheResults) return;

    const cacheKey = this._getIntrospectionCacheKey(token);
    const ttl = oauthConfig.introspection.cacheTtl;

    if (this.type === "redis" && this.redisClient) {
      try {
        await this.redisClient.setEx(cacheKey, ttl, JSON.stringify(result));
      } catch (error) {
        console.error("Redis cache error:", error);
      }
    } else {
      // Memory cache
      this.introspectionCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + ttl * 1000,
      });

      // Clean up expired cache entries
      setTimeout(() => {
        this.introspectionCache.delete(cacheKey);
      }, ttl * 1000);
    }
  }

  // Get cached introspection result
  async getCachedIntrospectionResult(token) {
    if (!oauthConfig.introspection.cacheResults) return null;

    const cacheKey = this._getIntrospectionCacheKey(token);

    if (this.type === "redis" && this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
      } catch (error) {
        console.error("Redis cache get error:", error);
        return null;
      }
    } else {
      // Memory cache
      const cached = this.introspectionCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.result;
      }
      if (cached) {
        this.introspectionCache.delete(cacheKey);
      }
      return null;
    }
  }

  // Clean up expired tokens
  async cleanupExpiredTokens() {
    if (this.type === "redis" && this.redisClient) {
      // Redis handles expiration automatically
      return;
    }

    // Memory storage cleanup
    const now = Date.now();
    for (const [tokenId, tokenData] of this.memoryStore.entries()) {
      const expiry =
        (tokenData.expiresIn || oauthConfig.jwt.accessTokenExpiry) * 1000;
      if (now - tokenData.createdAt > expiry) {
        this.memoryStore.delete(tokenId);
      }
    }
  }

  async cleanup() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    this.memoryStore.clear();
    this.introspectionCache.clear();
  }
}

module.exports = new TokenStorage();
