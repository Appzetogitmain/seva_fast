import crypto from "crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";

import Order from "../models/order.js";
import CheckoutGroup from "../models/checkoutGroup.js";
import Payment from "../models/payment.js";
import PaymentWebhookEvent from "../models/paymentWebhookEvent.js";
import { ORDER_PAYMENT_STATUS } from "../constants/finance.js";
import {
  PAYMENT_EVENT_SOURCE,
  PAYMENT_GATEWAY,
  PAYMENT_STATUS,
  canTransitionPaymentStatus,
} from "../constants/payment.js";
import { handleOnlineOrderFinance } from "./finance/orderFinanceService.js";
import { resolveSellerOrderEarning } from "./finance/pricingService.js";
import { DEFAULT_SELLER_TIMEOUT_MS, WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { afterPlaceOrderV2 } from "./orderWorkflowService.js";
import { releaseReservedStockForOrder } from "./stockService.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";

let razorpayClient = null;
const MAX_RECEIPT_LENGTH = 40;

function getRazorpayClient() {
  if (razorpayClient) return razorpayClient;

  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials not configured");
  }

  razorpayClient = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpayClient;
}

function getRazorpayKeyId() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  if (!keyId) {
    throw new Error("Razorpay credentials not configured");
  }
  return keyId;
}

function verifyRazorpaySignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const secret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!secret) {
    throw new Error("Razorpay credentials not configured");
  }

  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return generatedSignature === razorpaySignature;
}

function sanitizeGatewayPayload(payload = {}) {
  return {
    merchantOrderId: payload.merchantOrderId || payload.id,
    transactionId: payload.transactionId || payload.payment_id,
    amount: payload.amount,
    state: payload.state || payload.status,
    responseCode: payload.responseCode,
    paymentMode: payload.paymentMode,
    meta: payload.meta || {},
  };
}

function sanitizeMerchantOrderIdPart(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildGatewayReceipt(publicOrderRef, attemptCount = 1) {
  const normalizedBase = sanitizeMerchantOrderIdPart(publicOrderRef) || "ORDER";
  const suffix = `-A${Math.max(1, Number(attemptCount) || 1)}`;
  const maxBaseLength = MAX_RECEIPT_LENGTH - suffix.length;
  const truncatedBase = normalizedBase.slice(0, Math.max(1, maxBaseLength));
  return `${truncatedBase}${suffix}`;
}

function toOrderLookup(orderRef) {
  if (!orderRef) return null;
  const trimmed = String(orderRef).trim();
  if (!trimmed) return null;
  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    return {
      $or: [{ _id: new mongoose.Types.ObjectId(trimmed) }, { orderId: trimmed }],
    };
  }
  return { orderId: trimmed };
}

function extractCheckoutGroupId(orderRef) {
  const trimmed = String(orderRef || "").trim().toUpperCase();
  if (!trimmed) return null;
  if (trimmed.startsWith("CHK-") || trimmed.startsWith("CG-")) {
    return trimmed;
  }
  return null;
}

async function resolvePaymentTarget(orderRef) {
  const checkoutGroupId = extractCheckoutGroupId(orderRef);
  if (checkoutGroupId) {
    const checkoutGroup = await CheckoutGroup.findOne({ checkoutGroupId }).lean();
    if (!checkoutGroup) {
      const err = new Error("Checkout group not found");
      err.statusCode = 404;
      throw err;
    }
    let orders = await Order.find({ checkoutGroupId })
      .sort({ checkoutGroupIndex: 1, createdAt: 1 });

    if (orders.length === 0) {
      const fallbackClauses = [];
      if (Array.isArray(checkoutGroup.orderIds) && checkoutGroup.orderIds.length > 0) {
        fallbackClauses.push({ _id: { $in: checkoutGroup.orderIds } });
      }
      if (Array.isArray(checkoutGroup.publicOrderIds) && checkoutGroup.publicOrderIds.length > 0) {
        fallbackClauses.push({ orderId: { $in: checkoutGroup.publicOrderIds } });
      }

      if (fallbackClauses.length > 0) {
        orders = await Order.find({ $or: fallbackClauses })
          .sort({ checkoutGroupIndex: 1, createdAt: 1 });
      }
    }

    if (orders.length === 0) {
      const err = new Error("Checkout group has no orders");
      err.statusCode = 404;
      throw err;
    }
    return {
      checkoutGroupId,
      checkoutGroup,
      orders,
      primaryOrder: orders[0],
      publicOrderRef: checkoutGroupId,
    };
  }

  const query = toOrderLookup(orderRef);
  if (!query) {
    const err = new Error("orderRef is required");
    err.statusCode = 400;
    throw err;
  }

  const order = await Order.findOne(query);
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  if (order.checkoutGroupId) {
    const orders = await Order.find({ checkoutGroupId: order.checkoutGroupId })
      .sort({ checkoutGroupIndex: 1, createdAt: 1 });
    const checkoutGroup = await CheckoutGroup.findOne({
      checkoutGroupId: order.checkoutGroupId,
    }).lean();
    return {
      checkoutGroupId: order.checkoutGroupId,
      checkoutGroup,
      orders: orders.length > 0 ? orders : [order],
      primaryOrder: order,
      publicOrderRef: order.checkoutGroupId,
    };
  }

  return {
    checkoutGroupId: null,
    checkoutGroup: null,
    orders: [order],
    primaryOrder: order,
    publicOrderRef: order.orderId,
  };
}

function validatePaymentEligibility(target, userId) {
  if (!target?.orders?.length) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  for (const order of target.orders) {
    if (String(order.customer) !== String(userId)) {
      const err = new Error("You are not allowed to pay for this order");
      err.statusCode = 403;
      throw err;
    }
    if (order.paymentMode !== "ONLINE") {
      const err = new Error("Payment is allowed only for ONLINE orders");
      err.statusCode = 400;
      throw err;
    }
    if (
      order.status === "cancelled" ||
      order.workflowStatus === WORKFLOW_STATUS.CANCELLED ||
      order.status === "delivered" ||
      order.workflowStatus === WORKFLOW_STATUS.DELIVERED
    ) {
      const err = new Error("Payment is not allowed for this checkout state");
      err.statusCode = 409;
      throw err;
    }
    if (order.paymentStatus === ORDER_PAYMENT_STATUS.PAID) {
      const err = new Error("Order is already paid");
      err.statusCode = 409;
      throw err;
    }
    if (order.paymentStatus === ORDER_PAYMENT_STATUS.REFUNDED) {
      const err = new Error("Order payment has already been refunded");
      err.statusCode = 409;
      throw err;
    }
  }
}

function getPayableAmountPaise(target) {
  const grossRupees = target.orders.reduce(
    (sum, order) =>
      sum + Number(order?.paymentBreakdown?.grandTotal ?? order?.pricing?.total ?? 0),
    0,
  );
  const walletFromGroup = Number(target.checkoutGroup?.walletAmount || 0);
  const walletFromOrders = target.orders.reduce(
    (sum, order) => sum + Number(order?.pricing?.walletAmount || 0),
    0,
  );
  const walletUsed = Math.max(walletFromGroup, walletFromOrders);
  const amountRupees = Math.max(0, grossRupees - walletUsed);
  if (!Number.isFinite(amountRupees) || amountRupees < 0) {
    const err = new Error("Unable to determine payable amount for this checkout");
    err.statusCode = 400;
    throw err;
  }
  if (amountRupees === 0) {
    return 0;
  }
  return Math.round(amountRupees * 100);
}

function mapRazorpayStatusToInternal(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid" || normalized === "captured") return PAYMENT_STATUS.CAPTURED;
  if (normalized === "failed") return PAYMENT_STATUS.FAILED;
  if (normalized === "cancelled") return PAYMENT_STATUS.CANCELLED;
  if (normalized === "authorized") return PAYMENT_STATUS.AUTHORIZED;
  return PAYMENT_STATUS.PENDING;
}

function paymentStatusToOrderPaymentStatus(status) {
  if (status === PAYMENT_STATUS.CAPTURED) return ORDER_PAYMENT_STATUS.PAID;
  if (status === PAYMENT_STATUS.FAILED) return ORDER_PAYMENT_STATUS.FAILED;
  if (status === PAYMENT_STATUS.REFUNDED) return ORDER_PAYMENT_STATUS.REFUNDED;
  return ORDER_PAYMENT_STATUS.CREATED;
}

async function transitionPaymentState(payment, {
  nextStatus,
  source,
  reason = "",
  gatewayPaymentId = null,
  rawGatewayResponse = null,
}) {
  const currentStatus = payment.status || PAYMENT_STATUS.CREATED;
  if (currentStatus === nextStatus) {
    if (gatewayPaymentId && !payment.gatewayPaymentId) {
      payment.gatewayPaymentId = gatewayPaymentId;
    }
    if (rawGatewayResponse) {
      payment.rawGatewayResponse = {
        ...(payment.rawGatewayResponse || {}),
        ...sanitizeGatewayPayload(rawGatewayResponse),
      };
    }
    await payment.save();
    return payment;
  }

  if (!canTransitionPaymentStatus(currentStatus, nextStatus)) {
    const err = new Error(`Invalid payment transition ${currentStatus} -> ${nextStatus}`);
    err.statusCode = 409;
    throw err;
  }

  payment.status = nextStatus;
  if (gatewayPaymentId) payment.gatewayPaymentId = gatewayPaymentId;
  if (rawGatewayResponse) {
    payment.rawGatewayResponse = {
      ...(payment.rawGatewayResponse || {}),
      ...sanitizeGatewayPayload(rawGatewayResponse),
    };
  }
  payment.statusHistory.push({
    fromStatus: currentStatus,
    toStatus: nextStatus,
    source,
    reason,
    changedAt: new Date(),
  });
  if (nextStatus === PAYMENT_STATUS.CAPTURED) {
    payment.capturedAt = new Date();
  } else if (nextStatus === PAYMENT_STATUS.FAILED) {
    payment.failedAt = new Date();
    payment.failureReason = reason || payment.failureReason;
  } else if (nextStatus === PAYMENT_STATUS.REFUNDED) {
    payment.refundedAt = new Date();
  }
  await payment.save();
  return payment;
}

export async function finalizeWalletCoveredOnlineCheckout({
  orders,
  checkoutGroupId,
  customerId,
}) {
  if (!Array.isArray(orders) || orders.length === 0) return;

  const walletRef = `WLT-CHOUT-${checkoutGroupId}`;
  for (const order of orders) {
    await handleOnlineOrderFinance(order._id, {
      actorId: null,
      transactionId: walletRef,
      metadata: {
        checkoutGroupId,
        paidVia: "wallet",
      },
    });
    await moveOrderToSellerPendingAfterPayment(order._id);
    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_PLACED, {
      orderId: order.orderId,
      checkoutGroupId,
      customerId,
      userId: customerId,
    });
    emitNotificationEvent(NOTIFICATION_EVENTS.PAYMENT_SUCCESS, {
      orderId: order.orderId,
      checkoutGroupId,
      customerId,
      userId: customerId,
      sellerId: order.seller,
    });
    if (order.seller) {
      emitNotificationEvent(NOTIFICATION_EVENTS.NEW_ORDER, {
        orderId: order.orderId,
        checkoutGroupId,
        sellerId: order.seller,
        sellerEarning: resolveSellerOrderEarning(order),
      });
    }
  }
  await updateCheckoutGroupPaymentStatus(checkoutGroupId, PAYMENT_STATUS.CAPTURED);
}

async function moveOrderToSellerPendingAfterPayment(orderId) {
  const now = new Date();
  const sellerPendingUntil = new Date(now.getTime() + DEFAULT_SELLER_TIMEOUT_MS());
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      workflowVersion: { $gte: 2 },
      workflowStatus: WORKFLOW_STATUS.CREATED,
      paymentMode: "ONLINE",
    },
    {
      $set: {
        workflowStatus: WORKFLOW_STATUS.SELLER_PENDING,
        sellerPendingExpiresAt: sellerPendingUntil,
      },
    },
    { new: true },
  );
  if (updatedOrder) {
    void afterPlaceOrderV2(updatedOrder).catch((error) => {
      console.warn("[moveOrderToSellerPendingAfterPayment] afterPlaceOrderV2:", error.message);
    });
  }
}

async function getRelatedOrdersForPayment(payment) {
  if (Array.isArray(payment.orderIds) && payment.orderIds.length > 0) {
    return Order.find({ _id: { $in: payment.orderIds } })
      .sort({ checkoutGroupIndex: 1, createdAt: 1 });
  }
  if (payment.checkoutGroupId) {
    return Order.find({ checkoutGroupId: payment.checkoutGroupId })
      .sort({ checkoutGroupIndex: 1, createdAt: 1 });
  }
  if (payment.order) {
    const order = await Order.findById(payment.order);
    return order ? [order] : [];
  }
  return [];
}

async function updateCheckoutGroupPaymentStatus(checkoutGroupId, nextStatus) {
  if (!checkoutGroupId) return;
  if (nextStatus === PAYMENT_STATUS.CAPTURED) {
    await CheckoutGroup.updateOne(
      { checkoutGroupId },
      {
        $set: {
          status: "PAID",
          paymentStatus: ORDER_PAYMENT_STATUS.PAID,
          "stockReservation.status": "COMMITTED",
        },
      },
    );
    return;
  }
  if (nextStatus === PAYMENT_STATUS.FAILED || nextStatus === PAYMENT_STATUS.CANCELLED) {
    await CheckoutGroup.updateOne(
      { checkoutGroupId },
      {
        $set: {
          status: "CANCELLED",
          paymentStatus: ORDER_PAYMENT_STATUS.FAILED,
          "stockReservation.status": "RELEASED",
          "stockReservation.releasedAt": new Date(),
        },
      },
    );
    return;
  }
  if (nextStatus === PAYMENT_STATUS.REFUNDED) {
    await CheckoutGroup.updateOne(
      { checkoutGroupId },
      {
        $set: {
          paymentStatus: ORDER_PAYMENT_STATUS.REFUNDED,
          status: "CANCELLED",
        },
      },
    );
  }
}

async function handleOrderSideEffectsFromPaymentStatus(payment, nextStatus, reason) {
  const orders = await getRelatedOrdersForPayment(payment);
  if (!orders.length) return;

  if (nextStatus === PAYMENT_STATUS.CAPTURED) {
    for (const order of orders) {
      await handleOnlineOrderFinance(order._id, {
        actorId: null,
        transactionId: payment.gatewayPaymentId || "",
        metadata: {
          paymentId: payment._id.toString(),
          checkoutGroupId: payment.checkoutGroupId || null,
        },
      });
      await moveOrderToSellerPendingAfterPayment(order._id);
      emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_PLACED, {
        orderId: order.orderId,
        checkoutGroupId: payment.checkoutGroupId,
        customerId: order.customer,
        userId: order.customer,
      });
      emitNotificationEvent(NOTIFICATION_EVENTS.PAYMENT_SUCCESS, {
        orderId: order.orderId,
        checkoutGroupId: payment.checkoutGroupId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
      });

      emitNotificationEvent(NOTIFICATION_EVENTS.NEW_ORDER, {
        orderId: order.orderId,
        sellerId: order.seller,
        sellerEarning: resolveSellerOrderEarning(order),
      });
    }
    await updateCheckoutGroupPaymentStatus(payment.checkoutGroupId, nextStatus);
    return;
  }

  if (nextStatus === PAYMENT_STATUS.FAILED || nextStatus === PAYMENT_STATUS.CANCELLED) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      for (const order of orders) {
        const orderForUpdate = await Order.findById(order._id, null, { session });
        if (
          orderForUpdate &&
          orderForUpdate.workflowStatus === WORKFLOW_STATUS.CREATED &&
          orderForUpdate.status !== "cancelled"
        ) {
          await releaseReservedStockForOrder(orderForUpdate, {
            session,
            reason: reason || "Payment failed",
          });
          orderForUpdate.status = "cancelled";
          orderForUpdate.orderStatus = "cancelled";
          orderForUpdate.workflowStatus = WORKFLOW_STATUS.CANCELLED;
          orderForUpdate.cancelledBy = "system";
          orderForUpdate.cancelReason = reason || "Payment failed";
          orderForUpdate.paymentStatus = ORDER_PAYMENT_STATUS.FAILED;
          await orderForUpdate.save({ session });
        }
      }
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    await updateCheckoutGroupPaymentStatus(payment.checkoutGroupId, nextStatus);
    for (const order of orders) {
      emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
        orderId: order.orderId,
        checkoutGroupId: payment.checkoutGroupId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
        customerMessage: "Order was cancelled because payment failed.",
        sellerMessage: `Order #${order.orderId} was cancelled because payment failed.`,
      });
    }
    return;
  }

  if (nextStatus === PAYMENT_STATUS.REFUNDED) {
    await Order.updateMany(
      { _id: { $in: orders.map((order) => order._id) } },
      {
        $set: {
          paymentStatus: ORDER_PAYMENT_STATUS.REFUNDED,
          "payment.status": "refunded",
        },
      },
    );
    await updateCheckoutGroupPaymentStatus(payment.checkoutGroupId, nextStatus);
    for (const order of orders) {
      emitNotificationEvent(NOTIFICATION_EVENTS.REFUND_COMPLETED, {
        orderId: order.orderId,
        checkoutGroupId: payment.checkoutGroupId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
      });
    }
    return;
  }

  await Order.updateMany(
    { _id: { $in: orders.map((order) => order._id) } },
    {
      $set: {
        paymentStatus: paymentStatusToOrderPaymentStatus(nextStatus),
      },
    },
  );
}

function buildRazorpayInitResponse(payment) {
  return {
    payment,
    razorpayOrderId: payment.gatewayOrderId,
    amount: payment.amount,
    currency: payment.currency,
    razorpayKey: getRazorpayKeyId(),
    merchantOrderId: payment.gatewayOrderId,
  };
}

export async function createPaymentOrderForOrderRef({
  orderRef,
  userId,
  idempotencyKey = null,
  correlationId = null,
}) {
  const target = await resolvePaymentTarget(orderRef);
  validatePaymentEligibility(target, userId);
  const primaryOrder = target.primaryOrder;
  const paymentScopeQuery = target.checkoutGroupId
    ? { checkoutGroupId: target.checkoutGroupId }
    : { order: primaryOrder._id };

  if (idempotencyKey) {
    const existingForKey = await Payment.findOne({
      ...paymentScopeQuery,
      idempotencyKey,
    });
    if (existingForKey) {
      return {
        ...buildRazorpayInitResponse(existingForKey),
        duplicate: true,
      };
    }
  }

  const existingOpenPayment = await Payment.findOne({
    ...paymentScopeQuery,
    status: {
      $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING],
    },
  }).sort({ createdAt: -1 });

  if (existingOpenPayment?.gatewayOrderId) {
    return {
      ...buildRazorpayInitResponse(existingOpenPayment),
      duplicate: true,
    };
  }

  const amountPaise = getPayableAmountPaise(target);
  if (amountPaise === 0) {
    const err = new Error("No online payment required for this order");
    err.statusCode = 400;
    throw err;
  }
  const currency = String(primaryOrder?.paymentBreakdown?.currency || "INR").toUpperCase();
  const attemptCount = (await Payment.countDocuments(paymentScopeQuery)) + 1;
  const receipt = buildGatewayReceipt(
    target.checkoutGroupId || target.publicOrderRef || crypto.randomUUID(),
    attemptCount,
  );

  const client = getRazorpayClient();
  const razorpayOrder = await client.orders.create({
    amount: amountPaise,
    currency,
    receipt,
    notes: {
      publicOrderId: target.publicOrderRef,
      checkoutGroupId: target.checkoutGroupId || "",
      customerId: String(primaryOrder.customer),
    },
  });

  const paymentData = {
    order: primaryOrder._id,
    orderIds: target.orders.map((order) => order._id),
    checkoutGroupId: target.checkoutGroupId || null,
    publicOrderId: target.publicOrderRef,
    customer: primaryOrder.customer,
    gatewayName: PAYMENT_GATEWAY.RAZORPAY,
    gatewayOrderId: razorpayOrder.id,
    amount: amountPaise,
    currency,
    status: PAYMENT_STATUS.PENDING,
    attemptCount,
    idempotencyKey: idempotencyKey || undefined,
    correlationId,
    rawGatewayResponse: {
      merchantOrderId: razorpayOrder.id,
      receipt,
      amount: amountPaise,
      status: razorpayOrder.status,
    },
    statusHistory: [
      {
        fromStatus: PAYMENT_STATUS.CREATED,
        toStatus: PAYMENT_STATUS.PENDING,
        source: PAYMENT_EVENT_SOURCE.SYSTEM,
        reason: "Razorpay checkout initiated",
      },
    ],
  };

  const payment = await Payment.create(paymentData);

  console.log(
    JSON.stringify({
      level: "info",
      ts: new Date().toISOString(),
      event: "payment_order_created",
      correlationId,
      publicOrderId: payment.publicOrderId,
      paymentId: payment._id.toString(),
      gatewayOrderId: payment.gatewayOrderId,
      amount: payment.amount,
    }),
  );

  return {
    ...buildRazorpayInitResponse(payment),
    duplicate: false,
  };
}

async function syncPaymentFromRazorpayOrder(payment, {
  source,
  reason,
  gatewayPaymentId = null,
  rawGatewayResponse = null,
}) {
  const client = getRazorpayClient();
  const razorpayOrder = await client.orders.fetch(payment.gatewayOrderId);
  const nextStatus = mapRazorpayStatusToInternal(razorpayOrder.status);

  let resolvedPaymentId = gatewayPaymentId;
  if (!resolvedPaymentId && nextStatus === PAYMENT_STATUS.CAPTURED) {
    const payments = await client.orders.fetchPayments(payment.gatewayOrderId);
    const capturedPayment = payments?.items?.find(
      (item) => String(item.status || "").toLowerCase() === "captured",
    );
    resolvedPaymentId = capturedPayment?.id || null;
  }

  await transitionPaymentState(payment, {
    nextStatus,
    source,
    reason,
    gatewayPaymentId: resolvedPaymentId,
    rawGatewayResponse: rawGatewayResponse || razorpayOrder,
  });

  await handleOrderSideEffectsFromPaymentStatus(
    payment,
    nextStatus,
    reason || razorpayOrder.status,
  );

  return {
    payment,
    status: nextStatus,
  };
}

export async function verifyRazorpayPaymentStatus({
  merchantOrderId,
  userId,
  razorpayPaymentId = null,
  razorpaySignature = null,
  correlationId = null,
}) {
  const payment = await Payment.findOne({ gatewayOrderId: merchantOrderId });
  if (!payment) {
    const err = new Error("Payment attempt not found");
    err.statusCode = 404;
    throw err;
  }

  if (userId && String(payment.customer) !== String(userId)) {
    const err = new Error("Not authorized to verify this payment");
    err.statusCode = 403;
    throw err;
  }

  if (payment.status === PAYMENT_STATUS.CAPTURED) {
    return {
      payment,
      status: payment.status,
    };
  }

  if (razorpayPaymentId && razorpaySignature) {
    const isValid = verifyRazorpaySignature({
      razorpayOrderId: merchantOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    if (!isValid) {
      const err = new Error("Payment signature verification failed");
      err.statusCode = 400;
      throw err;
    }

    await transitionPaymentState(payment, {
      nextStatus: PAYMENT_STATUS.CAPTURED,
      source: PAYMENT_EVENT_SOURCE.CLIENT_VERIFY,
      reason: "Razorpay client signature verified",
      gatewayPaymentId: razorpayPaymentId,
      rawGatewayResponse: {
        merchantOrderId,
        transactionId: razorpayPaymentId,
        state: "paid",
      },
    });

    await handleOrderSideEffectsFromPaymentStatus(
      payment,
      PAYMENT_STATUS.CAPTURED,
      "Razorpay payment captured",
    );
  } else {
    await syncPaymentFromRazorpayOrder(payment, {
      source: PAYMENT_EVENT_SOURCE.CLIENT_VERIFY,
      reason: "Razorpay status check",
      gatewayPaymentId: razorpayPaymentId,
    });
  }

  payment.correlationId = correlationId || payment.correlationId;
  await payment.save();

  console.log(
    JSON.stringify({
      level: "info",
      ts: new Date().toISOString(),
      event: "payment_status_verified",
      correlationId,
      merchantOrderId,
      status: payment.status,
    }),
  );

  return {
    payment,
    status: payment.status,
  };
}

export async function processRazorpayWebhook({
  rawBody,
  signature,
  correlationId = null,
}) {
  const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret) {
    const err = new Error("Razorpay webhook secret not configured");
    err.statusCode = 500;
    throw err;
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (!signature || expectedSignature !== signature) {
    const err = new Error("Invalid webhook signature");
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    const err = new Error("Invalid webhook payload");
    err.statusCode = 400;
    throw err;
  }

  const event = payload.event || "unknown";
  const paymentEntity = payload?.payload?.payment?.entity || {};
  const orderEntity = payload?.payload?.order?.entity || {};
  const gatewayOrderId = orderEntity.id || paymentEntity.order_id;
  const gatewayPaymentId = paymentEntity.id || null;
  const eventId = payload.id || gatewayPaymentId || crypto.randomUUID();
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  try {
    await PaymentWebhookEvent.create({
      eventId,
      gatewayName: PAYMENT_GATEWAY.RAZORPAY,
      eventType: event,
      payloadHash,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return { duplicate: true, accepted: true };
    }
    throw error;
  }

  if (!gatewayOrderId) {
    return { accepted: true, ignored: true, reason: "Missing Razorpay order id" };
  }

  const payment = await Payment.findOne({ gatewayOrderId });
  if (!payment) {
    return { accepted: true, ignored: true, reason: "Payment attempt not found" };
  }

  const nextStatus = mapRazorpayStatusToInternal(
    paymentEntity.status || orderEntity.status || event,
  );

  await transitionPaymentState(payment, {
    nextStatus,
    source: PAYMENT_EVENT_SOURCE.WEBHOOK,
    reason: `Razorpay webhook: ${event}`,
    gatewayPaymentId,
    rawGatewayResponse: paymentEntity.id ? paymentEntity : orderEntity,
  });

  payment.correlationId = correlationId || payment.correlationId;
  await payment.save();

  await PaymentWebhookEvent.updateOne(
    { eventId },
    {
      $set: {
        payment: payment._id,
        publicOrderId: payment.publicOrderId,
      },
    },
  );

  await handleOrderSideEffectsFromPaymentStatus(
    payment,
    nextStatus,
    paymentEntity.error_description || event,
  );

  return {
    accepted: true,
    duplicate: false,
    paymentStatus: nextStatus,
    publicOrderId: payment.publicOrderId,
  };
}

export async function verifyClientPaymentCallback(data) {
  const merchantOrderId =
    data.gatewayOrderId ||
    data.merchantOrderId ||
    data.razorpay_order_id;

  if (!merchantOrderId) {
    const err = new Error("merchantOrderId is required");
    err.statusCode = 400;
    throw err;
  }

  return verifyRazorpayPaymentStatus({
    merchantOrderId,
    userId: data.userId,
    razorpayPaymentId: data.gatewayPaymentId || data.transactionId || data.razorpay_payment_id,
    razorpaySignature: data.razorpaySignature || data.razorpay_signature || null,
    correlationId: data.correlationId,
  });
}
