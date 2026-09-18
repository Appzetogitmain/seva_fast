/**
 * Extract a 6-digit Indian pincode from free-text address fields.
 */
export function extractIndianPincode(...sources) {
  for (const source of sources) {
    const text = String(source || "").trim();
    if (!text) continue;

    const matches = text.match(/\b(\d{6})\b/g);
    if (!matches?.length) continue;

    // Prefer the last 6-digit group (often at end of formatted addresses).
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const pin = matches[i];
      if (/^\d{6}$/.test(pin)) return pin;
    }
  }
  return "";
}

/**
 * Best-effort parse of "City, State, Pincode" style strings.
 */
export function parseCityStatePincode(cityText = "") {
  const text = String(cityText || "").trim();
  if (!text) {
    return { city: "", state: "", pincode: "" };
  }

  const pincode = extractIndianPincode(text);
  const withoutPin = pincode ? text.replace(pincode, "").replace(/,\s*$/, "").trim() : text;
  const parts = withoutPin.split(",").map((p) => p.trim()).filter(Boolean);

  return {
    city: parts[0] || withoutPin,
    state: parts[1] || "",
    pincode,
  };
}

/**
 * Resolves a delivery pincode/city/state from an Order/checkout `address`
 * object, tolerating clients that don't send a dedicated `pincode` field —
 * falls back to parsing it out of `city` or `address`/`landmark` free text.
 * Shared by shiprocketOrderService.js and deliveryDecisionService.js so both
 * resolve the same pincode for the same address.
 */
export function resolveDeliveryPincodeCityState(addr = {}) {
  const parsedCity = parseCityStatePincode(addr.city);
  const pincode =
    String(addr.pincode || "").trim() ||
    parsedCity.pincode ||
    extractIndianPincode(addr.address, addr.landmark);
  const city =
    parsedCity.city && String(addr.city || "").includes(",")
      ? parsedCity.city
      : String(addr.city || "").trim() || parsedCity.city;
  const state = String(addr.state || "").trim() || parsedCity.state;
  return { pincode, city, state };
}
