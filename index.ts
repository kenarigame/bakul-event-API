import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

import { config } from "./config";
import authRoutes from "./routes/auth.routes";
import eventRoutes from "./routes/event.routes";
import { errorHandler, notFound } from "./middlewares/error.middleware";

const app = express();

// Middleware
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use("/api", limiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);

// Health check
app.get("/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(
      `Server running on port ${config.port} in ${config.nodeEnv} mode`,
    );
  });
}
