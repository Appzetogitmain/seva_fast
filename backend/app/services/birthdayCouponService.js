import crypto from "crypto";
import Coupon from "../models/coupon.js";
import logger from "./logger.js";

// Rule fields cloned from the admin-marked template into each per-customer
// coupon. Per-instance fields (code, assignedCustomer, validity window,
// usage limits, dedupeKey) are set fresh for every issuance, never copied.
const CLONEABLE_TEMPLATE_FIELDS = [
  "title",
  "description",
  "discountType",
  "discountValue",
  "maxDiscount",
  "couponType",
  "minOrderValue",
  "minItems",
  "applicableCategories",
  "monthlyVolumeThreshold",
];

function generateBirthdayCouponCode() {
  return `HBD${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function findActiveBirthdayTemplate() {
  const now = new Date();
  return Coupon.findOne({
    isBirthdayTemplate: true,
    isActive: true,
    validFrom: { $lte: now },
    validTill: { $gte: now },
  }).lean();
}

/**
 * Idempotently issues (or returns the already-issued) birthday coupon for a
 * customer/year, cloned from whichever coupon the admin marked as the
 * birthday template. Returns null if no active template is configured —
 * callers should treat that as "no coupon this year," not an error.
 *
 * Idempotency: create-first, same idiom as WhatsAppMessage.dedupeKey — the
 * unique partial index on Coupon.dedupeKey is the single source of truth
 * that stops two concurrent/duplicate scheduler runs from ever issuing two
 * coupons for the same customer/year. A pre-check find() would leave a race
 * window; letting the DB reject the duplicate insert doesn't.
 */
export async function issueBirthdayCoupon(customer, year) {
  const dedupeKey = `birthday:${customer._id}:${year}`;

  const template = await findActiveBirthdayTemplate();
  if (!template) return null;

  const validFrom = new Date();
  const validTill = new Date(validFrom.getTime() + (template.birthdayValidityDays || 7) * 24 * 60 * 60 * 1000);

  const base = {};
  for (const field of CLONEABLE_TEMPLATE_FIELDS) {
    if (template[field] !== undefined) base[field] = template[field];
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Coupon.create({
        ...base,
        code: generateBirthdayCouponCode(),
        title: base.title || "Birthday Special",
        description: base.description || "A birthday gift, just for you!",
        assignedCustomer: customer._id,
        usageLimit: 1,
        perUserLimit: 1,
        isBirthdayTemplate: false,
        validFrom,
        validTill,
        isActive: true,
        dedupeKey,
      });
    } catch (error) {
      if (error?.code === 11000 && error.keyPattern?.dedupeKey) {
        const existing = await Coupon.findOne({ dedupeKey }).lean();
        if (existing) return existing;
        continue; // extremely unlikely: raced out between the conflict and this read
      }
      if (error?.code === 11000 && error.keyPattern?.code) {
        continue; // random code collision — retry with a freshly generated code
      }
      throw error;
    }
  }

  logger.error("Failed to issue birthday coupon after retries", {
    customerId: String(customer._id),
    year,
  });
  return null;
}

export function formatCouponDiscountLabel(coupon) {
  if (coupon.discountType === "free_delivery") return "Free delivery";
  if (coupon.discountType === "fixed") return `Rs. ${coupon.discountValue} off`;
  const capped = coupon.maxDiscount ? ` (up to Rs. ${coupon.maxDiscount})` : "";
  return `${coupon.discountValue}% off${capped}`;
}

export default { issueBirthdayCoupon, formatCouponDiscountLabel };
