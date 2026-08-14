import axios from "axios";
import { getWhatsAppConfig } from "../../config/whatsapp.js";
import { maskPhone } from "../../utils/phone.js";
import logger from "../../services/logger.js";

function buildSendTemplateUrl(config) {
  return `${config.baseUrl}/send-template`;
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
 * Sends an approved WhatsApp template message via Tezsender's Official
 * (Meta Cloud device) send-template endpoint. Business-initiated WhatsApp
 * messages (order updates, birthday wishes, campaigns) must use an approved
 * template outside the 24h customer-service session window — this is the
 * only send path those flows should use.
 */
export async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  languageCode,
  bodyParams = [],
}) {
  const config = requireConfig();

  if (!templateName) {
    const error = new Error("WhatsApp template name is required");
    error.statusCode = 400;
    throw error;
  }

  const params = {
    api_key: config.apiKey,
    number: toTezsenderPhone(to),
    template_name: templateName,
    language: languageCode || config.defaultLanguageCode,
  };
  if (bodyParams.length) {
    params.params = bodyParams.map((value) => String(value ?? "")).join(",");
  }

  try {
    const response = await axios.get(buildSendTemplateUrl(config), {
      params,
      timeout: config.timeoutMs,
    });

    if (!response.data?.status) {
      const error = new Error(response.data?.message || "WhatsApp send failed");
      error.statusCode = 502;
      throw error;
    }

    return {
      success: true,
      waMessageId: response.data?.data?.id || response.data?.id || response.data?.msg_id || "",
      raw: response.data,
    };
  } catch (error) {
    const mapped = error.statusCode ? error : mapTezsenderError(error);
    logger.error("Tezsender WhatsApp template send failed", {
      to: maskPhone(to),
      templateName,
      message: mapped.message,
    });
    throw mapped;
  }
}

export default {
  sendWhatsAppTemplateMessage,
};
