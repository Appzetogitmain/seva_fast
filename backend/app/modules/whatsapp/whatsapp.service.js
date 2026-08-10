import axios from "axios";
import { getWhatsAppConfig } from "../../config/whatsapp.js";
import { maskPhone } from "../../utils/phone.js";
import logger from "../../services/logger.js";

function buildMessagesUrl(config) {
  return `${config.baseUrl}/${config.apiVersion}/${config.phoneNumberId}/messages`;
}

// Graph API expects the destination number in international format without
// a leading '+' (our numbers are already normalized to E.164 upstream).
function toGraphPhone(e164Phone) {
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

function mapGraphError(error) {
  const graphError = error.response?.data?.error;
  const message = graphError?.message || error.message || "WhatsApp send failed";
  const mapped = new Error(message);
  mapped.statusCode = error.response ? 502 : 500;
  mapped.providerCode = graphError?.code;
  mapped.providerSubcode = graphError?.error_subcode;
  return mapped;
}

/**
 * Sends a Meta-approved template message. Business-initiated WhatsApp
 * messages (order updates, birthday wishes, campaigns) must use an approved
 * template outside the 24h customer-service session window — this is the
 * only send path those flows should use.
 */
export async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  languageCode,
  bodyParams = [],
  headerImageUrl,
}) {
  const config = requireConfig();

  if (!templateName) {
    const error = new Error("WhatsApp template name is required");
    error.statusCode = 400;
    throw error;
  }

  const components = [];
  if (headerImageUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: headerImageUrl } }],
    });
  }
  if (bodyParams.length) {
    components.push({
      type: "body",
      parameters: bodyParams.map((value) => ({ type: "text", text: String(value ?? "") })),
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: toGraphPhone(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode || config.defaultLanguageCode },
      ...(components.length ? { components } : {}),
    },
  };

  try {
    const response = await axios.post(buildMessagesUrl(config), payload, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: config.timeoutMs,
    });

    return {
      success: true,
      waMessageId: response.data?.messages?.[0]?.id || "",
      raw: response.data,
    };
  } catch (error) {
    const mapped = mapGraphError(error);
    logger.error("WhatsApp Graph API template send failed", {
      to: maskPhone(to),
      templateName,
      message: mapped.message,
      providerCode: mapped.providerCode,
    });
    throw mapped;
  }
}

export default {
  sendWhatsAppTemplateMessage,
};
