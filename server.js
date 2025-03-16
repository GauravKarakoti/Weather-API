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

    // Improved error handling for element selection
    const getElementText = (selector) => $(selector).text()?.trim() || null;

    const temperature = getElementText(process.env.TEMPERATURE_CLASS);
    const minMaxTemperature = getElementText(process.env.MIN_MAX_TEMPERATURE_CLASS);
    const humidityPressure = getElementText(process.env.HUMIDITY_PRESSURE_CLASS);
    const condition = getElementText(process.env.CONDITION_CLASS);
    const date = getElementText(process.env.DATE_CLASS);

    if (!temperature || !condition) {
      return res.status(404).json({ error: "Weather data not found for the specified city." });
    }

    // Improved parsing for min/max temp and humidity/pressure
    const minTemperature = minMaxTemperature?.substring(0, 3).trim() || "N/A";
    const maxTemperature = minMaxTemperature?.substring(3).trim() || "N/A";
    const humidity = humidityPressure?.substring(0, 2).trim() || "N/A";
    const pressure = humidityPressure?.substring(2).trim() || "N/A";

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
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };