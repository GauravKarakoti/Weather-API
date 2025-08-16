const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

function configureEnv() {
  const result = dotenv.config();
  if (result.error) {
    const examplePath = path.join(__dirname, "../../.env.example");
    if (fs.existsSync(examplePath)) {
      dotenv.config({ path: examplePath });
      console.warn("Using .env.example. Please create a .env file.");
    } else {
      console.error("No .env or .env.example file found!");
      process.exit(1);
    }
  }

  // Normalize test environment defaults expected by tests
  if (process.env.NODE_ENV === "test") {
    process.env.OAUTH_CLIENT_ID =
      process.env.OAUTH_CLIENT_ID || "weather-api-client";
    process.env.OAUTH_CLIENT_SECRET =
      process.env.OAUTH_CLIENT_SECRET || "default-client-secret";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    process.env.TRUST_PROXY = "false";

    // Weather API test defaults
    process.env.SCRAPE_API_FIRST =
      process.env.SCRAPE_API_FIRST || "https://test-weather.com/";
    process.env.SCRAPE_API_LAST = process.env.SCRAPE_API_LAST || "/weather";
    process.env.SCRAPE_API_FALLBACK =
      process.env.SCRAPE_API_FALLBACK || "https://fallback-weather.com/";
    process.env.SPECIAL_API_KEY = process.env.SPECIAL_API_KEY || "test-api-key";

    // Weather selectors test defaults
    process.env.TEMPERATURE_CLASS =
      process.env.TEMPERATURE_CLASS || ".temp-fallback";
    process.env.MIN_MAX_TEMPERATURE_CLASS =
      process.env.MIN_MAX_TEMPERATURE_CLASS || ".min-max-temp-fallback";
    process.env.HUMIDITY_PRESSURE_CLASS =
      process.env.HUMIDITY_PRESSURE_CLASS || ".humidity-pressure-fallback";
    process.env.CONDITION_CLASS =
      process.env.CONDITION_CLASS || ".condition-fallback";
    process.env.DATE_CLASS = process.env.DATE_CLASS || ".date-fallback";
  }
}

module.exports = { configureEnv };
