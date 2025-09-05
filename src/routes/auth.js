import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// POST /api/auth/token
router.post("/token", (req, res) => {
  const { client_id, client_secret } = req.body;

  if (
    client_id === process.env.OAUTH_CLIENT_ID &&
    client_secret === process.env.OAUTH_CLIENT_SECRET
  ) {
    const accessToken = jwt.sign(
      { client_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRY || "1h" }
    );

    return res.json({ access_token: accessToken, token_type: "Bearer" });
  }

  return res.status(401).json({ error: "Invalid client credentials" });
});

export default router;
