const xss = require("xss");

// Configure a shared FilterXSS instance so the whole app uses the same policy
const xssOptions = {
	whiteList: {},
	stripIgnoreTag: true,
	stripIgnoreTagBody: ['script'],
	allowCommentTag: false,
	css: false,
};

const xssFilter = new xss.FilterXSS(xssOptions);

const sanitizeInput = (str) => {
	if (typeof str !== 'string') return '';
	// Run through the configured FilterXSS instance
	const xssFiltered = xssFilter.process(str);
	const trimmed = xssFiltered.trim();
	// Additional character-level cleaning to match existing behavior
	const sanitized = trimmed.replace(/[^^\p{L}\p{M}\s'’\-\d]/gu, '');
	return sanitized;
};

const isValidCity = (city) => /^[\p{L}\p{M}\s'’\-\d]{2,50}$/u.test(city);

module.exports = { sanitizeInput, isValidCity };
