const xss = require("xss");

const sanitizeInput = (str) => xss(str.trim());

const isValidCity = (city) => /^[\p{L}\p{M}\s'’\-\d]{2,50}$/u.test(city);

module.exports = { sanitizeInput, isValidCity };
