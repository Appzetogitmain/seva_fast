import WhatsAppTemplate from "../../models/whatsappTemplate.js";
import { WHATSAPP_MESSAGE_TYPES } from "./whatsapp.constants.js";
import logger from "../../services/logger.js";

/**
 * Plain-text message templates sent as-is through Tezsender's send-text
 * (QR/device) API — no Meta template approval involved. {placeholders} are
 * filled in by renderTemplate() below.
 *
 * Source of truth, in priority order:
 *   1. Admin-edited row in the WhatsAppTemplate collection (DB)
 *   2. WHATSAPP_TEMPLATE_* env var
 *   3. Hardcoded default below
 * This lets admins edit copy from the panel without a redeploy, while still
 * having a safe fallback if the DB is unreachable or a row was never set.
 */
function envOrDefault(envKey, fallback) {
  const value = process.env[envKey];
  return value && String(value).trim() ? String(value).trim() : fallback;
}

const TEMPLATE_MAP = {
  [WHATSAPP_MESSAGE_TYPES.ORDER_PLACED]: {
    envKey: "WHATSAPP_TEMPLATE_ORDER_PLACED",
    default: "Hi {name}, your order #{orderNumber} has been placed successfully. Amount: {amount}. We'll notify you when it's out for delivery.",
    label: "Order Placed",
  },
  [WHATSAPP_MESSAGE_TYPES.OUT_FOR_DELIVERY]: {
    envKey: "WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY",
    default: "Hi {name}, your order #{orderNumber} is out for delivery.",
    label: "Out for Delivery",
  },
  [WHATSAPP_MESSAGE_TYPES.ORDER_DELIVERED]: {
    envKey: "WHATSAPP_TEMPLATE_ORDER_DELIVERED",
    default: "Hi {name}, your order #{orderNumber} has been delivered. Amount: {amount}. Thank you for shopping with us!",
    label: "Order Delivered",
  },
  [WHATSAPP_MESSAGE_TYPES.ORDER_CANCELLED]: {
    envKey: "WHATSAPP_TEMPLATE_ORDER_CANCELLED",
    default: "Hi {name}, your order #{orderNumber} has been cancelled. Status: {status}.",
    label: "Order Cancelled",
  },
  [WHATSAPP_MESSAGE_TYPES.BIRTHDAY_WISH]: {
    envKey: "WHATSAPP_TEMPLATE_BIRTHDAY_WISH",
    default: "Happy Birthday {name}! Wishing you a wonderful day from all of us.",
    label: "Birthday Wish",
  },
};

// Placeholders each template type is rendered with — surfaced to the admin
// UI so editors know which {tokens} are available for a given message type.
const TEMPLATE_VARS = {
  [WHATSAPP_MESSAGE_TYPES.ORDER_PLACED]: ["name", "orderNumber", "amount"],
  [WHATSAPP_MESSAGE_TYPES.OUT_FOR_DELIVERY]: ["name", "orderNumber"],
  [WHATSAPP_MESSAGE_TYPES.ORDER_DELIVERED]: ["name", "orderNumber", "amount"],
  [WHATSAPP_MESSAGE_TYPES.ORDER_CANCELLED]: ["name", "orderNumber", "status"],
  [WHATSAPP_MESSAGE_TYPES.BIRTHDAY_WISH]: ["name"],
};

export async function getTemplateForType(messageType) {
  const entry = TEMPLATE_MAP[messageType];
  if (!entry) return null;

  try {
    const dbTemplate = await WhatsAppTemplate.findOne({ messageType }).lean();
    if (dbTemplate?.text) return dbTemplate.text;
  } catch (error) {
    logger.error("Failed to read WhatsApp template from database, falling back", {
      messageType,
      message: error.message,
    });
  }

  return envOrDefault(entry.envKey, entry.default);
}

/**
 * Effective template per event type for the admin panel — resolves the same
 * priority chain as getTemplateForType() but also reports where each value
 * came from, so the UI can show "Customized" vs "Default".
 */
export async function listEffectiveTemplates() {
  const dbTemplates = await WhatsAppTemplate.find({}).lean();
  const dbByType = new Map(dbTemplates.map((t) => [t.messageType, t]));

  return Object.entries(TEMPLATE_MAP).map(([messageType, entry]) => {
    const dbRow = dbByType.get(messageType);
    if (dbRow?.text) {
      return {
        messageType,
        label: entry.label,
        text: dbRow.text,
        variables: TEMPLATE_VARS[messageType] || [],
        source: "database",
        defaultText: entry.default,
        updatedAt: dbRow.updatedAt,
      };
    }
    return {
      messageType,
      label: entry.label,
      text: envOrDefault(entry.envKey, entry.default),
      variables: TEMPLATE_VARS[messageType] || [],
      source: process.env[entry.envKey] ? "env" : "default",
      defaultText: entry.default,
      updatedAt: null,
    };
  });
}

/** Replaces {key} placeholders with vars[key]; leaves unknown placeholders untouched. */
export function renderTemplate(template, vars = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value !== undefined && value !== null && value !== "" ? String(value) : match;
  });
}

export default {
  getTemplateForType,
  listEffectiveTemplates,
  renderTemplate,
};
