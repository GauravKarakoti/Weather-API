const express = require("express");
const { getWeather } = require("../controllers/weather.controller");

const router = express.Router();
router.get("/:city", getWeather);

module.exports = router;
