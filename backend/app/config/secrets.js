/**
 * Central access to secrets. There are deliberately NO hard-coded fallbacks:
 * a missing secret must fail loudly rather than silently using a public
 * default (which would let anyone forge payment signatures or login tokens).
 */
function readSecret(name) {
  const value = process.env[name];
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`Server misconfiguration: ${name} is not set`);
    error.statusCode = 500;
    error.code = "MISSING_SECRET";
    throw error;
  }
  return value.trim();
}

export const getRazorpayKeyId = () => readSecret("RAZORPAY_KEY_ID");
export const getRazorpayKeySecret = () => readSecret("RAZORPAY_KEY_SECRET");
export const getJwtSecret = () => readSecret("JWT_SECRET");

/** OTP hashing uses its own secret when set, otherwise the JWT secret. */
export const getOtpHashSecret = () =>
  process.env.OTP_HASH_SECRET && process.env.OTP_HASH_SECRET.trim()
    ? process.env.OTP_HASH_SECRET.trim()
    : readSecret("JWT_SECRET");

export default {
  getRazorpayKeyId,
  getRazorpayKeySecret,
  getJwtSecret,
  getOtpHashSecret,
};
