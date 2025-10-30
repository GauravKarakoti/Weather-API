const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const oauthConfig = require("../config/oauth");
const tokenStorage = require("./tokenStorage.service");
const { v4: uuidv4 } = require("uuid");

class OAuthService {
  constructor() {
    this.config = oauthConfig;
  }

  // Generate JWT access token
  generateAccessToken(payload) { // <- ADDED ASYNC
    const tokenId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    const tokenPayload = {
      jti: tokenId, // JWT ID
      sub: payload.userId || payload.sub, // Subject (user ID)
      aud: payload.clientId || "weather-api", // Audience
      iss: this.config.jwt.issuer, // Issuer
      iat: now, // Issued at
      exp: now + this.config.jwt.accessTokenExpiry, // Expiration
      nbf: now + this.config.jwt.notBefore, // Not before
      scope: payload.scope || "read",
      username: payload.username,
      client_id: payload.clientId,
      token_type: "access_token",
    };

    const token = jwt.sign(tokenPayload, this.config.jwt.secret, {
      algorithm: this.config.jwt.algorithm,
    });

    return { token, tokenId, payload: tokenPayload };
  }

  // Generate opaque refresh token
  generateRefreshToken(payload) { // <- ADDED ASYNC
    const tokenId = uuidv4();
    const refreshToken = crypto
      .randomBytes(this.config.security.tokenEntropy)
      .toString("hex");

    const tokenData = {
      tokenId,
      userId: payload.userId,
      clientId: payload.clientId,
      username: payload.username,
      scope: payload.scope || "read",
      type: "refresh_token",
      expiresIn: this.config.jwt.refreshTokenExpiry,
      createdAt: Date.now(),
    };

    return { refreshToken, tokenId, tokenData };
  }

  // Verify JWT token
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        algorithms: [this.config.jwt.algorithm],
      });

      // Check if token is in storage (for revocation support)
      const storedToken = await tokenStorage.getToken(decoded.jti);
      if (!storedToken) {
        return { valid: false, error: "Token not found or revoked" };
      }

      // Check expiration
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        await tokenStorage.revokeToken(decoded.jti);
        return { valid: false, error: "Token expired" };
      }

      return { valid: true, payload: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Verify refresh token
  async verifyRefreshToken(refreshToken) {
    try {
      // For opaque tokens, we need to find by token value
      // This is a simplified approach - in production, you'd hash the token
      const tokenId = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      const storedToken = await tokenStorage.getToken(tokenId);

      if (!storedToken || storedToken.type !== "refresh_token") {
        return { valid: false, error: "Invalid refresh token" };
      }

      // Check expiration
      const now = Date.now();
      if (now - storedToken.createdAt > storedToken.expiresIn * 1000) {
        await tokenStorage.revokeToken(tokenId);
        return { valid: false, error: "Refresh token expired" };
      }

      return { valid: true, tokenData: storedToken };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Authenticate client credentials
  authenticateClient(clientId, clientSecret) {
    const client = this.config.clients[clientId];
    if (!client) {
      return { valid: false, error: "Invalid client" };
    }

    if (client.secret !== clientSecret) {
      return { valid: false, error: "Invalid client credentials" };
    }

    return { valid: true, client };
  }

  // Issue new token pair
  async issueTokens(payload) {
    try {
      // Check token limits per user
      if (payload.userId) {
        const tokenCount = await tokenStorage.getUserTokenCount(payload.userId);
        if (tokenCount >= this.config.security.maxTokensPerUser) {
          // Revoke oldest tokens if limit exceeded
          await tokenStorage.revokeUserTokens(payload.userId);
        }
      }

      // Generate access token
      const {
        token: accessToken,
        tokenId: accessTokenId,
        payload: accessPayload,
      } = this.generateAccessToken(payload); // <- ADDED AWAIT

      // Generate refresh token
      const {
        refreshToken,
        tokenId: refreshTokenId,
        tokenData: refreshTokenData,
      } = this.generateRefreshToken(payload); // <- ADDED AWAIT

      // Store tokens
      await tokenStorage.storeToken(accessTokenId, {
        ...accessPayload,
        type: "access_token",
      });

      // For refresh tokens, use hash as key for security
      const refreshTokenKey = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      await tokenStorage.storeToken(refreshTokenKey, refreshTokenData);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: this.config.jwt.accessTokenExpiry,
        scope: payload.scope || "read",
      };
    } catch (error) {
      throw new Error(`Failed to issue tokens: ${error.message}`);
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken, clientId, clientSecret) {
    try {
      // Authenticate client
      const clientAuth = this.authenticateClient(clientId, clientSecret);
      if (!clientAuth.valid) {
        return { error: "invalid_client", error_description: clientAuth.error };
      }

      // Verify refresh token
      const refreshVerification = await this.verifyRefreshToken(refreshToken);
      if (!refreshVerification.valid) {
        return {
          error: "invalid_grant",
          error_description: refreshVerification.error,
        };
      }

      const { tokenData } = refreshVerification;

      // Revoke old refresh token if rotation is enabled
      if (this.config.security.tokenRotation) {
        const oldTokenKey = crypto
          .createHash("sha256")
          .update(refreshToken)
          .digest("hex");
        await tokenStorage.revokeToken(oldTokenKey);
      }

      // Issue new tokens
      const newTokens = await this.issueTokens({
        userId: tokenData.userId,
        username: tokenData.username,
        clientId: tokenData.clientId,
        scope: tokenData.scope,
      });

      return newTokens;
    } catch (error) {
      return { error: "server_error", error_description: error.message };
    }
  }

  // Introspect token (RFC 7662)
  async introspectToken(token, clientId, clientSecret) {
    try {
      // Authenticate client
      const clientAuth = this.authenticateClient(clientId, clientSecret);
      if (!clientAuth.valid) {
        return { active: false };
      }

      // Check cache first if enabled
      if (this.config.introspection.cacheResults) {
        const cachedResult =
          await tokenStorage.getCachedIntrospectionResult(token);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // Try to verify as JWT first
      const verification = await this.verifyAccessToken(token);

      if (verification.valid) {
        const { payload } = verification;
        const now = Math.floor(Date.now() / 1000);

        const result = {
          active: true,
          scope: payload.scope,
          client_id: payload.client_id,
          username: payload.username,
          token_type: payload.token_type,
          exp: payload.exp,
          iat: payload.iat,
          sub: payload.sub,
          aud: payload.aud,
          iss: payload.iss,
          jti: payload.jti,
          nbf: payload.nbf || payload.iat, // Not before (RFC 7662)
          // Additional RFC 7662 fields
          user_id: payload.sub,
          token_use: "access",
          auth_time: payload.iat,
          // Custom fields for Weather API
          permissions: payload.scope ? payload.scope.split(" ") : [],
          client_name: clientAuth.client.name || clientId,
          issued_for: payload.aud,
        };

        // Cache the result
        await tokenStorage.cacheIntrospectionResult(token, result);
        return result;
      }

      // If JWT verification fails, try as opaque token
      const tokenKey = crypto
        .createHash(this.config.security.hashAlgorithm)
        .update(token)
        .digest("hex");
      const storedToken = await tokenStorage.getToken(tokenKey);

      if (storedToken && storedToken.type === "refresh_token") {
        const now = Date.now();
        const isExpired =
          now - storedToken.createdAt > storedToken.expiresIn * 1000;

        if (isExpired) {
          await tokenStorage.revokeToken(tokenKey);
          const expiredResult = { active: false };
          await tokenStorage.cacheIntrospectionResult(token, expiredResult);
          return expiredResult;
        }

        const expTime = Math.floor(
          (storedToken.createdAt + storedToken.expiresIn * 1000) / 1000,
        );
        const iatTime = Math.floor(storedToken.createdAt / 1000);

        const result = {
          active: true,
          scope: storedToken.scope,
          client_id: storedToken.clientId,
          username: storedToken.username,
          token_type: "refresh_token",
          exp: expTime,
          iat: iatTime,
          sub: storedToken.userId,
          aud: "weather-api",
          iss: "weather-api-oauth",
          jti: tokenKey,
          nbf: iatTime,
          // Additional RFC 7662 fields
          user_id: storedToken.userId,
          token_use: "refresh",
          auth_time: iatTime,
          // Custom fields for Weather API
          permissions: storedToken.scope ? storedToken.scope.split(" ") : [],
          client_name: clientAuth.client.name || clientId,
          issued_for: "weather-api",
        };

        // Cache the result
        await tokenStorage.cacheIntrospectionResult(token, result);
        return result;
      }

      const inactiveResult = { active: false };
      // Cache inactive results too (shorter TTL)
      await tokenStorage.cacheIntrospectionResult(token, inactiveResult);
      return inactiveResult;
    } catch (error) {
      console.error("Token introspection error:", error);
      const errorResult = { active: false };
      await tokenStorage.cacheIntrospectionResult(token, errorResult);
      return errorResult;
    }
  }

  // Revoke token
  async revokeToken(token, clientId, clientSecret) {
    try {
      // Authenticate client
      const clientAuth = this.authenticateClient(clientId, clientSecret);
      if (!clientAuth.valid) {
        return { error: "invalid_client" };
      }

      // Try to decode JWT to get token ID
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.jti) {
          await tokenStorage.revokeToken(decoded.jti);
          return { success: true };
        }
      } catch (e) {
        // Not a JWT, try as opaque token
      }

      // Try as opaque token
      const tokenKey = crypto.createHash("sha256").update(token).digest("hex");
      const revoked = await tokenStorage.revokeToken(tokenKey);

      return { success: revoked };
    } catch (error) {
      return { error: "server_error", error_description: error.message };
    }
  }
}

module.exports = new OAuthService();
