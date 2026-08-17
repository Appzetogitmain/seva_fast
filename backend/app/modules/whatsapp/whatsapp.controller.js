import handleResponse from "../../utils/helper.js";
import WhatsAppCampaign from "../../models/whatsappCampaign.js";
import WhatsAppMessage from "../../models/whatsappMessage.js";
import WhatsAppTemplate, { WHATSAPP_TEMPLATE_TYPES } from "../../models/whatsappTemplate.js";
import Customer from "../../models/customer.js";
import { createCampaignSchema, updateTemplateSchema, validateSchema } from "../../validation/whatsappValidation.js";
import { dispatchCampaign } from "./whatsappCampaign.service.js";
import { listEffectiveTemplates } from "./whatsapp.templates.js";
import { getWhatsAppConfig, isWhatsAppEnabled } from "../../config/whatsapp.js";
import { uploadToCloudinary } from "../../services/mediaService.js";
import logger from "../../services/logger.js";

// ── Config status (admin) — never returns the API key ──────────────────────

export const getWhatsAppConfigStatus = async (req, res) => {
  try {
    const config = getWhatsAppConfig();
    return handleResponse(res, 200, "WhatsApp config status", {
      enabled: isWhatsAppEnabled(),
      configured: Boolean(config),
      apiKeySet: Boolean(config?.apiKey),
      baseUrl: config?.baseUrl || "",
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

/**
 * POST /api/admin/whatsapp/campaigns/upload-image (admin only)
 * Uploads a campaign offer image to Cloudinary. Returns the public URL to be
 * passed as `imageUrl` when creating a campaign with contentType "image".
 * Request: multipart/form-data with field "image".
 */
export const uploadCampaignImage = async (req, res) => {
  try {
    if (!req.file) {
      return handleResponse(res, 400, "An image file is required");
    }

    const url = await uploadToCloudinary(req.file.buffer, "whatsapp-campaigns", {
      mimeType: req.file.mimetype,
      resourceType: "image",
    });

    return handleResponse(res, 200, "Image uploaded", { url });
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

// ── Message templates (admin) ───────────────────────────────────────────────
// Source of truth for the 5 automated event templates (order lifecycle +
// birthday). The dispatcher (whatsapp.templates.js) reads this same
// collection first, falling back to env vars / hardcoded defaults if a row
// doesn't exist yet — so editing here takes effect immediately, no redeploy.

export const listWhatsAppTemplates = async (req, res) => {
  try {
    const templates = await listEffectiveTemplates();
    return handleResponse(res, 200, "WhatsApp templates fetched", templates);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateWhatsAppTemplate = async (req, res) => {
  try {
    const { messageType } = req.params;
    if (!WHATSAPP_TEMPLATE_TYPES.includes(messageType)) {
      return handleResponse(res, 400, "Unknown template type");
    }
    const payload = validateSchema(updateTemplateSchema, req.body);

    const template = await WhatsAppTemplate.findOneAndUpdate(
      { messageType },
      { $set: { text: payload.text, updatedBy: req.user?.id || null } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return handleResponse(res, 200, "Template updated", template);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const resetWhatsAppTemplate = async (req, res) => {
  try {
    const { messageType } = req.params;
    if (!WHATSAPP_TEMPLATE_TYPES.includes(messageType)) {
      return handleResponse(res, 400, "Unknown template type");
    }
    await WhatsAppTemplate.deleteOne({ messageType });
    return handleResponse(res, 200, "Template reset to default");
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

export default {
  getWhatsAppConfigStatus,
  uploadCampaignImage,
  createCampaign,
  listCampaigns,
  getCampaign,
  cancelCampaign,
  getCampaignMessages,
  listWhatsAppTemplates,
  updateWhatsAppTemplate,
  resetWhatsAppTemplate,
  listWhatsAppMessages,
};
