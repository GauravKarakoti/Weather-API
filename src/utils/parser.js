const parseTemperature = (text) => {
  const match = text?.match(/-?\d+(\.\d+)?/);
  if (!match) return "N/A";
  const temp = parseFloat(match[0]);
  return temp >= -100 && temp <= 100 ? `${temp.toFixed(1)} °C` : "N/A";
};

const parseMinMaxTemperature = (text) => {
  const matches = text?.match(/-?\d+(\.\d+)?/g) || [];
  const min = parseFloat(matches[0]);
  const max = parseFloat(matches[1]);
  return {
    minTemperature: min >= -100 ? `${min.toFixed(1)} °C` : "N/A",
    maxTemperature: max <= 100 ? `${max.toFixed(1)} °C` : "N/A",
  };
};

const parseHumidityPressure = (text) => {
  const humidity = parseInt(text?.match(/(\d+)\s*Humidity/i)?.[1]);
  const pressure = parseFloat(text?.match(/(\d+)\s*Pressure/i)?.[1]);
  return {
    humidity: humidity >= 0 && humidity <= 100 ? `${humidity}%` : "N/A",
    pressure: pressure >= 300 && pressure <= 1100 ? `${pressure} hPa` : "N/A",
  };
};

module.exports = {
  parseTemperature,
  parseMinMaxTemperature,
  parseHumidityPressure,
};
