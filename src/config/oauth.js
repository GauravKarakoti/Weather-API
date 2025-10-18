// Fail fast if JWT_SECRET is missing
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET is not set in environment variables.");
}

const oauthConfig = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY) || 3600, // 1 hour
    refreshTokenExpiry:
      parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRY) || 604800, // 7 days
    algorithm: "HS256",
    // Additional JWT security options
    notBefore: 0, // Tokens valid immediately
    issuer: "weather-api-oauth",
    audience: "weather-api",
  },

  // Client Configuration
  clients: {
    [process.env.OAUTH_CLIENT_ID || "weather-api-client"]: {
      secret: process.env.OAUTH_CLIENT_SECRET || "default-client-secret",
      name: "Weather API Client",
      scopes: ["read", "write"],
      grantTypes: ["authorization_code", "refresh_token", "client_credentials"],
      redirectUris: [],
      isConfidential: true,
    },
  },

  // Token Storage Configuration
  storage: {
    type: process.env.TOKEN_STORAGE || "memory", // 'memory' or 'redis'
    redis: {
      url: process.env.REDIS_URL || "redis://localhost:6379",
      password: process.env.REDIS_PASSWORD || null,
      keyPrefix: "oauth:",
      ttl: {
        accessToken: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY) || 3600,
        refreshToken: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRY) || 604800,
      },
    },
  },

  // Security Configuration
  security: {
    tokenRotation: true, // Rotate refresh tokens on use
    revokeOldTokens: true, // Revoke old tokens when new ones are issued
    maxTokensPerUser: 5, // Maximum active tokens per user
    requireHttps: process.env.NODE_ENV === "production", // Require HTTPS in production
    maxFailedAttempts: 5, // Maximum failed authentication attempts
    lockoutDuration: 900, // Lockout duration in seconds (15 minutes)
    // Token security
    tokenEntropy: 32, // Bytes of entropy for token generation
    hashAlgorithm: "sha256", // Algorithm for token hashing
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      introspectWindowMs: 1 * 60 * 1000, // 1 minute for introspection
      introspectMax: 60, // 60 introspection requests per minute
    },
  },

  // Introspection Configuration (RFC 7662)
  introspection: {
    enabled: true,
    requireClientAuth: true,
    returnFullToken: true, // Return full token information
    cacheResults: true, // Cache introspection results
    cacheTtl: 300, // Cache TTL in seconds (5 minutes)
  },
};

module.exports = oauthConfig;
