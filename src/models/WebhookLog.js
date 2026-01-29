const mongoose = require("mongoose");

const webhookLogSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["meta", "snapchat", "tiktok"],
      required: true,
      index: true,
    },
    eventType: {
      type: String,
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
    },
    processed: {
      type: Boolean,
      default: false,
    },
    error: {
      type: String,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Auto-delete logs older than 30 days
webhookLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

const WebhookLog = mongoose.model("WebhookLog", webhookLogSchema);

module.exports = WebhookLog;
