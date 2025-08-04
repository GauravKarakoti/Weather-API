const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");

const { sendAdminAlert } = require("./email.service");
const { fallbackSelectors } = require("../constants/selectors");

let selectorValidationInterval = null;

const validateSelectors = async () => {
  const testCity = "delhi";
  const testUrl = `${process.env.SCRAPE_API_FIRST}${testCity}${process.env.SCRAPE_API_LAST}`;

  try {
    const response = await axios.get(testUrl, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(response.data);
    const missing = [];

    Object.keys(fallbackSelectors).forEach((key) => {
      const selector = process.env[key];
      if (!$(selector).length) missing.push(key);
    });

    if (missing.length) {
      console.warn("Missing selectors:", missing);
      await sendAdminAlert(missing);
    } else {
      console.log("All selectors validated successfully.");
    }
  } catch (error) {
    console.error("Selector validation failed:", error.message);
    await sendAdminAlert(["ALL_SELECTORS_FAILED"]);
  }
};

const scheduleSelectorValidation = () => {
  const base = 7 * 24 * 60 * 60 * 1000;
  const rand = crypto.randomBytes(4).readUInt32BE(0) / 0xffffffff;
  const offset = rand * 24 * 60 * 60 * 1000 - 12 * 60 * 60 * 1000;
  const interval = base + offset;

  selectorValidationInterval = setInterval(validateSelectors, interval);
  console.log("Scheduled weekly selector validation.");
};

const stopValidationJob = () => {
  if (selectorValidationInterval) clearInterval(selectorValidationInterval);
};

module.exports = {
  validateSelectors,
  scheduleSelectorValidation,
  stopValidationJob,
};
