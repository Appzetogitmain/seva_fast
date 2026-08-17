function parseBool(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).trim().toLowerCase() === "true";
}

export function isWhatsAppEnabled() {
  return parseBool(process.env.WHATSAPP_ENABLED, false);
}

/**
 * Lazily reads Tezsender config from env on every call (mirrors
 * smsIndiaHubService's pattern) so credentials added at runtime (env reload,
 * process restart) are picked up without a stale cached singleton.
 * Returns null when disabled or incomplete — callers must treat that as
 * "gracefully skip", never throw into the caller's flow.
 */
export function getWhatsAppConfig() {
  if (!isWhatsAppEnabled()) return null;

  const apiKey = String(process.env.TEZSENDER_API_KEY || "").trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: String(process.env.TEZSENDER_API_BASE_URL || "https://tezsender.in/api")
      .trim()
      .replace(/\/+$/, ""),
    timeoutMs: parseInt(process.env.TEZSENDER_SEND_TIMEOUT_MS || "15000", 10),
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
