const crypto = require("crypto");
const axios = require("axios");
const Lead = require("../models/Lead");
const WebhookLog = require("../models/WebhookLog");

/**
 * Verify Meta webhook signature
 */
const verifySignature = (payload, signature) => {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.META_APP_SECRET)
    .update(payload)
    .digest("hex");

  const receivedSignature = signature.replace("sha256=", "");
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature),
  );
};

/**
 * Handle Meta webhook verification (GET request)
 * Facebook sends this to verify your webhook endpoint
 */
const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("✅ Meta webhook verified");
    return res.status(200).send(challenge);
  }

  console.log("❌ Meta webhook verification failed");
  return res.status(403).json({ error: "Verification failed" });
};

/**
 * Fetch full lead details from Meta Graph API
 */
const fetchLeadDetails = async (leadgenId) => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${leadgenId}`,
      {
        params: {
          access_token: process.env.META_ACCESS_TOKEN,
          fields: "id,created_time,field_data,form_id,ad_id,campaign_id",
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching Meta lead details:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

/**
 * Fetch form name from Meta
 */
const fetchFormName = async (formId) => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${formId}`,
      {
        params: {
          access_token: process.env.META_ACCESS_TOKEN,
          fields: "name",
        },
      },
    );
    return response.data.name;
  } catch (error) {
    console.error(
      "Error fetching form name:",
      error.response?.data || error.message,
    );
    return null;
  }
};

/**
 * Parse field_data array into structured object
 */
const parseFieldData = (fieldData) => {
  const data = {
    customFields: {},
  };

  if (!fieldData) return data;

  fieldData.forEach((field) => {
    const name = field.name.toLowerCase();
    const value = field.values?.[0] || "";

    switch (name) {
      case "email":
        data.email = value;
        break;
      case "phone_number":
      case "phone":
        data.phone = value;
        break;
      case "full_name":
        data.customerName = value;
        break;
      case "first_name":
        data.firstName = value;
        break;
      case "last_name":
        data.lastName = value;
        break;
      default:
        data.customFields[field.name] = value;
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
 * Handle Meta webhook events (POST request)
 */
const handleWebhook = async (req, res) => {
  const payload = req.body.toString();
  const signature = req.headers["x-hub-signature-256"];

  // Log the webhook
  const log = new WebhookLog({
    platform: "meta",
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

    // Process each entry
    for (const entry of data.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === "leadgen") {
          const leadgenId = change.value.leadgen_id;
          const formId = change.value.form_id;
          const adId = change.value.ad_id;

          log.eventType = "leadgen";

          // Fetch full lead details from Meta API
          const leadDetails = await fetchLeadDetails(leadgenId);
          const formName = await fetchFormName(formId);
          const parsedData = parseFieldData(leadDetails.field_data);

          // Create or update lead
          const lead = await Lead.findOneAndUpdate(
            { platform: "meta", platformLeadId: leadgenId },
            {
              platform: "meta",
              platformLeadId: leadgenId,
              formId: formId,
              formName: formName,
              adId: adId,
              campaignId: leadDetails.campaign_id,
              ...parsedData,
              platformCreatedAt: leadDetails.created_time
                ? new Date(leadDetails.created_time)
                : new Date(),
              receivedAt: new Date(),
            },
            { upsert: true, new: true },
          );

          log.leadId = lead._id;
          log.processed = true;
          console.log(`✅ Meta lead saved: ${lead._id}`);
        }
      }
    }

    await log.save();

    // Facebook expects a 200 response within 20 seconds
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing Meta webhook:", error);
    log.error = error.message;
    await log.save();

    // Still return 200 to prevent Facebook from retrying
    res.status(200).json({ received: true, error: error.message });
  }
};

module.exports = {
  verifyWebhook,
  handleWebhook,
};
