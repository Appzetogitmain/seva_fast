import { getWhatsAppConfig } from "../../config/whatsapp.js";
import { WHATSAPP_MESSAGE_TYPES } from "./whatsapp.constants.js";

/**
 * Template names/languages are intentionally kept here, separate from
 * dispatcher/business logic, so ops can repoint an event at a different
 * Tezsender-approved template (or change its language) via env vars only —
 * no code change, no redeploy of order/campaign logic.
 */
function envOrDefault(envKey, fallback) {
  const value = process.env[envKey];
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function defaultLanguageCode() {
  const config = getWhatsAppConfig();
  return config?.defaultLanguageCode || envOrDefault("WHATSAPP_DEFAULT_LANGUAGE_CODE", "en_US");
}

const TEMPLATE_MAP = {
  [WHATSAPP_MESSAGE_TYPES.ORDER_PLACED]: {
    envName: "WHATSAPP_TEMPLATE_ORDER_PLACED",
    defaultName: "order_placed",
    envLang: "WHATSAPP_TEMPLATE_LANG_ORDER_PLACED",
  },
  [WHATSAPP_MESSAGE_TYPES.OUT_FOR_DELIVERY]: {
    envName: "WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY",
    defaultName: "order_out_for_delivery",
    envLang: "WHATSAPP_TEMPLATE_LANG_OUT_FOR_DELIVERY",
  },
  [WHATSAPP_MESSAGE_TYPES.ORDER_DELIVERED]: {
    envName: "WHATSAPP_TEMPLATE_ORDER_DELIVERED",
    defaultName: "order_delivered",
    envLang: "WHATSAPP_TEMPLATE_LANG_ORDER_DELIVERED",
  },
  [WHATSAPP_MESSAGE_TYPES.ORDER_CANCELLED]: {
    envName: "WHATSAPP_TEMPLATE_ORDER_CANCELLED",
    defaultName: "order_cancelled",
    envLang: "WHATSAPP_TEMPLATE_LANG_ORDER_CANCELLED",
  },
  [WHATSAPP_MESSAGE_TYPES.BIRTHDAY_WISH]: {
    envName: "WHATSAPP_TEMPLATE_BIRTHDAY_WISH",
    defaultName: "birthday_wish",
    envLang: "WHATSAPP_TEMPLATE_LANG_BIRTHDAY_WISH",
  },
};

export function getTemplateForType(messageType) {
  const entry = TEMPLATE_MAP[messageType];
  if (!entry) return null;
  return {
    name: envOrDefault(entry.envName, entry.defaultName),
    languageCode: envOrDefault(entry.envLang, defaultLanguageCode()),
  };
}

/**
 * Ordered body-parameter builders — must match the {{1}}, {{2}}... variable
 * order in the corresponding approved template. Update here if an
 * approved template's variable order/count changes.
 */
export function buildOrderEventBodyParams(messageType, vars = {}) {
  const { customerName, orderNumber, amount, status, deliveryInfo } = vars;
  switch (messageType) {
    case WHATSAPP_MESSAGE_TYPES.ORDER_PLACED:
      return [customerName, orderNumber, amount];
    case WHATSAPP_MESSAGE_TYPES.OUT_FOR_DELIVERY:
      return [customerName, orderNumber, deliveryInfo || "on the way"];
    case WHATSAPP_MESSAGE_TYPES.ORDER_DELIVERED:
      return [customerName, orderNumber, amount];
    case WHATSAPP_MESSAGE_TYPES.ORDER_CANCELLED:
      return [customerName, orderNumber, status || "cancelled"];
    default:
      return [customerName, orderNumber];
  }
}

export function buildBirthdayBodyParams(vars = {}) {
  return [vars.customerName || "there"];
}

export default {
  getTemplateForType,
  buildOrderEventBodyParams,
  buildBirthdayBodyParams,
};
