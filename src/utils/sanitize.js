const xss = require("xss");

const sanitizeInput = (input) => {
    if (input == null) return ""; // handle null/undefined
    const str = String(input).trim(); // coerce to string
    const options = {
        whiteList: {}, // remove all HTML tags
        stripIgnoreTag: true, // remove ignored tags
        stripIgnoreTagBody: ["script"], // remove script body
        onTagAttr: (tag, name, value) => {
            // remove any event handlers (onerror, onclick, etc.)
            if (/^on/i.test(name)) return "";
            // remove dangerous protocols
            if ((name === "href" || name === "src") && /^(javascript:|data:)/i.test(value)) return "";
            return name + '="' + xss.escapeAttrValue(value) + '"';
        },
    };
    return xss(str, options);
};

const isValidCity = (city) => /^[\p{L}\p{M}\s'’\-\d]{2,50}$/u.test(city);

module.exports = { sanitizeInput, isValidCity };
