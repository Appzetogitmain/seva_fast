/**
 * Renders admin-authored legal text as paragraphs.
 * Supports plain text (newlines) and light HTML if admin pastes markup.
 */
export function isHtmlLegalContent(value = "") {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || "").trim());
}

export function splitLegalParagraphs(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function normalizeLegalAudience(value) {
  const raw = String(value || "customer").toLowerCase().trim();
  if (raw === "seller" || raw === "delivery") return raw;
  return "customer";
}

export function getLegalContent(settings = {}, audience = "customer", type = "terms") {
  const role = normalizeLegalAudience(audience);
  const isPrivacy = type === "privacy";

  if (role === "seller") {
    return String(
      isPrivacy
        ? settings?.sellerPrivacyPolicy
        : settings?.sellerTermsAndConditions,
    ).trim();
  }
  if (role === "delivery") {
    return String(
      isPrivacy
        ? settings?.deliveryPrivacyPolicy
        : settings?.deliveryTermsAndConditions,
    ).trim();
  }
  return String(
    isPrivacy ? settings?.privacyPolicy : settings?.termsAndConditions,
  ).trim();
}

export function getLegalAudienceLabel(audience = "customer") {
  const role = normalizeLegalAudience(audience);
  if (role === "seller") return "Seller";
  if (role === "delivery") return "Delivery Partner";
  return "Customer";
}
