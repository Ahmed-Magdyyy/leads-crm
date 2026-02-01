const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    // Platform identification
    platform: {
      type: String,
      enum: ["meta", "snapchat", "tiktok"],
      required: true,
      index: true,
    },
    platformLeadId: {
      type: String,
      required: true,
    },
    formId: {
      type: String,
    },
    formName: {
      type: String,
    },
    adId: {
      type: String,
    },
    adName: {
      type: String,
    },
    adsetId: {
      type: String,
    },
    adsetName: {
      type: String,
    },
    campaignId: {
      type: String,
    },
    campaignName: {
      type: String,
    },
    pageId: {
      type: String,
    },

    // Customer information
    customerName: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },

    // Additional fields from the form
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Lead status management
    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "converted", "lost"],
      default: "new",
      index: true,
    },

    // Internal notes
    notes: {
      type: String,
    },

    // Timestamps
    platformCreatedAt: {
      type: Date,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for deduplication
leadSchema.index({ platform: 1, platformLeadId: 1 }, { unique: true });

// Text index for search
leadSchema.index({ customerName: "text", email: "text", phone: "text" });

const Lead = mongoose.model("Lead", leadSchema);

module.exports = Lead;
