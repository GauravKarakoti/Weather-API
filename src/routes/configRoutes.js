const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  return res.json({ message: "Configuration loaded successfully." });
});

module.exports = router;
