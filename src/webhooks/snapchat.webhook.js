const crypto = require("crypto");
const Lead = require("../models/Lead");
const WebhookLog = require("../models/WebhookLog");

/**
 * Verify Snapchat webhook signature
 */
const verifySignature = (payload, signature, timestamp) => {
  if (!signature || !timestamp) return false;

  const signatureBaseString = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.SNAPCHAT_CLIENT_SECRET)
    .update(signatureBaseString)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature),
  );
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
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const data = JSON.parse(payload);

    // Snapchat may send different event types
    const eventType = data.event_type || "lead_submitted";
    log.eventType = eventType;

    if (eventType === "lead_submitted" || data.lead) {
      const leadData = data.lead || data;
      const leadId = leadData.lead_id || leadData.id;

      const parsedData = parseSnapchatLead(leadData);

      // Create or update lead
      const lead = await Lead.findOneAndUpdate(
        { platform: "snapchat", platformLeadId: leadId },
        {
          platform: "snapchat",
          platformLeadId: leadId,
          formId: leadData.form_id,
          formName: leadData.form_name,
          adId: leadData.ad_id,
          adName: leadData.ad_name,
          campaignId: leadData.campaign_id,
          campaignName: leadData.campaign_name,
          ...parsedData,
          platformCreatedAt: leadData.created_at
            ? new Date(leadData.created_at)
            : new Date(),
          receivedAt: new Date(),
        },
        { upsert: true, new: true },
      );

      log.leadId = lead._id;
      log.processed = true;
      console.log(`✅ Snapchat lead saved: ${lead._id}`);
    }

    await log.save();
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing Snapchat webhook:", error);
    log.error = error.message;
    await log.save();
    res.status(200).json({ received: true, error: error.message });
  }
};

module.exports = {
  handleWebhook,
};
