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
            type: "Order Payment",
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
          type: "Order Payment",
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
