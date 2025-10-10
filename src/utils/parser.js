const parseTemperature = (text) => {
  // Fixed ReDoS vulnerability: Use atomic grouping to prevent backtracking
  const match = text?.match(/-?\d+(?:\.\d+)?/);
  if (!match) return "N/A";
  const temp = parseFloat(match[0]);
  return temp >= -100 && temp <= 100 ? `${temp.toFixed(1)} °C` : "N/A";
};

const parseMinMaxTemperature = (text) => {
  // Fixed ReDoS vulnerability: Use atomic grouping to prevent backtracking
  const matches = text?.match(/-?\d+(?:\.\d+)?/g) || [];
  const min = parseFloat(matches[0]);
  const max = parseFloat(matches[1]);
  return {
    minTemperature: min >= -100 ? `${min.toFixed(1)} °C` : "N/A",
    maxTemperature: max <= 100 ? `${max.toFixed(1)} °C` : "N/A",
  };
};

const extractIntegerBeforeKeyword = (text, keyword) => {
  if (typeof text !== "string") return null;

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const keywordLength = lowerKeyword.length;

  for (let i = 0; i < lowerText.length; i++) {
    if (/\d/.test(lowerText[i])) {
      let j = i;
      while (j < lowerText.length && /[0-9]/.test(lowerText[j])) j++;

      let k = j;
      while (k < lowerText.length && /\s/.test(lowerText[k])) k++;

      if (lowerText.startsWith(lowerKeyword, k)) {
        const num = parseInt(text.substring(i, j), 10);
        return isNaN(num) ? null : num;
      }
      i = j - 1;
    }
  }
  return null;
};

const parseHumidityPressure = (text) => {
  const humidity = extractIntegerBeforeKeyword(text, "Humidity");
  const pressure = extractIntegerBeforeKeyword(text, "Pressure");

  return {
    humidity:
      humidity !== null && humidity >= 0 && humidity <= 100
        ? `${humidity}%`
        : "N/A",
    pressure:
      pressure !== null && pressure >= 300 && pressure <= 1100
        ? `${pressure} hPa`
        : "N/A",
  };
};

const parseWind = (text) => {
  if (!text) return { windSpeed: "N/A", windDirection: "N/A" };

  // Assume format like "10 km/h NW" or "15 mph SSE"
  const match = text.match(/(\d+(?:\.\d+)?)\s*(km\/h|mph|m\/s)\s*([NSEW]+(?:-[NSEW]+)?)/i);
  if (!match) return { windSpeed: "N/A", windDirection: "N/A" };

  const speed = parseFloat(match[1]);
  const unit = match[2];
  const direction = match[3].toUpperCase();

  return {
    windSpeed: speed >= 0 && speed <= 200 ? `${speed} ${unit}` : "N/A",
    windDirection: direction,
  };
};

const parseUvIndex = (text) => {
  if (!text) return "N/A";

  const match = text.match(/\d+/);
  if (!match) return "N/A";

  const uv = parseInt(match[0], 10);
  return uv >= 0 && uv <= 11 ? uv.toString() : "N/A";
};

const parsePollenCount = (text) => {
  if (!text) return "N/A";

  // Assume text like "Low", "Moderate", "High", or a number
  const lowerText = text.toLowerCase().trim();
  if (lowerText === "low" || lowerText === "moderate" || lowerText === "high") {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  const match = text.match(/\d+/);
  if (match) {
    const count = parseInt(match[0], 10);
    return count >= 0 ? count.toString() : "N/A";
  }

  return "N/A";
};

module.exports = {
  parseTemperature,
  parseMinMaxTemperature,
  parseHumidityPressure,
  parseWind,
  parseUvIndex,
  parsePollenCount,
};
