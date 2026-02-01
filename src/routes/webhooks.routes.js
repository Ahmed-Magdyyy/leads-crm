const express = require("express");
const router = express.Router();
const metaWebhook = require("../webhooks/meta.webhook");
const snapchatWebhook = require("../webhooks/snapchat.webhook");
const tiktokWebhook = require("../webhooks/tiktok.webhook");

// Debug middleware for all webhook routes
router.use((req, res, next) => {
  console.log(`🔔 Webhook route hit: ${req.method} ${req.path}`);
  next();
});

// Test endpoint to verify POST works
router.post("/test", (req, res) => {
  console.log("✅ Test webhook POST received");
  res.json({ success: true });
});

// Meta (Facebook/Instagram) webhooks
router.get("/meta", metaWebhook.verifyWebhook);
router.post("/meta", metaWebhook.handleWebhook);

// Snapchat webhooks
router.post("/snapchat", snapchatWebhook.handleWebhook);

// TikTok webhooks
router.post("/tiktok", tiktokWebhook.handleWebhook);

module.exports = router;
