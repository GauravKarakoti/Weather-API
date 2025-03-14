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
    status:429,
    error: "Too many requests, please try again later."
  }
});
app.use(limiter);

// Enhanced API endpoint
app.get("/api/weather/:city", async (req, res) => {
  try {
    const response = await axios.get(
      `${process.env.SCRAPE_API_FIRST}${encodeURIComponent(req.params.city)}${process.env.SCRAPE_API_LAST}`
    );
    
    const $ = cheerio.load(response.data);
    
    // Improved error handling for element selection
    const getElementText = (selector) => $(selector).text()?.trim() || null;
    const temperature = getElementText(process.env.TEMPERATURE_CLASS);
    const minMaxTemperature = getElementText(process.env.MIN_MAX_TEMPERATURE_CLASS);
    const humidityPressure = getElementText(process.env.HUMIDITY_PRESSURE_CLASS);

    let minTemperature = "", maxTemperature = "", humidity = "", pressure = "";

    for (let i = 0; i < 6; i++) {
        if (i < 3) minTemperature += minMaxTemperature[i];
        else maxTemperature += minMaxTemperature[i];
    }

    for (let i = 0; i < 6; i++) {
        if (i < 2) humidity += humidityPressure[i];
        else pressure += humidityPressure[i];
    }
    const weatherData = {
      date: getElementText(process.env.DATE_CLASS),
      temperature,
      condition: getElementText(process.env.CONDITION_CLASS), // New condition field
      minTemperature,
      maxTemperature,
      humidity,
      pressure
    };

    // Validate essential data
    if (!weatherData.temperature || !weatherData.condition) {
      return res.status(404).json({ 
        error: "Weather data not found for the specified city" 
      });
    }

    res.json(weatherData);
  } catch (error) {
    console.error("Scraping error:", error);
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      error: statusCode === 404 
        ? "City not found" 
        : "Failed to retrieve weather data"
    });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
