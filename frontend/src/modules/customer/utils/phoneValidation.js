// Shared Indian mobile number validation helpers, used everywhere the
// customer app collects/validates a phone number (auth/signup, addresses).
//
// A valid Indian mobile number is exactly 10 digits and must start with
// 6, 7, 8 or 9.
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Strips all non-digit characters and removes a leading Indian country code
 * (e.g. "+91"/"91") or a leading trunk "0" so a number sourced with a
 * country-code prefix (such as a profile phone normalized to E.164 on the
 * backend, e.g. "+919876543210") validates the same way as a bare 10-digit
 * number typed by the user.
 */
export function normalizePhoneNumber(rawPhone) {
  let digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

/** Returns true if the given value normalizes to a valid Indian mobile number. */
export function isValidIndianPhone(rawPhone) {
  return INDIAN_MOBILE_REGEX.test(normalizePhoneNumber(rawPhone));
}
