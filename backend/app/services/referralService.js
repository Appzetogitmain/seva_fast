import crypto from "crypto";
import Customer from "../models/customer.js";

const DEFAULT_ADMIN_REFERRAL_CODE = "SEVAFAST";

export async function resolveReferrerByCode(referralCode = "") {
  const normalizedCode = String(referralCode || "").trim().toUpperCase();
  if (!normalizedCode) return null;

  if (normalizedCode === DEFAULT_ADMIN_REFERRAL_CODE) {
    let adminUser = await Customer.findOne({
      referralCode: DEFAULT_ADMIN_REFERRAL_CODE,
      role: "admin",
    });

    if (!adminUser) {
      adminUser = await Customer.create({
        name: "SEVAFAST Admin",
        phone: "+910000000000",
        role: "admin",
        referralCode: DEFAULT_ADMIN_REFERRAL_CODE,
        isVerified: true,
      });
    }

    return adminUser;
  }

  return Customer.findOne({ referralCode: normalizedCode });
}

export async function resolveReferrerIdByCode(referralCode = "") {
  const referrer = await resolveReferrerByCode(referralCode);
  return referrer?._id || null;
}

export function generateReferralCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export function isSelfReferral(buyerId, referrerId) {
  if (!buyerId || !referrerId) return false;
  return String(buyerId) === String(referrerId);
}

export async function resolvePlanPurchaseReferrer(
  buyerId,
  { referralCode = "" } = {},
) {
  const normalizedCode =
    String(referralCode || "").trim().toUpperCase() || DEFAULT_ADMIN_REFERRAL_CODE;

  const referrer = await resolveReferrerByCode(normalizedCode);
  if (referrer && !isSelfReferral(buyerId, referrer._id)) {
    return referrer._id;
  }

  const fallbackReferrer = await resolveReferrerByCode(DEFAULT_ADMIN_REFERRAL_CODE);
  return fallbackReferrer?._id || null;
}
