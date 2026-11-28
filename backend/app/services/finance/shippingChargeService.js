/**
 * Shiprocket shipping-charge engine — the ONLY place that moves money for
 * Pan-India (Shiprocket) freight. Every charge goes through
 * applyShippingCharge(), which:
 *
 *  1. Is idempotent per `key`: an atomic conditional update adds the key to
 *     paymentBreakdown.shippingChargeKeys before anything else happens, so a
 *     duplicate webhook / retry / double click can never deduct twice (a
 *     concurrent duplicate either sees the key or loses the write conflict
 *     and its transaction aborts).
 *  2. Decides who bears it (SELLER or PLATFORM).
 *  3. For seller-borne charges, recovers the money in this order:
 *       a) from this order's not-yet-queued seller payout (PAYOUT),
 *       b) from the seller's available wallet balance (WALLET),
 *       c) whatever is still left is recorded as OUTSTANDING on the order
 *          and is netted automatically from the seller's next payouts
 *          (nettOutstandingSellerDues).
 *     Negative amounts (Shiprocket billed less than charged) are refunded
 *     the same way in reverse.
 *  4. Writes a ledger entry + finance audit log for every rupee moved.
 *
 * Wallet balances can never go negative (schema min: 0) — a shortfall
 * becomes an outstanding due instead of being lost.
 */
import mongoose from "mongoose";
import Order from "../../models/order.js";
import {
  LEDGER_DIRECTION,
  LEDGER_TRANSACTION_TYPE,
  OWNER_TYPE,
} from "../../constants/finance.js";
import { roundCurrency } from "../../utils/money.js";
import { createLedgerEntry } from "./ledgerService.js";
import { createFinanceAuditLog } from "./auditLogService.js";
import { creditWallet, debitWallet, getOrCreateWallet } from "./walletService.js";

export const SHIPPING_CHARGE_KIND = {
  FORWARD: "FORWARD",
  FORWARD_ADJUSTMENT: "FORWARD_ADJUSTMENT",
  RTO: "RTO",
  RTO_ADJUSTMENT: "RTO_ADJUSTMENT",
  RETURN_PICKUP: "RETURN_PICKUP",
  RETURN_PICKUP_ADJUSTMENT: "RETURN_PICKUP_ADJUSTMENT",
};

export const SHIPPING_BEARER = {
  SELLER: "SELLER",
  PLATFORM: "PLATFORM",
};

/** Kind of the base charge each adjustment corrects. */
const BASE_KIND = {
  [SHIPPING_CHARGE_KIND.FORWARD]: SHIPPING_CHARGE_KIND.FORWARD,
  [SHIPPING_CHARGE_KIND.FORWARD_ADJUSTMENT]: SHIPPING_CHARGE_KIND.FORWARD,
  [SHIPPING_CHARGE_KIND.RTO]: SHIPPING_CHARGE_KIND.RTO,
  [SHIPPING_CHARGE_KIND.RTO_ADJUSTMENT]: SHIPPING_CHARGE_KIND.RTO,
  [SHIPPING_CHARGE_KIND.RETURN_PICKUP]: SHIPPING_CHARGE_KIND.RETURN_PICKUP,
  [SHIPPING_CHARGE_KIND.RETURN_PICKUP_ADJUSTMENT]: SHIPPING_CHARGE_KIND.RETURN_PICKUP,
};
const ADJUSTMENT_KIND = {
  [SHIPPING_CHARGE_KIND.FORWARD]: SHIPPING_CHARGE_KIND.FORWARD_ADJUSTMENT,
  [SHIPPING_CHARGE_KIND.RTO]: SHIPPING_CHARGE_KIND.RTO_ADJUSTMENT,
  [SHIPPING_CHARGE_KIND.RETURN_PICKUP]: SHIPPING_CHARGE_KIND.RETURN_PICKUP_ADJUSTMENT,
};

/**
 * Return policy — who pays Shiprocket for the reverse pickup.
 * Seller-fault reasons (wrong/damaged/missing/not-as-described product) →
 * seller. Customer-preference reasons and courier-caused damage → platform
 * (matches the existing policy that the platform absorbs return delivery
 * cost for local returns; courier damage is claimed from Shiprocket).
 */
export const SELLER_FAULT_RETURN_REASONS = new Set([
  "ITEM_DAMAGED",
  "WRONG_ITEM",
  "MISSING_ITEM",
  "NOT_AS_DESCRIBED",
  "QUALITY_NOT_AS_EXPECTED",
  "PERFORMANCE_NOT_ADEQUATE",
]);

export function resolveReturnShippingBearer(order) {
  const code = String(order?.returnReasonCode || "").toUpperCase();
  return SELLER_FAULT_RETURN_REASONS.has(code) ? SHIPPING_BEARER.SELLER : SHIPPING_BEARER.PLATFORM;
}

/** RTO: customer refused / undeliverable. Seller bears forward + RTO freight. */
export function resolveRtoShippingBearer() {
  return SHIPPING_BEARER.SELLER;
}

function money(v) {
  return roundCurrency(Number(v || 0));
}

function isOrderCancelled(order) {
  const s = String(order?.status || "").toLowerCase();
  const os = String(order?.orderStatus || "").toLowerCase();
  return s === "cancelled" || os === "cancelled";
}

/** The seller payout for this order can still absorb a deduction. */
function sellerPayoutStillAdjustable(order) {
  return !order.financeFlags?.sellerPayoutQueued && !isOrderCancelled(order);
}

function sumEntries(entries, baseKind, bearer = null) {
  return money(
    (entries || [])
      .filter((e) => BASE_KIND[e.kind] === baseKind && (!bearer || e.bearer === bearer))
      .reduce((s, e) => s + Number(e.amount || 0), 0),
  );
}

/** Recompute all derived shipping totals on paymentBreakdown from the entries. */
function recomputeShippingTotals(pb) {
  const entries = pb.shippingCharges || [];
  pb.shiprocketShippingCharge = sumEntries(entries, SHIPPING_CHARGE_KIND.FORWARD);
  pb.shiprocketRtoCharge = sumEntries(entries, SHIPPING_CHARGE_KIND.RTO);
  pb.shiprocketReturnPickupCharge = sumEntries(entries, SHIPPING_CHARGE_KIND.RETURN_PICKUP);
  pb.sellerShippingChargesTotal = money(
    entries.filter((e) => e.bearer === SHIPPING_BEARER.SELLER).reduce((s, e) => s + Number(e.amount || 0), 0),
  );
  pb.platformShippingExpenseTotal = money(
    entries.filter((e) => e.bearer === SHIPPING_BEARER.PLATFORM).reduce((s, e) => s + Number(e.amount || 0), 0),
  );
}

async function resolveOrderObjectId(orderOrId, session) {
  if (orderOrId && typeof orderOrId === "object" && orderOrId._id) return orderOrId._id;
  if (mongoose.Types.ObjectId.isValid(orderOrId)) return orderOrId;
  const found = await Order.findOne({ orderId: String(orderOrId) }, { _id: 1 }, { session });
  if (!found) throw new Error("Order not found");
  return found._id;
}

/**
 * Takes up to `amount` from the seller's available wallet; anything not
 * covered becomes an outstanding due on the order. Caller saves the order.
 */
async function recoverFromSeller(order, amount, { session, reason, reference }) {
  const due = money(amount);
  const result = { wallet: 0, outstanding: 0 };
  if (due <= 0 || !order.seller) return result;

  const wallet = await getOrCreateWallet(OWNER_TYPE.SELLER, order.seller, { session });
  const take = money(Math.min(money(wallet.availableBalance), due));
  if (take > 0) {
    const debit = await debitWallet({
      ownerType: OWNER_TYPE.SELLER,
      ownerId: order.seller,
      amount: take,
      bucket: "available",
      session,
    });
    await createLedgerEntry(
      {
        orderId: order._id,
        walletId: debit.wallet._id,
        actorType: OWNER_TYPE.SELLER,
        actorId: order.seller,
        type: LEDGER_TRANSACTION_TYPE.SHIPROCKET_SHIPPING_CHARGE,
        direction: LEDGER_DIRECTION.DEBIT,
        amount: take,
        paymentMode: order.paymentMode,
        metadata: { recoveredVia: "WALLET", reason },
        description: `${reason} — recovered from seller wallet`,
        reference: `${reference}-WALLET`,
        balanceBefore: debit.before,
        balanceAfter: debit.after,
      },
      { session },
    );
  }
  result.wallet = take;
  result.outstanding = money(due - take);
  const pb = order.paymentBreakdown;
  pb.sellerShippingRecoveredFromWallet = money((pb.sellerShippingRecoveredFromWallet || 0) + take);
  pb.sellerShippingDueOutstanding = money((pb.sellerShippingDueOutstanding || 0) + result.outstanding);
  return result;
}

/** Refund to seller: clear this order's outstanding first, then credit wallet. */
async function refundToSeller(order, amount, { session, reason, reference }) {
  const refund = money(amount);
  const result = { outstandingCleared: 0, wallet: 0 };
  if (refund <= 0 || !order.seller) return result;
  const pb = order.paymentBreakdown;

  const clear = money(Math.min(money(pb.sellerShippingDueOutstanding), refund));
  pb.sellerShippingDueOutstanding = money((pb.sellerShippingDueOutstanding || 0) - clear);
  result.outstandingCleared = clear;

  const credit = money(refund - clear);
  if (credit > 0) {
    const c = await creditWallet({
      ownerType: OWNER_TYPE.SELLER,
      ownerId: order.seller,
      amount: credit,
      bucket: "available",
      session,
    });
    await createLedgerEntry(
      {
        orderId: order._id,
        walletId: c.wallet._id,
        actorType: OWNER_TYPE.SELLER,
        actorId: order.seller,
        type: LEDGER_TRANSACTION_TYPE.SHIPROCKET_SHIPPING_CHARGE,
        direction: LEDGER_DIRECTION.CREDIT,
        amount: credit,
        paymentMode: order.paymentMode,
        metadata: { refundedVia: "WALLET", reason },
        description: `${reason} — refunded to seller wallet`,
        reference: `${reference}-WALLET-REFUND`,
        balanceBefore: c.before,
        balanceAfter: c.after,
      },
      { session },
    );
    pb.sellerShippingRecoveredFromWallet = money((pb.sellerShippingRecoveredFromWallet || 0) - credit);
  }
  result.wallet = credit;
  return result;
}

/**
 * Apply one Shiprocket charge (or refund, if amount < 0) to an order.
 * Returns { applied, duplicate, entry }.
 */
export async function applyShippingCharge(
  orderOrId,
  {
    kind,
    amount,
    key,
    bearer = SHIPPING_BEARER.SELLER,
    source = null,
    courierName = null,
    reference = null,
    note = "",
    actorId = null,
  } = {},
) {
  const value = money(amount);
  if (!BASE_KIND[kind]) throw new Error(`Unknown shipping charge kind: ${kind}`);
  if (!key) throw new Error("applyShippingCharge requires an idempotency key");
  if (!Number.isFinite(value) || value === 0) {
    return { applied: false, duplicate: false, entry: null };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const orderObjectId = await resolveOrderObjectId(orderOrId, session);

    // Atomic idempotency guard — must be the first write.
    const guard = await Order.updateOne(
      { _id: orderObjectId, "paymentBreakdown.shippingChargeKeys": { $ne: key } },
      { $addToSet: { "paymentBreakdown.shippingChargeKeys": key } },
      { session },
    );
    if (!guard || !guard.modifiedCount) {
      await session.abortTransaction();
      console.log(`[ShippingCharge] Duplicate ignored: ${key}`);
      return { applied: false, duplicate: true, entry: null };
    }

    const order = await Order.findOne({ _id: orderObjectId }, null, { session });
    if (!order) throw new Error("Order not found");
    if (!order.paymentBreakdown) order.paymentBreakdown = {};
    const pb = order.paymentBreakdown;
    if (!Array.isArray(pb.shippingCharges)) pb.shippingCharges = [];

    const ledgerRef = `SHIP-${order.orderId}-${key}`;
    const reason = `Shiprocket ${kind.replace(/_/g, " ").toLowerCase()}${courierName ? ` (${courierName})` : ""}`;
    const recovery = { payout: 0, wallet: 0, outstanding: 0, outstandingCleared: 0 };
    const payoutBefore = money(pb.sellerPayoutTotal);

    if (bearer === SHIPPING_BEARER.SELLER) {
      if (sellerPayoutStillAdjustable(order)) {
        // Net from (or back into) this order's payout. The payout may go
        // negative here; createPendingSellerPayout recovers a negative
        // payout from wallet/outstanding when the order settles.
        pb.sellerPayoutTotal = money(payoutBefore - value);
        pb.sellerNetProfit = money(pb.sellerPayoutTotal - Number(pb.totalCostPrice || 0));
        recovery.payout = value;
        await createLedgerEntry(
          {
            orderId: order._id,
            actorType: OWNER_TYPE.SELLER,
            actorId: order.seller || null,
            type: LEDGER_TRANSACTION_TYPE.SHIPROCKET_SHIPPING_CHARGE,
            direction: value > 0 ? LEDGER_DIRECTION.DEBIT : LEDGER_DIRECTION.CREDIT,
            amount: Math.abs(value),
            paymentMode: order.paymentMode,
            metadata: { kind, key, source, courierName, nettedFromOrderPayout: true, payoutBefore, payoutAfter: pb.sellerPayoutTotal },
            description: `${reason} — ${value > 0 ? "deducted from" : "added back to"} seller order payout (admin pays Shiprocket)`,
            reference: ledgerRef,
          },
          { session },
        );
      } else if (value > 0) {
        const r = await recoverFromSeller(order, value, { session, reason, reference: ledgerRef });
        recovery.wallet = r.wallet;
        recovery.outstanding = r.outstanding;
      } else {
        const r = await refundToSeller(order, -value, { session, reason, reference: ledgerRef });
        recovery.wallet = -r.wallet;
        recovery.outstandingCleared = r.outstandingCleared;
      }
    } else {
      // Platform-borne: an expense of the platform, recorded against admin.
      const adminWallet = await getOrCreateWallet(OWNER_TYPE.ADMIN, null, { session });
      await createLedgerEntry(
        {
          orderId: order._id,
          walletId: adminWallet._id,
          actorType: OWNER_TYPE.ADMIN,
          actorId: null,
          type: LEDGER_TRANSACTION_TYPE.SHIPROCKET_SHIPPING_CHARGE,
          direction: value > 0 ? LEDGER_DIRECTION.DEBIT : LEDGER_DIRECTION.CREDIT,
          amount: Math.abs(value),
          paymentMode: order.paymentMode,
          metadata: { kind, key, source, courierName, bearer },
          description: `${reason} — platform expense (not charged to seller)`,
          reference: ledgerRef,
        },
        { session },
      );
    }

    const entry = {
      key,
      kind,
      amount: value,
      bearer,
      source,
      courierName,
      reference,
      note,
      recoveredVia: recovery,
      appliedAt: new Date(),
    };
    pb.shippingCharges.push(entry);
    if (kind === SHIPPING_CHARGE_KIND.FORWARD) {
      pb.shiprocketShippingChargeSource = source;
      pb.shiprocketShippingChargeAppliedAt = entry.appliedAt;
    }
    recomputeShippingTotals(pb);

    await createFinanceAuditLog(
      {
        action: "SHIPROCKET_SHIPPING_CHARGE_APPLIED",
        actorType: OWNER_TYPE.ADMIN,
        actorId: actorId || null,
        orderId: order._id,
        metadata: {
          key,
          kind,
          amount: value,
          bearer,
          source,
          courierName,
          reference,
          recovery,
          sellerPayoutBefore: payoutBefore,
          sellerPayoutAfter: money(pb.sellerPayoutTotal),
          sellerShippingDueOutstanding: money(pb.sellerShippingDueOutstanding),
        },
        note,
      },
      { session },
    );

    order.markModified("paymentBreakdown");
    await order.save({ session });
    await session.commitTransaction();
    console.log(
      `[ShippingCharge] ${order.orderId} ${kind} ₹${value} bearer=${bearer} payout=${recovery.payout} wallet=${recovery.wallet} outstanding=${recovery.outstanding}`,
    );
    return { applied: true, duplicate: false, entry };
  } catch (error) {
    if (session.inTransaction?.() !== false) {
      try { await session.abortTransaction(); } catch { /* already aborted */ }
    }
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Final Shiprocket bill for a charge kind (weight dispute, extra charges,
 * or a cheaper final bill). `finalAmount` is the TOTAL Shiprocket billed for
 * that kind; the difference from what's already been applied is posted as
 * an adjustment. Re-sending the same final amount is a no-op (delta 0), and
 * the same `reference` can never post twice.
 */
export async function reconcileFinalShippingCharge(
  orderOrId,
  { kind = SHIPPING_CHARGE_KIND.FORWARD, finalAmount, reference = "", reason = "", actorId = null } = {},
) {
  const baseKind = BASE_KIND[kind];
  if (!baseKind || baseKind !== kind) {
    throw new Error("kind must be FORWARD, RTO or RETURN_PICKUP");
  }
  const target = money(finalAmount);
  if (!Number.isFinite(target) || target < 0) throw new Error("finalAmount must be >= 0");

  const orderObjectId = await resolveOrderObjectId(orderOrId, null);
  const order = await Order.findOne({ _id: orderObjectId });
  if (!order) throw new Error("Order not found");
  const entries = order.paymentBreakdown?.shippingCharges || [];
  const alreadyApplied = sumEntries(entries, baseKind);
  const delta = money(target - alreadyApplied);
  if (Math.abs(delta) < 0.01) {
    return { applied: false, duplicate: false, delta: 0, alreadyApplied, finalAmount: target };
  }

  // Same bearer as the base charge; if no base charge exists yet, use policy.
  const base = entries.find((e) => e.kind === baseKind);
  const bearer =
    base?.bearer ||
    (baseKind === SHIPPING_CHARGE_KIND.RETURN_PICKUP
      ? resolveReturnShippingBearer(order)
      : baseKind === SHIPPING_CHARGE_KIND.RTO
        ? resolveRtoShippingBearer(order)
        : SHIPPING_BEARER.SELLER);

  const result = await applyShippingCharge(order._id, {
    kind: base ? ADJUSTMENT_KIND[baseKind] : baseKind,
    amount: delta,
    key: `${baseKind}_FINAL:${reference || `amt-${target}`}`,
    bearer,
    source: "shiprocket_final_bill",
    reference: reference || null,
    note: reason || `Final Shiprocket bill ₹${target} (was ₹${alreadyApplied})`,
    actorId,
  });
  return { ...result, delta, alreadyApplied, finalAmount: target };
}

/**
 * Nets the seller's outstanding shipping dues (from other orders) out of a
 * payout that is about to be queued. Returns the amount netted (<= maxAmount).
 */
export async function nettOutstandingSellerDues(sellerId, maxAmount, { session, payingOrder } = {}) {
  let available = money(maxAmount);
  if (!sellerId || available <= 0) return 0;

  const owing = await Order.find(
    { seller: sellerId, "paymentBreakdown.sellerShippingDueOutstanding": { $gt: 0 } },
    null,
    { session },
  ).sort({ createdAt: 1 });

  let netted = 0;
  for (const due of owing) {
    if (available <= 0) break;
    if (payingOrder && String(due._id) === String(payingOrder._id)) continue;
    const owed = money(due.paymentBreakdown.sellerShippingDueOutstanding);
    const take = money(Math.min(owed, available));
    if (take <= 0) continue;
    due.paymentBreakdown.sellerShippingDueOutstanding = money(owed - take);
    due.paymentBreakdown.sellerShippingRecoveredFromPayouts = money(
      (due.paymentBreakdown.sellerShippingRecoveredFromPayouts || 0) + take,
    );
    due.markModified("paymentBreakdown");
    await due.save({ session });
    available = money(available - take);
    netted = money(netted + take);

    await createLedgerEntry(
      {
        orderId: due._id,
        actorType: OWNER_TYPE.SELLER,
        actorId: sellerId,
        type: LEDGER_TRANSACTION_TYPE.SHIPROCKET_SHIPPING_CHARGE,
        direction: LEDGER_DIRECTION.DEBIT,
        amount: take,
        metadata: { recoveredVia: "LATER_PAYOUT", payoutOrderId: payingOrder?.orderId || null },
        description: `Outstanding Shiprocket dues of ${due.orderId} netted from payout of ${payingOrder?.orderId || "a later order"}`,
        reference: `SHIP-DUE-${due.orderId}-FROM-${payingOrder?.orderId || "PAYOUT"}`,
      },
      { session },
    );
    await createFinanceAuditLog(
      {
        action: "SELLER_SHIPPING_SHORTFALL_RECOVERED",
        actorType: OWNER_TYPE.ADMIN,
        orderId: due._id,
        metadata: { netted: take, fromOrder: payingOrder?.orderId || null, remaining: due.paymentBreakdown.sellerShippingDueOutstanding },
      },
      { session },
    );
  }
  return netted;
}

/** Outstanding dues per seller (admin view). */
export async function listOutstandingSellerShippingDues({ sellerId = null } = {}) {
  const match = { "paymentBreakdown.sellerShippingDueOutstanding": { $gt: 0 } };
  if (sellerId) match.seller = new mongoose.Types.ObjectId(String(sellerId));
  return Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$seller",
        totalOutstanding: { $sum: "$paymentBreakdown.sellerShippingDueOutstanding" },
        orders: { $push: { orderId: "$orderId", outstanding: "$paymentBreakdown.sellerShippingDueOutstanding" } },
      },
    },
    { $sort: { totalOutstanding: -1 } },
  ]);
}

/**
 * Recover `amount` the seller owes, inside the caller's session, on an order
 * document the caller will save. Wallet first, rest outstanding.
 */
export async function recoverSellerDueInSession(order, amount, { session, reason = "Seller due", reference }) {
  if (!order.paymentBreakdown) order.paymentBreakdown = {};
  const r = await recoverFromSeller(order, amount, {
    session,
    reason,
    reference: reference || `SELLER-DUE-${order.orderId}`,
  });
  await createFinanceAuditLog(
    {
      action: "SELLER_SHIPPING_SHORTFALL_RECOVERED",
      actorType: OWNER_TYPE.ADMIN,
      orderId: order._id,
      metadata: { reason, due: money(amount), recoveredFromWallet: r.wallet, outstanding: r.outstanding },
      note: r.outstanding > 0 ? `Seller still owes ₹${r.outstanding} on ${order.orderId}` : "",
    },
    { session },
  );
  if (r.outstanding > 0) {
    console.warn(`[ShippingCharge] Seller ${order.seller} owes ₹${r.outstanding} on ${order.orderId} (${reason})`);
  }
  return r;
}

/** Runs `fn(order, session)` at most once per (order, key). */
async function runOnce(orderOrId, key, fn) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const orderObjectId = await resolveOrderObjectId(orderOrId, session);
    const guard = await Order.updateOne(
      { _id: orderObjectId, "paymentBreakdown.shippingChargeKeys": { $ne: key } },
      { $addToSet: { "paymentBreakdown.shippingChargeKeys": key } },
      { session },
    );
    if (!guard || !guard.modifiedCount) {
      await session.abortTransaction();
      return { applied: false, duplicate: true };
    }
    const order = await Order.findOne({ _id: orderObjectId }, null, { session });
    if (!order) throw new Error("Order not found");
    if (!order.paymentBreakdown) order.paymentBreakdown = {};
    const result = await fn(order, session);
    order.markModified("paymentBreakdown");
    await order.save({ session });
    await session.commitTransaction();
    return { applied: true, duplicate: false, ...result };
  } catch (error) {
    try { await session.abortTransaction(); } catch { /* already aborted */ }
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Seller-borne charges that were netted from this order's payout, when that
 * payout will now never be paid (RTO / cancellation / return cancelled the
 * payout): recover them from the seller's wallet / outstanding instead.
 */
export async function recoverPayoutNettedCharges(orderOrId, { kinds, key, reason, actorId = null } = {}) {
  return runOnce(orderOrId, key, async (order, session) => {
    const entries = order.paymentBreakdown.shippingCharges || [];
    const nettedTotal = money(
      entries
        .filter((e) => e.bearer === SHIPPING_BEARER.SELLER && kinds.includes(e.kind))
        .reduce((s, e) => s + Number(e.recoveredVia?.payout || 0), 0),
    );
    if (nettedTotal <= 0) return { amount: 0 };
    const r = await recoverSellerDueInSession(order, nettedTotal, {
      session,
      reason,
      reference: `SHIP-${order.orderId}-${key}`,
    });
    // Those entries are no longer covered by the payout.
    for (const e of entries) {
      if (e.bearer === SHIPPING_BEARER.SELLER && kinds.includes(e.kind) && e.recoveredVia?.payout) {
        e.recoveredVia = { ...e.recoveredVia, payout: 0, rehomedBy: key };
      }
    }
    // Restore the payout figure so it reflects goods only (it won't be paid).
    order.paymentBreakdown.sellerPayoutTotal = money(Number(order.paymentBreakdown.sellerPayoutTotal || 0) + nettedTotal);
    await createFinanceAuditLog(
      {
        action: "SHIPROCKET_SHIPPING_CHARGE_APPLIED",
        actorType: OWNER_TYPE.ADMIN,
        actorId,
        orderId: order._id,
        metadata: { key, rehomedAmount: nettedTotal, kinds, ...r },
        note: reason,
      },
      { session },
    );
    return { amount: nettedTotal, ...r };
  });
}

/**
 * Generic, idempotent seller due (e.g. return refund clawback after the
 * payout was already released). Never fails silently on low balance.
 */
export async function recoverSellerDue(orderOrId, amount, { key, reason }) {
  if (money(amount) <= 0) return { applied: false, duplicate: false };
  return runOnce(orderOrId, key, (order, session) =>
    recoverSellerDueInSession(order, amount, { session, reason, reference: `${key}-${order.orderId}` }),
  );
}

/**
 * Admin confirms Shiprocket remitted COD for these orders (matched from the
 * Shiprocket COD remittance report / UTR). Idempotent per order.
 */
export async function markShiprocketCodRemitted(orderIds = [], { utr = "", remittedAt = null, actorId = null } = {}) {
  const results = [];
  for (const id of orderIds) {
    try {
      const r = await runOnce(id, "COD_REMITTED_BY_SHIPROCKET", async (order, session) => {
        if (order.deliveryType !== "scheduled") throw new Error("Not a Shiprocket order");
        if (!order.financeFlags?.codCashRemittedToAdmin) throw new Error("Order COD not yet collected (not delivered)");
        order.financeFlags = { ...(order.financeFlags || {}), shiprocketCodRemitted: true };
        order.paymentBreakdown.shiprocketCodRemittance = {
          utr: utr || null,
          remittedAt: remittedAt ? new Date(remittedAt) : new Date(),
          amount: money(order.paymentBreakdown.grandTotal) - money(order.pricing?.walletAmount),
        };
        await createFinanceAuditLog(
          {
            action: "COD_COLLECTED_BY_COURIER",
            actorType: OWNER_TYPE.ADMIN,
            actorId,
            orderId: order._id,
            metadata: { remittanceConfirmed: true, utr, amount: order.paymentBreakdown.shiprocketCodRemittance.amount },
          },
          { session },
        );
        return { utr };
      });
      results.push({ order: String(id), ...r });
    } catch (error) {
      results.push({ order: String(id), applied: false, error: error.message });
    }
  }
  return results;
}
