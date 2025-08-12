#!/usr/bin/env node

/**
 * OAuth 2.0 Test Script
 *
 * This script demonstrates and tests the OAuth 2.0 implementation
 * by performing various authentication flows and API calls.
 */

const axios = require("axios");
const crypto = require("crypto");

class OAuthTester {
  constructor(baseUrl = "http://localhost:3003") {
    this.baseUrl = baseUrl;
    this.clientId = process.env.OAUTH_CLIENT_ID || "weather-api-client";
    this.clientSecret =
      process.env.OAUTH_CLIENT_SECRET || "default-client-secret";
    this.tokens = {};
  }

  log(message, data = null) {
    console.log(`[OAuth Test] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  error(message, error = null) {
    console.error(`[OAuth Error] ${message}`);
    if (error) {
      console.error(error.response?.data || error.message);
    }
  }

  // Test client credentials flow
  async testClientCredentials() {
    this.log("Testing Client Credentials Flow...");

    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth/token`,
        "grant_type=client_credentials&scope=read",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
          },
        },
      );

      this.tokens.clientCredentials = response.data;
      this.log("✅ Client Credentials Flow Success", response.data);
      return true;
    } catch (error) {
      this.error("❌ Client Credentials Flow Failed", error);
      return false;
    }
  }

  // Test demo token issuance
  async testDemoTokens() {
    this.log("Testing Demo Token Issuance...");

    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth/demo/issue`,
        `username=testuser-${Date.now()}@example.com&scope=read write`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
          },
        },
      );

      this.tokens.demo = response.data;
      this.log("✅ Demo Token Issuance Success", response.data);
      return true;
    } catch (error) {
      this.error("❌ Demo Token Issuance Failed", error);
      return false;
    }
  }

  // Test token introspection
  async testIntrospection(token, tokenName) {
    this.log(`Testing Token Introspection for ${tokenName}...`);

    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth/introspect`,
        `token=${token}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
          },
        },
      );

      this.log(
        `✅ Token Introspection Success for ${tokenName}`,
        response.data,
      );
      return response.data.active;
    } catch (error) {
      this.error(`❌ Token Introspection Failed for ${tokenName}`, error);
      return false;
    }
  }

  // Test refresh token flow
  async testRefreshToken() {
    if (!this.tokens.demo?.refresh_token) {
      this.log("⚠️ Skipping refresh token test - no refresh token available");
      return false;
    }

    this.log("Testing Refresh Token Flow...");

    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth/token`,
        `grant_type=refresh_token&refresh_token=${this.tokens.demo.refresh_token}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
          },
        },
      );

      this.tokens.refreshed = response.data;
      this.log("✅ Refresh Token Flow Success", response.data);
      return true;
    } catch (error) {
      this.error("❌ Refresh Token Flow Failed", error);
      return false;
    }
  }

  // Test protected API access
  async testProtectedAPI(token, tokenName) {
    this.log(`Testing Protected API Access with ${tokenName}...`);

    try {
      const response = await axios.get(`${this.baseUrl}/api/weather/london`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.log(`✅ Protected API Access Success with ${tokenName}`, {
        status: response.status,
        hasWeatherData: !!response.data.temperature,
      });
      return true;
    } catch (error) {
      this.error(`❌ Protected API Access Failed with ${tokenName}`, error);
      return false;
    }
  }

  // Test token info endpoint
  async testTokenInfo(token, tokenName) {
    this.log(`Testing Token Info Endpoint with ${tokenName}...`);

    try {
      const response = await axios.get(`${this.baseUrl}/oauth/tokeninfo`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.log(`✅ Token Info Success with ${tokenName}`, response.data);
      return true;
    } catch (error) {
      this.error(`❌ Token Info Failed with ${tokenName}`, error);
      return false;
    }
  }

  // Run all tests
  async runAllTests() {
    this.log("🚀 Starting OAuth Test Suite...");

    const results = {
      clientCredentials: await this.testClientCredentials(),
      demoTokens: await this.testDemoTokens(),
      refreshToken: await this.testRefreshToken(),
      introspection: false,
      protectedAPI: false,
      tokenInfo: false,
    };

    // Test introspection with demo token if available
    if (this.tokens.demo?.access_token) {
      results.introspection = await this.testIntrospection(
        this.tokens.demo.access_token,
        "Demo Token",
      );
      results.protectedAPI = await this.testProtectedAPI(
        this.tokens.demo.access_token,
        "Demo Token",
      );
      results.tokenInfo = await this.testTokenInfo(
        this.tokens.demo.access_token,
        "Demo Token",
      );
    }

    // Test introspection with refreshed token if available
    if (this.tokens.refreshed?.access_token) {
      const refreshedIntrospection = await this.testIntrospection(
        this.tokens.refreshed.access_token,
        "Refreshed Token",
      );
      const refreshedProtectedAPI = await this.testProtectedAPI(
        this.tokens.refreshed.access_token,
        "Refreshed Token",
      );
      const refreshedTokenInfo = await this.testTokenInfo(
        this.tokens.refreshed.access_token,
        "Refreshed Token",
      );

      results.introspection = results.introspection || refreshedIntrospection;
      results.protectedAPI = results.protectedAPI || refreshedProtectedAPI;
      results.tokenInfo = results.tokenInfo || refreshedTokenInfo;
    }

    this.log("📊 Test Results Summary:", results);

    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;

    this.log(`🎯 Tests Passed: ${passedTests}/${totalTests}`);

    return results;
  }
}

// Main execution
if (require.main === module) {
  const tester = new OAuthTester();
  tester.runAllTests().catch((error) => {
    console.error("❌ Test suite failed:", error);
    process.exit(1);
  });
}

module.exports = OAuthTester;
