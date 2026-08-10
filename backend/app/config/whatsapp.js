function parseBool(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).trim().toLowerCase() === "true";
}

export function isWhatsAppEnabled() {
  return parseBool(process.env.WHATSAPP_ENABLED, false);
}

/**
 * Lazily reads WhatsApp Cloud API config from env on every call (mirrors
 * smsIndiaHubService's pattern) so credentials added at runtime (env reload,
 * process restart) are picked up without a stale cached singleton.
 * Returns null when disabled or incomplete — callers must treat that as
 * "gracefully skip", never throw into the caller's flow.
 */
export function getWhatsAppConfig() {
  if (!isWhatsAppEnabled()) return null;

  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();

  if (!accessToken || !phoneNumberId) {
    return null;
  }

  return {
    accessToken,
    phoneNumberId,
    businessAccountId: String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim(),
    apiVersion: String(process.env.WHATSAPP_API_VERSION || "v20.0").trim(),
    baseUrl: String(process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com")
      .trim()
      .replace(/\/+$/, ""),
    timeoutMs: parseInt(process.env.WHATSAPP_SEND_TIMEOUT_MS || "15000", 10),
    defaultLanguageCode: String(process.env.WHATSAPP_DEFAULT_LANGUAGE_CODE || "en_US").trim(),
    appSecret: String(process.env.WHATSAPP_APP_SECRET || "").trim(),
    webhookVerifyToken: String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim(),
  };
}

export function isWhatsAppConfigured() {
  return getWhatsAppConfig() !== null;
}

export default {
  isWhatsAppEnabled,
  getWhatsAppConfig,
  isWhatsAppConfigured,
};
