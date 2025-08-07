const cheerio = require("cheerio");
const { sanitizeInput, isValidCity } = require("../utils/sanitize");
const { fetchWeatherData, formatDate } = require("../services/weather.service");
const {
  parseTemperature,
  parseHumidityPressure,
  parseMinMaxTemperature,
} = require("../utils/parser");
const { handleError } = require("../middleware/error.middleware");
const { fallbackSelectors } = require("../constants/selectors");

const getWeather = async (req, res) => {
  try {
    const city = sanitizeInput(req.params.city);
    if (!isValidCity(city)) {
      return handleError(res, 400, "Invalid city name", "INVALID_CITY");
    }

    const response = await fetchWeatherData(city);
    const $ = cheerio.load(response.data);

    const getText = (primary, fallback) => {
      const el = $(primary);
      return el.length ? el.text().trim() : $(fallback).text()?.trim() || null;
    };

    const temperatureText = getElementText(process.env.TEMPERATURE_CLASS, fallbackSelectors.TEMPERATURE_CLASS);
    const temperature = parseTemperature(temperatureText);
    const minMaxText = getElementText(process.env.MIN_MAX_TEMPERATURE_CLASS, fallbackSelectors.MIN_MAX_TEMPERATURE_CLASS);
    const { minTemperature, maxTemperature } = parseMinMaxTemperature(minMaxText);
    const humidityPressureText = getElementText(process.env.HUMIDITY_PRESSURE_CLASS, fallbackSelectors.HUMIDITY_PRESSURE_CLASS);
    const { humidity, pressure } = parseHumidityPressure(humidityPressureText);
    const condition = getElementText(process.env.CONDITION_CLASS, fallbackSelectors.CONDITION_CLASS);
    const dateText = getElementText(process.env.DATE_CLASS, fallbackSelectors.DATE_CLASS);
    const date = formatDate(dateText); // Declare date variable here

    if (!temperature || !condition) {
      return handleError(
        res,
        503,
        "Failed to parse weather data",
        "PARSING_ERROR"
      );
    }

    res.json({
      date: formatDate(date),
      temperature,
      minTemperature,
      maxTemperature,
      condition,
      humidity,
      pressure,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    if (error.code === "ECONNABORTED") {
      return handleError(res, 504, "Weather service timeout", "TIMEOUT");
    }
    return handleError(
      res,
      502,
      "Failed to get weather data",
      "SCRAPING_ERROR"
    );
  }
};

module.exports = { getWeather };
