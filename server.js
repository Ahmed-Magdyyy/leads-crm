require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./src/config/database");

// Import routes
const leadsRoutes = require("./src/routes/leads.routes");
const webhooksRoutes = require("./src/routes/webhooks.routes");

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// Raw body parser for webhook signature verification (must be before express.json())
app.use("/webhooks", express.raw({ type: "application/json" }));

// JSON parser for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/leads", leadsRoutes);
app.use("/webhooks", webhooksRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Leads CRM server running on port ${PORT}`);
  console.log(
    `📡 Webhook endpoints ready at /webhooks/meta, /webhooks/snapchat, /webhooks/tiktok`,
  );
});
