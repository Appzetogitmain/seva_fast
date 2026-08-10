import crypto from "crypto";
import handleResponse from "../../utils/helper.js";
import WhatsAppCampaign from "../../models/whatsappCampaign.js";
import WhatsAppMessage from "../../models/whatsappMessage.js";
import Customer from "../../models/customer.js";
import { createCampaignSchema, validateSchema } from "../../validation/whatsappValidation.js";
import { dispatchCampaign } from "./whatsappCampaign.service.js";
import { getWhatsAppConfig, isWhatsAppEnabled } from "../../config/whatsapp.js";
import logger from "../../services/logger.js";

// ── Config status (admin) — never returns the access token / app secret ───

export const getWhatsAppConfigStatus = async (req, res) => {
  try {
    const config = getWhatsAppConfig();
    return handleResponse(res, 200, "WhatsApp config status", {
      enabled: isWhatsAppEnabled(),
      configured: Boolean(config),
      phoneNumberIdSet: Boolean(config?.phoneNumberId),
      businessAccountIdSet: Boolean(config?.businessAccountId),
      webhookVerifyTokenSet: Boolean(String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim()),
      appSecretSet: Boolean(String(process.env.WHATSAPP_APP_SECRET || "").trim()),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ── Campaigns (admin) ──────────────────────────────────────────────────────

export const createCampaign = async (req, res) => {
  try {
    const payload = validateSchema(createCampaignSchema, req.body);

    if (payload.audienceType === "selected") {
      const validCount = await Customer.countDocuments({ _id: { $in: payload.targetCustomerIds } });
      if (validCount !== payload.targetCustomerIds.length) {
        return handleResponse(res, 400, "One or more selected customers were not found");
      }
    }

    const campaign = await WhatsAppCampaign.create({
      ...payload,
      status: payload.scheduleType === "scheduled" ? "scheduled" : "draft",
      createdBy: req.user?.id || null,
    });

    if (payload.scheduleType === "immediate") {
      setImmediate(() => {
        dispatchCampaign(campaign._id).catch((error) => {
          logger.error("Immediate WhatsApp campaign dispatch failed", {
            campaignId: String(campaign._id),
            message: error.message,
          });
        });
      });
    }

    return handleResponse(res, 201, "Campaign created", campaign);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const listCampaigns = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      WhatsAppCampaign.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WhatsAppCampaign.countDocuments(filter),
    ]);

    return handleResponse(res, 200, "Campaigns fetched", { items, total, page, limit });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getCampaign = async (req, res) => {
  try {
    const campaign = await WhatsAppCampaign.findById(req.params.id).lean();
    if (!campaign) return handleResponse(res, 404, "Campaign not found");
    return handleResponse(res, 200, "Campaign fetched", campaign);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const cancelCampaign = async (req, res) => {
  try {
    const campaign = await WhatsAppCampaign.findOneAndUpdate(
      { _id: req.params.id, status: "scheduled" },
      { $set: { status: "cancelled" } },
      { new: true },
    );
    if (!campaign) {
      return handleResponse(res, 400, "Only scheduled campaigns that have not been sent yet can be cancelled");
    }
    return handleResponse(res, 200, "Campaign cancelled", campaign);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getCampaignMessages = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const filter = { relatedCampaign: req.params.id };
    const [items, total] = await Promise.all([
      WhatsAppMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customer", "name phone")
        .lean(),
      WhatsAppMessage.countDocuments(filter),
    ]);

    return handleResponse(res, 200, "Campaign messages fetched", { items, total, page, limit });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ── Message tracking (admin) ───────────────────────────────────────────────

export const listWhatsAppMessages = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.messageType) filter.messageType = req.query.messageType;
    if (req.query.customerId) filter.customer = req.query.customerId;
    if (req.query.orderId) filter.relatedOrder = req.query.orderId;

    const [items, total] = await Promise.all([
      WhatsAppMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customer", "name phone")
        .lean(),
      WhatsAppMessage.countDocuments(filter),
    ]);

    return handleResponse(res, 200, "WhatsApp messages fetched", { items, total, page, limit });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ── Webhook (Meta) ──────────────────────────────────────────────────────────
// GET handshake: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
// POST delivery/read/failure status callbacks, signed with X-Hub-Signature-256
// over the raw request body using the app secret.

export const verifyWhatsAppWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expected = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim();
  if (!expected) {
    // Fail closed: no verify token configured means we reject rather than
    // silently accepting an unauthenticated subscription handshake.
    logger.error("WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set — rejecting webhook verification");
    return res.status(403).send("Forbidden");
  }

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(String(token || ""));
  const matches =
    expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

  if (mode === "subscribe" && matches) {
    return res.status(200).send(String(challenge ?? ""));
  }
  return res.status(403).send("Forbidden");
};

function isValidSignature(req) {
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || "").trim();
  const signatureHeader = req.headers["x-hub-signature-256"];

  if (!appSecret) {
    logger.error("WHATSAPP_APP_SECRET is not set — rejecting webhook payload");
    return false;
  }
  if (!signatureHeader || !Buffer.isBuffer(req.body)) return false;

  const expectedSignature = `sha256=${crypto.createHmac("sha256", appSecret).update(req.body).digest("hex")}`;
  const expectedBuf = Buffer.from(expectedSignature);
  const receivedBuf = Buffer.from(String(signatureHeader));
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

const STATUS_RANK = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 1 };

async function applyStatusUpdate(statusUpdate) {
  const waMessageId = statusUpdate?.id;
  const status = statusUpdate?.status;
  if (!waMessageId || !status || !(status in STATUS_RANK)) return;

  const existing = await WhatsAppMessage.findOne({ waMessageId }).select("status").lean();
  if (!existing) return;
  if (STATUS_RANK[status] < STATUS_RANK[existing.status]) {
    // Out-of-order webhook delivery — never downgrade a further-along status.
    return;
  }

  const update = { status };
  if (status === "delivered") update.deliveredAt = new Date();
  if (status === "read") update.readAt = new Date();
  if (status === "failed") {
    update.failureReason =
      statusUpdate?.errors?.[0]?.title || statusUpdate?.errors?.[0]?.message || "Delivery failed";
  }

  await WhatsAppMessage.updateOne({ waMessageId }, { $set: update });
}

export const receiveWhatsAppWebhook = async (req, res) => {
  if (!isValidSignature(req)) {
    return res.status(401).send("Invalid signature");
  }

  // Ack immediately so Meta doesn't retry-storm us while we process.
  res.status(200).send("EVENT_RECEIVED");

  try {
    const body = JSON.parse(req.body.toString("utf8"));
    const entries = Array.isArray(body?.entry) ? body.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
        for (const statusUpdate of statuses) {
          await applyStatusUpdate(statusUpdate);
        }
      }
    }
  } catch (error) {
    logger.error("Failed to process WhatsApp webhook payload", { message: error.message });
  }
};

export default {
  getWhatsAppConfigStatus,
  createCampaign,
  listCampaigns,
  getCampaign,
  cancelCampaign,
  getCampaignMessages,
  listWhatsAppMessages,
  verifyWhatsAppWebhook,
  receiveWhatsAppWebhook,
};
