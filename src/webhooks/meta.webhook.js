const crypto = require("crypto");
const axios = require("axios");
const Lead = require("../models/Lead");
const WebhookLog = require("../models/WebhookLog");

// Configuration
const META_API_VERSION = "v24.0";
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry wrapper for API calls with exponential backoff
 */
const withRetry = async (fn, retries = MAX_RETRIES) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRetryable =
        error.response?.status >= 500 ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT";

      if (!isRetryable || attempt === retries) {
        throw error;
      }

      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(
        `⚠️ Meta API attempt ${attempt} failed, retrying in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }
  throw lastError;
};

/**
 * Verify Meta webhook signature
 */
const verifySignature = (payload, signature) => {
  if (!signature || !process.env.META_APP_SECRET) return false;

  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.META_APP_SECRET)
      .update(payload)
      .digest("hex");

    const receivedSignature = signature.replace("sha256=", "");

    // Ensure both buffers are the same length
    if (expectedSignature.length !== receivedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature),
    );
  } catch (error) {
    console.error("Signature verification error:", error.message);
    return false;
  }
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
  return withRetry(async () => {
    const response = await axios.get(`${META_API_BASE_URL}/${leadgenId}`, {
      params: {
        access_token: process.env.META_ACCESS_TOKEN,
        fields:
          "id,created_time,field_data,form_id,ad_id,adset_id,campaign_id,ad_name,adset_name,campaign_name",
      },
      timeout: 10000,
    });
    return response.data;
  }).catch((error) => {
    const errorDetails = error.response?.data?.error || error.message;
    console.error("Error fetching Meta lead details:", errorDetails);
    throw new Error(
      `Failed to fetch lead details: ${JSON.stringify(errorDetails)}`,
    );
  });
};

/**
 * Fetch form details from Meta
 */
const fetchFormDetails = async (formId) => {
  if (!formId) return null;

  return withRetry(async () => {
    const response = await axios.get(`${META_API_BASE_URL}/${formId}`, {
      params: {
        access_token: process.env.META_ACCESS_TOKEN,
        fields: "id,name,status,page",
      },
      timeout: 10000,
    });
    return response.data;
  }).catch((error) => {
    console.error(
      "Error fetching form details:",
      error.response?.data?.error || error.message,
    );
    return null;
  });
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
  console.log("📥 Meta webhook POST received");

  // Respond immediately to Meta (they expect response within 20 seconds)
  res.status(200).json({ received: true });

  const payload = req.body.toString();
  console.log("📦 Payload:", payload.substring(0, 200));
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
        console.error("❌ Meta webhook: Invalid signature");
        return;
      }
    }

    const data = JSON.parse(payload);

    // Validate payload structure
    if (!data.entry || !Array.isArray(data.entry)) {
      log.error = "Invalid payload structure: missing entry array";
      await log.save();
      console.error("❌ Meta webhook: Invalid payload structure");
      return;
    }

    // Process each entry
    for (const entry of data.entry) {
      const pageId = entry.id;

      for (const change of entry.changes || []) {
        if (change.field === "leadgen") {
          const leadgenId = change.value?.leadgen_id;
          const formId = change.value?.form_id;

          if (!leadgenId) {
            console.error("❌ Meta webhook: Missing leadgen_id");
            continue;
          }

          log.eventType = "leadgen";

          // Fetch full lead details from Meta API
          const [leadDetails, formDetails] = await Promise.all([
            fetchLeadDetails(leadgenId),
            fetchFormDetails(formId),
          ]);

          const parsedData = parseFieldData(leadDetails.field_data);

          // Create or update lead with all available fields
          const lead = await Lead.findOneAndUpdate(
            { platform: "meta", platformLeadId: leadgenId },
            {
              platform: "meta",
              platformLeadId: leadgenId,
              formId: formId || leadDetails.form_id,
              formName: formDetails?.name || null,
              adId: leadDetails.ad_id || change.value?.ad_id,
              adName: leadDetails.ad_name || null,
              adsetId: leadDetails.adset_id || null,
              adsetName: leadDetails.adset_name || null,
              campaignId: leadDetails.campaign_id || null,
              campaignName: leadDetails.campaign_name || null,
              pageId: pageId,
              ...parsedData,
              platformCreatedAt: leadDetails.created_time
                ? new Date(leadDetails.created_time)
                : new Date(),
              receivedAt: new Date(),
            },
            { upsert: true, new: true, runValidators: true },
          );

          log.leadId = lead._id;
          log.processed = true;
          console.log(
            `✅ Meta lead saved: ${lead._id} (form: ${formDetails?.name || formId})`,
          );
        }
      }
    }

    await log.save();
  } catch (error) {
    console.error("Error processing Meta webhook:", error.message);
    log.error = error.message;
    await log.save();
  }
};

module.exports = {
  verifyWebhook,
  handleWebhook,
};
