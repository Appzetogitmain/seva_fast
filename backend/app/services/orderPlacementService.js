import mongoose from "mongoose";
import Cart from "../models/cart.js";
import CheckoutGroup from "../models/checkoutGroup.js";
import Order from "../models/order.js";
import User from "../models/customer.js";
import Transaction from "../models/transaction.js";
import { assertCouponUsable, syncCouponUsedCount } from "./couponUsageService.js";
import { WORKFLOW_STATUS, DEFAULT_SELLER_TIMEOUT_MS } from "../constants/orderWorkflow.js";
import { ORDER_PAYMENT_STATUS } from "../constants/finance.js";
import { freezeFinancialSnapshot } from "./finance/orderFinanceService.js";
import { resolveSellerOrderEarning } from "./finance/pricingService.js";
import {
  generateUniqueCheckoutGroupId,
  generateUniquePublicOrderId,
} from "./orderIdService.js";
import { afterPlaceOrderV2 } from "./orderWorkflowService.js";
import {
  computeStockReservationWindow,
  reserveStockForItems,
} from "./stockService.js";
import { finalizeWalletCoveredOnlineCheckout } from "./paymentService.js";
import { isLowStockAlertsEnabled } from "./lowStockAlertService.js";
import {
  checkIdempotency,
  acquireIdempotencyLock,
  storeIdempotencyResult,
  storeIdempotencyError,
  releaseIdempotencyLock,
  isRetryableError,
  validateIdempotencyKey,
} from "./idempotencyService.js";
import { buildCheckoutPricingSnapshot } from "./checkoutPricingService.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import * as logger from "./logger.js";

const IDEMPOTENCY_RECORD_TTL_MS = 24 * 60 * 60 * 1000;

function normalizePaymentMode(raw) {
  const mode = String(raw || "COD").trim().toUpperCase();
  return mode === "ONLINE" ? "ONLINE" : "COD";
}

function toObjectId(value, fieldName) {
  if (value == null || value === "") {
    const err = new Error(`${fieldName} is required for transaction`);
    err.statusCode = 500;
    throw err;
  }
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "object" && value._id != null) {
    return new mongoose.Types.ObjectId(String(value._id));
  }
  return new mongoose.Types.ObjectId(String(value));
}

async function persistTransaction(record, session) {
  const reference = String(record.reference || "").trim();
  if (!reference) {
    const err = new Error("Transaction reference is required");
    err.statusCode = 500;
    throw err;
  }

  const amount = Number(record.amount);
  if (!Number.isFinite(amount)) {
    const err = new Error("Transaction amount must be a valid number");
    err.statusCode = 500;
    throw err;
  }

  const doc = new Transaction({
    user: toObjectId(record.user, "user"),
    userModel: record.userModel,
    type: record.type,
    amount,
    status: record.status || "Pending",
    reference,
    order: record.order || undefined,
    meta: record.meta || undefined,
  });
  await doc.save({ session });
  return doc;
}

import { extractIndianPincode, parseCityStatePincode } from "../utils/pincode.js";

function normalizeAddress(address = {}) {
  const normalized = { ...(address || {}) };
  const parsedCity = parseCityStatePincode(normalized.city);

  if (!normalized.pincode) {
    normalized.pincode =
      extractIndianPincode(normalized.address, normalized.landmark, normalized.city) ||
      parsedCity.pincode;
  } else {
    normalized.pincode = String(normalized.pincode).trim();
  }
  if (!normalized.state && parsedCity.state) {
    normalized.state = parsedCity.state;
  }
  if (normalized.state != null) {
    normalized.state = String(normalized.state).trim();
  }
  if (parsedCity.city && String(normalized.city || "").includes(",")) {
    normalized.city = parsedCity.city;
  } else if (normalized.city != null) {
    normalized.city = String(normalized.city).trim();
  }
  if (address?.location) {
    const lat = Number(address.location.lat);
    const lng = Number(address.location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      delete normalized.location;
    } else {
      normalized.location = { lat, lng };
    }
  }
  return normalized;
}

function mapOrderItemsForPersistence(hydratedItems = []) {
  return hydratedItems.map((item) => ({
    product: item.productId,
    name: item.productName,
    quantity: item.quantity,
    price: item.price,
    variantSlot: String(item.variantSku || item.variantSlot || "").trim() || undefined,
    image: item.image || "",
    weight: item.weight || "",
    packageLength: Number.isFinite(Number(item.packageLength))
      ? Number(item.packageLength)
      : undefined,
    packageBreadth: Number.isFinite(Number(item.packageBreadth))
      ? Number(item.packageBreadth)
      : undefined,
    packageHeight: Number.isFinite(Number(item.packageHeight))
      ? Number(item.packageHeight)
      : undefined,
  }));
}

function placementSource(payload = {}) {
  return Array.isArray(payload.items) && payload.items.length > 0
    ? "DIRECT_ITEMS"
    : "CART";
}

function toPlain(doc) {
  if (!doc) return doc;
  if (typeof doc.toObject === "function") return doc.toObject();
  return doc;
}

function buildResultPayload({ checkoutGroup, orders }) {
  const plainGroup = toPlain(checkoutGroup);
  const plainOrders = Array.isArray(orders) ? orders.map((item) => toPlain(item)) : [];
  return {
    checkoutGroup: plainGroup,
    orders: plainOrders,
    order: plainOrders[0] || null,
  };
}

async function findExistingCheckoutByIdempotency(customerId, idempotencyKey) {
  if (!idempotencyKey) return null;

  const checkoutGroup = await CheckoutGroup.findOne({
    customer: customerId,
    "placement.idempotencyKey": idempotencyKey,
  }).lean();
  if (checkoutGroup) {
    const orders = await Order.find({
      checkoutGroupId: checkoutGroup.checkoutGroupId,
    })
      .sort({ checkoutGroupIndex: 1, createdAt: 1 })
      .lean();
    return { checkoutGroup, orders };
  }

  const legacyOrder = await Order.findOne({
    customer: customerId,
    "placement.idempotencyKey": idempotencyKey,
  }).lean();
  if (!legacyOrder) return null;
  return {
    checkoutGroup: null,
    orders: [legacyOrder],
  };
}

async function resolveOrderItemsInput({
  payload,
  customerId,
  session,
}) {
  let orderItemsInput = Array.isArray(payload.items) ? payload.items.filter(Boolean) : [];
  if (orderItemsInput.length > 0) {
    return {
      orderItemsInput,
      source: "DIRECT_ITEMS",
      cartDocument: null,
    };
  }

  const cart = await Cart.findOne({ customerId }, null, { session });
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    const err = new Error("Cannot place order with empty cart");
    err.statusCode = 400;
    throw err;
  }

  orderItemsInput = cart.items.map((item) => ({
    product: item.productId,
    variantSku: String(item.variantSku || "").trim(),
    quantity: item.quantity,
  }));
  return {
    orderItemsInput,
    source: "CART",
    cartDocument: cart,
  };
}

async function consumeCartItems({
  customerId,
  source,
  orderItemsInput,
  session,
  cartDocument = null,
}) {
  if (source === "CART") {
    const cart = cartDocument || (await Cart.findOne({ customerId }, null, { session }));
    if (!cart) return;
    cart.items = [];
    await cart.save({ session });
    return;
  }

  const cart = cartDocument || (await Cart.findOne({ customerId }, null, { session }));
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return;
  }

  const requestedQtyByLineKey = new Map();
  for (const item of orderItemsInput || []) {
    const productId = String(item.product || item.productId || "");
    if (!productId) continue;
    const variantSku = String(item.variantSku || item.variantSlot || "").trim();
    const quantity = Math.max(Number(item.quantity || 0), 0);
    if (!quantity) continue;
    const key = `${productId}::${variantSku || ""}`;
    requestedQtyByLineKey.set(key, (requestedQtyByLineKey.get(key) || 0) + quantity);
  }

  const remaining = [];
  for (const cartItem of cart.items) {
    const productId = String(cartItem.productId);
    const variantSku = String(cartItem.variantSku || "").trim();
    const key = `${productId}::${variantSku || ""}`;
    const requested = requestedQtyByLineKey.get(key) || 0;
    if (requested <= 0) {
      remaining.push(cartItem);
      continue;
    }
    const quantityLeft = Number(cartItem.quantity || 0) - requested;
    if (quantityLeft > 0) {
      remaining.push({
        productId: cartItem.productId,
        variantSku,
        quantity: quantityLeft,
      });
    }
    requestedQtyByLineKey.delete(key);
  }

  cart.items = remaining;
  await cart.save({ session });
}

function buildCheckoutGroupStatus(paymentMode) {
  return paymentMode === "ONLINE" ? "PAYMENT_PENDING" : "CREATED";
}

function buildCheckoutGroupPaymentStatus(paymentMode) {
  return paymentMode === "ONLINE"
    ? ORDER_PAYMENT_STATUS.CREATED
    : ORDER_PAYMENT_STATUS.PENDING_CASH_COLLECTION;
}

export async function placeOrderAtomic({
  customerId,
  payload,
  idempotencyKey = null,
  retryCount = 0,
}) {
  const normalizedPayload = {
    ...(payload || {}),
    paymentMode: normalizePaymentMode(payload?.paymentMode),
  };

  if (idempotencyKey) {
    if (!validateIdempotencyKey(idempotencyKey)) {
      const error = new Error("Invalid idempotency key format");
      error.statusCode = 400;
      throw error;
    }

    const idempotencyCheck = await checkIdempotency(idempotencyKey, normalizedPayload);
    if (idempotencyCheck.exists && !idempotencyCheck.checksumMismatch) {
      if (idempotencyCheck.result.status === "error") {
        const error = new Error(idempotencyCheck.result.error.message);
        error.statusCode = idempotencyCheck.result.error.statusCode || 500;
        throw error;
      }
      return {
        ...idempotencyCheck.result.data,
        duplicate: true,
      };
    }
    if (idempotencyCheck.checksumMismatch) {
      const error = new Error("Idempotency key reused with different payload");
      error.statusCode = 422;
      throw error;
    }
    if (idempotencyCheck.inProgress) {
      const error = new Error("Request is being processed");
      error.statusCode = 409;
      throw error;
    }

    const lockAcquired = await acquireIdempotencyLock(idempotencyKey);
    if (!lockAcquired) {
      const error = new Error("Request is being processed");
      error.statusCode = 409;
      throw error;
    }
  }

  const existingByIdempotency = await findExistingCheckoutByIdempotency(customerId, idempotencyKey);
  if (existingByIdempotency) {
    const existingResult = buildResultPayload({
      checkoutGroup: existingByIdempotency.checkoutGroup,
      orders: existingByIdempotency.orders,
    });
    if (idempotencyKey) {
      await storeIdempotencyResult(idempotencyKey, existingResult, normalizedPayload);
    }
    return { ...existingResult, duplicate: true };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction({
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxCommitTimeMS: parseInt(process.env.CHECKOUT_TRANSACTION_TIMEOUT_MS || "20000", 10),
    });

    const paymentMode = normalizePaymentMode(normalizedPayload.paymentMode);
    const normalizedAddress = normalizeAddress(normalizedPayload.address);
    const idempotencyKeyExpiry = idempotencyKey
      ? new Date(Date.now() + IDEMPOTENCY_RECORD_TTL_MS)
      : null;
    const source = placementSource(normalizedPayload);
    const walletAmount = Math.max(0, Number(normalizedPayload.walletAmount || 0));
    const tipAmount = Math.max(0, Number(normalizedPayload.tipAmount || 0));
    const couponId = normalizedPayload.couponId || null;
    let couponCode = null;
    if (couponId) {
      const couponDoc = await assertCouponUsable({
        couponId,
        customerId,
        session,
      });
      couponCode = couponDoc?.code ? String(couponDoc.code).toUpperCase() : null;
    }

    // 1. Fetch user and validate wallet
    const user = await User.findById(customerId).populate("currentPlan").session(session);
    if (walletAmount > 0) {
      if (!user) throw new Error("User not found");
      if (user.walletBalance < walletAmount) {
        throw new Error("Insufficient wallet balance");
      }
    }

    const {
      orderItemsInput,
      source: resolvedSource,
      cartDocument,
    } = await resolveOrderItemsInput({
      payload: normalizedPayload,
      customerId,
      session,
    });

    let hasFreeDelivery = false;
    let hasFreeHandling = false;
    let cashbackPercentage = 0;
    if (user?.currentPlan && user.planExpiry && new Date(user.planExpiry) > new Date()) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const monthlyOrderCount = await Order.countDocuments({
        customer: user._id,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        status: { $nin: ["cancelled", "declined"] }
      });

      const freeDelFeature = user.currentPlan.features?.find(f => f.key === "FREE_DELIVERY");
      if (freeDelFeature && freeDelFeature.value !== false && freeDelFeature.value !== "0") {
        const limit = parseInt(freeDelFeature.value, 10) || 0;
        if (limit === -1 || monthlyOrderCount < limit) {
          hasFreeDelivery = true;
        }
      }
      const freeHandFeature = user.currentPlan.features?.find(f => f.key === "FREE_HANDLING");
      if (freeHandFeature && freeHandFeature.value !== false && freeHandFeature.value !== "0") {
        const limit = parseInt(freeHandFeature.value, 10) || 0;
        if (limit === -1 || monthlyOrderCount < limit) {
          hasFreeHandling = true;
        }
      }
      const cashbackFeature = user.currentPlan.features?.find(f => f.key === "CASHBACK");
      if (cashbackFeature && cashbackFeature.value) {
        cashbackPercentage = parseFloat(cashbackFeature.value) || 0;
      }
    }

    let membershipTier = "none";
    if (user?.currentPlan && user.planExpiry && new Date(user.planExpiry) > new Date()) {
      const planName = String(user.currentPlan.name || "").toLowerCase();
      if (planName.includes("gold")) membershipTier = "gold";
      else if (planName.includes("silver")) membershipTier = "silver";
      else if (planName.includes("bronze")) membershipTier = "bronze";
    }

    const pricingSnapshot = await buildCheckoutPricingSnapshot({
      orderItems: orderItemsInput,
      address: normalizedAddress,
      tipAmount,
      discountTotal: Math.max(0, Number(normalizedPayload.discountTotal || 0)),
      session,
      hasFreeDelivery,
      hasFreeHandling,
      cashbackPercentage,
      membershipTier,
    });

    const checkoutGroupId = await generateUniqueCheckoutGroupId({ session });
    const checkoutReservation = computeStockReservationWindow(paymentMode);
    const checkoutGroup = new CheckoutGroup({
      checkoutGroupId,
      customer: customerId,
      paymentMode,
      paymentStatus: buildCheckoutGroupPaymentStatus(paymentMode),
      status: buildCheckoutGroupStatus(paymentMode),
      stockReservation: checkoutReservation,
      pricingSummary: pricingSnapshot.aggregateBreakdown,
      walletAmount,
      sellerCount: pricingSnapshot.sellerCount,
      itemCount: pricingSnapshot.itemCount,
      addressSnapshot: normalizedAddress,
      placement: {
        idempotencyKey: idempotencyKey || undefined,
        idempotencyKeyExpiry,
        createdFrom: resolvedSource || source,
      },
      expiresAt: checkoutReservation.expiresAt || null,
      metadata: {
        timeSlot: normalizedPayload.timeSlot || "now",
        tipAmount,
      },
    });
    await checkoutGroup.save({ session });

    const orders = [];
    const pendingLowStockAlerts = [];
    const sellerTimeoutMs = DEFAULT_SELLER_TIMEOUT_MS();
    const shouldStartSellerWorkflow = paymentMode === "COD";

    for (let index = 0; index < pricingSnapshot.sellerBreakdownEntries.length; index += 1) {
      const entry = pricingSnapshot.sellerBreakdownEntries[index];
      const orderId = await generateUniquePublicOrderId({ session });
      const orderReservation = computeStockReservationWindow(paymentMode);
      const sellerPendingUntil = shouldStartSellerWorkflow
        ? new Date(Date.now() + sellerTimeoutMs)
        : null;
      // Top-level expiresAt is for unpaid ONLINE reservation TTL only — never mirror sellerPendingUntil
      // or MongoDB TTL can delete the order when the seller does not accept in time.
      const orderExpiresAt = orderReservation.expiresAt || null;

      const sellerLowStockAlerts = await reserveStockForItems({
        items: entry.items,
        sellerId: entry.sellerId,
        orderId,
        session,
        paymentMode,
      });
      if (Array.isArray(sellerLowStockAlerts) && sellerLowStockAlerts.length > 0) {
        pendingLowStockAlerts.push(...sellerLowStockAlerts);
      }

      const orderGrandTotal = Number(entry.breakdown?.grandTotal || 0);
      const groupGrandTotal = Number(pricingSnapshot.aggregateBreakdown?.grandTotal || 1);
      const proportionateWallet = (orderGrandTotal / groupGrandTotal) * walletAmount;

      const isOrderScheduled = entry.items.some(item => item.deliveryType === "scheduled");
      const order = new Order({
        orderId,
        customer: customerId,
        seller: entry.sellerId,
        couponId: couponId || undefined,
        couponCode: couponCode || undefined,
        items: mapOrderItemsForPersistence(entry.items),
        address: normalizedAddress,
        paymentMode,
        deliveryType: isOrderScheduled ? "scheduled" : "instant",
        paymentStatus:
          paymentMode === "ONLINE"
            ? ORDER_PAYMENT_STATUS.CREATED
            : ORDER_PAYMENT_STATUS.PENDING_CASH_COLLECTION,
        payment: {
          method: paymentMode === "ONLINE" ? "online" : "cash",
          status: "pending",
        },
        pricing: {
          ...entry.breakdown, // This might overwrite fields, be careful
          tip: entry.breakdown.tipTotal,
          total: entry.breakdown.grandTotal,
          walletAmount: proportionateWallet,
        },
        status: "pending",
        orderStatus: "pending",
        timeSlot: normalizedPayload.timeSlot || "now",
        workflowVersion: 2,
        workflowStatus: shouldStartSellerWorkflow
          ? WORKFLOW_STATUS.SELLER_PENDING
          : WORKFLOW_STATUS.CREATED,
        sellerPendingExpiresAt: sellerPendingUntil,
        expiresAt: orderExpiresAt,
        stockReservation: orderReservation,
        checkoutGroupId,
        checkoutGroupSize: pricingSnapshot.sellerCount,
        checkoutGroupIndex: index,
        placement: {
          idempotencyKey: idempotencyKey || undefined,
          idempotencyKeyExpiry,
          createdFrom: resolvedSource || source,
        },
        settlementStatus: {
          overall: "PENDING",
          sellerPayout: "PENDING",
          riderPayout: "PENDING",
          adminEarningCredited: false,
        },
      });

      freezeFinancialSnapshot(order, entry.breakdown);
      await order.save({ session });
      orders.push(order);
    }

    checkoutGroup.orderIds = orders.map((order) => order._id);
    checkoutGroup.publicOrderIds = orders.map((order) => order.orderId);
    checkoutGroup.sellerBreakdown = orders.map((order, index) => ({
      seller: order.seller,
      order: order._id,
      publicOrderId: order.orderId,
      itemCount: order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      subtotal: Number(order.paymentBreakdown?.productSubtotal || 0),
      sellerPayout: Number(order.paymentBreakdown?.sellerPayoutTotal || 0),
      riderTipAmount: Number(order.paymentBreakdown?.riderTipAmount || 0),
      adminCommission: Number(order.paymentBreakdown?.adminProductCommissionTotal || 0),
      grandTotal: Number(order.paymentBreakdown?.grandTotal || 0),
    }));
    await checkoutGroup.save({ session });

    // Deduct wallet balance if used
    if (walletAmount > 0) {
      if (!user) throw new Error("User not found");
      user.walletBalance -= walletAmount;
      await user.save({ session });

      await persistTransaction(
        {
          user: user._id,
          userModel: "User",
          type: "Wallet Payment",
          amount: -Number(walletAmount.toFixed(2)),
          status: "Settled",
          reference: `WLT-CHOUT-${checkoutGroupId}`,
          meta: { checkoutGroupId },
        },
        session,
      );
    }

    for (const order of orders) {
      await persistTransaction(
        {
          user: order.seller,
          userModel: "Seller",
          order: order._id,
          type: "Order Payment",
          amount: Number(
            order.paymentBreakdown?.grandTotal || order.pricing?.total || 0,
          ),
          status: "Pending",
          reference: order.orderId,
          meta: { checkoutGroupId },
        },
        session,
      );
    }

    await consumeCartItems({
      customerId,
      source: resolvedSource || source,
      orderItemsInput,
      session,
      cartDocument,
    });

    await session.commitTransaction();

    const grandTotal = Number(pricingSnapshot.aggregateBreakdown?.grandTotal || 0);
    const walletCoversTotal =
      walletAmount > 0 &&
      Number(walletAmount.toFixed(2)) >= Number(grandTotal.toFixed(2));

    if (paymentMode === "ONLINE" && walletCoversTotal) {
      void finalizeWalletCoveredOnlineCheckout({
        orders,
        checkoutGroupId,
        customerId,
      }).catch((error) => {
        logger.warn("[placeOrderAtomic] wallet checkout finalization failed", {
          checkoutGroupId,
          message: error.message,
        });
      });
    }

    // Sync coupon usedCount from real checkout redemptions (multi-seller = 1)
    if (couponId) {
      syncCouponUsedCount(couponId, couponCode).catch(() => {});
    }

    const resultPayload = buildResultPayload({
      checkoutGroup,
      orders,
    });

    if (idempotencyKey) {
      await storeIdempotencyResult(idempotencyKey, resultPayload, normalizedPayload);
    }

    if (shouldStartSellerWorkflow) {
      for (const order of orders) {
        void afterPlaceOrderV2(order).catch((error) => {
          logger.warn("[placeOrderAtomic] afterPlaceOrderV2 failed", {
            orderId: order.orderId,
            message: error.message,
          });
        });
      }
    }

    if (shouldStartSellerWorkflow) {
      for (const order of orders) {
        emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_PLACED, {
          orderId: order.orderId,
          checkoutGroupId,
          customerId,
          userId: customerId,
        });
        if (order.seller) {
          emitNotificationEvent(NOTIFICATION_EVENTS.NEW_ORDER, {
            orderId: order.orderId,
            checkoutGroupId,
            sellerId: order.seller,
            customerId,
            sellerEarning: resolveSellerOrderEarning(order),
          });
        }
      }
    }

    if (pendingLowStockAlerts.length > 0 && await isLowStockAlertsEnabled()) {
      pendingLowStockAlerts.forEach((alertPayload) => {
        emitNotificationEvent(NOTIFICATION_EVENTS.LOW_STOCK_ALERT, alertPayload);
      });
    }

    return { ...resultPayload, duplicate: false };
  } catch (error) {
    await session.abortTransaction();

    if (idempotencyKey) {
      if (isRetryableError(error)) {
        await releaseIdempotencyLock(idempotencyKey);
      } else {
        await storeIdempotencyError(idempotencyKey, error, normalizedPayload);
      }
    }

    if (error?.code === 11000) {
      if (idempotencyKey) {
        const existing = await findExistingCheckoutByIdempotency(customerId, idempotencyKey);
        if (existing) {
          const existingResult = buildResultPayload({
            checkoutGroup: existing.checkoutGroup,
            orders: existing.orders,
          });
          await storeIdempotencyResult(idempotencyKey, existingResult, normalizedPayload);
          return { ...existingResult, duplicate: true };
        }
      }

      if (retryCount < 2 && /orderId|checkoutGroupId/i.test(String(error.message || ""))) {
        return placeOrderAtomic({
          customerId,
          payload: normalizedPayload,
          idempotencyKey,
          retryCount: retryCount + 1,
        });
      }
    }

    throw error;
  } finally {
    session.endSession();
  }
}

export default {
  placeOrderAtomic,
};
