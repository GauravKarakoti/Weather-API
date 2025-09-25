import express from "express";
import axios from "axios";

const router = express.Router();

// GET weather by city
router.get("/", async (req, res) => {
  const city = req.query.city || "Pune"; // default city if none given
  const apiKey = process.env.SPECIAL_API_KEY;

  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: city,
          appid: apiKey,
          units: "metric", // Celsius
        },
      }
    );

    res.json({
      city: response.data.name,
      temperature: response.data.main.temp,
      description: response.data.weather[0].description,
      humidity: response.data.main.humidity,
      wind: response.data.wind.speed,
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to fetch weather data",
      details: error.response?.data || error.message,
    });
  }
});

export default router;
