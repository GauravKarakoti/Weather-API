const oauthService = require("../services/oauth.service");

class OAuthController {
  // Token introspection endpoint (RFC 7662)
  async introspect(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          error: "invalid_request",
          error_description: "Missing token parameter",
        });
      }

      // Client authentication is handled by middleware
      const { id: clientId } = req.client;
      const clientSecret =
        req.body.client_secret ||
        (req.headers.authorization
          ? Buffer.from(req.headers.authorization.substring(6), "base64")
              .toString("utf-8")
              .split(":")[1]
          : null);

      const introspectionResult = await oauthService.introspectToken(
        token,
        clientId,
        clientSecret,
      );

      res.json(introspectionResult);
    } catch (error) {
      console.error("Token introspection error:", error);
      res.status(500).json({
        error: "server_error",
        error_description: "Internal server error during token introspection",
      });
    }
  }

  // Token endpoint for refresh and client credentials flows
  async token(req, res) {
    try {
      const { grant_type, refresh_token, scope } = req.body;
      const { id: clientId } = req.client;

      if (!grant_type) {
        return res.status(400).json({
          error: "invalid_request",
          error_description: "Missing grant_type parameter",
        });
      }

      if (grant_type === "refresh_token") {
        return await this.handleRefreshToken(req, res);
      }
      if (grant_type === "client_credentials") {
        return await this.handleClientCredentials(req, res);
      }
      return res.status(400).json({
        error: "unsupported_grant_type",
        error_description: `Grant type '${grant_type}' is not supported`,
      });
    } catch (error) {
      console.error("Token endpoint error:", error);
      res.status(500).json({
        error: "server_error",
        error_description: "Internal server error during token issuance",
      });
    }
  }

  // Handle refresh token flow
  async handleRefreshToken(req, res) {
    const { refresh_token, scope } = req.body;
    const { id: clientId } = req.client;

    if (!refresh_token) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing refresh_token parameter",
      });
    }

    const clientSecret =
      req.body.client_secret ||
      (req.headers.authorization
        ? Buffer.from(req.headers.authorization.substring(6), "base64")
            .toString("utf-8")
            .split(":")[1]
        : null);

    const result = await oauthService.refreshAccessToken(
      refresh_token,
      clientId,
      clientSecret,
    );

    if (result.error) {
      const statusCode = result.error === "invalid_client" ? 401 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  }

  // Handle client credentials flow
  async handleClientCredentials(req, res) {
    const { scope } = req.body;
    const { id: clientId } = req.client;

    // For client credentials, create a service account token
    const tokenPayload = {
      userId: `client:${clientId}`,
      username: `service-account:${clientId}`,
      clientId: clientId,
      scope: scope || "read",
    };

    try {
      const tokens = await oauthService.issueTokens(tokenPayload);

      // Client credentials flow doesn't return refresh token
      const { refresh_token, ...response } = tokens;

      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: "server_error",
        error_description: error.message,
      });
    }
  }

  // Token revocation endpoint (RFC 7009)
  async revoke(req, res) {
    try {
      const { token, token_type_hint } = req.body;

      if (!token) {
        return res.status(400).json({
          error: "invalid_request",
          error_description: "Missing token parameter",
        });
      }

      const { id: clientId } = req.client;
      const clientSecret =
        req.body.client_secret ||
        (req.headers.authorization
          ? Buffer.from(req.headers.authorization.substring(6), "base64")
              .toString("utf-8")
              .split(":")[1]
          : null);

      const result = await oauthService.revokeToken(
        token,
        clientId,
        clientSecret,
      );

      if (result.error) {
        const statusCode = result.error === "invalid_client" ? 401 : 400;
        return res.status(statusCode).json(result);
      }

      // RFC 7009 specifies that successful revocation returns 200 with empty body
      res.status(200).send();
    } catch (error) {
      console.error("Token revocation error:", error);
      res.status(500).json({
        error: "server_error",
        error_description: "Internal server error during token revocation",
      });
    }
  }

  async issueDemo(req, res) {
    try {
      const { username, scope } = req.body;
      const { id: clientId } = req.client;

      if (!username) {
        return res.status(400).json({
          error: "invalid_request",
          error_description: "Missing username parameter",
        });
      }

      // ADD DYNAMIC IMPORT HERE
      const { v4: uuidv4 } = await import("uuid");

      const tokenPayload = {
        userId: uuidv4(),
        username: username,
        clientId: clientId,
        scope: scope || "read write",
      };

      const tokens = await oauthService.issueTokens(tokenPayload);

      res.json({
        ...tokens,
        message: "Demo tokens issued successfully",
        user: {
          id: tokenPayload.userId,
          username: tokenPayload.username,
        },
      });
    } catch (error) {
      console.error("Demo token issuance error:", error);
      res.status(500).json({
        error: "server_error",
        error_description: error.message,
      });
    }
  }

  // Get token info (for debugging)
  async tokenInfo(req, res) {
    try {
      // This endpoint is protected by OAuth middleware
      const user = req.user;

      res.json({
        user: user,
        message: "Token is valid and active",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Token info error:", error);
      res.status(500).json({
        error: "server_error",
        error_description: "Internal server error",
      });
    }
  }
}

module.exports = new OAuthController();
