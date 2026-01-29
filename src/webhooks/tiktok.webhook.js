const crypto = require("crypto");
const Lead = require("../models/Lead");
const WebhookLog = require("../models/WebhookLog");

/**
 * Verify TikTok webhook signature
 */
const verifySignature = (payload, signature) => {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.TIKTOK_APP_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature),
  );
};

/**
 * Parse TikTok lead data into our schema format
 */
const parseTiktokLead = (leadData) => {
  const data = {
    customFields: {},
  };

  // TikTok provides form fields as an array
  const formFields = leadData.form_fields || leadData.fields || [];

  formFields.forEach((field) => {
    const fieldName = (field.field_name || field.name || "").toLowerCase();
    const value = field.value || field.answer || "";

    switch (fieldName) {
      case "email":
        data.email = value;
        break;
      case "phone":
      case "phone_number":
      case "phonenumber":
        data.phone = value;
        break;
      case "name":
      case "full_name":
      case "fullname":
        data.customerName = value;
        break;
      case "first_name":
      case "firstname":
        data.firstName = value;
        break;
      case "last_name":
      case "lastname":
        data.lastName = value;
        break;
      default:
        data.customFields[field.field_name || field.name] = value;
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
 * Handle TikTok webhook events (POST request)
 */
const handleWebhook = async (req, res) => {
  const payload = req.body.toString();
  const signature =
    req.headers["x-tiktok-signature"] || req.headers["x-tt-signature"];

  // Log the webhook
  const log = new WebhookLog({
    platform: "tiktok",
    headers: req.headers,
    rawPayload: JSON.parse(payload),
    ipAddress: req.ip,
  });

  try {
    // Verify signature in production
    if (process.env.NODE_ENV === "production") {
      if (!verifySignature(payload, signature)) {
        log.error = "Invalid signature";
        await log.save();
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const data = JSON.parse(payload);

    // TikTok may wrap lead in different structures
    const eventType = data.event || data.event_type || "lead_submitted";
    log.eventType = eventType;

    // Handle lead events
    const leadData = data.lead || data.data?.lead || data;
    const leadId = leadData.lead_id || leadData.id || data.lead_id;

    if (leadId) {
      const parsedData = parseTiktokLead(leadData);

      // Create or update lead
      const lead = await Lead.findOneAndUpdate(
        { platform: "tiktok", platformLeadId: leadId },
        {
          platform: "tiktok",
          platformLeadId: leadId,
          formId: leadData.form_id || data.form_id,
          formName: leadData.form_name || data.form_name,
          adId: leadData.ad_id || data.ad_id,
          adName: leadData.ad_name || data.ad_name,
          campaignId: leadData.campaign_id || data.campaign_id,
          campaignName: leadData.campaign_name || data.campaign_name,
          ...parsedData,
          platformCreatedAt: leadData.create_time
            ? new Date(leadData.create_time * 1000)
            : new Date(),
          receivedAt: new Date(),
        },
        { upsert: true, new: true },
      );

      log.leadId = lead._id;
      log.processed = true;
      console.log(`✅ TikTok lead saved: ${lead._id}`);
    }

    await log.save();

    // TikTok expects 200 response
    res.status(200).json({ code: 0, message: "success" });
  } catch (error) {
    console.error("Error processing TikTok webhook:", error);
    log.error = error.message;
    await log.save();
    res.status(200).json({ code: 0, message: "success", error: error.message });
  }
};

module.exports = {
  handleWebhook,
};
