const fetchWeather = require("../utils/fetchWeather"); // existing function
const { getOrSetCache } = require("../utils/cache");  // caching helper

const getWeather = async (req, res) => {
    const city = req.params.city;

    try {
        // Use Redis cache
        const data = await getOrSetCache(city.toLowerCase(), () => fetchWeather(city));
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch weather" });
    }
};

module.exports = { getWeather };
