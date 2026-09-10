const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_PHONE_COUNTRY_CODE || "+91";

export function normalizePhoneNumber(rawPhone) {
  if (rawPhone == null) return "";
  let value = String(rawPhone).trim();
  if (!value) return "";

  value = value.replace(/[\s().-]/g, "");
  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }

  if (!value.startsWith("+")) {
    if (/^\d{10}$/.test(value)) {
      value = `${DEFAULT_COUNTRY_CODE}${value}`;
    } else {
      value = `+${value}`;
    }
  }

  const normalized = value.replace(/[^\d+]/g, "");
  return normalized;
}

export function isValidE164Phone(phone) {
  return /^\+[1-9]\d{7,14}$/.test(String(phone || ""));
}

export function maskPhone(phone) {
  const value = String(phone || "");
  if (value.length <= 4) return "***";
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

/**
 * Strips formatting and country code prefix (+91, 91, 0) to extract a clean 10-digit Indian phone number.
 */
export function normalizeIndian10DigitPhone(rawPhone) {
  if (rawPhone == null) return "";
  let digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  } else if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
}

/**
 * Generates all plausible database representations for a given phone input.
 * e.g. for "+919876543210" or "9876543210", returns:
 * ["9876543210", "+919876543210", "919876543210", "09876543210"]
 */
export function getPhoneLookupCandidates(rawPhone) {
  if (!rawPhone) return [];
  const rawTrimmed = String(rawPhone).trim();
  const tenDigit = normalizeIndian10DigitPhone(rawTrimmed);
  const candidates = new Set();
  if (rawTrimmed) candidates.add(rawTrimmed);
  if (tenDigit && tenDigit.length === 10) {
    candidates.add(tenDigit);
    candidates.add(`+91${tenDigit}`);
    candidates.add(`91${tenDigit}`);
    candidates.add(`0${tenDigit}`);
  }
  return Array.from(candidates);
}
