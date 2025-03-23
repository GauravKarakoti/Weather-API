const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const xss = require("xss");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load environment variables
const envResult = dotenv.config();
if (envResult.error) {
  const envExamplePath = path.join(__dirname, ".env.example");
  if (fs.existsSync(envExamplePath)) {
    dotenv.config({ path: envExamplePath });
    console.warn("Using .env.example for environment variables. Please create a .env file for production.");
  } else {
    console.error("No .env or .env.example file found!");
    process.exit(1);
  }
}

const app = express();

// Security and middleware configurations
app.use(cors());
app.use(express.static("public"));
app.use(express.json());
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self';"
  );
  next();
});

// Required environment variables validation
const requiredEnvVars = [
  "SCRAPE_API_FIRST",
  "SCRAPE_API_LAST",
  "TEMPERATURE_CLASS",
  "MIN_MAX_TEMPERATURE_CLASS",
  "HUMIDITY_PRESSURE_CLASS",
  "CONDITION_CLASS",
  "DATE_CLASS",
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Error: Missing environment variable ${varName}`);
    process.exit(1);
  }
});

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    status: 429,
    error: "Too many requests, please try again later.",
  },
  headers: true,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.set("Retry-After", Math.ceil(limiter.windowMs / 1000));
    res.status(429).json({
      error: "Too many requests. Please try again later.",
      retryAfter: Math.ceil(limiter.windowMs / 1000) + " seconds",
    });
  },
});
app.use(limiter);

// Sanitize input to prevent XSS
const sanitizeInput = (str) => xss(str.trim());

// Enhanced city validation to support special characters
const isValidCity = (city) => {
  // Updated regex to better handle apostrophes and special characters
  return /^[a-zA-Z\s'-]{2,50}$/.test(city) || /^[\p{L}\s'-]{2,50}$/u.test(city);
};

// Function to parse humidity and pressure
const parseHumidityPressure = (rawText) => {
  if (!rawText) return { humidity: "N/A", pressure: "N/A" };

  const parts = rawText.split(".");
  if (parts.length < 2) return { humidity: "N/A", pressure: "N/A" };

  const humidity = parts[parts.length - 1] || "N/A";
  const rawPressure = parts[parts.length - 2] || "N/A";

  // Convert pressure correctly
  const parsePressure = (pressure) => {
    const value = parseFloat(pressure);
    if (value > 10000) {
      return `${(value / 100).toFixed(2)} hPa`;
    } else if (value > 1000) {
      return `${value} hPa`;
    } else {
      return `${value} Pa`;
    }
  };

  return { humidity, pressure: parsePressure(rawPressure) };
};

const formatDate = (dateString) => {
  
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric", // Add year
      month: "long",  // Full month name
      day: "numeric", // Day of the month
    }).format(new Date(dateString));
  } catch {
    return dateString; // Fallback to the original string if parsing fails
  }
};

// Improved Error Handling
const handleError = (res, statusCode, message, code) => {
  res.status(statusCode).json({
    error: message,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
  });
};

// API route to fetch weather data
app.get("/api/weather/:city", async (req, res) => {
  try {
   
    const city = sanitizeInput(req.params.city);
   
    // Validate city input
    if (!city || !isValidCity(city)) {
      return handleError(
          res, 
          401, 
          "Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)", 
          "INVALID_CITY"
      );
  }

    
    try {
      
      const encodedCity = city
      .normalize('NFD')  // Normalize decomposed form
      .replace(/'/g, '')  // Remove apostrophes
      .replace(/[\u0300-\u036f]/g, '')  // Remove combining diacritical marks
      .replace(/\s+/g, '-')  // Replace spaces with hyphens
      .toLowerCase();  // Convert to lowercase

      const response = await axios.get(
        `${process.env.SCRAPE_API_FIRST}${encodedCity}${process.env.SCRAPE_API_LAST}`,
        { 
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      );
    
      const $ = cheerio.load(response.data);

      // Function to extract text safely
      const getElementText = (selector) => {
        const element = $(selector);
        if (!element.length) throw new Error(`Required element ${selector} not found`);
        return element.text()?.trim() || null;
      };

      try {
        const temperature = getElementText(process.env.TEMPERATURE_CLASS);
        const minMaxTemperature = getElementText(process.env.MIN_MAX_TEMPERATURE_CLASS);
        const humidityPressureText = getElementText(process.env.HUMIDITY_PRESSURE_CLASS);
        const condition = getElementText(process.env.CONDITION_CLASS);
        const date = getElementText(process.env.DATE_CLASS);
       
        if (!temperature || !condition) {
          return handleError(res, 404, "Weather data not found for the specified city.", "DATA_NOT_FOUND");
        }

      
       
        const matches = minMaxTemperature.match(/-?\d+°/g); 
        // 'g' ensures we get all matches
const minTemperature = matches?.[0] || "N/A"; // First match
const maxTemperature = matches?.[1] || "N/A"; // Second match


        const { humidity, pressure } = parseHumidityPressure(humidityPressureText);

        // Ensure temperature has °C suffix
        const ecelsius =(temp)=>(temp.includes("°C") ? temp : `${temp}`)
        const ensureCelsius = (temp) => (temp.includes("°C") ? temp : `${temp}C`);

        const weatherData = {
          date: formatDate(date),
          temperature: ensureCelsius(temperature),
          condition,
          minTemperature: ensureCelsius(minTemperature),
          maxTemperature: ensureCelsius(maxTemperature),
          humidity: `${humidity}%`, // Ensure humidity has % suffix
          pressure,
        };

        res.json(weatherData);
        
      } catch (parsingError) {
        console.error("Data parsing error:", parsingError);
        return res.status(503).json({
          error: "Unable to parse weather data. The weather service might be temporarily unavailable.",
        });
      }

    } catch (scrapingError) {
      console.error("Scraping error:", scrapingError);

      if (scrapingError.code === "ECONNABORTED") {
        return handleError(res, 504, "The weather service is taking too long. Try again later.", "TIMEOUT");
      }

      if (scrapingError.response?.status === 404) {
        return handleError(res, 404, "City not found. Please check the spelling.", "CITY_NOT_FOUND");
      }

      return handleError(res, 503, "Weather service temporarily unavailable.", "SERVICE_UNAVAILABLE");
    }
  } catch (error) {
    console.error("Server error:", error);
    handleError(res, 500, "Unexpected server error. Please try again later.", "SERVER_ERROR");
  }
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };