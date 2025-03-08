const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
app.use(cors());

// Rate Limiting Middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        status: 429,
        error: "Too many requests, please try again later."
    }
});

// Apply rate limiting to all API requests
app.use(limiter);

app.get("/:city", async (req, res) => {
    try {
        const page = await axios.get(process.env.SCRAPE_API_FIRST + req.params.city + process.env.SCRAPE_API_LAST);
        const $ = cheerio.load(page.data);

        const date = $(process.env.DATE_CLASS).text();
        const temperature = $(process.env.TEMPERATURE_CLASS).text();
        const minMaxTemperature = $(process.env.MIN_MAX_TEMPERATURE_CLASS).text();
        const humidityPressure = $(process.env.HUMIDITY_PRESSURE_CLASS).text();

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
            date,
            temperature,
            minTemperature,
            maxTemperature,
            humidity,
            pressure
        };

        res.send(weatherData);
    } catch (error) {
        console.error("Error fetching weather data:", error);
        res.status(500).json({ error: "Failed to fetch weather data. Please try again later." });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
