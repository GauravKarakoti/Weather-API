const allowedOrigins = [
  process.env.ALLOWED_ORIGIN,
  process.env.ALLOWED_ORIGIN2,
  process.env.ALLOWED_ORIGIN3,
  process.env.ALLOWED_ORIGIN4,
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

module.exports = { corsOptions };
