import Order from "../models/order.js";
import Cart from "../models/cart.js";
import Product from "../models/product.js";
import Transaction from "../models/transaction.js";
import StockHistory from "../models/stockHistory.js";
import Seller from "../models/seller.js";
import Delivery from "../models/delivery.js";
import Setting from "../models/setting.js";
import User from "../models/customer.js";
import CheckoutGroup from "../models/checkoutGroup.js";
import Payout from "../models/payout.js";
import OrderOtp from "../models/orderOtp.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import { WORKFLOW_STATUS, DEFAULT_SELLER_TIMEOUT_MS, workflowFromLegacyStatus, legacyStatusFromWorkflow } from "../constants/orderWorkflow.js";
import { ORDER_PAYMENT_STATUS } from "../constants/finance.js";
import {
  afterPlaceOrderV2,
  sellerAcceptAtomic,
  sellerRejectAtomic,
  deliveryAcceptAtomic,
  customerCancelV2,
  resolveWorkflowStatus,
} from "../services/orderWorkflowService.js";
import { applyDeliveredSettlement } from "../services/orderSettlement.js";
import {
  freezeFinancialSnapshot,
  reverseOrderFinanceOnCancellation,
  markSelfDeliveryCodCashWithSeller,
} from "../services/finance/orderFinanceService.js";
import { getDeliveryPartnerIdsWithinSellerRadius } from "../services/deliveryNearbyService.js";
import {
  generateOrderPaymentBreakdown,
  hydrateOrderItems,
} from "../services/finance/pricingService.js";
import { distanceMeters } from "../utils/geoUtils.js";
import {
  fetchAvailableOrdersForDelivery,
  fetchSellerOrdersPage,
} from "../services/orderQueryService.js";
import {
  orderMatchQueryFromRouteParam,
  orderMatchQueryFlexible,
} from "../utils/orderLookup.js";
import { sanitizeOrderForDeliveryView, sanitizeOrdersForDeliveryView } from "../utils/deliveryOrderView.js";
import { sanitizeOrderForSellerView } from "../utils/sellerOrderView.js";
import { createFinanceOrderSchema } from "../validation/financeValidation.js";
import { placeOrderAtomic } from "../services/orderPlacementService.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { cancelShiprocketShipmentForOrder } from "../services/shiprocket/shiprocketOrderService.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import {
  emitDeliveryBroadcastForSeller,
  emitReturnBroadcastForCustomer,
  retractDeliveryBroadcastForOrder,
  emitToSeller,
  emitToDelivery,
  emitOrderStatusUpdate,
} from "../services/orderSocketEmitter.js";
import * as walletService from "../services/finance/walletService.js";
import { OWNER_TYPE } from "../constants/finance.js";
import { processPayout } from "../services/finance/payoutService.js";
import { getAdminIds } from "../utils/adminIds.js";
import { buildKey, getOrSet, getTTL, invalidate } from "../services/cacheService.js";

function validateWithJoi(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    const err = new Error(error.details.map((item) => item.message).join("; "));
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function normalizePaymentMode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "ONLINE") return "ONLINE";
  if (raw === "COD" || raw === "CASH") return "COD";
  return null;
}

function inferPaymentMode(payment = {}) {
  const candidates = [
    payment.paymentMode,
    payment.mode,
    payment.method,
    payment.type,
    payment.paymentMethod,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  if (
    candidates.some(
      (value) =>
        value.includes("online") || value.includes("upi") || value.includes("card"),
    )
  ) {
    return "ONLINE";
  }
  if (candidates.some((value) => value.includes("cod") || value.includes("cash"))) {
    return "COD";
  }
  return null;
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return fallback;
}

function getReturnEligibilityDelayMinutes() {
  return parsePositiveInt(process.env.RETURN_ELIGIBILITY_DELAY_MINUTES, 0);
}

function getReturnWindowMinutes() {
  return parsePositiveInt(process.env.RETURN_WINDOW_MINUTES, 24 * 60);
}

function formatDurationMinutes(minutes) {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

function computeReturnWindowForOrder(order) {
  const base = order?.deliveredAt || order?.createdAt || new Date();
  const deliveredAt = base instanceof Date ? base : new Date(base);
  const eligibleDelay = getReturnEligibilityDelayMinutes();
  const windowMinutes = getReturnWindowMinutes();
  const eligibleAt = new Date(deliveredAt.getTime() + eligibleDelay * 60 * 1000);
  let windowExpiresAt = new Date(deliveredAt.getTime() + windowMinutes * 60 * 1000);
  if (windowExpiresAt < eligibleAt) {
    windowExpiresAt = eligibleAt;
  }

  return {
    eligibleAt,
    windowExpiresAt,
    eligibleDelay,
    windowMinutes,
  };
}

async function deriveDistanceKm({ sellerId, addressLocation }) {
  if (
    typeof addressLocation?.lat !== "number" ||
    typeof addressLocation?.lng !== "number" ||
    !Number.isFinite(addressLocation.lat) ||
    !Number.isFinite(addressLocation.lng) ||
    !sellerId
  ) {
    return 0;
  }

  const seller = await Seller.findById(sellerId).select("location").lean();
  const coords = seller?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  const [lng, lat] = coords;
  const meters = distanceMeters(
    Number(addressLocation.lat),
    Number(addressLocation.lng),
    Number(lat),
    Number(lng),
  );
  return Number((meters / 1000).toFixed(3));
}

function buildFallbackBreakdownFromPricing(pricing = {}) {
  const subtotal = Number(pricing.subtotal || 0);
  const deliveryFee = Number(pricing.deliveryFee || 0);
  const handlingFee = Number(pricing.platformFee || 0);
  const taxTotal = Number(pricing.gst || 0);
  const discountTotal = Number(pricing.discount || 0);
  const grandTotal = Number(pricing.total || 0);

  return {
    productSubtotal: Number.isFinite(subtotal) ? subtotal : 0,
    deliveryFeeCharged: Number.isFinite(deliveryFee) ? deliveryFee : 0,
    handlingFeeCharged: Number.isFinite(handlingFee) ? handlingFee : 0,
    discountTotal: Number.isFinite(discountTotal) ? discountTotal : 0,
    taxTotal: Number.isFinite(taxTotal) ? taxTotal : 0,
    grandTotal: Number.isFinite(grandTotal) ? grandTotal : 0,
    snapshots: {
      deliverySettings: {},
      categoryCommissionSettings: [],
      handlingFeeStrategy: null,
      handlingCategoryUsed: {},
    },
    lineItems: [],
  };
}

/* ===============================
   PLACE ORDER
================================ */
export const placeOrder = async (req, res) => {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return handleResponse(res, 401, "Unauthorized");
    }

    const { address, payment, timeSlot, items, paymentMode: paymentModeRaw } =
      req.body || {};

    const payload = validateWithJoi(createFinanceOrderSchema, {
      items,
      address,
      paymentMode:
        normalizePaymentMode(paymentModeRaw) ||
        normalizePaymentMode(payment?.paymentMode) ||
        inferPaymentMode(payment) ||
        "COD",
      timeSlot: timeSlot || "now",
      tipAmount: Number(req.body?.tipAmount || 0),
      walletAmount: Number(req.body?.walletAmount || 0),
      discountTotal: Number(req.body?.discountTotal || 0),
      couponId: req.body?.couponId || null,
    });

    const idempotencyKey = String(req.headers?.["idempotency-key"] || "").trim() || null;
    const placement = await placeOrderAtomic({
      customerId,
      payload,
      idempotencyKey,
    });

    try {
      await invalidate(buildKey("orders", "customer", `${customerId}:*`));
    } catch (cacheErr) {
      console.warn("[placeOrder] cache invalidation failed:", cacheErr.message);
    }

    return handleResponse(
      res,
      placement.duplicate ? 200 : 201,
      placement.duplicate
        ? "Duplicate request resolved using existing order"
        : "Order placed successfully",
      {
        order: placement.order,
        orders: placement.orders,
        checkoutGroup: placement.checkoutGroup,
        paymentRef:
          (Array.isArray(placement.orders) && placement.orders.length > 1
            ? placement.checkoutGroup?.checkoutGroupId
            : placement.order?.orderId) ||
          placement.checkoutGroup?.checkoutGroupId ||
          null,
      },
    );
  } catch (error) {
    console.error("Place Order Error:", error);
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
/* ===============================
   GET CUSTOMER ORDERS
================================ */
export const getMyOrders = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const cacheKey = buildKey("orders", "customer", `${customerId}:p${page}:l${limit}`);

    const result = await getOrSet(
      cacheKey,
      async () => {
        const [orders, total] = await Promise.all([
          Order.find({ customer: customerId })
            .select(
              "orderId checkoutGroupId customer seller items address payment pricing status workflowStatus workflowVersion returnStatus timeSlot createdAt",
            )
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .populate("items.product", "name mainImage price salePrice")
            .lean(),
          Order.countDocuments({ customer: customerId }),
        ]);

        console.log(`[getMyOrders Debug] Customer ID: ${customerId} | Total Orders: ${total} | Skip: ${skip} | Limit: ${limit}`);

        return {
          items: orders,
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        };
      },
      getTTL("orders"),
    );

    return handleResponse(res, 200, "Orders fetched successfully", result);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER RETURNS (Admin/Seller)
================================ */
export const getSellerReturns = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { status, startDate, endDate } = req.query;

    const query = {};

    if (role !== "admin") {
      query.seller = userId;
    }

    // Only fetch orders that have a return request
    query.returnStatus = { $exists: true, $nin: ["none", null] };

    if (status && status !== "all") {
      query.returnStatus = status;
    }

    if (startDate || endDate) {
      query.returnRequestedAt = {};
      if (startDate) {
        query.returnRequestedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.returnRequestedAt.$lte = end;
      }
    }

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ returnRequestedAt: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customer", "name phone")
        .populate("returnDeliveryBoy", "name phone")
        .populate("items.product", "name mainImage")
        .lean(),
      Order.countDocuments(query),
    ]);

    return handleResponse(res, 200, "Seller returns fetched", {
      items: orders,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/** Populated ref `{ _id, ... }` or raw ObjectId string — safe id string for ACL checks */
function refToIdString(ref) {
  if (ref == null) return "";
  if (typeof ref === "object" && ref._id != null) return String(ref._id);
  return String(ref);
}

/* ===============================
   GET ORDER DETAILS
================================ */
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { role } = req.user;
    const userId = req.user?.id ?? req.user?._id;
    const uid = userId != null ? String(userId).trim() : "";

    const orderKey = orderMatchQueryFlexible(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    let order = await Order.findOne(orderKey)
      .populate("customer", "name email phone")
      .populate("items.product", "name mainImage price salePrice")
      .populate("deliveryBoy", "name phone")
      .populate("returnDeliveryBoy", "name phone")
      .populate("seller", "shopName name address phone location")
      .lean();

    if (!order) {
      if (orderId && orderId.startsWith("CHK-")) {
        const group = await CheckoutGroup.findOne({ checkoutGroupId: orderId }).lean();
        if (group) {
          // Construct virtual summary from snapshots
          const virtualSummary = {
            orderId: group.checkoutGroupId,
            status: group.status?.toLowerCase() || "pending",
            orderStatus: group.status?.toLowerCase() || "pending",
            paymentStatus: group.paymentStatus === "CAPTURED" ? "PAID" : (group.paymentStatus || "CREATED"),
            workflowStatus: group.status || "CREATED",
            pricing: {
              subtotal: group.pricingSummary?.subtotal || 0,
              deliveryFee: group.pricingSummary?.deliveryFee || 0,
              platformFee: group.pricingSummary?.platformFee || 0,
              total: group.pricingSummary?.totalAmount || 0,
            },
            address: group.addressSnapshot || {},
            items: [], // Snapshots can be complex; return empty for now to avoid display errors
            createdAt: group.createdAt,
            isGroupSummary: true,
            isFragmented: true, // Indicates this is a summary of potentially multiple orders
          };
          return handleResponse(res, 200, "Group summary retrieved", virtualSummary);
        }
      }
      return handleResponse(res, 404, "Order not found");
    }

    // BUGFIX: Defensive check for customer reference integrity
    // If customer field is null or undefined, log error and attempt recovery
    if (!order.customer) {
      console.error(`[ORDER_BUG] Order ${orderId} has null/undefined customer field`, {
        orderId: order.orderId,
        _id: order._id,
        workflowStatus: order.workflowStatus,
        timestamp: new Date().toISOString(),
      });

      // Attempt to fetch order without populate to check raw customer field
      const rawOrder = await Order.findOne(orderKey).lean();
      if (rawOrder && rawOrder.customer) {
        // Customer reference exists but failed to populate
        console.error(`[ORDER_BUG] Customer reference exists but failed to populate`, {
          orderId: order.orderId,
          customerRef: rawOrder.customer,
        });
        // Use the raw customer reference for authorization
        order.customer = rawOrder.customer;
      } else {
        // Customer field is truly null/undefined in database
        console.error(`[ORDER_BUG] Customer field is null in database`, {
          orderId: order.orderId,
        });
        return handleResponse(
          res,
          500,
          "Order data integrity error: customer reference is missing",
        );
      }
    }

    if (!order.workflowStatus) {
      order.workflowStatus = resolveWorkflowStatus(order);
    }

    // --- Data Isolation Check ---
    const roleNorm = String(role || "").toLowerCase();
    const sellerIdStr =
      typeof order.seller === "object" && order.seller?._id
        ? order.seller._id.toString()
        : order.seller?.toString();

    // BUGFIX: Normalize customer reference to handle both populated and unpopulated cases
    const customerIdStr = refToIdString(order.customer);

    const isOwnerCustomer =
      (roleNorm === "customer" || roleNorm === "user") &&
      order.customer &&
      customerIdStr === uid;
    const isOwnerSeller = role === "seller" && sellerIdStr === uid;
    const primaryRiderId = refToIdString(order.deliveryBoy);
    const returnRiderId = refToIdString(order.returnDeliveryBoy);
    const isAssignedDeliveryBoy =
      role === "delivery" &&
      (primaryRiderId === uid || returnRiderId === uid);

    // ALLOW view if it is a broadcasted delivery or return that is not yet assigned
    const isBroadcastedOrder =
      role === "delivery" &&
      ((!order.deliveryBoy && order.workflowStatus === WORKFLOW_STATUS.DELIVERY_SEARCH) ||
        (!order.returnDeliveryBoy && ["return_approved", "return_pickup_assigned"].includes(order.returnStatus)));

    const isSubAdmin = role === "sub-admin";
    const isSubAdminWithZone =
      isSubAdmin &&
      order.zoneId &&
      Array.isArray(req.assignedZones) &&
      req.assignedZones.some((id) => String(id) === String(order.zoneId));

    const isAdmin = role === "admin" || isSubAdminWithZone;

    if (
      !isOwnerCustomer &&
      !isOwnerSeller &&
      !isAssignedDeliveryBoy &&
      !isBroadcastedOrder &&
      !isAdmin
    ) {
      // BUGFIX: Improved error message to distinguish authorization failure from missing order
      console.warn(`[ORDER_ACCESS] Authorization denied for order ${orderId}`, {
        orderId: order.orderId,
        requestedBy: uid,
        role: roleNorm,
        customerIdStr,
        hasCustomer: !!order.customer,
      });
      return handleResponse(
        res,
        403,
        "Access denied. You are not authorized to view this order.",
      );
    }
    // -----------------------------

    const workflowStatus = String(order.workflowStatus || "").toUpperCase();
    const legacyStatus = String(order.status || "").toLowerCase();
    const isOutForDelivery =
      workflowStatus === WORKFLOW_STATUS.OUT_FOR_DELIVERY ||
      legacyStatus === "out_for_delivery";
    const isDelivered =
      workflowStatus === WORKFLOW_STATUS.DELIVERED ||
      legacyStatus === "delivered";

    if (isOwnerCustomer && isOutForDelivery && !isDelivered) {
      const otpDoc = await OrderOtp.findOne({
        orderId: order.orderId,
        type: "delivery",
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      })
        .sort({ createdAt: -1 })
        .select("code expiresAt")
        .lean();

      if (otpDoc?.code) {
        order.deliveryOtp = otpDoc.code;
        order.deliveryOtpExpiresAt = otpDoc.expiresAt;
      }
    }

    if (roleNorm === "delivery") {
      order = sanitizeOrderForDeliveryView(order);
    }

    if (isOwnerSeller) {
      order = sanitizeOrderForSellerView(order);
    }

    return handleResponse(res, 200, "Order details fetched", order);
  } catch (error) {
    console.error(`[ORDER_ERROR] Error fetching order details:`, error);
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CANCEL ORDER
================================ */
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const customerId = req.user.id;

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne({ ...orderKey, customer: customerId });

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (order.workflowVersion >= 2) {
      try {
        const updated = await customerCancelV2(
          customerId,
          order.orderId,
          reason,
        );
        return handleResponse(res, 200, "Order cancelled successfully", updated);
      } catch (e) {
        return handleResponse(res, e.statusCode || 500, e.message);
      }
    }

    if (order.status !== "pending") {
      return handleResponse(
        res,
        400,
        "Order cannot be cancelled after confirmation",
      );
    }

    order.status = "cancelled";
    order.orderStatus = "cancelled";
    order.cancelledBy = "customer";
    order.cancelReason = reason || "Cancelled by user";
    await order.save();

    try {
      await invalidate(buildKey("orders", "customer", `${customerId}:*`));
    } catch (cacheErr) {
      console.warn("[cancelOrder] cache invalidation failed:", cacheErr.message);
    }

    if (order.paymentBreakdown?.grandTotal != null) {
      try {
        await reverseOrderFinanceOnCancellation(order._id, {
          actorId: customerId,
          reason: reason || "Cancelled by customer before acceptance",
        });
      } catch (financeError) {
        console.warn("[cancelOrder] finance reversal failed:", financeError.message);
      }
    }

    return handleResponse(res, 200, "Order cancelled successfully", order);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REQUEST RETURN (Customer)
================================ */
export const requestReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user.id;
    const { items, reason, images, reasonDetail, conditionAssurance } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return handleResponse(
        res,
        400,
        "Please select at least one item to return.",
      );
    }
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return handleResponse(res, 400, "Return reason is required.");
    }

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne({ ...orderKey, customer: customerId });

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (order.status !== "delivered") {
      return handleResponse(
        res,
        400,
        "Return can only be requested for delivered orders.",
      );
    }

    if (order.returnStatus && order.returnStatus !== "none") {
      return handleResponse(
        res,
        400,
        "Return request already exists for this order.",
      );
    }

    const now = new Date();
    const { eligibleAt, windowExpiresAt, eligibleDelay, windowMinutes } =
      computeReturnWindowForOrder(order);

    if (now < eligibleAt) {
      return handleResponse(
        res,
        400,
        `Return is available after ${formatDurationMinutes(eligibleDelay)} from delivery. Please try again later.`,
      );
    }

    // Overarching window expiration check removed. We now validate each selected item individually.

    const selectedItems = [];
    for (const entry of items) {
      const { itemIndex, quantity } = entry || {};
      if (
        typeof itemIndex !== "number" ||
        itemIndex < 0 ||
        itemIndex >= order.items.length
      ) {
        return handleResponse(res, 400, "Invalid item selection for return.");
      }
      const original = order.items[itemIndex];
      const qty = Number(quantity) || original.quantity;
      if (qty <= 0 || qty > original.quantity) {
        return handleResponse(
          res,
          400,
          "Invalid quantity for one of the return items.",
        );
      }
      
      if (original.isReturnable === false) {
        return handleResponse(res, 400, `Item ${original.name} is non-returnable.`);
      }

      const itemWindowMinutes = original.returnWindowDays != null ? original.returnWindowDays * 24 * 60 : windowMinutes;
      const itemWindowExpiresAt = new Date(eligibleAt.getTime() + itemWindowMinutes * 60 * 1000);
      if (now > itemWindowExpiresAt) {
        return handleResponse(res, 400, `Return window for ${original.name} has expired.`);
      }

      selectedItems.push({
        product: original.product,
        name: original.name,
        quantity: qty,
        price: original.price,
        variantSlot: original.variantSlot,
        itemIndex,
        status: "requested",
      });
    }

    order.returnStatus = "return_requested";
    order.returnReason = reason.trim();
    order.returnReasonDetail = reasonDetail?.trim() || "";
    order.returnConditionAssurance = Boolean(conditionAssurance);
    order.returnImages = Array.isArray(images) ? images.slice(0, 5) : [];
    order.returnItems = selectedItems;
    order.returnRequestedAt = now;
    order.returnEligibleAt = eligibleAt;
    order.returnWindowExpiresAt = windowExpiresAt;
    order.returnDeadline = windowExpiresAt;

    await order.save();

    const adminIds = await getAdminIds();
    emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_REQUESTED, {
      orderId: order.orderId,
      customerId: order.customer,
      sellerId: order.seller,
      adminIds,
      data: {
        reason: order.returnReason,
        reasonDetail: order.returnReasonDetail,
      },
    });
    emitToSeller(order.seller?.toString(), {
      event: "return:requested",
      payload: {
        orderId: order.orderId,
        returnStatus: order.returnStatus,
        returnReason: order.returnReason,
        returnReasonDetail: order.returnReasonDetail,
        returnRequestedAt: order.returnRequestedAt,
      },
    });

    return handleResponse(
      res,
      200,
      "Return request submitted successfully",
      order,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET RETURN DETAILS (Order-scoped)
================================ */
export const getReturnDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { id: userId, role } = req.user;

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey)
      .populate("customer", "name phone")
      .populate("seller", "shopName name")
      .populate("returnDeliveryBoy", "name phone");

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const isOwnerCustomer =
      (role === "customer" || role === "user") &&
      order.customer?._id?.toString() === userId;
    const isOwnerSeller =
      role === "seller" && order.seller?._id?.toString() === userId;
    const isAssignedReturnDelivery =
      role === "delivery" &&
      order.returnDeliveryBoy?._id?.toString() === userId;
    const isAdmin = role === "admin";

    if (
      !isOwnerCustomer &&
      !isOwnerSeller &&
      !isAssignedReturnDelivery &&
      !isAdmin
    ) {
      return handleResponse(
        res,
        403,
        "Access denied. You are not authorized to view this return.",
      );
    }

    let returnDeliveryCommission = order.returnDeliveryCommission;
    if (
      returnDeliveryCommission === undefined ||
      returnDeliveryCommission === null
    ) {
      try {
        const settings = await Setting.findOne({});
        returnDeliveryCommission = settings?.returnDeliveryCommission ?? 0;
      } catch {
        returnDeliveryCommission = 0;
      }
    }

    // Fetch active OTP if in pickup assigned status
    let activeOtp = null;
    if (order.returnStatus === "return_pickup_assigned") {
      const otpDoc = await OrderOtp.findOne({
        orderId: order.orderId,
        type: "return_pickup",
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });
      activeOtp = otpDoc?.code || null;
    }

    const { eligibleAt, windowExpiresAt } = computeReturnWindowForOrder(order);

    const payload = {
      orderId: order.orderId,
      status: order.status,
      returnStatus: order.returnStatus,
      returnReason: order.returnReason,
      returnReasonDetail: order.returnReasonDetail,
      returnConditionAssurance: order.returnConditionAssurance,
      returnRejectedReason: order.returnRejectedReason,
      returnRequestedAt: order.returnRequestedAt,
      returnDeadline: windowExpiresAt,
      returnEligibleAt: eligibleAt,
      returnWindowExpiresAt: windowExpiresAt,
      returnImages: order.returnImages || [],
      returnItems: order.returnItems || [],
      returnRefundAmount: order.returnRefundAmount,
      returnDeliveryCommission,
      returnDeliveryBoy: order.returnDeliveryBoy || null,
      returnQcStatus: order.returnQcStatus,
      returnQcAt: order.returnQcAt,
      returnQcNote: order.returnQcNote,
      returnPickupOtp: activeOtp,
    };

    return handleResponse(res, 200, "Return details fetched", payload);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE ORDER STATUS (Admin/Seller/Delivery)
================================ */
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, deliveryBoyId, selfDelivery } = req.body;
    const { id: userId, role } = req.user;

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const canonicalOrderId = order.orderId;

    // Normalize aliases from older seller UI labels
    let nextStatus = status ? String(status).toLowerCase().trim() : undefined;
    if (nextStatus === "processing" || nextStatus === "process") {
      nextStatus = "confirmed";
    }

    const currentLegacyStatus = String(order.status || "").toLowerCase();
    const currentWorkflow = String(order.workflowStatus || "").toUpperCase();
    const isFinalized =
      currentLegacyStatus === "cancelled" ||
      currentLegacyStatus === "delivered" ||
      currentWorkflow === WORKFLOW_STATUS.CANCELLED ||
      currentWorkflow === WORKFLOW_STATUS.DELIVERED;

    // Never revive timed-out / cancelled / delivered orders via a late status update.
    if (
      nextStatus &&
      isFinalized &&
      nextStatus !== currentLegacyStatus &&
      !(
        currentLegacyStatus === "cancelled" &&
        nextStatus === "cancelled"
      )
    ) {
      return handleResponse(
        res,
        409,
        currentLegacyStatus === "cancelled" ||
          currentWorkflow === WORKFLOW_STATUS.CANCELLED
          ? "Order was cancelled (timeout or rejection) and cannot be confirmed"
          : "Order is already finalized and cannot be updated",
      );
    }

    // V2 seller accept/reject only while still awaiting seller action.
    // For later transitions (packed / out_for_delivery / etc.) use normal update path.
    if (order.workflowVersion >= 2 && role === "seller" && nextStatus) {
      const awaitingSeller =
        !isFinalized &&
        (order.workflowStatus === WORKFLOW_STATUS.SELLER_PENDING ||
          order.status === "pending");

      if (nextStatus === "confirmed" && awaitingSeller) {
        try {
          const updated = await sellerAcceptAtomic(userId, canonicalOrderId);
          return handleResponse(res, 200, "Order accepted", updated);
        } catch (e) {
          return handleResponse(res, e.statusCode || 500, e.message);
        }
      }
      if (nextStatus === "cancelled" && awaitingSeller) {
        try {
          const updated = await sellerRejectAtomic(userId, canonicalOrderId);
          return handleResponse(res, 200, "Order rejected", updated);
        } catch (e) {
          return handleResponse(res, e.statusCode || 500, e.message);
        }
      }
      // If seller re-selects current confirmed status after accept, treat as success (no-op).
      if (
        nextStatus === "confirmed" &&
        !awaitingSeller &&
        ["confirmed", "packed", "out_for_delivery", "delivered"].includes(
          currentLegacyStatus,
        )
      ) {
        return handleResponse(res, 200, "Order already accepted", order);
      }
    }

    // --- Data Isolation Check ---
    const isOwnerSeller =
      role === "seller" && order.seller?.toString() === userId;
    const isAssignedDeliveryBoy =
      role === "delivery" && order.deliveryBoy?.toString() === userId;
    const isAdmin = role === "admin";

    if (!isOwnerSeller && !isAssignedDeliveryBoy && !isAdmin) {
      return handleResponse(
        res,
        403,
        "Access denied. You are not authorized to update this order.",
      );
    }
    // -----------------------------

    const oldStatus = order.status;
    if (nextStatus) {
      // Shiprocket create runs on seller accept for scheduled orders (see orderWorkflowService).
      // Do not create again on packed — avoids double Shiprocket orders in multi-vendor flow.
      order.status = nextStatus;
      order.orderStatus = nextStatus;
      if (order.workflowVersion >= 2) {
        order.workflowStatus = workflowFromLegacyStatus(nextStatus);
      }
    }
    if (deliveryBoyId && String(order.deliveryBoy || "") !== String(deliveryBoyId)) {
      const effectiveStatus = String(nextStatus || order.status || "").toLowerCase();
      const canAssignAtStatus = ["packed", "out_for_delivery"].includes(effectiveStatus);
      if (!canAssignAtStatus) {
        return handleResponse(
          res,
          400,
          "Delivery partner can only be assigned after the order is packed.",
        );
      }

      if (typeof Delivery.findById === "function") {
        const rider = await Delivery.findById(deliveryBoyId);
        if (rider && !rider.isVerified) {
          return handleResponse(res, 400, "Delivery partner is not approved yet. Cannot assign order.");
        }
        if (rider && !rider.isOnline) {
          return handleResponse(res, 400, "Delivery partner is offline. Cannot assign order.");
        }
      }
      if (typeof Order.countDocuments === "function") {
        const activeOrdersCount = await Order.countDocuments({
          deliveryBoy: deliveryBoyId,
          status: { $nin: ["delivered", "cancelled"] },
        });
        if (activeOrdersCount >= 3) {
          return handleResponse(res, 400, "Delivery partner is at maximum capacity.");
        }
      }
    }

    if (deliveryBoyId) {
      order.deliveryBoy = deliveryBoyId;
      order.deliveryMode = "platform";
      order.selfDeliveryPerson = undefined;
      order.deliverySearchExpiresAt = new Date(Date.now() + 60000);
      order.assignedAt = order.assignedAt || new Date();
      order.deliveryRiderStep = order.deliveryRiderStep || 1;

      if (order.workflowVersion >= 2) {
        // Keep customer/seller-facing status as packed when assigning at pack time.
        // Only map workflow to DELIVERY_ASSIGNED so the rider receives the order.
        const assignableWorkflows = new Set([
          WORKFLOW_STATUS.DELIVERY_SEARCH,
          WORKFLOW_STATUS.SELLER_ACCEPTED,
          WORKFLOW_STATUS.PICKUP_READY,
          WORKFLOW_STATUS.DELIVERY_ASSIGNED,
        ]);
        if (assignableWorkflows.has(order.workflowStatus) || nextStatus === "packed") {
          order.workflowStatus = WORKFLOW_STATUS.DELIVERY_ASSIGNED;
          if (nextStatus === "packed" || order.status === "packed") {
            order.status = "packed";
            order.orderStatus = "packed";
          }
        }
      }

      if (Array.isArray(order.skippedBy)) {
        order.skippedBy = order.skippedBy.filter(
          (id) => id.toString() !== deliveryBoyId.toString()
        );
      }

      await order.save();

      try {
        await retractDeliveryBroadcastForOrder(canonicalOrderId, deliveryBoyId);
      } catch (retractErr) {
        console.warn("[updateOrderStatus] retract broadcast failed:", retractErr.message);
      }

      try {
        const orderRich = await Order.findById(order._id)
          .populate("seller", "shopName address name location serviceRadius")
          .lean();
        const seller = orderRich?.seller || {};
        const pickup = seller.shopName || "Seller";
        const drop = orderRich?.address?.address || "Customer address";
        const assignPreview = {
          pickup,
          drop,
          total: orderRich?.pricing?.total ?? 0,
          earnings: Number(orderRich?.paymentBreakdown?.riderPayoutTotal) || 0,
        };
        const assignExpiresAt =
          orderRich?.deliverySearchExpiresAt || new Date(Date.now() + 60000);

        emitNotificationEvent(NOTIFICATION_EVENTS.DELIVERY_ASSIGNED, {
          orderId: canonicalOrderId,
          deliveryId: deliveryBoyId,
          data: {
            preview: assignPreview,
            deliverySearchExpiresAt: assignExpiresAt,
            eventType: NOTIFICATION_EVENTS.DELIVERY_ASSIGNED,
          },
        });

        emitToDelivery(deliveryBoyId, {
          event: "order:assigned",
          payload: {
            orderId: canonicalOrderId,
            workflowStatus: orderRich?.workflowStatus || orderRich?.status,
            preview: assignPreview,
            deliverySearchExpiresAt: assignExpiresAt,
            status: order.status,
            message: `You have been assigned order #${canonicalOrderId}.`,
          },
        });
      } catch (socketErr) {
        console.warn("[updateOrderStatus] socket emit failed:", socketErr.message);
      }
    }

    if (selfDelivery && typeof selfDelivery === "object") {
      const effectiveStatus = String(nextStatus || order.status || "").toLowerCase();
      const canSetAtStatus = ["packed", "out_for_delivery"].includes(effectiveStatus);
      if (!canSetAtStatus) {
        return handleResponse(
          res,
          400,
          "Own delivery person can only be set after the order is packed.",
        );
      }

      if (order.deliveryBoy) {
        const previousDeliveryBoyId = order.deliveryBoy;
        order.deliveryBoy = undefined;
        order.deliveryPartner = undefined;
        try {
          await retractDeliveryBroadcastForOrder(canonicalOrderId, previousDeliveryBoyId);
        } catch (retractErr) {
          console.warn("[updateOrderStatus] retract broadcast failed:", retractErr.message);
        }
      }

      order.deliveryMode = "self";
      order.selfDeliveryPerson = {
        name: selfDelivery.name ? String(selfDelivery.name).trim() : "",
        phone: selfDelivery.phone ? String(selfDelivery.phone).trim() : "",
      };
      order.selfDeliveryMarkedAt = new Date();

      await order.save();
    }

    // Legacy orders: keep rider UI step in sync with status (delivery app refresh-safe)
    if (
      isAssignedDeliveryBoy &&
      role === "delivery" &&
      order.workflowVersion < 2 &&
      nextStatus
    ) {
      if (nextStatus === "packed") order.deliveryRiderStep = 2;
      else if (nextStatus === "out_for_delivery") order.deliveryRiderStep = 3;
    }

    // Handle Cancellation (Stock Reversal & Transaction Update)
    if (nextStatus === "cancelled" && oldStatus !== "cancelled") {
      if (order.deliveryType === "scheduled" && order.shipmentDetails?.shiprocketOrderId) {
        try {
          await cancelShiprocketShipmentForOrder(order._id);
        } catch (cancelErr) {
          console.warn("[SHIPROCKET_CANCEL_ERROR] Failed to cancel shipment:", cancelErr.message);
        }
      }
      // 1. Reverse Stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
        });

        await StockHistory.create({
          product: item.product,
          seller: order.seller,
          type: "Correction",
          quantity: item.quantity,
          note: `Order #${canonicalOrderId} Cancelled`,
          order: order._id,
        });
      }

      // 2. Update Transaction
      await Transaction.findOneAndUpdate(
        { reference: canonicalOrderId },
        { status: "Failed" },
      );

      emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
        orderId: canonicalOrderId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
      });

      try {
        await retractDeliveryBroadcastForOrder(canonicalOrderId);
      } catch (retractErr) {
        console.warn("[updateOrderStatus] retract broadcast failed:", retractErr.message);
      }
    }

    // Handle Confirmation/Delivery (Settle Transaction for Demo)
    if (nextStatus === "delivered" && oldStatus !== "delivered") {
      order.deliveredAt = new Date();

      // Important: persist deliveryBoy/status first so settlement can correctly:
      // - queue rider payout
      // - mark COD cash collected (system float)
      await order.save();
      if (order.deliveryMode === "self") {
        await markSelfDeliveryCodCashWithSeller(order._id);
      }
      await applyDeliveredSettlement(order, canonicalOrderId);

      emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_DELIVERED, {
        orderId: canonicalOrderId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
        deliveryId: order.deliveryBoy,
      });

      const refreshed = await Order.findById(order._id);
      emitOrderStatusUpdate(
        canonicalOrderId,
        {
          status: refreshed?.status || order.status,
          workflowStatus: refreshed?.workflowStatus || order.workflowStatus,
        },
        order.customer,
        order.seller,
        order._id,
      );
      return handleResponse(res, 200, "Order status updated", refreshed || order);
    }

    await order.save();

    try {
      await invalidate(buildKey("orders", "customer", `${order.customer.toString()}:*`));
    } catch (cacheErr) {
      console.warn("[updateOrderStatus] cache invalidation failed:", cacheErr.message);
    }

    if (nextStatus === "confirmed" && role === "seller") {
      // This order is now 'Automatic' for delivery partners
      emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CONFIRMED, {
        orderId: canonicalOrderId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
      });
    }

    if (nextStatus === "packed") {
      emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_PACKED, {
        orderId: canonicalOrderId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
        deliveryId: order.deliveryBoy,
      });
      if (order.deliveryBoy) {
        emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_READY, {
          orderId: canonicalOrderId,
          deliveryId: order.deliveryBoy,
          sellerId: order.seller,
        });
      }
    }

    if (nextStatus === "out_for_delivery") {
      emitNotificationEvent(NOTIFICATION_EVENTS.OUT_FOR_DELIVERY, {
        orderId: canonicalOrderId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
        deliveryId: order.deliveryBoy,
      });
    }

    if (nextStatus || deliveryBoyId) {
      emitOrderStatusUpdate(
        canonicalOrderId,
        {
          status: order.status,
          workflowStatus: order.workflowStatus,
          deliveryBoyId: order.deliveryBoy || null,
        },
        order.customer,
        order.seller,
        order._id,
      );
    }

    return handleResponse(res, 200, "Order status updated", order);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   AVAILABLE RIDERS (Seller/Admin) — platform pool near a seller, by availability/GPS
================================ */
export const getAvailableRiders = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const sellerId = role === "seller" ? userId : req.query.sellerId;

    if (!sellerId) {
      return handleResponse(res, 400, "sellerId is required");
    }

    const ids = await getDeliveryPartnerIdsWithinSellerRadius(sellerId);
    const riders = await Delivery.find({
      _id: { $in: ids },
      isVerified: true,
      isOnline: true,
    })
      .select("name phone vehicleType vehicleNumber currentArea profileImage")
      .lean();

    return handleResponse(res, 200, "Available riders fetched successfully", riders);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   APPROVE RETURN (Seller/Admin)
================================ */
export const approveReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { id: userId, role } = req.user;

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const isOwnerSeller =
      role === "seller" && order.seller?.toString() === userId;

    if (!isOwnerSeller) {
      return handleResponse(
        res,
        403,
        "Only the seller can approve return requests.",
      );
    }

    if (order.returnStatus !== "return_requested") {
      return handleResponse(
        res,
        400,
        "Only pending return requests can be approved.",
      );
    }

    if (!Array.isArray(order.returnItems) || order.returnItems.length === 0) {
      return handleResponse(res, 400, "No return items found for this order.");
    }

    const refundAmount = order.returnItems.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0,
    );

    const settings = await Setting.findOne({});
    const returnCommission = settings?.returnDeliveryCommission ?? 0;

    order.returnItems = order.returnItems.map((item) => ({
      ...(item.toObject?.() ?? item),
      status: "approved",
    }));
    order.returnRefundAmount = refundAmount;
    order.returnDeliveryCommission = returnCommission;

    // Approved — seller assigns a rider manually (same as forward orders)
    order.returnStatus = "return_approved";
    order.returnDeliveryBoy = null;
    order.skippedBy = [];

    await order.save();

    emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_APPROVED, {
      orderId: order.orderId,
      customerId: order.customer,
      userId: order.customer,
      sellerId: order.seller,
      data: {
        refundAmount,
      },
    });

    return handleResponse(res, 200, "Return request approved", order);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REJECT RETURN (Seller/Admin)
================================ */
export const rejectReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { id: userId, role } = req.user;
    const { reason } = req.body || {};

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return handleResponse(res, 400, "Rejection reason is required.");
    }

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const isOwnerSeller =
      role === "seller" && order.seller?.toString() === userId;

    if (!isOwnerSeller) {
      return handleResponse(
        res,
        403,
        "Only the seller can reject return requests.",
      );
    }

    if (order.returnStatus !== "return_requested") {
      return handleResponse(
        res,
        400,
        "Only pending return requests can be rejected.",
      );
    }

    order.returnStatus = "return_rejected";
    order.returnRejectedReason = reason.trim();

    await order.save();

    emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_REJECTED, {
      orderId: order.orderId,
      customerId: order.customer,
      userId: order.customer,
      sellerId: order.seller,
      data: {
        reason: order.returnRejectedReason,
      },
    });

    return handleResponse(res, 200, "Return request rejected", order);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   QC CHECK (Admin)
================================ */
export const updateReturnQcStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { qcStatus, note } = req.body || {};
    const { id: userId, role } = req.user;

    if (role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    if (!["qc_passed", "qc_failed"].includes(qcStatus)) {
      return handleResponse(res, 400, "Invalid qcStatus value.");
    }

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (order.returnStatus === "qc_passed" || order.returnStatus === "refund_completed") {
      return handleResponse(res, 200, "Return QC already processed and refund completed.", order);
    }

    if (order.returnStatus !== "returned") {
      return handleResponse(
        res,
        400,
        "QC can only be completed after the item is returned.",
      );
    }

    if (qcStatus === "qc_passed") {
      if (!Array.isArray(order.returnImages) || order.returnImages.length === 0) {
        return handleResponse(
          res,
          400,
          "Customer return photos are required before approving QC.",
        );
      }
      if (!Array.isArray(order.returnPickupImages) || order.returnPickupImages.length === 0) {
        return handleResponse(
          res,
          400,
          "Rider pickup photos are required before approving QC.",
        );
      }
    }

    order.returnStatus = qcStatus;
    order.returnQcStatus = qcStatus === "qc_passed" ? "passed" : "failed";
    order.returnQcAt = new Date();
    order.returnQcBy = userId;
    order.returnQcNote = note ? String(note).trim().slice(0, 500) : undefined;

    await order.save();

    if (qcStatus === "qc_passed") {
      const updated = await completeReturnAndRefund(order);
      return handleResponse(res, 200, "QC passed and refund processed", updated);
    }

    // QC failed: allow seller payout release if on hold
    // Fraud guard — prevent double release
    if (order.sellerPayoutReleasedAt) {
      return handleResponse(res, 409, "Seller payout already released for this order.");
    }
    const autoRelease =
      String(process.env.AUTO_RELEASE_SELLER_PAYOUT || "true").toLowerCase() === "true";
    if (autoRelease) {
      const payout = await Payout.findOne({
        payoutType: "SELLER",
        relatedOrderIds: order._id,
        status: { $in: ["PENDING", "PROCESSING"] },
      }).select("_id").lean();
      if (payout?._id) {
        try {
          await processPayout(payout._id);
        } catch (error) {
          console.warn("[ReturnQC] Auto-release payout failed:", error.message);
        }
      }
    } else {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            "settlementStatus.sellerPayout": "PENDING",
            "financeFlags.sellerPayoutHeld": false,
          },
        },
      );
    }

    return handleResponse(res, 200, "QC failed recorded", order);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ASSIGN RETURN DELIVERY (Seller/Admin)
================================ */
export const assignReturnDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { id: userId, role } = req.user;
    const { deliveryBoyId } = req.body || {};

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const isOwnerSeller = role === "seller" && order.seller?.toString() === userId;

    if (!isOwnerSeller) {
      return handleResponse(
        res,
        403,
        "Only the seller can assign a delivery partner for return pickup.",
      );
    }

    if (order.returnStatus !== "return_requested" && order.returnStatus !== "return_approved") {
      return handleResponse(
        res,
        400,
        "Return pickup can only be assigned for pending or approved returns.",
      );
    }

    const riderId =
      typeof deliveryBoyId === "string" && deliveryBoyId.trim().length > 0
        ? deliveryBoyId.trim()
        : null;

    if (role === "seller" && !riderId) {
      return handleResponse(
        res,
        400,
        "Please select a delivery partner to assign return pickup.",
      );
    }

    // If Admin/Seller manually specified a rider
    if (riderId) {
      const partner = await Delivery.findById(riderId);
      if (!partner) {
        return handleResponse(res, 404, "Delivery partner not found.");
      }
      order.returnDeliveryBoy = riderId;
    } else {
      // If undefined/empty object, we want nearby riders to pick it up via broadcast (available orders pool)
      // `orderQueryService` will serve orders where `returnStatus="return_pickup_assigned"` and `returnDeliveryBoy=null`
      order.returnDeliveryBoy = null;
    }

    order.returnStatus = "return_pickup_assigned";

    await order.save();
    if (riderId) {
      emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_PICKUP_ASSIGNED, {
        orderId: order.orderId,
        deliveryId: riderId,
        sellerId: order.seller,
        customerId: order.customer,
      });
      emitToDelivery(riderId, {
        event: "delivery:broadcast",
        payload: {
          orderId: order.orderId,
          type: "RETURN_PICKUP",
          preview: {
            pickup: "Customer Address",
            drop: "Seller Store",
            total: order.pricing?.total || 0,
          },
          deliverySearchExpiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
          at: new Date().toISOString(),
        },
      });
    } else {
      // Trigger broadcast for nearby riders
      const payload = {
        orderId: order.orderId,
        type: "RETURN_PICKUP",
        isReturnPickup: true,
        items: (order.items || []).map(item => ({
          name: item.name,
          quantity: item.quantity,
          image: item.image || item.thumbnail
        })),
        preview: {
          pickup: order.address?.completeAddress || "Customer Address",
          drop: order.sellerBranchArea || "Seller Store",
          total: order.pricing?.total || 0,
          earnings: order.returnDeliveryCommission || 0,
        },
        deliverySearchExpiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
      };

      // Trigger broadcast for nearby riders (Riders near Customer for returns)
      const customerLocation = order.address?.location;
      emitReturnBroadcastForCustomer(customerLocation, payload);

      emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_PICKUP_ASSIGNED, {
        orderId: order.orderId,
        sellerId: order.seller,
        customerId: order.customer,
      });
    }

    return handleResponse(
      res,
      200,
      "Return pickup assigned successfully",
      order,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ACCEPT RETURN PICKUP (Delivery)
================================ */
export const acceptReturnPickup = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { id: userId, role } = req.user;

    if (role !== "delivery" && role !== "admin") {
      return handleResponse(res, 403, "Access denied.");
    }

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    const order = await Order.findOne(orderKey);

    if (!order) return handleResponse(res, 404, "Order not found");

    if (order.returnDeliveryBoy && order.returnDeliveryBoy.toString() !== userId) {
      return handleResponse(
        res,
        403,
        "This return pickup is already assigned to another rider.",
      );
    }

    if (!order.returnDeliveryBoy) {
      order.returnDeliveryBoy = userId;
      order.returnStatus = "return_pickup_assigned";
      await order.save();

      // Retract broadcast so other riders stop seeing this task
      try {
        await retractDeliveryBroadcastForOrder(order.orderId, userId);
      } catch (e) {
        console.warn("[acceptReturnPickup] retract broadcast failed:", e.message);
      }

      // Notify customer their return pickup is assigned
      emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_PICKUP_ASSIGNED, {
        orderId: order.orderId,
        customerId: order.customer,
        userId: order.customer,
        deliveryId: userId,
        data: { message: "A delivery partner has accepted your return pickup!" },
      });
    }

    return handleResponse(res, 200, "Return pickup accepted", order);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REJECT RETURN PICKUP (Delivery)
================================ */
export const rejectReturnPickup = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { id: userId, role } = req.user;

    if (role !== "delivery" && role !== "admin") {
      return handleResponse(res, 403, "Access denied.");
    }

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    const order = await Order.findOne(orderKey);

    if (!order) return handleResponse(res, 404, "Order not found");

    if (order.returnDeliveryBoy?.toString() !== userId) {
      // If it's a broadcast order, add to skippedBy
      if (!order.returnDeliveryBoy) {
        if (!order.skippedBy.includes(userId)) {
          order.skippedBy.push(userId);
          await order.save();
        }
        return handleResponse(res, 200, "Return pickup skipped");
      }
      return handleResponse(
        res,
        403,
        "You are not assigned to this return pickup.",
      );
    }

    if (order.returnStatus !== "return_pickup_assigned") {
      return handleResponse(res, 400, "Cannot reject in current status.");
    }

    order.returnDeliveryBoy = null;
    if (!order.skippedBy.includes(userId)) {
      order.skippedBy.push(userId);
    }
    order.returnStatus = "return_approved";
    await order.save();

    // Notify seller
    emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_REJECTED, {
      orderId: order.orderId,
      sellerId: order.seller,
      customerId: order.customer,
      data: { reason: "Delivery partner rejected the pickup request." },
    });

    return handleResponse(res, 200, "Pickup rejected successfully.");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const completeReturnAndRefund = async (order) => {
  if (!order) return null;
  if (order.returnStatus === "refund_completed") {
    return order;
  }
  if (order.returnStatus !== "qc_passed") {
    return order;
  }

  const refundAmount =
    order.returnRefundAmount ||
    (Array.isArray(order.returnItems)
      ? order.returnItems.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
        0,
      )
      : 0);

  const commission = order.returnDeliveryCommission || 0;
  const walletRefundTotal = refundAmount;

  // 1. Credit customer wallet (full refund, even for COD)
  if (order.customer && walletRefundTotal > 0) {
    const customer = await User.findById(order.customer);
    if (customer) {
      customer.walletBalance = (customer.walletBalance || 0) + Number(walletRefundTotal.toFixed(2));
      await customer.save();

      await Transaction.create({
        user: customer._id,
        userModel: "User",
        order: order._id,
        type: "Refund",
        amount: Number(walletRefundTotal.toFixed(2)),
        status: "Settled",
        reference: `REF-WALLET-${order.orderId}`,
        meta: { orderId: order._id, type: "return_wallet" }
      });

      emitNotificationEvent(NOTIFICATION_EVENTS.WALLET_UPDATED, {
        customerId: customer._id,
        userId: customer._id,
        orderObjectId: order._id,
        data: {
          amount: walletRefundTotal,
          direction: "credited",
          reason: `Return refund for order #${order.orderId}`,
          balance: customer.walletBalance,
          dedupeKey: `wallet:${order.orderId}:return_refund`,
        },
      });
    }
  }

  // 2. Seller adjustment (cancel payout if on hold, else debit available balance)
  if (order.seller && (refundAmount > 0 || commission > 0)) {
    const isHeld =
      order.settlementStatus?.sellerPayout === "HOLD" ||
      order.financeFlags?.sellerPayoutHeld;

    if (isHeld) {
      try {
        const { cancelPendingPayoutForOrder } = await import("../services/finance/payoutService.js");
        const cancelled = await cancelPendingPayoutForOrder(order._id, "SELLER", {
          remarks: `Payout cancelled due to return QC passed.`,
        });

        if (cancelled) {
          // If payout was cancelled, we don't need to debit the seller's available balance
          // because they never received the money in the first place.
          await Order.findByIdAndUpdate(order._id, {
            "settlementStatus.sellerPayout": "CANCELLED",
            "financeFlags.sellerPayoutHeld": false,
          });
        }
      } catch (error) {
        console.error(`[ReturnFinance] Payout cancellation failed for seller ${order.seller}`, error.message);
      }
    } else {
      // If payment was already released (Available balance), we must debit to recover funds.
      const adjustment = Math.max(0, refundAmount + commission);
      try {
        const { debitWallet } = await import("../services/finance/walletService.js");
        await debitWallet({
          ownerType: "SELLER",
          ownerId: order.seller,
          amount: adjustment,
          bucket: "available",
        });
      } catch (error) {
        console.warn(`[ReturnFinance] Wallet debit failed for seller ${order.seller}.`, error.message);
      }
    }

    const adjustment = Math.max(0, refundAmount + commission);
    await Transaction.create({
      user: order.seller,
      userModel: "Seller",
      order: order._id,
      type: "Refund",
      amount: -adjustment,
      status: "Settled",
      reference: `REF-SELL-${order.orderId}`,
    });
  }

  // 3. Delivery partner earning for return pickup
  // Guard: commission is already credited at pickupOTP time (verifyReturnPickupOtp)
  // Only credit here if it wasn't already paid to prevent double payment
  const commissionAlreadyPaid = order.financeFlags?.returnPickupCommissionPaid;
  if (order.returnDeliveryBoy && commission > 0 && !commissionAlreadyPaid) {
    try {
      await walletService.creditWallet({
        ownerType: "DELIVERY_PARTNER",
        ownerId: order.returnDeliveryBoy,
        amount: commission,
        bucket: "available"
      });
    } catch (error) {
      console.error(`[ReturnFinance] Failed to credit delivery boy ${order.returnDeliveryBoy}`, error.message);
    }

    await Transaction.create({
      user: order.returnDeliveryBoy,
      userModel: "Delivery",
      order: order._id,
      type: "Delivery Earning",
      amount: commission,
      status: "Settled",
      reference: `RET-DEL-${order.orderId}`,
    });
  }

  order.returnStatus = "refund_completed";
  if (order.payment) {
    order.payment.status = "refunded";
  }

  await order.save();
  emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_QC_PASSED, {
    orderId: order.orderId,
    customerId: order.customer,
    userId: order.customer,
    sellerId: order.seller,
    data: { refundAmount },
  });
  emitNotificationEvent(NOTIFICATION_EVENTS.REFUND_COMPLETED, {
    orderId: order.orderId,
    customerId: order.customer,
    userId: order.customer,
    sellerId: order.seller,
    deliveryId: order.returnDeliveryBoy,
    data: {
      refundAmount,
      returnDeliveryCommission: commission,
      isCOD: order.paymentMode === "COD"
    },
  });
  return order;
};

/* ===============================
   UPDATE RETURN STATUS (Delivery/Admin)
================================ */
export const updateReturnStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { returnStatus } = req.body || {};
    const { id: userId, role } = req.user;

    if (!returnStatus) {
      return handleResponse(res, 400, "returnStatus is required.");
    }

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const isAssignedReturnDelivery =
      role === "delivery" && order.returnDeliveryBoy?.toString() === userId;
    const isAdmin = role === "admin";

    if (!isAssignedReturnDelivery && !isAdmin) {
      return handleResponse(
        res,
        403,
        "Access denied. You are not authorized to update this return.",
      );
    }

    const oldStatus = order.returnStatus;
    const allowedStatuses = [
      "return_pickup_assigned",
      "return_in_transit",
      "returned",
    ];

    if (!allowedStatuses.includes(returnStatus)) {
      return handleResponse(res, 400, "Invalid returnStatus value.");
    }

    // Only allow forward transitions
    const orderOf = (s) =>
      s === "return_pickup_assigned"
        ? 1
        : s === "return_in_transit"
          ? 2
          : s === "returned"
            ? 3
            : 0;

    if (orderOf(returnStatus) < orderOf(oldStatus)) {
      return handleResponse(res, 400, "Return status cannot move backwards.");
    }

    const now = new Date();

    if (returnStatus === "return_in_transit") {
      order.returnStatus = "return_in_transit";
      if (!order.returnPickedAt) {
        order.returnPickedAt = now;
      }
      await order.save();
      return handleResponse(res, 200, "Return status updated", order);
    }

    if (returnStatus === "returned") {
      order.returnStatus = "returned";
      if (!order.returnDeliveredBackAt) {
        order.returnDeliveredBackAt = now;
      }
      await order.save();
      return handleResponse(res, 200, "Return received", order);
    }

    order.returnStatus = returnStatus;
    await order.save();

    return handleResponse(res, 200, "Return status updated", order);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER ORDERS
================================ */
export const getSellerOrders = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { startDate, endDate, status: statusParam } = req.query;
    const assignedZones = req.assignedZones || [];

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const { orders, total, summary } = await fetchSellerOrdersPage({
      role,
      userId,
      statusParam,
      startDate,
      endDate,
      skip,
      limit,
      assignedZones,
    });


    return handleResponse(
      res,
      200,
      role === "admin" ? "All orders fetched" : "Seller orders fetched",
      {
        items: orders,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        summary,
      },
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET AVAILABLE ORDERS (Delivery Boy)
================================ */
export const getAvailableOrders = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== "delivery" && role !== "admin") {
      return handleResponse(
        res,
        403,
        "Access denied. Only delivery partners can view available orders.",
      );
    }

    const { requiresLocation, orders } = await fetchAvailableOrdersForDelivery({
      userId,
      requestedLimit: req.query.limit,
      type: req.query.type || "delivery",
    });

    if (requiresLocation) {
      return handleResponse(
        res,
        200,
        "Update your location to see nearby orders",
        [],
      );
    }

    return handleResponse(
      res,
      200,
      orders.length > 0 ? "Available orders fetched" : "No orders found",
      sanitizeOrdersForDeliveryView(orders),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ACCEPT ORDER (Delivery Boy)
================================ */
export const acceptOrder = async (req, res) => {
  try {
    const orderId = decodeURIComponent(String(req.params.orderId || "")).trim();
    const userId = req.user?.id ?? req.user?._id;
    const { role } = req.user;

    if (!userId) {
      return handleResponse(res, 401, "Invalid or incomplete token");
    }

    if (role !== "delivery" && role !== "admin") {
      return handleResponse(res, 403, "Access denied.");
    }

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (order.workflowVersion >= 2) {
      try {
        const idem = req.headers["idempotency-key"];
        const { order: updated, duplicate } = await deliveryAcceptAtomic(
          userId,
          order.orderId,
          idem,
        );
        return handleResponse(
          res,
          200,
          duplicate ? "Already accepted" : "Order accepted successfully",
          updated,
        );
      } catch (e) {
        return handleResponse(res, e.statusCode || 500, e.message);
      }
    }

    if (!order.deliveryBoy || order.deliveryBoy.toString() !== userId.toString()) {
      return handleResponse(
        res,
        400,
        "This order is not assigned to you. Wait for seller assignment.",
      );
    }

    if (order.status === "pending") {
      order.status = "confirmed";
    }

    await order.save();
    emitNotificationEvent(NOTIFICATION_EVENTS.DELIVERY_ASSIGNED, {
      orderId: order.orderId,
      deliveryId: userId,
      customerId: order.customer,
      sellerId: order.seller,
    });

    return handleResponse(res, 200, "Order accepted successfully", order);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   SKIP ORDER (Delivery Boy)
================================ */
export const skipOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { id: userId, role } = req.user;

    if (role !== "delivery" && role !== "admin") {
      return handleResponse(res, 403, "Access denied.");
    }

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    // Add user to skippedBy array if not already there
    if (order.workflowVersion >= 2) {
      if (order.workflowStatus !== WORKFLOW_STATUS.DELIVERY_SEARCH) {
        return handleResponse(
          res,
          400,
          "Order cannot be skipped in current state",
        );
      }
    }

    if (!order.skippedBy.includes(userId)) {
      order.skippedBy.push(userId);
      await order.save();
    }

    return handleResponse(res, 200, "Order skipped successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPLOAD RETURN PICKUP PROOF (Delivery)
================================ */
export const uploadReturnPickupProof = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { id: userId, role } = req.user;
    const { images, condition, conditionNote } = req.body || {};

    if (role !== "delivery" && role !== "admin") {
      return handleResponse(res, 403, "Access denied.");
    }

    const orderKey = orderMatchQueryFromRouteParam(orderId);
    if (!orderKey) return handleResponse(res, 404, "Order not found");

    const order = await Order.findOne(orderKey);
    if (!order) return handleResponse(res, 404, "Order not found");

    if (role === "delivery" && order.returnDeliveryBoy?.toString() !== userId) {
      return handleResponse(res, 403, "Not assigned to this return pickup.");
    }

    if (order.returnStatus !== "return_pickup_assigned") {
      return handleResponse(
        res,
        400,
        "Proof can only be uploaded when status is return_pickup_assigned.",
      );
    }

    if (!Array.isArray(images) || images.length === 0) {
      return handleResponse(res, 400, "At least one image URL is required.");
    }

    const validConditions = ["good", "damaged", "suspicious"];
    if (condition && !validConditions.includes(condition)) {
      return handleResponse(res, 400, "Condition must be: good, damaged, or suspicious.");
    }

    order.returnPickupImages = images.slice(0, 10);
    if (condition) order.returnPickupCondition = condition;
    if (conditionNote) order.returnPickupConditionNote = String(conditionNote).trim().slice(0, 500);
    await order.save();

    return handleResponse(res, 200, "Pickup proof uploaded", {
      returnPickupImages: order.returnPickupImages,
      returnPickupCondition: order.returnPickupCondition,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
