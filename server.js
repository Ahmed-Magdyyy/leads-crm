require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const { connectDB, closeDB } = require("./src/config/database");

// Import routes
const leadsRoutes = require("./src/routes/leads.routes");
const webhooksRoutes = require("./src/routes/webhooks.routes");

const app = express();

// Trust proxy for accurate IP addresses behind load balancers
app.set("trust proxy", 1);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
      },
    },
  }),
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Raw body parser for webhook signature verification (must be before express.json())
app.use("/webhooks", express.raw({ type: "application/json" }));

// JSON parser for other routes with size limit
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Routes
app.use("/api/leads", leadsRoutes);
app.use("/webhooks", webhooksRoutes);

// Health check with database status
app.get("/health", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    uptime: process.uptime(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message;

  console.error(`[${new Date().toISOString()}] Error:`, {
    status,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Leads CRM server running on port ${PORT}`);
  console.log(`📡 Webhook endpoints ready:`);
  console.log(`   - POST /webhooks/meta`);
  console.log(`   - POST /webhooks/snapchat`);
  console.log(`   - POST /webhooks/tiktok`);
  console.log(`🔍 Health check: GET /health`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    console.log("✅ HTTP server closed");
    await closeDB();
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
