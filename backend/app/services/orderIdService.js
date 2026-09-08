import crypto from "crypto";
import Order from "../models/order.js";
import CheckoutGroup from "../models/checkoutGroup.js";

// Crockford Base32 excludes ambiguous letters (I, L, O, U) to avoid customer/rider confusion.
const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RANDOM_SUFFIX_LENGTH = 6;

function formatCompactDate(date = new Date()) {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function randomBase32(length) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CROCKFORD_BASE32[bytes[i] % CROCKFORD_BASE32.length];
  }
  return out;
}

export function buildPublicOrderId(now = new Date()) {
  return `ORD-${formatCompactDate(now)}-${randomBase32(RANDOM_SUFFIX_LENGTH)}`;
}

export function buildCheckoutGroupId(now = new Date()) {
  return `CHK-${formatCompactDate(now)}-${randomBase32(RANDOM_SUFFIX_LENGTH)}`;
}

export async function generateUniquePublicOrderId({ session = null, maxAttempts = 8 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = buildPublicOrderId();
    const query = Order.exists({ orderId: candidate });
    if (session) query.session(session);
    const exists = await query;
    if (!exists) return candidate;
  }
  const err = new Error("Unable to generate a unique public order id");
  err.statusCode = 500;
  throw err;
}

export async function generateUniqueCheckoutGroupId({ session = null, maxAttempts = 8 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = buildCheckoutGroupId();
    const query = CheckoutGroup.exists({ checkoutGroupId: candidate });
    if (session) query.session(session);
    const exists = await query;
    if (!exists) return candidate;
  }
  const err = new Error("Unable to generate a unique checkout group id");
  err.statusCode = 500;
  throw err;
}
