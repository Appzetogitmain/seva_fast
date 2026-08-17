import axios from "axios";
import { getWhatsAppConfig } from "../../config/whatsapp.js";
import { maskPhone } from "../../utils/phone.js";
import logger from "../../services/logger.js";

function buildSendTextUrl(config) {
  return `${config.baseUrl}/send-text`;
}

function buildSendImageUrl(config) {
  return `${config.baseUrl}/send-image`;
}

// Tezsender expects the destination number in international format without
// a leading '+' (our numbers are already normalized to E.164 upstream).
function toTezsenderPhone(e164Phone) {
  return String(e164Phone || "").replace(/^\+/, "");
}

function requireConfig() {
  const config = getWhatsAppConfig();
  if (!config) {
    const error = new Error("WhatsApp is not configured");
    error.statusCode = 500;
    error.code = "WHATSAPP_NOT_CONFIGURED";
    throw error;
  }
  return config;
}

function mapTezsenderError(error) {
  const responseData = error.response?.data;
  const message = responseData?.message || error.message || "WhatsApp send failed";
  const mapped = new Error(message);
  mapped.statusCode = error.response ? 502 : 500;
  return mapped;
}

/**
 * Sends a plain-text WhatsApp message via Tezsender's QR/device-based
 * send-text endpoint (GET https://tezsender.in/api/send-text). This device
 * mode has no Meta template approval — the message body is whatever our own
 * internal templates (whatsapp.templates.js) render, sent as-is as `msg`.
 */
export async function sendWhatsAppTextMessage({ to, message }) {
  const config = requireConfig();

  if (!message || !String(message).trim()) {
    const error = new Error("WhatsApp message text is required");
    error.statusCode = 400;
    throw error;
  }

  const params = {
    api_key: config.apiKey,
    number: toTezsenderPhone(to),
    msg: message,
  };

  try {
    const response = await axios.get(buildSendTextUrl(config), {
      params,
      timeout: config.timeoutMs,
    });

    // Tezsender always replies HTTP 200 and signals failure via body.status.
    if (!response.data?.status) {
      const error = new Error(response.data?.message || "WhatsApp send failed");
      error.statusCode = 502;
      throw error;
    }

    return {
      success: true,
      waMessageId: response.data?.msgId || response.data?.data?.id || response.data?.id || "",
      ackStatus: response.data?.ackStatus || "",
      raw: response.data,
    };
  } catch (error) {
    const mapped = error.statusCode ? error : mapTezsenderError(error);
    logger.error("Tezsender WhatsApp text send failed", {
      to: maskPhone(to),
      message: mapped.message,
    });
    throw mapped;
  }
}

/**
 * Sends an image WhatsApp message (with an optional caption) via Tezsender's
 * send-image endpoint. Same GET/query-string shape as send-text, plus an
 * image URL. Confirmed against a live "api_key, number, msg, and image_url
 * are required" validation error from Tezsender: the caption field is named
 * `msg` (same as send-text), not `caption`.
 */
export async function sendWhatsAppImageMessage({ to, imageUrl, caption = "" }) {
  const config = requireConfig();

  const url = String(imageUrl || "").trim();
  if (!url) {
    const error = new Error("WhatsApp image URL is required");
    error.statusCode = 400;
    throw error;
  }

  const params = {
    api_key: config.apiKey,
    number: toTezsenderPhone(to),
    msg: caption || "",
    image_url: url,
  };

  try {
    const response = await axios.get(buildSendImageUrl(config), {
      params,
      timeout: config.timeoutMs,
    });

    // Tezsender always replies HTTP 200 and signals failure via body.status.
    if (!response.data?.status) {
      const error = new Error(response.data?.message || "WhatsApp image send failed");
      error.statusCode = 502;
      throw error;
    }

    return {
      success: true,
      waMessageId: response.data?.msgId || response.data?.data?.id || response.data?.id || "",
      ackStatus: response.data?.ackStatus || "",
      raw: response.data,
    };
  } catch (error) {
    const mapped = error.statusCode ? error : mapTezsenderError(error);
    logger.error("Tezsender WhatsApp image send failed", {
      to: maskPhone(to),
      message: mapped.message,
    });
    throw mapped;
  }
}

export default {
  sendWhatsAppTextMessage,
  sendWhatsAppImageMessage,
};
