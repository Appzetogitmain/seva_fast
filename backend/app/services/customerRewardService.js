/**
 * Customer reward programs funded from the ADMIN COMMISSION.
 *
 * Site Cashback (per order)
 *   budget  = order admin commission × siteCashbackPercent (Fees & Charges)
 *   amount  = budget, limited by maxPerOrder / maxPerCustomerPerMonth
 *   Pending  → while the order is not yet settled or its return window is open
 *   Approved → settled (online PAID / COD cash collected), return window closed,
 *              not returned/refunded
 *   Credited → wallet credited (only when payouts are enabled)
 *   Reversed → order returned/refunded (wallet debited back if already credited)
 *
 * Direct Customer Buy Slab (per customer per month, IST)
 *   pool    = Σ eligible orders' admin commission × directSlabCommissionPercent
 *   reward  = the highest admin-configured slab the customer's eligible monthly
 *             spend reaches; if all rewards exceed the pool they are scaled down
 *             proportionally, so payouts never exceed the budget.
 *   Generated as Pending after month end + verification days; the admin
 *   verifies and approves; credited when payouts are enabled.
 *
 * Safety
 *   - Nothing is ever credited while customerRewards.payoutsEnabled is false.
 *   - Live tracking only starts from customerRewards.effectiveFrom (stamped the
 *     first time payouts are enabled) — no retroactive payouts.
 *   - Unique indexes (one cashback per order, one slab per customer per month)
 *     + unique Transaction references prevent double rewards.
 */
import mongoose from "mongoose";
import CustomerReward from "../models/customerReward.js";
import Order from "../models/order.js";
import Customer from "../models/customer.js";
import Setting from "../models/setting.js";
import Transaction from "../models/transaction.js";
import { roundCurrency } from "../utils/money.js";
import { getOrCreateFinanceSettings } from "./finance/financeSettingsService.js";

const IST_OFFSET_MIN = 330;
const RETURNED_FINAL = ["returned", "qc_passed", "refund_completed"];
const RETURN_IN_PROGRESS = [
  "return_requested",
  "return_approved",
  "return_pickup_assigned",
  "return_in_transit",
  "return_drop_pending",
];
const REFUND_PAYMENT_STATUSES = ["REFUNDED", "REFUND_PENDING", "REFUND_FAILED"];

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export const DEFAULT_REWARD_CONFIG = {
  payoutsEnabled: false,
  effectiveFrom: null,
  siteCashback: {
    enabled: true,
    minOrderValue: 0,
    maxPerOrder: 0,
    maxPerCustomerPerMonth: 0,
    holdDaysAfterDelivery: 1,
  },
  directSlab: {
    enabled: true,
    verificationDaysAfterMonthEnd: 3,
    slabs: [],
  },
};

export async function getRewardConfig() {
  const [setting, finance] = await Promise.all([
    Setting.findOne({}).select("customerRewards").lean(),
    getOrCreateFinanceSettings(),
  ]);
  const raw = setting?.customerRewards || {};
  const slabs = (raw.directSlab?.slabs || [])
    .map((s) => ({
      minMonthlySpend: Number(s.minMonthlySpend || 0),
      minOrders: Number(s.minOrders || 0),
      reward: Number(s.reward || 0),
    }))
    .filter((s) => (s.minMonthlySpend > 0 || s.minOrders > 0) && s.reward > 0)
    .sort((a, b) => a.minMonthlySpend - b.minMonthlySpend || a.minOrders - b.minOrders);
  return {
    payoutsEnabled: raw.payoutsEnabled === true,
    effectiveFrom: raw.effectiveFrom || null,
    siteCashback: { ...DEFAULT_REWARD_CONFIG.siteCashback, ...(raw.siteCashback || {}) },
    directSlab: { ...DEFAULT_REWARD_CONFIG.directSlab, ...(raw.directSlab || {}), slabs },
    // Budget rates are the admin-set splits from Fees & Charges.
    siteCashbackPercent: Number(finance?.siteCashbackPercent || 0),
    directSlabPercent: Number(finance?.directSlabCommissionPercent || 0),
  };
}

export async function updateRewardConfig(payload = {}) {
  const current = await getRewardConfig();
  const next = {
    payoutsEnabled: payload.payoutsEnabled !== undefined ? payload.payoutsEnabled === true : current.payoutsEnabled,
    effectiveFrom: current.effectiveFrom,
    siteCashback: { ...current.siteCashback },
    directSlab: { ...current.directSlab },
  };

  const num = (v, label) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      throw Object.assign(new Error(`${label} must be a number ≥ 0`), { statusCode: 400 });
    }
    return n;
  };

  if (payload.siteCashback) {
    const sc = payload.siteCashback;
    if (sc.enabled !== undefined) next.siteCashback.enabled = sc.enabled === true;
    for (const key of ["minOrderValue", "maxPerOrder", "maxPerCustomerPerMonth", "holdDaysAfterDelivery"]) {
      if (sc[key] !== undefined) next.siteCashback[key] = num(sc[key], key);
    }
  }
  if (payload.directSlab) {
    const ds = payload.directSlab;
    if (ds.enabled !== undefined) next.directSlab.enabled = ds.enabled === true;
    if (ds.verificationDaysAfterMonthEnd !== undefined) {
      next.directSlab.verificationDaysAfterMonthEnd = num(ds.verificationDaysAfterMonthEnd, "verificationDaysAfterMonthEnd");
    }
    if (ds.slabs !== undefined) {
      if (!Array.isArray(ds.slabs)) throw Object.assign(new Error("slabs must be a list"), { statusCode: 400 });
      const slabs = ds.slabs.map((s, i) => {
        const minOrders = num(s.minOrders ?? 0, `Slab ${i + 1} minimum orders`);
        if (!Number.isInteger(minOrders)) {
          throw Object.assign(new Error(`Slab ${i + 1} minimum orders must be a whole number`), { statusCode: 400 });
        }
        return {
          minMonthlySpend: num(s.minMonthlySpend ?? 0, `Slab ${i + 1} monthly spend`),
          minOrders,
          reward: num(s.reward, `Slab ${i + 1} reward`),
        };
      });
      const seen = new Set();
      for (const [i, slab] of slabs.entries()) {
        if (slab.reward <= 0) {
          throw Object.assign(new Error(`Slab ${i + 1} needs a reward above 0`), { statusCode: 400 });
        }
        if (slab.minMonthlySpend <= 0 && slab.minOrders <= 0) {
          throw Object.assign(new Error(`Slab ${i + 1} needs a minimum monthly spend or a minimum number of orders`), { statusCode: 400 });
        }
        const key = `${slab.minMonthlySpend}|${slab.minOrders}`;
        if (seen.has(key)) {
          throw Object.assign(new Error(`Slab ${i + 1} duplicates another slab's spend and order count`), { statusCode: 400 });
        }
        seen.add(key);
      }
      next.directSlab.slabs = slabs.sort((a, b) => a.minMonthlySpend - b.minMonthlySpend || a.minOrders - b.minOrders);
    }
  }

  // Turning payouts on for the first time starts the program from now:
  // nothing delivered before this moment is ever rewarded.
  if (next.payoutsEnabled && !current.payoutsEnabled && !current.effectiveFrom) {
    next.effectiveFrom = new Date();
  }

  await Setting.findOneAndUpdate({}, { $set: { customerRewards: next } }, { upsert: true });
  return getRewardConfig();
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function istPeriod(date) {
  const d = new Date(new Date(date).getTime() + IST_OFFSET_MIN * 60000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodRange(period) {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MIN * 60000);
  const end = new Date(Date.UTC(y, m, 1) - IST_OFFSET_MIN * 60000);
  return { start, end };
}

const adminCommissionOf = (order) => Number(order.paymentBreakdown?.adminProductCommissionTotal || 0);

/** Net product value the customer paid for (after discounts). */
export function netSpendOf(order) {
  const pb = order.paymentBreakdown || {};
  const subtotal = Number(pb.productSubtotal ?? order.pricing?.subtotal ?? 0);
  const discount = Number(pb.discountTotal ?? order.pricing?.discount ?? 0);
  return roundCurrency(Math.max(subtotal - discount, 0));
}

export function isReturnedOrRefunded(order) {
  return (
    RETURNED_FINAL.includes(order.returnStatus) ||
    REFUND_PAYMENT_STATUSES.includes(String(order.paymentStatus || "").toUpperCase()) ||
    order.status === "cancelled"
  );
}

export function isSettled(order) {
  const mode = String(order.paymentMode || "").toUpperCase();
  const ps = String(order.paymentStatus || "").toUpperCase();
  if (mode === "ONLINE") return ps === "PAID";
  return order.financeFlags?.codMarkedCollected === true || ["CASH_COLLECTED", "COD_RECONCILED", "PAID"].includes(ps);
}

function returnWindowEnd(order, holdDays) {
  if (order.returnWindowExpiresAt) return new Date(order.returnWindowExpiresAt);
  const delivered = order.deliveredAt || order.updatedAt || order.createdAt;
  return new Date(new Date(delivered).getTime() + Number(holdDays || 0) * 86400000);
}

/**
 * Where an order stands for cashback right now.
 * → { state: "eligible" | "waiting" | "reversed" | "not_eligible", reason }
 */
export function cashbackOrderState(order, config, now = new Date()) {
  if (order.status !== "delivered") return { state: "not_eligible", reason: "Not delivered" };
  if (isReturnedOrRefunded(order)) return { state: "reversed", reason: "Order returned / refunded" };
  if (adminCommissionOf(order) <= 0) return { state: "not_eligible", reason: "No admin commission on this order" };
  if (netSpendOf(order) < Number(config.siteCashback.minOrderValue || 0)) {
    return { state: "not_eligible", reason: `Below minimum order value ₹${config.siteCashback.minOrderValue}` };
  }
  if (RETURN_IN_PROGRESS.includes(order.returnStatus)) return { state: "waiting", reason: "Return in progress" };
  if (!isSettled(order) && !config.assumeSettled) return { state: "waiting", reason: "Payment not settled yet" };
  if (now < returnWindowEnd(order, config.siteCashback.holdDaysAfterDelivery)) {
    return { state: "waiting", reason: "Return window still open" };
  }
  return { state: "eligible", reason: "" };
}

export function cashbackBudget(order, config) {
  return roundCurrency((adminCommissionOf(order) * config.siteCashbackPercent) / 100);
}

/** Cashback amount after the per-order and per-customer-month caps. */
export function cashbackAmount(order, config, usedThisMonth = 0) {
  let amount = cashbackBudget(order, config);
  const maxOrder = Number(config.siteCashback.maxPerOrder || 0);
  if (maxOrder > 0) amount = Math.min(amount, maxOrder);
  const maxMonth = Number(config.siteCashback.maxPerCustomerPerMonth || 0);
  if (maxMonth > 0) amount = Math.min(amount, Math.max(maxMonth - usedThisMonth, 0));
  return roundCurrency(amount);
}

function pushHistory(reward, status, by = "system", note = "") {
  reward.history.push({ status, at: new Date(), by: String(by || "system"), note });
}

/* ------------------------------------------------------------------ */
/* Wallet credit / reversal                                            */
/* ------------------------------------------------------------------ */

const programLabel = (p) => (p === "site_cashback" ? "Site Cashback" : "Direct Buy Slab reward");

export async function creditReward(rewardId, { by = "system" } = {}) {
  const config = await getRewardConfig();
  if (!config.payoutsEnabled) {
    throw Object.assign(new Error("Reward payouts are switched off. Enable payouts after the rules are approved."), {
      statusCode: 409,
    });
  }
  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      const reward = await CustomerReward.findById(rewardId).session(session);
      if (!reward) throw Object.assign(new Error("Reward not found"), { statusCode: 404 });
      if (reward.status === "credited") {
        result = reward;
        return;
      }
      if (reward.status !== "approved") {
        throw Object.assign(new Error(`Only approved rewards can be credited (this one is ${reward.status})`), {
          statusCode: 409,
        });
      }
      const reference = `CRW-${reward.program === "site_cashback" ? "CB" : "SLAB"}-${reward._id}`;
      const existing = await Transaction.findOne({ reference }).session(session).lean();
      if (!existing && reward.amount > 0) {
        const customer = await Customer.findByIdAndUpdate(
          reward.customer,
          { $inc: { walletBalance: reward.amount } },
          { new: true, session, select: "walletBalance" },
        );
        if (!customer) throw Object.assign(new Error("Customer account not found"), { statusCode: 404 });
        await Transaction.create(
          [
            {
              user: reward.customer,
              userModel: "User",
              type: "Cashback",
              amount: reward.amount,
              status: "Settled",
              reference,
              meta: {
                source: reward.program,
                customerRewardId: reward._id,
                orderId: reward.order,
                period: reward.period || undefined,
                description:
                  reward.program === "site_cashback"
                    ? `Site Cashback for order ${reward.orderId}`
                    : `Direct Buy Slab reward for ${reward.period} (monthly spend ₹${reward.monthlySpend})`,
              },
            },
          ],
          { session },
        );
      }
      reward.status = "credited";
      reward.creditedAt = new Date();
      reward.transactionReference = reference;
      pushHistory(reward, "credited", by, `${programLabel(reward.program)} credited to wallet`);
      await reward.save({ session });
      result = reward;
    });
  } finally {
    await session.endSession();
  }
  return result;
}

export async function reverseReward(rewardId, { by = "system", note = "" } = {}) {
  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      const reward = await CustomerReward.findById(rewardId).session(session);
      if (!reward) throw Object.assign(new Error("Reward not found"), { statusCode: 404 });
      if (reward.status === "reversed") {
        result = reward;
        return;
      }
      if (reward.status === "credited" && reward.amount > 0) {
        const reference = `${reward.transactionReference || `CRW-${reward._id}`}-REV`;
        const existing = await Transaction.findOne({ reference }).session(session).lean();
        if (!existing) {
          await Customer.updateOne({ _id: reward.customer }, { $inc: { walletBalance: -reward.amount } }, { session });
          await Transaction.create(
            [
              {
                user: reward.customer,
                userModel: "User",
                type: "Cashback",
                amount: -reward.amount,
                status: "Settled",
                reference,
                meta: {
                  source: `${reward.program}_reversal`,
                  customerRewardId: reward._id,
                  orderId: reward.order,
                  description: `${programLabel(reward.program)} reversed${note ? `: ${note}` : ""}`,
                },
              },
            ],
            { session },
          );
        }
        reward.reversalReference = reference;
      }
      reward.status = "reversed";
      reward.reversedAt = new Date();
      reward.reason = note || reward.reason;
      pushHistory(reward, "reversed", by, note);
      await reward.save({ session });
      result = reward;
    });
  } finally {
    await session.endSession();
  }
  return result;
}

export async function approveReward(rewardId, { by = "system", note = "" } = {}) {
  const reward = await CustomerReward.findById(rewardId);
  if (!reward) throw Object.assign(new Error("Reward not found"), { statusCode: 404 });
  if (reward.status !== "pending") {
    throw Object.assign(new Error(`Only pending rewards can be approved (this one is ${reward.status})`), { statusCode: 409 });
  }
  if (reward.program === "site_cashback" && reward.order) {
    const config = await getRewardConfig();
    const order = await Order.findById(reward.order).lean();
    const state = order ? cashbackOrderState(order, config) : { state: "reversed", reason: "Order not found" };
    if (state.state !== "eligible") {
      throw Object.assign(new Error(`Order is not eligible yet: ${state.reason}`), { statusCode: 409 });
    }
  }
  reward.status = "approved";
  reward.approvedAt = new Date();
  pushHistory(reward, "approved", by, note || "Verified and approved");
  await reward.save();
  return reward;
}

/* ------------------------------------------------------------------ */
/* Scheduled processing (live — only after payouts are enabled)        */
/* ------------------------------------------------------------------ */

async function usedCashbackThisMonth(customerId, period, excludeId = null) {
  const { start, end } = periodRange(period);
  const rows = await CustomerReward.find({
    program: "site_cashback",
    customer: customerId,
    status: { $in: ["pending", "approved", "credited"] },
    eligibleAt: { $gte: start, $lt: end },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("amount")
    .lean();
  return rows.reduce((s, r) => s + Number(r.amount || 0), 0);
}

export async function processSiteCashback(config, now = new Date()) {
  if (!config.siteCashback.enabled || !config.effectiveFrom || config.siteCashbackPercent <= 0) return;

  // 1) Open a Pending record for each newly delivered order with commission.
  const candidates = await Order.find({
    status: "delivered",
    deliveredAt: { $gte: config.effectiveFrom },
    "paymentBreakdown.adminProductCommissionTotal": { $gt: 0 },
  })
    .select("_id orderId customer deliveredAt status returnStatus paymentStatus paymentMode financeFlags returnWindowExpiresAt paymentBreakdown pricing")
    .lean();
  const existing = new Set(
    (await CustomerReward.find({ program: "site_cashback", order: { $in: candidates.map((o) => o._id) } }).select("order").lean())
      .map((r) => String(r.order)),
  );
  for (const order of candidates) {
    if (existing.has(String(order._id))) continue;
    const state = cashbackOrderState(order, config, now);
    if (state.state === "not_eligible") continue;
    const period = istPeriod(order.deliveredAt);
    const used = await usedCashbackThisMonth(order.customer, period);
    const amount = cashbackAmount(order, config, used);
    if (amount <= 0) continue;
    try {
      await CustomerReward.create({
        program: "site_cashback",
        customer: order.customer,
        order: order._id,
        orderId: order.orderId,
        amount,
        status: "pending",
        adminCommission: adminCommissionOf(order),
        budgetPercent: config.siteCashbackPercent,
        budgetAmount: cashbackBudget(order, config),
        eligibleAt: order.deliveredAt,
        reason: state.reason,
        history: [{ status: "pending", by: "system", note: state.reason || "Awaiting settlement and return window" }],
      });
    } catch (error) {
      if (error?.code !== 11000) throw error; // duplicate = already tracked
    }
  }

  // 2) Move pending → approved / reversed; approved → credited; credited → reversed on late refunds.
  const open = await CustomerReward.find({ program: "site_cashback", status: { $in: ["pending", "approved", "credited"] } });
  const orders = new Map(
    (await Order.find({ _id: { $in: open.map((r) => r.order) } }).lean()).map((o) => [String(o._id), o]),
  );
  for (const reward of open) {
    const order = orders.get(String(reward.order));
    const state = order ? cashbackOrderState(order, config, now) : { state: "reversed", reason: "Order not found" };
    try {
      if (state.state === "reversed") {
        await reverseReward(reward._id, { note: state.reason });
      } else if (reward.status === "pending" && state.state === "eligible") {
        reward.status = "approved";
        reward.approvedAt = new Date();
        reward.reason = "";
        pushHistory(reward, "approved", "system", "Settled and return window closed");
        await reward.save();
        if (config.payoutsEnabled) await creditReward(reward._id);
      } else if (reward.status === "pending" && state.reason && state.reason !== reward.reason) {
        reward.reason = state.reason;
        await reward.save();
      } else if (reward.status === "approved" && config.payoutsEnabled) {
        await creditReward(reward._id);
      }
    } catch (error) {
      // keep going with the other rewards; the next run retries
      // eslint-disable-next-line no-console
      console.error("[rewards] site cashback step failed", String(reward._id), error.message);
    }
  }
}

/** Compute one month's slab rewards (pure read — used by the job and the simulation). */
export async function computeMonthSlabs(period, config, { now = new Date(), since = null } = {}) {
  const { start, end } = periodRange(period);
  const from = since && since > start ? since : start;
  const orders = await Order.find({ status: "delivered", deliveredAt: { $gte: from, $lt: end } })
    .select("_id orderId customer deliveredAt status returnStatus paymentStatus paymentMode financeFlags returnWindowExpiresAt paymentBreakdown pricing")
    .lean();

  const byCustomer = new Map();
  let pool = 0;
  let eligibleOrders = 0;
  const excluded = { returned: 0, unsettled: 0, windowOpen: 0 };
  for (const order of orders) {
    // Only final orders count: delivered, settled, return window closed, not returned.
    if (isReturnedOrRefunded(order)) { excluded.returned += 1; continue; }
    if (RETURN_IN_PROGRESS.includes(order.returnStatus)) { excluded.windowOpen += 1; continue; }
    if (!isSettled(order) && !config.assumeSettled) { excluded.unsettled += 1; continue; }
    if (now < returnWindowEnd(order, config.siteCashback.holdDaysAfterDelivery)) { excluded.windowOpen += 1; continue; }
    eligibleOrders += 1;
    pool += (adminCommissionOf(order) * config.directSlabPercent) / 100;
    const key = String(order.customer);
    const row = byCustomer.get(key) || { customer: order.customer, spend: 0, orders: 0 };
    row.spend += netSpendOf(order);
    row.orders += 1;
    byCustomer.set(key, row);
  }

  const slabs = config.directSlab.slabs;
  const winners = [];
  for (const row of byCustomer.values()) {
    // Customer must meet BOTH the spend and the order-count of a slab; if several
    // slabs are met, the one with the highest reward applies.
    const slab = slabs
      .filter((s) => row.spend >= s.minMonthlySpend && row.orders >= (s.minOrders || 0))
      .sort((a, b) => b.reward - a.reward)[0];
    if (slab) winners.push({ ...row, spend: roundCurrency(row.spend), slab });
  }
  const totalRewards = winners.reduce((s, w) => s + w.slab.reward, 0);
  pool = roundCurrency(pool);
  const scaleFactor = totalRewards > pool && totalRewards > 0 ? pool / totalRewards : 1;
  for (const w of winners) w.amount = roundCurrency(w.slab.reward * scaleFactor);

  return {
    period,
    eligibleOrders,
    excluded,
    customersWithOrders: byCustomer.size,
    pool,
    totalRewardsBeforeScaling: roundCurrency(totalRewards),
    scaleFactor: Math.round(scaleFactor * 10000) / 10000,
    totalPayout: roundCurrency(winners.reduce((s, w) => s + w.amount, 0)),
    winners,
    spends: [...byCustomer.values()].map((r) => roundCurrency(r.spend)).sort((a, b) => b - a),
  };
}

export async function generateMonthlySlabs(config, now = new Date()) {
  if (!config.directSlab.enabled || !config.effectiveFrom || !config.directSlab.slabs.length) return;
  const verifyMs = Number(config.directSlab.verificationDaysAfterMonthEnd || 0) * 86400000;

  // Months from the program start up to the last fully-closed one.
  const periods = [];
  let cursor = istPeriod(config.effectiveFrom);
  const current = istPeriod(now);
  while (cursor < current) {
    periods.push(cursor);
    const [y, m] = cursor.split("-").map(Number);
    cursor = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
  }

  for (const period of periods) {
    const { end } = periodRange(period);
    if (now.getTime() < end.getTime() + verifyMs) continue; // verification window still open
    if (await CustomerReward.exists({ program: "direct_slab", period })) continue; // already generated
    const result = await computeMonthSlabs(period, config, { now, since: new Date(config.effectiveFrom) });
    for (const w of result.winners) {
      if (w.amount <= 0) continue;
      try {
        await CustomerReward.create({
          program: "direct_slab",
          customer: w.customer,
          period,
          amount: w.amount,
          monthlySpend: w.spend,
          monthlyOrders: w.orders,
          slab: w.slab,
          scaleFactor: result.scaleFactor,
          budgetPercent: config.directSlabPercent,
          budgetAmount: result.pool,
          status: "pending",
          eligibleAt: end,
          reason: "Awaiting admin verification",
          history: [
            {
              status: "pending",
              by: "system",
              note: `Monthly spend ₹${w.spend} with ${w.orders} order(s) met slab (₹${w.slab.minMonthlySpend}+, ${w.slab.minOrders || 0}+ orders) → reward ₹${w.slab.reward}${
                result.scaleFactor < 1 ? ` × ${result.scaleFactor} (pool limit)` : ""
              }`,
            },
          ],
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
  }
}

export async function processCustomerRewards(now = new Date()) {
  const config = await getRewardConfig();
  // Live tracking starts only once payouts have been enabled (effectiveFrom).
  if (!config.effectiveFrom) return;
  await processSiteCashback(config, now);
  await generateMonthlySlabs(config, now);
  // Approved slab rewards are credited automatically once payouts are on.
  if (config.payoutsEnabled) {
    const approved = await CustomerReward.find({ program: "direct_slab", status: "approved" }).select("_id").lean();
    for (const r of approved) {
      try {
        await creditReward(r._id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[rewards] slab credit failed", String(r._id), error.message);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Read-only simulation for the approval report                        */
/* ------------------------------------------------------------------ */

export async function simulateRewards({ fromDate, toDate, slabs, assumeSettled = false } = {}, now = new Date()) {
  const base = await getRewardConfig();
  const config = {
    ...base,
    // What-if: treat delivered orders as paid (e.g. COD cash not yet marked collected).
    assumeSettled: assumeSettled === true,
    directSlab: {
      ...base.directSlab,
      slabs: Array.isArray(slabs) && slabs.length
        ? slabs.map((s) => ({ minMonthlySpend: Number(s.minMonthlySpend || 0), minOrders: Number(s.minOrders || 0), reward: Number(s.reward) }))
            .filter((s) => (s.minMonthlySpend > 0 || s.minOrders > 0) && s.reward > 0)
            .sort((a, b) => a.minMonthlySpend - b.minMonthlySpend || a.minOrders - b.minOrders)
        : base.directSlab.slabs,
    },
  };

  const match = { status: "delivered" };
  if (fromDate || toDate) {
    match.deliveredAt = {};
    if (fromDate) match.deliveredAt.$gte = new Date(fromDate);
    if (toDate) {
      const e = new Date(toDate);
      e.setHours(23, 59, 59, 999);
      match.deliveredAt.$lte = e;
    }
  }
  const orders = await Order.find(match)
    .select("_id orderId customer deliveredAt status returnStatus paymentStatus paymentMode financeFlags returnWindowExpiresAt paymentBreakdown pricing")
    .sort({ deliveredAt: 1 })
    .lean();

  // Site Cashback
  const used = new Map();
  const cashback = { orders: orders.length, wouldApprove: 0, wouldApproveAmount: 0, pending: 0, pendingAmount: 0, reversed: 0, notEligible: 0, budget: 0, rows: [] };
  for (const order of orders) {
    const state = cashbackOrderState(order, config, now);
    const budget = cashbackBudget(order, config);
    const period = istPeriod(order.deliveredAt);
    const key = `${order.customer}:${period}`;
    const amount = state.state === "eligible" || state.state === "waiting" ? cashbackAmount(order, config, used.get(key) || 0) : 0;
    if (amount > 0) used.set(key, (used.get(key) || 0) + amount);
    cashback.budget += budget;
    if (state.state === "eligible") { cashback.wouldApprove += 1; cashback.wouldApproveAmount += amount; }
    else if (state.state === "waiting") { cashback.pending += 1; cashback.pendingAmount += amount; }
    else if (state.state === "reversed") cashback.reversed += 1;
    else cashback.notEligible += 1;
    cashback.rows.push({
      orderId: order.orderId,
      customer: String(order.customer),
      deliveredAt: order.deliveredAt,
      netSpend: netSpendOf(order),
      adminCommission: adminCommissionOf(order),
      budget,
      amount,
      outcome: state.state === "eligible" ? "approved" : state.state === "waiting" ? "pending" : state.state,
      reason: state.reason,
    });
  }
  cashback.budget = roundCurrency(cashback.budget);
  cashback.wouldApproveAmount = roundCurrency(cashback.wouldApproveAmount);
  cashback.pendingAmount = roundCurrency(cashback.pendingAmount);

  // Direct Buy Slab — per month present in the data
  const periods = [...new Set(orders.map((o) => istPeriod(o.deliveredAt)))].sort();
  const months = [];
  for (const period of periods) {
    const r = await computeMonthSlabs(period, config, { now });
    months.push({ ...r, winners: r.winners.map((w) => ({ customer: String(w.customer), spend: w.spend, slab: w.slab, amount: w.amount, orders: w.orders })) });
  }

  return {
    generatedAt: now,
    note: "Simulation only — no rewards were created and no wallet was credited.",
    config: {
      siteCashbackPercent: config.siteCashbackPercent,
      directSlabPercent: config.directSlabPercent,
      siteCashback: config.siteCashback,
      directSlab: config.directSlab,
      payoutsEnabled: config.payoutsEnabled,
      assumeSettled: config.assumeSettled,
    },
    cashback,
    slabs: months,
  };
}

async function buildRewardQuery({ program, status, customer, period, search, fromDate, toDate } = {}) {
  const q = {};
  if (program) q.program = program;
  if (status) q.status = status;
  if (period) q.period = period;
  if (customer && mongoose.Types.ObjectId.isValid(customer)) q.customer = new mongoose.Types.ObjectId(String(customer));
  const term = String(search || "").trim();
  if (term) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = await Customer.find({
      $or: [{ name: { $regex: esc, $options: "i" } }, { phone: { $regex: esc, $options: "i" } }],
    })
      .select("_id")
      .limit(500)
      .lean();
    q.$or = [
      { customer: { $in: matches.map((c) => c._id) } },
      { orderId: { $regex: esc, $options: "i" } },
    ];
  }
  if (fromDate || toDate) {
    q.createdAt = {};
    if (fromDate) q.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const e = new Date(toDate);
      e.setHours(23, 59, 59, 999);
      q.createdAt.$lte = e;
    }
  }
  return q;
}

export async function listRewards({ page = 1, limit = 25, ...filters } = {}) {
  const q = await buildRewardQuery(filters);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const [items, total, summary] = await Promise.all([
    CustomerReward.find(q).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).populate("customer", "name phone").lean(),
    CustomerReward.countDocuments(q),
    CustomerReward.aggregate([
      { $match: q },
      { $group: { _id: { program: "$program", status: "$status" }, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]),
  ]);
  return { items, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) || 1, summary };
}

/** CSV of reward transactions matching the same filters (max 20,000 rows). */
export async function exportRewardsCsv(filters = {}) {
  const q = await buildRewardQuery(filters);
  const rows = await CustomerReward.find(q).sort({ createdAt: -1 }).limit(20000).populate("customer", "name phone").lean();
  const cell = (v) => {
    const text = v === null || v === undefined ? "" : String(v);
    // Neutralise spreadsheet formulas and quote every cell.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ["Created", "Customer", "Phone", "Program", "Order / Month", "Monthly spend", "Monthly orders", "Amount", "Status", "Credited at", "Reversed at", "Reason"];
  const lines = rows.map((r) => [
    new Date(r.createdAt).toISOString(),
    r.customer?.name || "",
    r.customer?.phone || "",
    r.program === "site_cashback" ? "Site Cashback" : "Direct Buy Slab",
    r.program === "site_cashback" ? r.orderId : r.period,
    r.program === "direct_slab" ? r.monthlySpend : "",
    r.program === "direct_slab" ? r.monthlyOrders : "",
    r.amount,
    r.status,
    r.creditedAt ? new Date(r.creditedAt).toISOString() : "",
    r.reversedAt ? new Date(r.reversedAt).toISOString() : "",
    r.reason || "",
  ].map(cell).join(","));
  return [header.map(cell).join(","), ...lines].join("\n");
}
