import Transaction from "../models/transaction.js";
import Order from "../models/order.js";
import Setting from "../models/setting.js";
import {
  handleCodOrderFinance,
  settleDeliveredOrder,
  releaseExpiredHeldSellerPayouts,
  settleCodWalletsAfterAdminCredit,
} from "./finance/orderFinanceService.js";
import { autoProcessSellerPayoutForOrder } from "./finance/payoutService.js";
import { processOrderLevelCommissions } from "./finance/commissionService.js";
import { resolveSellerOrderEarning } from "./finance/pricingService.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";

function isCodOrder(order) {
  const mode = String(order?.paymentMode || "").toUpperCase();
  const method = String(order?.payment?.method || "").toLowerCase();
  return mode === "COD" || method === "cod" || method === "cash";
}

/**
 * Financial side effects when order becomes delivered (mirrors orderController).
 * COD: defers wallet credits until admin receives money (QR paid / seller remit).
 */
export async function applyDeliveredSettlement(order, orderIdString) {
  const settled = await settleDeliveredOrder(order._id);
  const cod = isCodOrder(settled);

  // COD cash is no longer auto-collected on OTP — rider must choose Online QR or Cash.
  if (cod) {
    // Keep legacy seller txn as Pending until admin credit settles wallets.
    const sellerEarning = Math.round(resolveSellerOrderEarning(settled));
    if (settled.seller && sellerEarning > 0) {
      await Transaction.findOneAndUpdate(
        { reference: orderIdString, userModel: "Seller" },
        {
          $set: {
            amount: sellerEarning,
            status: "Pending",
          },
          $setOnInsert: {
            user: settled.seller,
            userModel: "Seller",
            order: settled._id,
            type: "Order Payment",
            reference: orderIdString,
          },
        },
        { upsert: true, new: true },
      );
    }

    // Unlike the seller (who is genuinely owed money admin hasn't received
    // yet), the rider already collected the cash from the customer and
    // netted their commission out of it — they aren't waiting on anyone.
    // Credit this immediately so it shows up in the app right after
    // delivery instead of only after admin later reconciles the COD cash
    // (finalizeCodAfterAdminCredit, which still runs afterwards and just
    // upserts the same reference, keeping this idempotent).
    if (settled.deliveryBoy) {
      const deliveryEarning = Math.round(settled.paymentBreakdown?.riderPayoutTotal || 0);
      const deliveryMeta = {
        tipAmount: Math.round(settled.paymentBreakdown?.riderTipAmount || 0),
        payoutBase: Math.round(settled.paymentBreakdown?.riderPayoutBase || 0),
        payoutDistance: Math.round(settled.paymentBreakdown?.riderPayoutDistance || 0),
        payoutBonus: Math.round(settled.paymentBreakdown?.riderPayoutBonus || 0),
        settledViaCash: true,
      };
      await Transaction.findOneAndUpdate(
        { reference: `DEL-ERN-${orderIdString}` },
        {
          $set: {
            amount: deliveryEarning,
            status: "Settled",
            meta: deliveryMeta,
          },
          $setOnInsert: {
            user: settled.deliveryBoy,
            userModel: "Delivery",
            order: settled._id,
            type: "Delivery Earning",
            reference: `DEL-ERN-${orderIdString}`,
          },
        },
        { upsert: true, new: true },
      );
    }
    return settled;
  }

  if (settled.seller) {
    await releaseExpiredHeldSellerPayouts({ sellerId: settled.seller });
  }

  let sellerOnHold =
    settled.settlementStatus?.sellerPayout === "HOLD" ||
    Boolean(settled.financeFlags?.sellerPayoutHeld);

  if (!sellerOnHold && settled.financeFlags?.sellerPayoutQueued) {
    await autoProcessSellerPayoutForOrder(settled._id);
    const refreshed = await Order.findById(settled._id).lean();
    if (refreshed) {
      settled.settlementStatus = refreshed.settlementStatus;
      settled.financeFlags = refreshed.financeFlags;
      sellerOnHold = false;
    }
  }

  const sellerTxnStatus = sellerOnHold ? "Pending" : "Settled";

  const sellerEarning = Math.round(resolveSellerOrderEarning(settled));
  if (settled.seller && sellerEarning > 0) {
    await Transaction.findOneAndUpdate(
      { reference: orderIdString, userModel: "Seller" },
      {
        $set: {
          amount: sellerEarning,
          status: sellerTxnStatus,
        },
        $setOnInsert: {
          user: settled.seller,
          userModel: "Seller",
          order: settled._id,
          type: "Order Payment",
          reference: orderIdString,
        },
      },
      { upsert: true, new: true },
    );
  } else {
    await Transaction.findOneAndUpdate(
      { reference: orderIdString, userModel: "Seller" },
      { status: sellerTxnStatus },
    );
  }

  if (settled.deliveryBoy) {
    const deliveryEarning = Math.round(settled.paymentBreakdown?.riderPayoutTotal || 0);
    const deliveryMeta = {
      tipAmount: Math.round(settled.paymentBreakdown?.riderTipAmount || 0),
      payoutBase: Math.round(settled.paymentBreakdown?.riderPayoutBase || 0),
      payoutDistance: Math.round(settled.paymentBreakdown?.riderPayoutDistance || 0),
      payoutBonus: Math.round(settled.paymentBreakdown?.riderPayoutBonus || 0),
    };
    await Transaction.findOneAndUpdate(
      { reference: `DEL-ERN-${orderIdString}` },
      {
        $set: {
          amount: deliveryEarning,
          status: "Settled",
          meta: deliveryMeta,
        },
        $setOnInsert: {
          user: settled.deliveryBoy,
          userModel: "Delivery",
          order: settled._id,
          type: "Delivery Earning",
          reference: `DEL-ERN-${orderIdString}`,
        },
      },
      { upsert: true, new: true },
    );
  }

  let estimatedCashback = Number(settled.paymentBreakdown?.estimatedCashback || 0);
  if (estimatedCashback > 0 && settled.customer && !settled.financeFlags?.cashbackCredited) {
    const User = (await import("../models/customer.js")).default;
    const user = await User.findById(settled.customer).populate("currentPlan");
    const hasActivePlan =
      user?.currentPlan &&
      user.planExpiry &&
      new Date(user.planExpiry) > new Date();
    const cashbackFeature = user?.currentPlan?.features?.find(
      (feature) => feature.key === "CASHBACK",
    );
    const planCashbackPct =
      hasActivePlan && cashbackFeature?.value
        ? parseFloat(cashbackFeature.value) || 0
        : 0;

    if (!hasActivePlan || planCashbackPct <= 0) {
      estimatedCashback = 0;
    }

    if (estimatedCashback > 0 && user) {
      user.walletBalance = (user.walletBalance || 0) + estimatedCashback;
      await user.save();

      await Transaction.findOneAndUpdate(
        { reference: `CASHBACK-${orderIdString}` },
        {
          $setOnInsert: {
            user: settled.customer,
            userModel: "User",
            order: settled._id,
            type: "Cashback",
            amount: estimatedCashback,
            status: "Settled",
            reference: `CASHBACK-${orderIdString}`,
          },
        },
        { upsert: true, new: true },
      );

      settled.financeFlags = {
        ...(settled.financeFlags || {}),
        cashbackCredited: true,
      };
      await settled.save();

      emitNotificationEvent(NOTIFICATION_EVENTS.WALLET_UPDATED, {
        customerId: settled.customer,
        userId: settled.customer,
        orderObjectId: settled._id,
        data: {
          amount: estimatedCashback,
          direction: "credited",
          reason: `Cashback for order #${orderIdString}`,
          balance: user.walletBalance,
          dedupeKey: `wallet:${orderIdString}:cashback`,
        },
      });
    }
  }

  if (!settled.financeFlags?.levelCommissionCredited) {
    await processOrderLevelCommissions(settled);
    settled.financeFlags = {
      ...(settled.financeFlags || {}),
      levelCommissionCredited: true,
    };
    await settled.save();
  }

  return settled;
}

/**
 * Shared core for the self-healing sweep below: a rider's COD delivery
 * earning is normally credited immediately in applyDeliveredSettlement (see
 * above), but if that write was ever missed — e.g. an unrelated error
 * elsewhere in the same settlement call threw before reaching the credit
 * step, and the OTP-validate endpoint just logs + swallows it — the rider is
 * left delivered with no earning record and no retry. This creates any
 * missing "Delivery Earning" transactions for the given delivered COD orders.
 */
async function backfillCodRiderEarningsForOrders(codOrders) {
  if (codOrders.length === 0) return { created: 0 };

  const references = codOrders.map((o) => `DEL-ERN-${o.orderId}`);
  const existing = await Transaction.find({ reference: { $in: references } })
    .select("reference")
    .lean();
  const existingRefs = new Set(existing.map((t) => t.reference));

  const missing = codOrders.filter((o) => !existingRefs.has(`DEL-ERN-${o.orderId}`));
  if (missing.length === 0) return { created: 0 };

  let created = 0;
  for (const order of missing) {
    const amount = Math.round(order.paymentBreakdown?.riderPayoutTotal || 0);
    if (amount <= 0) continue;
    try {
      await Transaction.findOneAndUpdate(
        { reference: `DEL-ERN-${order.orderId}` },
        {
          $setOnInsert: {
            user: order.deliveryBoy,
            userModel: "Delivery",
            order: order._id,
            type: "Delivery Earning",
            reference: `DEL-ERN-${order.orderId}`,
            amount,
            status: "Settled",
            meta: {
              tipAmount: Math.round(order.paymentBreakdown?.riderTipAmount || 0),
              payoutBase: Math.round(order.paymentBreakdown?.riderPayoutBase || 0),
              payoutDistance: Math.round(order.paymentBreakdown?.riderPayoutDistance || 0),
              payoutBonus: Math.round(order.paymentBreakdown?.riderPayoutBonus || 0),
              settledViaCash: true,
              backfilled: true,
            },
          },
        },
        { upsert: true, new: true },
      );
      created += 1;
    } catch (error) {
      // Unique-index race with a concurrent settlement write for the same
      // order — harmless, the other write already created the record.
      console.warn(
        `[backfillMissingCodRiderEarnings] Skipped order ${order.orderId}:`,
        error.message,
      );
    }
  }
  return { created };
}

/** Per-rider sweep, called from the rider's own dashboard/earnings endpoints. */
export async function backfillMissingCodRiderEarnings(deliveryBoyId) {
  if (!deliveryBoyId) return { created: 0 };

  const codOrders = await Order.find({
    deliveryBoy: deliveryBoyId,
    status: "delivered",
    $or: [
      { paymentMode: { $regex: /^cod$/i } },
      { "payment.method": { $in: ["cod", "cash"] } },
    ],
  })
    .select("_id orderId deliveryBoy paymentBreakdown")
    .sort({ deliveredAt: -1 })
    .limit(300)
    .lean();

  return backfillCodRiderEarningsForOrders(codOrders);
}

/**
 * Platform-wide sweep (bounded to the most recent delivered COD orders) so
 * the admin delivery-transactions view self-heals too, even for a rider who
 * hasn't reopened their own app since the gap occurred.
 */
export async function backfillMissingCodRiderEarningsGlobal(limit = 500) {
  const codOrders = await Order.find({
    deliveryBoy: { $ne: null },
    status: "delivered",
    $or: [
      { paymentMode: { $regex: /^cod$/i } },
      { "payment.method": { $in: ["cod", "cash"] } },
    ],
  })
    .select("_id orderId deliveryBoy paymentBreakdown")
    .sort({ deliveredAt: -1 })
    .limit(limit)
    .lean();

  return backfillCodRiderEarningsForOrders(codOrders);
}

/**
 * After COD admin credit: finish wallet settlement + legacy txns / cashback / levels.
 */
export async function finalizeCodAfterAdminCredit(orderOrId, orderIdString) {
  const settled = await settleCodWalletsAfterAdminCredit(orderOrId);

  if (settled.seller) {
    await releaseExpiredHeldSellerPayouts({ sellerId: settled.seller });
  }

  let sellerOnHold =
    settled.settlementStatus?.sellerPayout === "HOLD" ||
    Boolean(settled.financeFlags?.sellerPayoutHeld);

  if (!sellerOnHold && settled.financeFlags?.sellerPayoutQueued) {
    await autoProcessSellerPayoutForOrder(settled._id);
  }

  const refreshed = await Order.findById(settled._id);
  if (!refreshed) return settled;

  const sellerTxnStatus =
    refreshed.settlementStatus?.sellerPayout === "HOLD" ||
    refreshed.financeFlags?.sellerPayoutHeld
      ? "Pending"
      : "Settled";

  const sellerEarning = Math.round(resolveSellerOrderEarning(refreshed));
  const ref = orderIdString || refreshed.orderId;
  if (refreshed.seller && sellerEarning > 0) {
    await Transaction.findOneAndUpdate(
      { reference: ref, userModel: "Seller" },
      {
        $set: {
          amount: sellerEarning,
          status: sellerTxnStatus,
        },
        $setOnInsert: {
          user: refreshed.seller,
          userModel: "Seller",
          order: refreshed._id,
          type: "Order Payment",
          reference: ref,
        },
      },
      { upsert: true, new: true },
    );
  }

  if (refreshed.deliveryBoy) {
    const deliveryEarning = Math.round(refreshed.paymentBreakdown?.riderPayoutTotal || 0);
    await Transaction.findOneAndUpdate(
      { reference: `DEL-ERN-${ref}` },
      {
        $set: {
          amount: deliveryEarning,
          status: "Settled",
          // COD: this earning was already kept in hand from the cash the
          // rider collected (see createPendingRiderPayout) — it counts
          // toward lifetime earnings history but must NOT also be treated
          // as withdrawable balance, or it'd pay the same commission twice.
          meta: {
            settledViaCash: true,
            codCollectedAmount: Math.round(refreshed.paymentBreakdown?.codCollectedAmount || 0),
            codRemittedAmount: Math.round(refreshed.paymentBreakdown?.codRemittedAmount || 0),
          },
        },
        $setOnInsert: {
          user: refreshed.deliveryBoy,
          userModel: "Delivery",
          order: refreshed._id,
          type: "Delivery Earning",
          reference: `DEL-ERN-${ref}`,
        },
      },
      { upsert: true, new: true },
    );
  }

  if (!refreshed.financeFlags?.levelCommissionCredited) {
    await processOrderLevelCommissions(refreshed);
    refreshed.financeFlags = {
      ...(refreshed.financeFlags || {}),
      levelCommissionCredited: true,
    };
    await refreshed.save();
  }

  return refreshed;
}

export async function getAdminCodPaymentQrSettings() {
  const settings = await Setting.findOne({})
    .select("adminPaymentQrUrl adminUpiId adminUpiName appName")
    .lean();
  return {
    qrUrl: settings?.adminPaymentQrUrl || "",
    upiId: settings?.adminUpiId || "",
    upiName: settings?.adminUpiName || settings?.appName || "Admin",
  };
}
