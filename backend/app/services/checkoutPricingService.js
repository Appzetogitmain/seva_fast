import Category from "../models/category.js";
import { HANDLING_FEE_STRATEGY } from "../constants/finance.js";
import {
  calculateHandlingFee,
  generateOrderPaymentBreakdown,
  hydrateOrderItems,
  recalculateLogisticsEarnings,
} from "./finance/pricingService.js";
import { getOrCreateFinanceSettings } from "./finance/financeSettingsService.js";
import { resolveSellerDeliveryDecision } from "./deliveryDecisionService.js";

export function groupHydratedItemsBySeller(hydratedItems = []) {
  const grouped = new Map();
  for (const item of hydratedItems) {
    const sellerId = String(item?.sellerId || "");
    if (!sellerId) {
      const err = new Error("Unable to resolve seller for one or more checkout items");
      err.statusCode = 400;
      throw err;
    }
    if (!grouped.has(sellerId)) {
      grouped.set(sellerId, []);
    }
    grouped.get(sellerId).push(item);
  }
  return grouped;
}

/**
 * Resolves the delivery method (local vs. Shiprocket), distance and ETA for
 * one seller's items automatically — sellers/products no longer choose this
 * directly. See deliveryDecisionService.js for the full decision logic.
 */
async function resolveDeliveryDecisionForSeller({ sellerId, address, sellerItems, session = null }) {
  try {
    return await resolveSellerDeliveryDecision({
      sellerId,
      customerLocation: address?.location,
      address,
      items: sellerItems,
      session,
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 400;
    throw err;
  }
}

function sumField(rows, field) {
  return Number(
    rows.reduce((sum, row) => sum + Number(row?.[field] || 0), 0).toFixed(2),
  );
}

function round2(value) {
  return Number((Number(value || 0)).toFixed(2));
}

export async function assertMinimumOrderValue(productSubtotal) {
  const settings = await getOrCreateFinanceSettings();
  const minimumOrderValue = round2(settings.minimumOrderValue || 0);
  if (minimumOrderValue <= 0) return;

  const subtotal = round2(productSubtotal);
  if (subtotal < minimumOrderValue) {
    const shortfall = round2(minimumOrderValue - subtotal);
    const err = new Error(
      `Minimum order value is ₹${minimumOrderValue}. Add items worth ₹${shortfall} more to checkout.`,
    );
    err.statusCode = 400;
    err.code = "MINIMUM_ORDER_VALUE";
    err.minimumOrderValue = minimumOrderValue;
    err.currentSubtotal = subtotal;
    throw err;
  }
}

function buildAggregateBreakdown(sellerBreakdowns = []) {
  const aggregate = {
    currency: sellerBreakdowns[0]?.currency || "INR",
    productSubtotal: sumField(sellerBreakdowns, "productSubtotal"),
    deliveryFeeCharged: sumField(sellerBreakdowns, "deliveryFeeCharged"),
    deliveryFeeBase: sumField(sellerBreakdowns, "deliveryFeeBase"),
    handlingFeeCharged: sumField(sellerBreakdowns, "handlingFeeCharged"),
    tipTotal: sumField(sellerBreakdowns, "tipTotal"),
    discountTotal: sumField(sellerBreakdowns, "discountTotal"),
    membershipDiscountAmount: sumField(sellerBreakdowns, "membershipDiscountAmount"),
    firstOrderDiscountAmount: sumField(sellerBreakdowns, "firstOrderDiscountAmount"),
    taxTotal: sumField(sellerBreakdowns, "taxTotal"),
    grandTotal: sumField(sellerBreakdowns, "grandTotal"),
    sellerPayoutTotal: sumField(sellerBreakdowns, "sellerPayoutTotal"),
    adminProductCommissionTotal: sumField(sellerBreakdowns, "adminProductCommissionTotal"),
    riderPayoutBase: sumField(sellerBreakdowns, "riderPayoutBase"),
    riderPayoutDistance: sumField(sellerBreakdowns, "riderPayoutDistance"),
    riderPayoutBonus: sumField(sellerBreakdowns, "riderPayoutBonus"),
    riderTipAmount: sumField(sellerBreakdowns, "riderTipAmount"),
    riderPayoutTotal: sumField(sellerBreakdowns, "riderPayoutTotal"),
    platformLogisticsMargin: sumField(sellerBreakdowns, "platformLogisticsMargin"),
    platformTotalEarning: sumField(sellerBreakdowns, "platformTotalEarning"),
    codCollectedAmount: sumField(sellerBreakdowns, "codCollectedAmount"),
    codRemittedAmount: sumField(sellerBreakdowns, "codRemittedAmount"),
    codPendingAmount: sumField(sellerBreakdowns, "codPendingAmount"),
    estimatedCashback: sumField(sellerBreakdowns, "estimatedCashback"),
    distanceKmActual: sumField(sellerBreakdowns, "distanceKmActual"),
    distanceKmRounded: sumField(sellerBreakdowns, "distanceKmRounded"),
    snapshots: {
      perSeller: sellerBreakdowns.map((row, index) => ({
        index,
        sellerId: row.sellerId,
        snapshots: row.snapshots || {},
      })),
    },
    lineItems: sellerBreakdowns.flatMap((row) =>
      (Array.isArray(row.lineItems) ? row.lineItems : []).map((lineItem) => ({
        ...lineItem,
        sellerId: row.sellerId,
      })),
    ),
  };
  return aggregate;
}

function allocateCheckoutTipToSellerBreakdowns(
  sellerBreakdownEntries = [],
  totalTipAmount = 0,
) {
  const normalizedTip = round2(totalTipAmount);
  if (!Number.isFinite(normalizedTip) || normalizedTip <= 0 || sellerBreakdownEntries.length === 0) {
    return;
  }

  const totalBase = sellerBreakdownEntries.reduce(
    (sum, entry) => sum + Number(entry?.breakdown?.grandTotal || 0),
    0,
  );

  let allocatedSoFar = 0;
  sellerBreakdownEntries.forEach((entry, index) => {
    const breakdown = entry?.breakdown;
    if (!breakdown) return;

    let allocatedTip = 0;
    if (index === sellerBreakdownEntries.length - 1) {
      allocatedTip = round2(normalizedTip - allocatedSoFar);
    } else if (totalBase > 0) {
      allocatedTip = round2(
        (Number(breakdown.grandTotal || 0) / totalBase) * normalizedTip,
      );
      allocatedSoFar = round2(allocatedSoFar + allocatedTip);
    }

    breakdown.tipTotal = round2(Number(breakdown.tipTotal || 0) + allocatedTip);
    breakdown.riderTipAmount = round2(
      Number(breakdown.riderTipAmount || 0) + allocatedTip,
    );
    breakdown.platformTotalEarning = round2(
      Number(breakdown.platformTotalEarning || 0) + allocatedTip,
    );
    breakdown.grandTotal = round2(Number(breakdown.grandTotal || 0) + allocatedTip);
  });
}

async function computeGlobalHandlingFeeForCheckout(hydratedItems = [], { session = null } = {}) {
  const headerIds = Array.from(
    new Set(hydratedItems.map((item) => String(item?.headerCategoryId || "")).filter(Boolean)),
  );
  if (headerIds.length === 0) {
    return {
      handlingFeeCharged: 0,
      handlingCategoryUsed: null,
    };
  }

  const categoryQuery = Category.find({ _id: { $in: headerIds } })
    .select("_id name handlingFees handlingFeeType handlingFeeValue")
    .lean();
  if (session) categoryQuery.session(session);
  const categories = await categoryQuery;
  const categoryById = new Map(categories.map((category) => [String(category._id), category]));

  const handling = calculateHandlingFee(hydratedItems, {
    handlingFeeStrategy: HANDLING_FEE_STRATEGY.HIGHEST_CATEGORY_FEE,
    categoryById,
  });

  return {
    handlingFeeCharged: Number(handling.handlingFeeCharged || 0),
    handlingCategoryUsed: handling.handlingCategoryUsed || null,
  };
}

function applyGlobalHandlingFeeToSellerBreakdowns(
  sellerBreakdownEntries = [],
  globalHandling = { handlingFeeCharged: 0, handlingCategoryUsed: null },
) {
  const fee = Number(globalHandling?.handlingFeeCharged || 0);
  if (!Number.isFinite(fee) || fee <= 0 || sellerBreakdownEntries.length === 0) return;

  const usedHeaderId = String(globalHandling?.handlingCategoryUsed?.headerCategoryId || "");
  let chosenSellerId = null;
  if (usedHeaderId) {
    for (const entry of sellerBreakdownEntries) {
      const entryItems = Array.isArray(entry?.items) ? entry.items : [];
      if (entryItems.some((item) => String(item?.headerCategoryId || "") === usedHeaderId)) {
        chosenSellerId = entry.sellerId;
        break;
      }
    }
  }
  if (!chosenSellerId) {
    chosenSellerId = sellerBreakdownEntries[0]?.sellerId || null;
  }

  for (const entry of sellerBreakdownEntries) {
    const breakdown = entry?.breakdown;
    if (!breakdown) continue;

    const shouldCharge = chosenSellerId && entry.sellerId === chosenSellerId;
    const handlingFeeCharged = shouldCharge ? fee : 0;

    breakdown.handlingFeeCharged = handlingFeeCharged;
    breakdown.snapshots = breakdown.snapshots && typeof breakdown.snapshots === "object"
      ? breakdown.snapshots
      : {};
    breakdown.snapshots.handlingFeeStrategy = HANDLING_FEE_STRATEGY.HIGHEST_CATEGORY_FEE;
    breakdown.snapshots.handlingCategoryUsed = shouldCharge
      ? globalHandling.handlingCategoryUsed || {}
      : {};

    const productSubtotal = Number(breakdown.productSubtotal || 0);
    const deliveryFeeCharged = Number(breakdown.deliveryFeeCharged || 0);
    const discountTotal = Number(breakdown.discountTotal || 0);
    const taxTotal = Number(breakdown.taxTotal || 0);
    const adminProductCommissionTotal = Number(breakdown.adminProductCommissionTotal || 0);

    breakdown.grandTotal = round2(
      productSubtotal + deliveryFeeCharged + handlingFeeCharged - discountTotal + taxTotal,
    );

    const logistics = recalculateLogisticsEarnings({
      deliveryFeeCharged,
      handlingFeeCharged,
      adminProductCommissionTotal,
      tipTotal: breakdown.tipTotal || 0,
      // Rider payout was already computed by generateOrderPaymentBreakdown and
      // doesn't depend on handling fee — carry it through unchanged instead
      // of letting this recalculation reset it to 0.
      riderPayoutBase: breakdown.riderPayoutBase || 0,
      riderPayoutDistance: breakdown.riderPayoutDistance || 0,
      riderPayoutBonus: breakdown.riderPayoutBonus || 0,
      riderPayoutTotal: breakdown.riderPayoutTotal || 0,
    });
    Object.assign(breakdown, logistics);
    breakdown.sellerPayoutTotal = round2(
      Math.max(productSubtotal - adminProductCommissionTotal, 0) +
        logistics.sellerDeliveryFeeShare,
    );
  }
}

/**
 * Resolves the automatic delivery-method decision (local vs. Shiprocket) for
 * every seller in a cart — this is the part of checkout that makes a live
 * Shiprocket API call, which can take several seconds. Callers that place
 * orders inside a DB transaction MUST call this BEFORE starting the
 * transaction (see orderPlacementService.js) and pass the result into
 * buildCheckoutPricingSnapshot as `precomputedDeliveryDecisions` — holding a
 * multi-document transaction open across a slow external HTTP call risks
 * hitting MongoDB's transaction lifetime limit and widens the write-conflict
 * window for unrelated concurrent orders on the same seller/products.
 */
export async function resolveDeliveryDecisionsForCheckout({ orderItems = [], address = {} }) {
  const hydratedItems = await hydrateOrderItems(orderItems, {
    session: null,
    enforceServerPricing: true,
  });
  if (!hydratedItems.length) {
    const err = new Error("Cannot checkout with empty cart");
    err.statusCode = 400;
    throw err;
  }

  const itemsBySeller = groupHydratedItemsBySeller(hydratedItems);
  const decisions = new Map();
  for (const [sellerId, sellerItems] of itemsBySeller.entries()) {
    decisions.set(
      sellerId,
      await resolveDeliveryDecisionForSeller({ sellerId, address, sellerItems, session: null }),
    );
  }
  return decisions;
}

export async function buildCheckoutPricingSnapshot({
  orderItems = [],
  address = {},
  tipAmount = 0,
  discountTotal = 0,
  session = null,
  hasFreeDelivery = false,
  hasFreeHandling = false,
  cashbackPercentage = 0,
  membershipTier = "none",
  isFirstOrder = false,
  isExpressDelivery = false,
  // Optional Map<sellerId, decision> from resolveDeliveryDecisionsForCheckout(),
  // pre-resolved outside any DB transaction. Falls back to resolving live
  // (unchanged behavior) for any seller missing from the map.
  precomputedDeliveryDecisions = null,
}) {
  const hydratedItems = await hydrateOrderItems(orderItems, {
    session,
    enforceServerPricing: true,
  });
  if (!hydratedItems.length) {
    const err = new Error("Cannot checkout with empty cart");
    err.statusCode = 400;
    throw err;
  }

  const itemsBySeller = groupHydratedItemsBySeller(hydratedItems);
  const sellerIds = Array.from(itemsBySeller.keys()).sort((a, b) => a.localeCompare(b));
  const sellerBreakdownEntries = [];

  const globalHandling = await computeGlobalHandlingFeeForCheckout(hydratedItems, { session });
  if (hasFreeHandling) {
    globalHandling.handlingFeeCharged = 0;
  }

  // Pre-compute each seller's subtotal for proportional discount distribution
  const sellerSubtotals = new Map();
  let totalSubtotal = 0;
  for (const sellerId of sellerIds) {
    const items = itemsBySeller.get(sellerId) || [];
    const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    sellerSubtotals.set(sellerId, subtotal);
    totalSubtotal += subtotal;
  }

  for (const sellerId of sellerIds) {
    const sellerItems = itemsBySeller.get(sellerId) || [];
    const decision = precomputedDeliveryDecisions?.has(sellerId)
      ? precomputedDeliveryDecisions.get(sellerId)
      : await resolveDeliveryDecisionForSeller({
          sellerId,
          address,
          sellerItems,
          session,
        });
    // Carry the resolved method onto each item so generateOrderPaymentBreakdown's
    // existing `deliveryType === "scheduled"` branching keeps working unchanged.
    for (const item of sellerItems) {
      item.deliveryType = decision.method;
    }
    const distanceKm = decision.distanceKm;
    // Distribute discount proportionally by seller subtotal
    const sellerRatio = totalSubtotal > 0 ? (sellerSubtotals.get(sellerId) || 0) / totalSubtotal : 1 / sellerIds.length;
    const sellerDiscount = round2(discountTotal * sellerRatio);
    const breakdown = await generateOrderPaymentBreakdown({
      preHydratedItems: sellerItems,
      distanceKm,
      discountTotal: sellerDiscount,
      taxTotal: 0,
      session,
      hasFreeDelivery,
      hasFreeHandling,
      membershipTier,
      isFirstOrder,
      isExpressDelivery,
    });

    if (cashbackPercentage > 0) {
      breakdown.estimatedCashback = round2(
        (breakdown.productSubtotal * cashbackPercentage) / 100,
      );
    } else {
      breakdown.estimatedCashback = 0;
    }

    sellerBreakdownEntries.push({
      deliveryDecision: decision,
      sellerId,
      distanceKm,
      items: sellerItems,
      breakdown: {
        ...breakdown,
        sellerId,
      },
    });
  }

  applyGlobalHandlingFeeToSellerBreakdowns(sellerBreakdownEntries, globalHandling);
  allocateCheckoutTipToSellerBreakdowns(sellerBreakdownEntries, tipAmount);

  const aggregateBreakdown = buildAggregateBreakdown(
    sellerBreakdownEntries.map((entry) => entry.breakdown),
  );

  await assertMinimumOrderValue(aggregateBreakdown.productSubtotal);

  return {
    hydratedItems,
    sellerBreakdownEntries,
    aggregateBreakdown,
    sellerCount: sellerBreakdownEntries.length,
    itemCount: hydratedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  };
}

export default {
  buildCheckoutPricingSnapshot,
  assertMinimumOrderValue,
  groupHydratedItemsBySeller,
};
