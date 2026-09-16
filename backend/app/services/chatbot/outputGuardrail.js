// Defense-in-depth output filter for chatbot replies. The system prompts
// already instruct the model never to leak secrets/infra details, but that's
// a soft guardrail — this regex pass runs server-side on every reply
// regardless of what the model actually did, and can't be bypassed by
// prompt injection.
const SECRET_PATTERNS = [
  { name: "google_api_key", regex: /AIza[0-9A-Za-z_-]{20,}/g },
  {
    name: "generic_secret_assignment",
    regex: /\b(?:api[_-]?key|secret|access[_-]?token|password|db[_-]?password)\s*[:=]\s*['"]?[A-Za-z0-9_\-/+]{10,}['"]?/gi,
  },
  { name: "mongo_connection_uri", regex: /mongodb(?:\+srv)?:\/\/[^\s'"<>]+/gi },
  { name: "jwt_like_token", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  {
    name: "private_key_block",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
];

/**
 * Scans/redacts a chatbot reply for accidental secret/credential leakage.
 * Returns the (possibly redacted) text plus which pattern names fired, so
 * callers can log a moderation event for confirmed leak attempts.
 */
export function applyOutputGuardrail(text) {
  if (!text || typeof text !== "string") {
    return { text, triggered: false, flags: [] };
  }

  let sanitized = text;
  const flags = [];

  for (const { name, regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(sanitized)) {
      flags.push(name);
      regex.lastIndex = 0;
      sanitized = sanitized.replace(regex, "[REDACTED]");
    }
  }

  return { text: sanitized, triggered: flags.length > 0, flags };
}
