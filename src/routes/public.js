import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "✅ Public route is working" });
});

export default router;
