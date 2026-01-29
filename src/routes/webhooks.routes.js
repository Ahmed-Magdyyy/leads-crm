const express = require("express");
const router = express.Router();
const metaWebhook = require("../webhooks/meta.webhook");
const snapchatWebhook = require("../webhooks/snapchat.webhook");
const tiktokWebhook = require("../webhooks/tiktok.webhook");

// Meta (Facebook/Instagram) webhooks
router.get("/meta", metaWebhook.verifyWebhook);
router.post("/meta", metaWebhook.handleWebhook);

// Snapchat webhooks
router.post("/snapchat", snapchatWebhook.handleWebhook);

// TikTok webhooks
router.post("/tiktok", tiktokWebhook.handleWebhook);

module.exports = router;
