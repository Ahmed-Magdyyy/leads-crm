const crypto = require("crypto");
const Lead = require("../models/Lead");
const WebhookLog = require("../models/WebhookLog");

/**
 * Verify TikTok webhook signature
 * TikTok uses HMAC-SHA256 for signature verification
 */
const verifySignature = (payload, signature) => {
  if (!signature || !process.env.TIKTOK_APP_SECRET) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.TIKTOK_APP_SECRET)
      .update(payload)
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
    console.error("TikTok signature verification error:", error.message);
    return false;
  }
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
  // Respond immediately to TikTok (they expect specific format)
  res.status(200).json({ code: 0, message: "success" });

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
        console.error("❌ TikTok webhook: Invalid signature");
        return;
      }
    }

    const data = JSON.parse(payload);

    // TikTok may wrap lead in different structures
    const eventType = data.event || data.event_type || "lead_submitted";
    log.eventType = eventType;

    // Handle lead events - TikTok can send data in various formats
    const leadData = data.lead || data.data?.lead || data;
    const leadId = leadData.lead_id || leadData.id || data.lead_id;

    if (!leadId) {
      log.error = "Missing lead_id in payload";
      await log.save();
      console.error("❌ TikTok webhook: Missing lead_id");
      return;
    }

    const parsedData = parseTiktokLead(leadData);

    // Parse TikTok timestamp (can be Unix seconds or milliseconds)
    let platformCreatedAt = new Date();
    if (leadData.create_time) {
      const timestamp = parseInt(leadData.create_time, 10);
      // If timestamp is in seconds (less than year 3000 in seconds)
      platformCreatedAt =
        timestamp < 32503680000
          ? new Date(timestamp * 1000)
          : new Date(timestamp);
    }

    // Create or update lead with all available fields
    const lead = await Lead.findOneAndUpdate(
      { platform: "tiktok", platformLeadId: leadId },
      {
        platform: "tiktok",
        platformLeadId: leadId,
        formId: leadData.form_id || data.form_id || null,
        formName: leadData.form_name || data.form_name || null,
        adId: leadData.ad_id || data.ad_id || null,
        adName: leadData.ad_name || data.ad_name || null,
        adsetId: leadData.adgroup_id || data.adgroup_id || null,
        adsetName: leadData.adgroup_name || data.adgroup_name || null,
        campaignId: leadData.campaign_id || data.campaign_id || null,
        campaignName: leadData.campaign_name || data.campaign_name || null,
        ...parsedData,
        platformCreatedAt,
        receivedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true },
    );

    log.leadId = lead._id;
    log.processed = true;
    console.log(
      `✅ TikTok lead saved: ${lead._id} (form: ${leadData.form_name || leadData.form_id})`,
    );

    await log.save();
  } catch (error) {
    console.error("Error processing TikTok webhook:", error.message);
    log.error = error.message;
    await log.save();
  }
};

module.exports = {
  handleWebhook,
};
