import express from "express";
import dotenv from "dotenv";

// Import routes
import publicRoutes from "./routes/public.js";
import weatherRoutes from "./routes/weather.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// Routes
app.use("/api/public", publicRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/auth", authRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
