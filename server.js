const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// Security and configuration improvements
app.use(cors());
app.use(express.static("public")); // Serve frontend files
app.use(express.json());

// Environment variable validation
const requiredEnvVars = ['SCRAPE_API_FIRST', 'SCRAPE_API_LAST', 'TEMPERATURE_CLASS', 'MIN_MAX_TEMPERATURE_CLASS', 'HUMIDITY_PRESSURE_CLASS', 'CONDITION_CLASS', 'DATE_CLASS'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Error: Missing environment variable ${varName}`);
    process.exit(1);
  }
});

// Rate limiting middleware (example)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    status: 429,
    error: "Too many requests, please try again later."
  }
});
app.use(limiter);

// Parsing function to extract humidity and pressure
const parseHumidityPressure = (rawText) => {
  // Split the raw text by periods (.)
  if (!rawText) {
    return { humidity: "N/A", pressure: "N/A" }; // Return N/A if rawText is not provided
  }

  // Split the raw text by periods (.)
  const parts = rawText.split('.');

  // Ensure that we have enough parts in the array to access
  if (parts.length < 2) {
    return { humidity: "N/A", pressure: "N/A" }; // Return N/A if the split parts are not enough
  }

  // Extract humidity (last part) and pressure (second last part)
  const humidity = parts[parts.length - 1] || "N/A";  // Last part is humidity
  const rawPressure = parts[parts.length - 2] || "N/A";  

  // Function to parse pressure correctly
  const parsePressure = (rawPressure) => {
    // Convert the raw pressure value to float and divide by 100 to adjust scale if necessary
    const pressure = parseFloat(rawPressure);
    
    // If pressure is greater than 10000 (indicating it might be in Pascals), convert to hPa (divide by 100)
    if (pressure > 10000) {
      return (pressure / 100).toFixed(2); // Scale down by dividing by 100 and return with 2 decimal places
    }

    // If pressure is greater than 1000, divide by 10 to bring it to a standard atmospheric range
    if (pressure > 1000) {
      return (pressure / 10).toFixed(2); // Divide by 10 and return with 2 decimal places
    }

    // Otherwise, just return the pressure as is, rounded to the nearest integer
    return Math.round(pressure);
  };

  // Parsing the pressure correctly
  const pressure = parsePressure(rawPressure);

  return { humidity, pressure };
};


// Enhanced API endpoint
app.get("/api/weather/:city", async (req, res) => {
  try {
    const city = req.params.city.trim();

    if (!city || city.length < 2) {
      return res.status(400).json({ error: "Invalid city name. Please enter a valid city." });
    }

    const response = await axios.get(
      `${process.env.SCRAPE_API_FIRST}${encodeURIComponent(city)}${process.env.SCRAPE_API_LAST}`
    );

    const $ = cheerio.load(response.data);

    // Function to safely get text from a given selector
    const getElementText = (selector) => {
      return $(selector).text()?.trim() || null;
    };

    const temperature = getElementText(process.env.TEMPERATURE_CLASS);
    const minMaxTemperature = getElementText(process.env.MIN_MAX_TEMPERATURE_CLASS);
    const humidityPressureText = getElementText(process.env.HUMIDITY_PRESSURE_CLASS); // Raw humidity and pressure text
    const condition = getElementText(process.env.CONDITION_CLASS);
    const date = getElementText(process.env.DATE_CLASS);

    if (!temperature || !condition) {
      return res.status(404).json({ error: "Weather data not found for the specified city." });
    }

    // Correctly parsing min/max temperature using regex
    const minTemperature = minMaxTemperature?.match(/(\d+°)/)?.[0] || "N/A";
    const maxTemperature = minMaxTemperature?.match(/(\d+°)/)?.[1] || "N/A";

    // Parse the humidity and pressure
    const { humidity, pressure } = parseHumidityPressure(humidityPressureText);

    // Construct the weather data object
    const weatherData = {
      date,
      temperature,
      condition,
      minTemperature,
      maxTemperature,
      humidity,
      pressure
    };

    res.json(weatherData);
  } catch (error) {
    console.error("Scraping error:", error);
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      error: statusCode === 404 ? "City not found. Please enter a valid city name." : "Failed to retrieve weather data."
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
