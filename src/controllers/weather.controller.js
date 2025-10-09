const cheerio = require("cheerio");
const { sanitizeInput, isValidCity } = require("../utils/sanitize");
const { fetchWeatherData, formatDate } = require("../services/weather.service");
const {
  parseTemperature,
  parseHumidityPressure,
  parseMinMaxTemperature,
  parseWind,
  parseUvIndex,
  parsePollenCount,
} = require("../utils/parser");
const { handleError } = require("../middlewares/error.middleware");
const { fallbackSelectors } = require("../constants/selectors");

const getWeather = async (req, res) => {
  try {
    const city = sanitizeInput(req.params.city);
    if (!isValidCity(city)) {
      return handleError(res, 400, "Invalid city name", "INVALID_CITY");
    }

    const response = await fetchWeatherData(city);
    const $ = cheerio.load(response.data);

    // Helper function to get element text with fallback
    const getElementText = (selectorKey) => {
      const primarySelector = process.env[selectorKey];
      const fallbackSelector = fallbackSelectors[selectorKey];
      let text = null;

      if (primarySelector && $(primarySelector).length) {
        text = $(primarySelector).text()?.trim();
      }

      if (!text && fallbackSelector && $(fallbackSelector).length) {
        text = $(fallbackSelector).text()?.trim();
      }

      return text || null;
    };

    const temperatureText = getElementText(
      process.env.TEMPERATURE_CLASS,
      fallbackSelectors.TEMPERATURE_CLASS,
    );
    const temperature = parseTemperature(temperatureText);
    const minMaxText = getElementText(
      process.env.MIN_MAX_TEMPERATURE_CLASS,
      fallbackSelectors.MIN_MAX_TEMPERATURE_CLASS,
    );
    const { minTemperature, maxTemperature } =
      parseMinMaxTemperature(minMaxText);
    const humidityPressureText = getElementText(
      process.env.HUMIDITY_PRESSURE_CLASS,
      fallbackSelectors.HUMIDITY_PRESSURE_CLASS,
    );
    const { humidity, pressure } = parseHumidityPressure(humidityPressureText);
    const condition = getElementText(
      process.env.CONDITION_CLASS,
      fallbackSelectors.CONDITION_CLASS,
    );
    const dateText = getElementText(
      process.env.DATE_CLASS,
      fallbackSelectors.DATE_CLASS,
    );
    const date = formatDate(dateText); // Declare date variable here

    // New weather details
    const windText = getElementText(
      process.env.WIND_CLASS,
      fallbackSelectors.WIND_CLASS,
    );
    const { windSpeed, windDirection } = parseWind(windText);

    const uvIndexText = getElementText(
      process.env.UV_INDEX_CLASS,
      fallbackSelectors.UV_INDEX_CLASS,
    );
    const uvIndex = parseUvIndex(uvIndexText);

    const pollenCountText = getElementText(
      process.env.POLLEN_COUNT_CLASS,
      fallbackSelectors.POLLEN_COUNT_CLASS,
    );
    const pollenCount = parsePollenCount(pollenCountText);

    if (temperature === "N/A" && condition === "N/A") {
      return handleError(
        res,
        503,
        "Failed to parse weather data",
        "PARSING_ERROR",
      );
    }

    res.json({
      date,
      temperature,
      minTemperature,
      maxTemperature,
      condition,
      humidity,
      pressure,
      windSpeed,
      windDirection,
      uvIndex,
      pollenCount,
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
      "SCRAPING_ERROR",
    );
  }
};

module.exports = { getWeather };
