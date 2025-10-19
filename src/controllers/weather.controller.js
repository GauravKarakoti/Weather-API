const cheerio = require("cheerio");
const { sanitizeInput, isValidCity } = require("../utils/sanitize");
const { fetchWeatherData, formatDate } = require("../services/weather.service");
const {
  parseTemperature,
  parseHumidityPressure,
  parseMinMaxTemperature,
} = require("../utils/parser");
const { handleError } = require("../middlewares/error.middleware");
const { fallbackSelectors } = require("../constants/selectors");
const { getOrSetCache } = require("../utils/cache"); // Redis caching helper

const getWeather = async (req, res) => {
  try {
    const city = sanitizeInput(req.params.city);
    if (!isValidCity(city)) {
      return handleError(res, 400, "Invalid city name", "INVALID_CITY");
    }

    // Wrap scraping logic inside Redis cache
    const data = await getOrSetCache(city.toLowerCase(), async () => {
      const response = await fetchWeatherData(city);
      const $ = cheerio.load(response.data);

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

      const temperatureText = getElementText("TEMPERATURE_CLASS");
      const temperature = parseTemperature(temperatureText);

      const minMaxText = getElementText("MIN_MAX_TEMPERATURE_CLASS");
      const { minTemperature, maxTemperature } = parseMinMaxTemperature(minMaxText);

      const humidityPressureText = getElementText("HUMIDITY_PRESSURE_CLASS");
      const { humidity, pressure } = parseHumidityPressure(humidityPressureText);

      const condition = getElementText("CONDITION_CLASS");
      const dateText = getElementText("DATE_CLASS");
      const date = formatDate(dateText);

      if (temperature === "N/A" && condition === "N/A") {
        throw new Error("PARSING_ERROR");
      }

      return {
        date,
        temperature,
        minTemperature,
        maxTemperature,
        condition,
        humidity,
        pressure,
      };
    });

    res.json(data);
  } catch (error) {
    console.error("Weather scraping error:", error);

    if (error.code === "ECONNABORTED") {
      return handleError(res, 504, "Weather service timeout", "TIMEOUT");
    }

    if (error.message === "PARSING_ERROR") {
      return handleError(res, 503, "Failed to parse weather data", "PARSING_ERROR");
    }

    return handleError(res, 502, "Failed to get weather data", "SCRAPING_ERROR");
  }
};

module.exports = { getWeather };
