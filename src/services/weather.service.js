const axios = require("axios");

const fetchWithRetry = async (url, options, retries = 3, backoff = 300) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, backoff * (i + 1)));
    }
  }
};

const fetchWeatherData = async (city) => {
  const encodedCity = encodeURIComponent(city.trim())
    .replace(/%20/g, "-")
    .replace(/'/g, "");
  const primaryUrl = `${process.env.SCRAPE_API_FIRST}${encodedCity}${process.env.SCRAPE_API_LAST}`;
  const fallbackUrl = `${process.env.SCRAPE_API_FALLBACK}${encodedCity}`;

  try {
    return await fetchWithRetry(primaryUrl, {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
  } catch {
    return await fetchWithRetry(fallbackUrl, {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
  }
};

const formatDate = (dateString) =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));

module.exports = { fetchWeatherData, formatDate };
