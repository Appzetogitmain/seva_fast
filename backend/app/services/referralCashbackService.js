/**
 * Refer & Earn cashback.
 *
 * Runs ALONGSIDE the existing MLM level commission (finance/commissionService
 * processOrderLevelCommissions) — it never reads or changes that flow.
 *
 * Rule: when a referred customer's FIRST delivered order has passed its return
 * window without being returned, the direct referrer gets a one-time cashback
 * (fixed amount or % of the order, configured by admin) in their wallet.
 *
 * Safety properties:
 *  - Disabled by default; only orders delivered after the admin enabled it
 *    (settings.referralCashback.effectiveFrom) are ever considered.
 *  - At most one reward per referred customer (unique index on ReferralReward).
 *  - Wallet $inc + Transaction + reward status are written in one DB
 *    transaction, and the Transaction reference is unique per friend.
 *  - Suspicious referrals are held as "flagged" for admin review, not paid.
 */
import mongoose from "mongoose";
import Customer from "../models/customer.js";
import Order from "../models/order.js";
import Setting from "../models/setting.js";
import Transaction from "../models/transaction.js";
import ReferralReward from "../models/referralReward.js";
import { roundCurrency } from "../utils/money.js";
import { normalizePhoneNumber } from "../utils/phone.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import logger from "./logger.js";

const DEFAULT_ADMIN_REFERRAL_CODE = "SEVAFAST";
const SAME_ADDRESS_RADIUS_METERS = 50;
const BATCH_SIZE = 100;
// A completed order whose return was rejected is still a completed order.
const COMPLETED_RETURN_STATUSES = ["none", "return_rejected"];

export const FRAUD_SIGNALS = {
  SAME_DEVICE: "same_device_as_referrer",
  SAME_SIGNUP_IP: "same_signup_network_as_referrer",
  SAME_PHONE: "delivery_phone_matches_referrer",
  SAME_ADDRESS: "delivery_address_matches_referrer",
};

export async function getReferralCashbackConfig() {
  const settings = await Setting.findOne({
    $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
  })
    .select("referralCashback")
    .lean();
  const cfg = settings?.referralCashback || {};
  return {
    enabled: Boolean(cfg.enabled),
    rewardType: cfg.rewardType === "percent" ? "percent" : "fixed",
    rewardValue: Math.max(0, Number(cfg.rewardValue) || 0),
    maxRewardAmount: Math.max(0, Number(cfg.maxRewardAmount) || 0),
    minOrderValue: Math.max(0, Number(cfg.minOrderValue) || 0),
    maxRewardsPerReferrerPerMonth: Math.max(0, Number(cfg.maxRewardsPerReferrerPerMonth) || 0),
    effectiveFrom: cfg.effectiveFrom ? new Date(cfg.effectiveFrom) : null,
  };
}

/** Order value used for the minimum check and % reward: items subtotal. */
export function getQualifyingOrderAmount(order) {
  const subtotal = Number(order?.pricing?.subtotal);
  if (Number.isFinite(subtotal) && subtotal > 0) return roundCurrency(subtotal);
  return roundCurrency(Number(order?.pricing?.total) || 0);
}

export function computeRewardAmount(config, orderAmount) {
  if (config.rewardType === "percent") {
    let amount = roundCurrency((orderAmount * config.rewardValue) / 100);
    if (config.maxRewardAmount > 0) amount = Math.min(amount, config.maxRewardAmount);
    return roundCurrency(amount);
  }
  return roundCurrency(config.rewardValue);
}

function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function hasCoords(loc) {
  return typeof loc?.lat === "number" && typeof loc?.lng === "number" && (loc.lat !== 0 || loc.lng !== 0);
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function detectFraudSignals({ customer, referrer, order }) {
  const signals = [];

  if (customer.signupDeviceId && customer.signupDeviceId === referrer.signupDeviceId) {
    signals.push(FRAUD_SIGNALS.SAME_DEVICE);
  }
  if (customer.signupIp && customer.signupIp === referrer.signupIp) {
    signals.push(FRAUD_SIGNALS.SAME_SIGNUP_IP);
  }

  const referrerPhone = normalizePhoneNumber(referrer.phone || "");
  const deliveryPhone = normalizePhoneNumber(order?.address?.phone || "");
  if (referrerPhone && deliveryPhone && referrerPhone === deliveryPhone) {
    signals.push(FRAUD_SIGNALS.SAME_PHONE);
  }

  const deliveryLoc = order?.address?.location;
  const deliveryText = normalizeText(order?.address?.address);
  const sameAddress = (referrer.addresses || []).some((addr) => {
    if (hasCoords(deliveryLoc) && hasCoords(addr.location)) {
      return distanceMeters(deliveryLoc, addr.location) <= SAME_ADDRESS_RADIUS_METERS;
    }
    const addrText = normalizeText(addr.fullAddress || addr.formattedAddress);
    return Boolean(deliveryText && addrText && deliveryText === addrText);
  });
  if (sameAddress) signals.push(FRAUD_SIGNALS.SAME_ADDRESS);

  return signals;
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Credits a reward that is in "processing", "flagged" (admin approved) or
 * "failed" (retry). Wallet, ledger and reward status move together.
 */
export async function creditReferralReward(rewardId, { reviewedBy = null, reviewNote = "" } = {}) {
  const session = await mongoose.startSession();
  let credited = null;
  try {
    await session.withTransaction(async () => {
      const reward = await ReferralReward.findById(rewardId).session(session);
      if (!reward) throw Object.assign(new Error("Referral reward not found"), { statusCode: 404 });
      if (reward.status === "credited") {
        credited = { reward, alreadyCredited: true };
        return;
      }
      if (!["processing", "flagged", "failed"].includes(reward.status)) {
        throw Object.assign(new Error(`Cannot credit a reward in status "${reward.status}"`), { statusCode: 409 });
      }
      if (!(reward.amount > 0)) {
        throw Object.assign(new Error("Reward amount must be greater than 0"), { statusCode: 400 });
      }

      const reference = `REF-CASHBACK-${reward.referredCustomer}`;
      const existingTx = await Transaction.findOne({ reference }).session(session).lean();
      let balance = null;
      if (!existingTx) {
        const updatedReferrer = await Customer.findByIdAndUpdate(
          reward.referrer,
          { $inc: { walletBalance: reward.amount } },
          { new: true, session, select: "walletBalance" },
        );
        if (!updatedReferrer) {
          throw Object.assign(new Error("Referrer account not found"), { statusCode: 404 });
        }
        balance = updatedReferrer.walletBalance;

        await Transaction.create(
          [
            {
              user: reward.referrer,
              userModel: "User",
              type: "Cashback",
              amount: reward.amount,
              status: "Settled",
              reference,
              meta: {
                source: "referral_cashback",
                referralRewardId: reward._id,
                referredUser: reward.referredCustomer,
                orderId: reward.order,
                orderAmount: reward.orderAmount,
                rewardType: reward.rewardType,
                rewardValue: reward.rewardValue,
                description: "Referral cashback — friend completed first order",
              },
            },
          ],
          { session },
        );
      }

      reward.status = "credited";
      reward.transactionReference = reference;
      reward.creditedAt = new Date();
      if (reviewedBy) {
        reward.reviewedBy = reviewedBy;
        reward.reviewedAt = new Date();
        reward.reviewNote = reviewNote || reward.reviewNote;
      }
      await reward.save({ session });
      credited = { reward, balance, alreadyCredited: Boolean(existingTx) };
    });
  } catch (error) {
    // Only an automatic credit attempt moves to "failed"; an admin action
    // just returns the error and leaves the reward as it was.
    if (!reviewedBy) {
      await ReferralReward.updateOne(
        { _id: rewardId, status: "processing" },
        { $set: { status: "failed", reason: error.message } },
      ).catch(() => {});
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (credited && !credited.alreadyCredited) {
    const { reward, balance } = credited;
    const friend = await Customer.findById(reward.referredCustomer).select("name").lean();
    emitNotificationEvent(NOTIFICATION_EVENTS.REFERRAL_CASHBACK_CREDITED, {
      customerId: reward.referrer,
      userId: reward.referrer,
      data: {
        amount: reward.amount,
        direction: "credited",
        reason: `Referral cashback — ${friend?.name || "your friend"} completed their first order`,
        balance: balance ?? undefined,
        friendName: friend?.name || "your friend",
        dedupeKey: `referral-cashback:${reward.referredCustomer}`,
      },
    });
  }
  return credited?.reward || null;
}

async function markOrderChecked(orderId) {
  await Order.updateOne({ _id: orderId }, { $set: { referralCashbackCheckedAt: new Date() } });
}

/**
 * Decide the outcome for one order whose return window has closed.
 * Returns a short string describing what happened (for logs/tests).
 */
export async function evaluateOrderForReferralCashback(order, config) {
  const customer = await Customer.findById(order.customer)
    .select("name phone referredBy +signupIp +signupDeviceId")
    .lean();
  if (!customer?.referredBy) return "not_referred";

  if (await ReferralReward.exists({ referredCustomer: customer._id })) return "already_rewarded";

  // Only the friend's FIRST delivered order can earn the referrer cashback.
  const earlierDelivered = await Order.exists({
    customer: customer._id,
    _id: { $ne: order._id },
    deliveredAt: { $lt: order.deliveredAt },
    $or: [{ status: "delivered" }, { workflowStatus: "DELIVERED" }],
  });
  if (earlierDelivered) return "not_first_order";

  const referrer = await Customer.findById(customer.referredBy)
    .select("name phone role referralCode isActive addresses +signupIp +signupDeviceId")
    .lean();

  // The platform's default code is a fallback, not a person — no cashback.
  if (
    referrer &&
    referrer.role === "admin" &&
    String(referrer.referralCode || "").toUpperCase() === DEFAULT_ADMIN_REFERRAL_CODE
  ) {
    return "platform_referrer";
  }

  const orderAmount = getQualifyingOrderAmount(order);
  const base = {
    referrer: customer.referredBy,
    referredCustomer: customer._id,
    order: order._id,
    orderId: order.orderId || "",
    orderAmount,
    rewardType: config.rewardType,
    rewardValue: config.rewardValue,
  };

  const createRecord = async (fields) => {
    try {
      return await ReferralReward.create({ ...base, ...fields });
    } catch (error) {
      if (error?.code === 11000) return null; // another worker got here first
      throw error;
    }
  };

  if (!referrer) {
    await createRecord({ status: "ineligible", amount: 0, reason: "Referrer account not found" });
    return "ineligible";
  }
  if (referrer.isActive === false) {
    await createRecord({ status: "ineligible", amount: 0, reason: "Referrer account is inactive" });
    return "ineligible";
  }
  if (String(referrer._id) === String(customer._id)) {
    await createRecord({ status: "ineligible", amount: 0, reason: "Self referral" });
    return "ineligible";
  }
  if (orderAmount < config.minOrderValue) {
    await createRecord({
      status: "ineligible",
      amount: 0,
      reason: `Order value ₹${orderAmount} is below the minimum ₹${config.minOrderValue}`,
    });
    return "ineligible";
  }

  const amount = computeRewardAmount(config, orderAmount);
  if (!(amount > 0)) {
    await createRecord({ status: "ineligible", amount: 0, reason: "Cashback value is not configured" });
    return "ineligible";
  }

  if (config.maxRewardsPerReferrerPerMonth > 0) {
    const thisMonth = await ReferralReward.countDocuments({
      referrer: referrer._id,
      status: "credited",
      creditedAt: { $gte: startOfCurrentMonth() },
    });
    if (thisMonth >= config.maxRewardsPerReferrerPerMonth) {
      await createRecord({
        status: "ineligible",
        amount,
        reason: `Referrer reached the monthly limit of ${config.maxRewardsPerReferrerPerMonth} cashback rewards`,
      });
      return "ineligible";
    }
  }

  const fraudSignals = detectFraudSignals({ customer, referrer, order });
  if (fraudSignals.length > 0) {
    await createRecord({
      status: "flagged",
      amount,
      fraudSignals,
      reason: "Held for admin review",
    });
    return "flagged";
  }

  const reward = await createRecord({ status: "processing", amount });
  if (!reward) return "already_rewarded";
  try {
    await creditReferralReward(reward._id);
  } catch (error) {
    // Reward is now "failed" and visible to admin for a manual retry.
    logger.error("Referral cashback credit failed", {
      rewardId: String(reward._id),
      error: error.message,
    });
    return "credit_failed";
  }
  return "credited";
}

/** Scheduler entry point — scans orders whose return window has closed. */
export async function processReferralCashbacks() {
  const config = await getReferralCashbackConfig();
  if (!config.enabled || !config.effectiveFrom) return { processed: 0, skipped: "disabled" };

  const now = new Date();
  const orders = await Order.find({
    status: "delivered",
    returnStatus: { $in: COMPLETED_RETURN_STATUSES },
    returnWindowExpiresAt: { $lte: now },
    deliveredAt: { $gte: config.effectiveFrom },
    referralCashbackCheckedAt: null,
  })
    .sort({ deliveredAt: 1 })
    .limit(BATCH_SIZE)
    .select("_id orderId customer deliveredAt pricing address")
    .lean();

  const outcomes = {};
  for (const order of orders) {
    try {
      const outcome = await evaluateOrderForReferralCashback(order, config);
      outcomes[outcome] = (outcomes[outcome] || 0) + 1;
      await markOrderChecked(order._id);
    } catch (error) {
      // Left unchecked so the next run retries it.
      outcomes.error = (outcomes.error || 0) + 1;
      logger.error("Referral cashback evaluation failed", {
        orderId: order.orderId,
        error: error.message,
      });
    }
  }

  if (orders.length > 0) {
    logger.info("Referral cashback run completed", { scanned: orders.length, outcomes });
  }
  return { processed: orders.length, outcomes };
}

export default {
  processReferralCashbacks,
  evaluateOrderForReferralCashback,
  creditReferralReward,
  getReferralCashbackConfig,
  computeRewardAmount,
  detectFraudSignals,
};
