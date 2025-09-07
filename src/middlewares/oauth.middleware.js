const oauthService = require("../services/oauth.service");
const oauthConfig = require("../config/oauth");

// Extract Bearer token from Authorization header
const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
};

// Validate token format
const validateTokenFormat = (token) => {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Invalid token format" };
  }

  // Check if it's a JWT (3 parts separated by dots)
  if (token.split(".").length === 3) {
    // Basic JWT format validation
    const parts = token.split(".");
    if (parts.some((part) => !part || part.length === 0)) {
      return { valid: false, error: "Malformed JWT token" };
    }
  }

  return { valid: true };
};

// OAuth middleware for protecting routes
const requireAuth = (requiredScopes = []) => {
  return async (req, res, next) => {
    try {
      // Check HTTPS requirement in production
      if (oauthConfig.security.requireHttps && req.protocol !== "https") {
        return res.status(403).json({
          error: "forbidden",
          error_description: "HTTPS is required for this endpoint",
        });
      }

      const token = extractBearerToken(req);

      if (!token) {
        return res.status(401).json({
          error: "invalid_token",
          error_description: "Missing or invalid authorization header",
        });
      }

      // Validate token format first
      const formatValidation = validateTokenFormat(token);
      if (!formatValidation.valid) {
        return res.status(401).json({
          error: "invalid_token",
          error_description: formatValidation.error,
        });
      }

      // Verify the token
      const verification = await oauthService.verifyAccessToken(token);

      if (!verification.valid) {
        return res.status(401).json({
          error: "invalid_token",
          error_description: verification.error,
        });
      }

      const { payload } = verification;

      // Check required scopes
      if (requiredScopes.length > 0) {
        const tokenScopes = payload.scope ? payload.scope.split(" ") : [];
        const hasRequiredScope = requiredScopes.some((scope) =>
          tokenScopes.includes(scope),
        );

        if (!hasRequiredScope) {
          return res.status(403).json({
            error: "insufficient_scope",
            error_description: `Required scope: ${requiredScopes.join(" or ")}`,
            required_scopes: requiredScopes,
            token_scopes: tokenScopes,
          });
        }
      }

      // Add user information to request
      req.user = {
        id: payload.sub,
        username: payload.username,
        clientId: payload.client_id,
        scopes: payload.scope ? payload.scope.split(" ") : [],
        tokenId: payload.jti,
        tokenType: payload.token_type,
        issuedAt: payload.iat,
        expiresAt: payload.exp,
        audience: payload.aud,
        issuer: payload.iss,
      };

      // Add token metadata for logging/auditing
      req.tokenMetadata = {
        tokenId: payload.jti,
        userId: payload.sub,
        clientId: payload.client_id,
        scopes: payload.scope,
        issuedAt: new Date(payload.iat * 1000).toISOString(),
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      };

      next();
    } catch (error) {
      console.error("OAuth middleware error:", error);
      return res.status(500).json({
        error: "server_error",
        error_description: "Internal authentication error",
      });
    }
  };
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);

    if (token) {
      const formatValidation = validateTokenFormat(token);
      if (formatValidation.valid) {
        const verification = await oauthService.verifyAccessToken(token);

        if (verification.valid) {
          const { payload } = verification;
          req.user = {
            id: payload.sub,
            username: payload.username,
            clientId: payload.client_id,
            scopes: payload.scope ? payload.scope.split(" ") : [],
            tokenId: payload.jti,
            tokenType: payload.token_type,
            issuedAt: payload.iat,
            expiresAt: payload.exp,
            audience: payload.aud,
            issuer: payload.iss,
          };
        }
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    console.warn("Optional auth error:", error);
    next();
  }
};

// Client authentication middleware for OAuth endpoints
const requireClientAuth = (req, res, next) => {
  try {
    let clientId, clientSecret;

    // Check for HTTP Basic Auth
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Basic ")) {
      const credentials = Buffer.from(
        authHeader.substring(6),
        "base64",
      ).toString("utf-8");
      const parts = credentials.split(":");
      clientId = parts.shift();
      clientSecret = parts.join(":");
    }

    // Support Bearer token for client auth (treat bearer token as client secret)
    // If Bearer is used, require client_id in body or query
    if (!clientSecret && authHeader && authHeader.startsWith("Bearer ")) {
      clientSecret = authHeader.substring(7);
      clientId = clientId || req.body?.client_id || req.query?.client_id;
    }

    // Check for credentials in request body (form data) or query
    if (!clientId && req.body) {
      clientId = req.body.client_id;
    }
    if (!clientSecret && req.body) {
      clientSecret = req.body.client_secret;
    }
    if (!clientId && req.query) {
      clientId = req.query.client_id;
    }
    if (!clientSecret && req.query) {
      clientSecret = req.query.client_secret;
    }

    if (!clientId || !clientSecret) {
      return res.status(401).json({
        error: "invalid_client",
        error_description: "Client authentication required",
      });
    }

    // Authenticate client
    const clientAuth = oauthService.authenticateClient(clientId, clientSecret);
    if (!clientAuth.valid) {
      return res.status(401).json({
        error: "invalid_client",
        error_description: clientAuth.error,
      });
    }

    req.client = {
      id: clientId,
      name: clientAuth.client.name,
      scopes: clientAuth.client.scopes,
      grantTypes: clientAuth.client.grantTypes,
      isConfidential: clientAuth.client.isConfidential,
      ...clientAuth.client,
    };

    next();
  } catch (error) {
    console.error("Client auth middleware error:", error);
    return res.status(500).json({
      error: "server_error",
      error_description: "Internal client authentication error",
    });
  }
};

// Enhanced token validation middleware with introspection
const requireValidToken = (requiredScopes = []) => {
  return async (req, res, next) => {
    try {
      const token = extractBearerToken(req);

      if (!token) {
        return res.status(401).json({
          error: "invalid_token",
          error_description: "Missing or invalid authorization header",
        });
      }

      // Use introspection for comprehensive token validation
      const introspection = await oauthService.introspectToken(
        token,
        req.client?.id || "unknown",
        req.client?.secret || "unknown",
      );

      if (!introspection.active) {
        return res.status(401).json({
          error: "invalid_token",
          error_description: "Token is not active",
        });
      }

      // Check required scopes
      if (requiredScopes.length > 0) {
        const tokenScopes = introspection.scope
          ? introspection.scope.split(" ")
          : [];
        const hasRequiredScope = requiredScopes.some((scope) =>
          tokenScopes.includes(scope),
        );

        if (!hasRequiredScope) {
          return res.status(403).json({
            error: "insufficient_scope",
            error_description: `Required scope: ${requiredScopes.join(" or ")}`,
            required_scopes: requiredScopes,
            token_scopes: tokenScopes,
          });
        }
      }

      // Add user information to request
      req.user = {
        id: introspection.sub || introspection.user_id,
        username: introspection.username,
        clientId: introspection.client_id,
        scopes: introspection.scope ? introspection.scope.split(" ") : [],
        tokenId: introspection.jti,
        tokenType: introspection.token_type,
        issuedAt: introspection.iat,
        expiresAt: introspection.exp,
        audience: introspection.aud,
        issuer: introspection.iss,
        permissions: introspection.permissions || [],
      };

      next();
    } catch (error) {
      console.error("Token validation middleware error:", error);
      return res.status(500).json({
        error: "server_error",
        error_description: "Internal token validation error",
      });
    }
  };
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireClientAuth,
  requireValidToken,
  extractBearerToken,
  validateTokenFormat,
};
