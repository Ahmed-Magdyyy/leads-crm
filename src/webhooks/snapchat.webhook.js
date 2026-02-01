const crypto = require("crypto");
const Lead = require("../models/Lead");
const WebhookLog = require("../models/WebhookLog");

// Configuration
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes tolerance for timestamp validation

/**
 * Verify Snapchat webhook signature
 * Snapchat uses HMAC-SHA256 with timestamp.payload format
 */
const verifySignature = (payload, signature, timestamp) => {
  if (!signature || !timestamp || !process.env.SNAPCHAT_CLIENT_SECRET) {
    return false;
  }

  try {
    // Validate timestamp is recent (prevent replay attacks)
    const webhookTime = parseInt(timestamp, 10) * 1000;
    const now = Date.now();
    if (Math.abs(now - webhookTime) > TIMESTAMP_TOLERANCE_MS) {
      console.error("Snapchat webhook: Timestamp too old or in future");
      return false;
    }

    const signatureBaseString = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.SNAPCHAT_CLIENT_SECRET)
      .update(signatureBaseString)
      .digest("hex");

    // Ensure both signatures are same length
    if (expectedSignature.length !== signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature),
    );
  } catch (error) {
    console.error("Snapchat signature verification error:", error.message);
    return false;
  }
};

/**
 * Parse Snapchat lead data into our schema format
 */
const parseSnapchatLead = (leadData) => {
  const data = {
    customFields: {},
  };

  // Snapchat provides form responses as an array
  const responses = leadData.form_responses || leadData.responses || [];

  responses.forEach((response) => {
    const questionType = response.question_type?.toLowerCase() || "";
    const questionId = response.question_id || "";
    const answer = response.answer || "";

    switch (questionType) {
      case "email":
        data.email = answer;
        break;
      case "phone":
      case "phone_number":
        data.phone = answer;
        break;
      case "name":
      case "full_name":
        data.customerName = answer;
        break;
      case "first_name":
        data.firstName = answer;
        break;
      case "last_name":
        data.lastName = answer;
        break;
      default:
        data.customFields[questionId || response.question] = answer;
    }
  });

  // Build customerName if not provided directly
  if (!data.customerName && (data.firstName || data.lastName)) {
    data.customerName = [data.firstName, data.lastName]
      .filter(Boolean)
      .join(" ");
  }

  return data;
};

/**
 * Handle Snapchat webhook events (POST request)
 */
const handleWebhook = async (req, res) => {
  // Respond immediately to Snapchat
  res.status(200).json({ received: true });

  const payload = req.body.toString();
  const signature = req.headers["x-snap-signature"];
  const timestamp = req.headers["x-snap-timestamp"];

  // Log the webhook
  const log = new WebhookLog({
    platform: "snapchat",
    headers: req.headers,
    rawPayload: JSON.parse(payload),
    ipAddress: req.ip,
  });

  try {
    // Verify signature in production
    if (process.env.NODE_ENV === "production") {
      if (!verifySignature(payload, signature, timestamp)) {
        log.error = "Invalid signature";
        await log.save();
        console.error("❌ Snapchat webhook: Invalid signature");
        return;
      }
    }

    const data = JSON.parse(payload);

    // Snapchat may send different event types
    const eventType = data.event_type || "lead_submitted";
    log.eventType = eventType;

    // Handle lead events
    if (eventType === "lead_submitted" || data.lead) {
      const leadData = data.lead || data;
      const leadId = leadData.lead_id || leadData.id;

      if (!leadId) {
        log.error = "Missing lead_id in payload";
        await log.save();
        console.error("❌ Snapchat webhook: Missing lead_id");
        return;
      }

      const parsedData = parseSnapchatLead(leadData);

      // Create or update lead with all available fields
      const lead = await Lead.findOneAndUpdate(
        { platform: "snapchat", platformLeadId: leadId },
        {
          platform: "snapchat",
          platformLeadId: leadId,
          formId: leadData.form_id || null,
          formName: leadData.form_name || null,
          adId: leadData.ad_id || null,
          adName: leadData.ad_name || null,
          adsetId: leadData.ad_squad_id || leadData.adset_id || null,
          adsetName: leadData.ad_squad_name || leadData.adset_name || null,
          campaignId: leadData.campaign_id || null,
          campaignName: leadData.campaign_name || null,
          ...parsedData,
          platformCreatedAt: leadData.created_at
            ? new Date(leadData.created_at)
            : new Date(),
          receivedAt: new Date(),
        },
        { upsert: true, new: true, runValidators: true },
      );

      log.leadId = lead._id;
      log.processed = true;
      console.log(
        `✅ Snapchat lead saved: ${lead._id} (form: ${leadData.form_name || leadData.form_id})`,
      );
    }

    await log.save();
  } catch (error) {
    console.error("Error processing Snapchat webhook:", error.message);
    log.error = error.message;
    await log.save();
  }
};

module.exports = {
  handleWebhook,
};
