import mongoose from "mongoose";
import Product from "../../models/product.js";
import Category from "../../models/category.js";
import Seller from "../../models/seller.js";
import {
  PRODUCT_APPROVAL_STATUS,
  resolveProductApprovalStatus,
} from "../productModerationService.js";
import {
  COMMISSION_FIXED_RULE,
  COMMISSION_TYPE,
  DELIVERY_PRICING_MODE,
  HANDLING_FEE_STRATEGY,
  HANDLING_FEE_TYPE,
} from "../../constants/finance.js";
import {
  addMoney,
  ceilKm,
  clampMoney,
  percentOf,
  roundCurrency,
} from "../../utils/money.js";
import { getOrCreateFinanceSettings } from "./financeSettingsService.js";

export const DELIVERY_FEE_SELLER_SHARE = 0.8;
export const DELIVERY_FEE_ADMIN_SHARE = 0.2;

/**
 * Splits the delivery fee between seller and admin — but only what's left
 * AFTER the rider is paid. The rider's payout (calculateRiderPayout) is a
 * fixed cost paid out of what the customer actually paid for delivery;
 * whatever remains is split by `sellerSharePercent` (admin-configurable via
 * Setting.sellerDeliveryFeeSharePercent, default 80) between seller/admin.
 * Pass 0 to stop giving sellers anything from delivery fee. If the rider's
 * payout consumes the whole fee (or more), nothing remains — seller and
 * admin both get ₹0 regardless of the percent (admin funds the rider's
 * shortfall from its other earnings, not from this split).
 */
export function splitDeliveryFee(deliveryFeeCharged = 0, riderPayoutTotal = 0, sellerSharePercent = null) {
  const fee = roundCurrency(deliveryFeeCharged || 0);
  const rider = roundCurrency(riderPayoutTotal || 0);
  const remaining = Math.max(roundCurrency(fee - rider), 0);
  const sharePercent =
    sellerSharePercent != null && Number.isFinite(Number(sellerSharePercent))
      ? Math.min(100, Math.max(0, Number(sellerSharePercent)))
      : DELIVERY_FEE_SELLER_SHARE * 100;
  const sellerDeliveryFeeShare = roundCurrency(remaining * (sharePercent / 100));
  const adminDeliveryFeeShare = roundCurrency(remaining - sellerDeliveryFeeShare);
  return { sellerDeliveryFeeShare, adminDeliveryFeeShare };
}

export function resolveSellerOrderEarning(order) {
  if (!order) return 0;

  const fromBreakdown = Number(order.paymentBreakdown?.sellerPayoutTotal);
  if (Number.isFinite(fromBreakdown) && fromBreakdown >= 0) {
    return roundCurrency(fromBreakdown);
  }

  const subtotal = Number(
    order.pricing?.subtotal ?? order.paymentBreakdown?.productSubtotal ?? 0,
  );
  const commission = Number(
    order.paymentBreakdown?.adminProductCommissionTotal ?? 0,
  );
  const deliveryFee = Number(
    order.pricing?.deliveryFee ?? order.paymentBreakdown?.deliveryFeeCharged ?? 0,
  );
  const riderPayoutTotal = Number(order.paymentBreakdown?.riderPayoutTotal ?? 0);
  const { sellerDeliveryFeeShare } = splitDeliveryFee(deliveryFee, riderPayoutTotal);

  return roundCurrency(
    Math.max(subtotal - commission, 0) + sellerDeliveryFeeShare,
  );
}

export function recalculateLogisticsEarnings({
  deliveryFeeCharged = 0,
  handlingFeeCharged = 0,
  adminProductCommissionTotal = 0,
  tipTotal = 0,
  // Rider payout is computed separately (calculateRiderPayout) and doesn't
  // depend on handling fee — this function just carries those values
  // through unchanged so a later recalculation (e.g. after redistributing
  // the global handling fee across sellers) doesn't wipe them back to 0.
  // It's also fed into splitDeliveryFee below: rider is paid first, seller
  // and admin only split what's left of the delivery fee after that.
  riderPayoutBase = 0,
  riderPayoutDistance = 0,
  riderPayoutBonus = 0,
  riderPayoutTotal = 0,
  sellerDeliveryFeeSharePercent = null,
} = {}) {
  const { sellerDeliveryFeeShare, adminDeliveryFeeShare } = splitDeliveryFee(
    deliveryFeeCharged,
    riderPayoutTotal,
    sellerDeliveryFeeSharePercent,
  );
  const handling = roundCurrency(handlingFeeCharged || 0);
  const tip = roundCurrency(tipTotal || 0);
  const adminCommission = roundCurrency(adminProductCommissionTotal || 0);
  const platformLogisticsMargin = roundCurrency(adminDeliveryFeeShare + handling);
  const platformTotalEarning = roundCurrency(
    adminCommission + platformLogisticsMargin + tip,
  );

  return {
    sellerDeliveryFeeShare,
    adminDeliveryFeeShare,
    platformLogisticsMargin,
    platformTotalEarning,
    riderPayoutBase: roundCurrency(riderPayoutBase),
    riderPayoutDistance: roundCurrency(riderPayoutDistance),
    riderPayoutBonus: roundCurrency(riderPayoutBonus),
    riderTipAmount: tip,
    riderPayoutTotal: roundCurrency(riderPayoutTotal),
  };
}
import {
  productHasVariants,
  resolveVariantByKey,
  resolveVariantUnitPrice,
} from "../../utils/productPricing.js";

function toObjectIdString(value) {
  if (!value) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function normalizeLineQuantity(quantity) {
  const q = Number(quantity || 0);
  if (!Number.isFinite(q) || q <= 0) return 1;
  return Math.floor(q);
}

function normalizeLinePrice(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? clampMoney(amount, 0) : 0;
}

function getSellerCategoryOverridePercent(sellerConfig, headerCategoryId) {
  if (!sellerConfig?.categoryCommissionOverrides || !headerCategoryId) return null;
  const key = String(headerCategoryId);
  const source = sellerConfig.categoryCommissionOverrides;

  let raw;
  if (typeof source.get === "function") {
    raw = source.get(key);
  } else if (typeof source === "object") {
    raw = source[key];
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function resolveCommissionConfig(category) {
  if (!category) {
    return {
      type: COMMISSION_TYPE.PERCENTAGE,
      value: 0,
      fixedRule: COMMISSION_FIXED_RULE.PER_QTY,
    };
  }

  const type = category.adminCommissionType || COMMISSION_TYPE.PERCENTAGE;

  // Backward-compat: admin UI still writes legacy `adminCommission` while newer
  // pricing reads `adminCommissionValue`. Because `adminCommissionValue` has a
  // schema default of 0 and updates can bypass save hooks, we treat a zero
  // `adminCommissionValue` as "unset" when legacy is non-zero.
  const legacyAdminCommission = Number(category.adminCommission ?? 0);
  const primaryAdminCommission = Number(category.adminCommissionValue);
  const resolvedRaw =
    category.adminCommissionValue == null ||
    (!Number.isFinite(primaryAdminCommission) ||
      (primaryAdminCommission === 0 && legacyAdminCommission > 0))
      ? legacyAdminCommission
      : primaryAdminCommission;
  const value = Number(resolvedRaw ?? 0);
  const fixedRule =
    category.adminCommissionFixedRule || COMMISSION_FIXED_RULE.PER_QTY;

  return {
    type,
    value: Number.isFinite(value) ? Math.max(value, 0) : 0,
    fixedRule,
  };
}

function resolveHandlingConfig(category) {
  if (!category) {
    return { type: HANDLING_FEE_TYPE.NONE, value: 0 };
  }

  const type =
    category.handlingFeeType ||
    (Number(category.handlingFees || 0) > 0
      ? HANDLING_FEE_TYPE.FIXED
      : HANDLING_FEE_TYPE.NONE);

  // Backward-compat: admin UI writes legacy `handlingFees` while pricing reads
  // `handlingFeeValue`. Since `handlingFeeValue` defaults to 0, treat it as
  // unset when legacy is non-zero.
  const legacyHandlingFees = Number(category.handlingFees ?? 0);
  const primaryHandlingValue = Number(category.handlingFeeValue);
  const resolvedRaw =
    category.handlingFeeValue == null ||
    (!Number.isFinite(primaryHandlingValue) ||
      (primaryHandlingValue === 0 && legacyHandlingFees > 0))
      ? legacyHandlingFees
      : primaryHandlingValue;
  const value = Number(resolvedRaw ?? 0);

  return {
    type,
    value: Number.isFinite(value) ? Math.max(value, 0) : 0,
  };
}

export function calculateProductSubtotal(items = []) {
  return roundCurrency(
    items.reduce((sum, item) => {
      const quantity = normalizeLineQuantity(item.quantity);
      const unitPrice = normalizeLinePrice(item.price);
      return sum + unitPrice * quantity;
    }, 0),
  );
}

export function calculateCategoryCommission(item, categoryConfig, sellerConfig = null) {
  const quantity = normalizeLineQuantity(item.quantity);
  const itemSubtotal = roundCurrency(normalizeLinePrice(item.price) * quantity);
  
  const now = new Date();
  const isSubscriptionActive =
    sellerConfig?.commissionModel === "PLAN_BASED" &&
    sellerConfig?.subscription?.status === "active" &&
    sellerConfig?.subscription?.expiresAt &&
    new Date(sellerConfig.subscription.expiresAt) > now;

  if (isSubscriptionActive || (sellerConfig?.commissionModel === "ONE_TIME" && sellerConfig?.oneTimeChargePaid)) {
    return {
      itemSubtotal,
      adminCommission: 0,
      sellerPayout: itemSubtotal,
      appliedCommissionType: "one_time_exempt",
      appliedCommissionValue: 0,
      appliedFixedRule: "none",
    };
  }

  const { type, value, fixedRule } = resolveCommissionConfig(categoryConfig);
  let effectiveValue = value;
  let effectiveType = type;
  let effectiveRule = fixedRule;

  if (sellerConfig?.categoryCommissionOverrides && item.headerCategoryId) {
    const override = sellerConfig.categoryCommissionOverrides.get(String(item.headerCategoryId));
    if (override !== undefined && override !== null) {
      effectiveValue = Number(override);
      effectiveType = COMMISSION_TYPE.PERCENTAGE; 
      effectiveRule = COMMISSION_FIXED_RULE.PER_QTY;
    }
  }

  let adminCommission = 0;
  if (effectiveType === COMMISSION_TYPE.PERCENTAGE) {
    adminCommission = percentOf(itemSubtotal, effectiveValue);
  } else {
    const fixedBase =
      effectiveRule === COMMISSION_FIXED_RULE.PER_ITEM ? effectiveValue : effectiveValue * quantity;
    adminCommission = roundCurrency(fixedBase);
  }

  adminCommission = clampMoney(adminCommission, 0, itemSubtotal);
  const sellerPayout = roundCurrency(itemSubtotal - adminCommission);

  return {
    itemSubtotal,
    adminCommission,
    sellerPayout,
    appliedCommissionType: effectiveType,
    appliedCommissionValue: effectiveValue,
    appliedFixedRule: effectiveRule,
  };
}

function calculateHandlingForCategory({ type, value }, categorySubtotal) {
  if (type === HANDLING_FEE_TYPE.NONE) return 0;
  if (type === HANDLING_FEE_TYPE.PERCENTAGE) {
    return percentOf(categorySubtotal, value);
  }
  return roundCurrency(value);
}

export function calculateHandlingFee(cartItems, options = {}) {
  const {
    handlingFeeStrategy = HANDLING_FEE_STRATEGY.HIGHEST_CATEGORY_FEE,
    categoryById = new Map(),
  } = options;

  const categorySubtotalMap = new Map();
  for (const item of cartItems) {
    const headerId = toObjectIdString(item.headerCategoryId);
    const itemSubtotal = roundCurrency(normalizeLinePrice(item.price) * normalizeLineQuantity(item.quantity));
    categorySubtotalMap.set(headerId, addMoney(categorySubtotalMap.get(headerId) || 0, itemSubtotal));
  }

  const categoryFees = [];
  for (const [headerId, subtotal] of categorySubtotalMap.entries()) {
    const category = categoryById.get(headerId);
    const handling = resolveHandlingConfig(category);
    const fee = calculateHandlingForCategory(handling, subtotal);
    categoryFees.push({
      headerCategoryId: headerId || null,
      categoryName: category?.name || "Unknown",
      subtotal,
      handlingFeeType: handling.type,
      handlingFeeValue: handling.value,
      computedFee: roundCurrency(fee),
    });
  }

  let totalHandlingFee = 0;
  let handlingCategoryUsed = null;

  if (categoryFees.length === 0) {
    totalHandlingFee = 0;
  } else if (handlingFeeStrategy === HANDLING_FEE_STRATEGY.SUM_OF_CATEGORY_FEES) {
    totalHandlingFee = categoryFees.reduce((sum, row) => addMoney(sum, row.computedFee), 0);
  } else if (handlingFeeStrategy === HANDLING_FEE_STRATEGY.PER_ITEM_FEE) {
    totalHandlingFee = cartItems.reduce((sum, item) => {
      const headerId = toObjectIdString(item.headerCategoryId);
      const category = categoryById.get(headerId);
      const handling = resolveHandlingConfig(category);
      const quantity = normalizeLineQuantity(item.quantity);
      const itemSubtotal = roundCurrency(normalizeLinePrice(item.price) * quantity);
      const perLine =
        handling.type === HANDLING_FEE_TYPE.FIXED
          ? roundCurrency(handling.value * quantity)
          : calculateHandlingForCategory(handling, itemSubtotal);
      return addMoney(sum, perLine);
    }, 0);
  } else {
    const maxCategory = categoryFees.reduce((best, row) =>
      row.computedFee > (best?.computedFee || 0) ? row : best,
    );
    totalHandlingFee = roundCurrency(maxCategory?.computedFee || 0);
    handlingCategoryUsed = maxCategory || null;
  }

  if (!handlingCategoryUsed && categoryFees.length > 0) {
    handlingCategoryUsed = categoryFees
      .slice()
      .sort((a, b) => b.computedFee - a.computedFee)[0];
  }

  return {
    handlingFeeCharged: roundCurrency(totalHandlingFee),
    handlingFeeStrategy,
    handlingCategoryUsed,
    categoryFees,
  };
}

/**
 * Picks the slab whose band contains `distanceKm`. Slabs are treated as
 * half-open on the low end and inclusive on the high end — e.g. a "0-5" /
 * "5-10" pair means exactly 5km belongs to the "0-5" slab, 5.01km belongs to
 * "5-10". A slab with maxKm: null is open-ended ("15+ km").
 */
function resolveDistanceSlab(slabs, distanceKm) {
  if (!Array.isArray(slabs) || slabs.length === 0) return null;
  const sorted = [...slabs]
    .map((slab) => ({
      ...slab,
      minKm: Number(slab.minKm) || 0,
      maxKm: slab.maxKm == null ? null : Number(slab.maxKm),
    }))
    .sort((a, b) => a.minKm - b.minKm);

  const distance = Number(distanceKm) || 0;
  for (const slab of sorted) {
    const max = slab.maxKm == null ? Infinity : slab.maxKm;
    if (distance <= max) return slab;
  }
  return sorted[sorted.length - 1];
}

/** Charge for weight above the free allowance, rounded up to the next whole kg. */
function computeWeightSurcharge(weightKg, baseWeightKg, extraFeePerKg) {
  const extraKg = Number(weightKg || 0) - Number(baseWeightKg || 0);
  if (!Number.isFinite(extraKg) || extraKg <= 0) return 0;
  return roundCurrency(Math.ceil(extraKg) * Number(extraFeePerKg || 0));
}

/**
 * Total cart weight in kg, reusing the same "parse the free-text weight
 * string, default to 0.5kg if unparseable" convention already used for
 * scheduled/nationwide orders.
 */
export function computeTotalWeightKg(items = []) {
  let totalWeightKg = 0;
  for (const item of items) {
    const wStr = item.weight || "";
    let wVal = parseFloat(String(wStr).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(wVal) || wVal <= 0) wVal = 0.5;
    if (String(wStr).toLowerCase().includes("gm") || String(wStr).toLowerCase().includes("gram")) {
      wVal = wVal / 1000;
    }
    totalWeightKg += wVal * Number(item.quantity || 1);
  }
  return totalWeightKg;
}

export function calculateCustomerDeliveryFee(
  distanceKm,
  deliverySettings,
  hasFreeDelivery = false,
  { weightKg = 0, isExpressDelivery = false, orderValue = 0 } = {},
) {
  const mode =
    deliverySettings.deliveryPricingMode || DELIVERY_PRICING_MODE.DISTANCE_BASED;
  const actualDistance = Number(distanceKm || 0);
  const normalizedDistance = Number.isFinite(actualDistance)
    ? Math.max(actualDistance, 0)
    : 0;

  if (mode === DELIVERY_PRICING_MODE.FIXED_PRICE) {
    let fixedFee = roundCurrency(
      deliverySettings.fixedDeliveryFee ?? deliverySettings.customerBaseDeliveryFee ?? 0,
    );
    if (hasFreeDelivery) {
        fixedFee = 0;
    }
    return {
      deliveryFeeCharged: fixedFee,
      deliveryFeeBase: roundCurrency(
        deliverySettings.fixedDeliveryFee ?? deliverySettings.customerBaseDeliveryFee ?? 0,
      ),
      distanceKmActual: normalizedDistance,
      distanceKmRounded: roundCurrency(normalizedDistance),
      roundedExtraKm: 0,
      mode,
      baseFee: fixedFee,
      extraFee: 0,
    };
  }

  const expressMaxWeight = Number(deliverySettings.expressDeliveryMaxWeightKg ?? 5);
  if (
    isExpressDelivery &&
    deliverySettings.expressDeliveryEnabled !== false &&
    Number(weightKg || 0) <= expressMaxWeight
  ) {
    const expressFee = roundCurrency(deliverySettings.expressDeliveryFee ?? 150);
    return {
      deliveryFeeCharged: hasFreeDelivery ? 0 : expressFee,
      deliveryFeeBase: expressFee,
      distanceKmActual: normalizedDistance,
      distanceKmRounded: normalizedDistance,
      roundedExtraKm: 0,
      mode: "EXPRESS",
      baseFee: expressFee,
      extraFee: 0,
      isExpress: true,
    };
  }

  const slab = resolveDistanceSlab(deliverySettings.deliveryFeeSlabs, normalizedDistance);
  const baseFee = roundCurrency(slab?.fee ?? 0);
  const weightSurcharge = computeWeightSurcharge(
    weightKg,
    deliverySettings.deliveryFeeBaseWeightKg ?? 2,
    deliverySettings.deliveryFeeExtraFeePerKg ?? 10,
  );
  const fullFee = roundCurrency(baseFee + weightSurcharge);

  const freeAboveOrderValue = slab?.freeAboveOrderValue;
  const qualifiesForSlabFreeDelivery =
    freeAboveOrderValue != null && Number(orderValue || 0) >= Number(freeAboveOrderValue);

  const chargedFee = hasFreeDelivery || qualifiesForSlabFreeDelivery ? 0 : fullFee;

  return {
    deliveryFeeCharged: chargedFee,
    deliveryFeeBase: fullFee,
    distanceKmActual: normalizedDistance,
    distanceKmRounded: normalizedDistance,
    roundedExtraKm: 0,
    mode,
    baseFee,
    extraFee: weightSurcharge,
    slabApplied: slab ? { minKm: slab.minKm, maxKm: slab.maxKm } : null,
  };
}

export function calculateRiderPayout(
  distanceKm,
  deliverySettings = {},
  { weightKg = 0, isExpressDelivery = false } = {},
) {
  const mode =
    deliverySettings?.deliveryPricingMode || DELIVERY_PRICING_MODE.DISTANCE_BASED;
  const actualDistance = Number(distanceKm || 0);
  const normalizedDistance = Number.isFinite(actualDistance)
    ? Math.max(actualDistance, 0)
    : 0;

  const expressMaxWeight = Number(deliverySettings?.expressDeliveryMaxWeightKg ?? 5);
  if (
    isExpressDelivery &&
    deliverySettings?.expressDeliveryEnabled !== false &&
    Number(weightKg || 0) <= expressMaxWeight
  ) {
    const expressEarning = roundCurrency(deliverySettings?.riderExpressEarning ?? 100);
    return {
      riderPayoutBase: expressEarning,
      riderPayoutDistance: 0,
      riderPayoutBonus: 0,
      riderPayoutTotal: expressEarning,
      roundedExtraKm: 0,
      mode: "EXPRESS",
    };
  }

  const slabs = Array.isArray(deliverySettings?.riderEarningSlabs)
    ? deliverySettings.riderEarningSlabs
    : [];
  const slab = resolveDistanceSlab(slabs, normalizedDistance);
  let riderBase = roundCurrency(slab?.earning ?? 0);

  let riderDistance = 0;
  let roundedExtraKm = 0;

  // IF riderEarningSlabs is empty or slab earning is not configured, compute using Admin settings:
  // - riderBasePayout (default 30 ₹)
  // - baseDistanceCapacityKm (default 0.5 km)
  // - deliveryPartnerRatePerKm (default 5 ₹ / km)
  if (!slab || (!riderBase && slabs.length === 0)) {
    const basePayout = roundCurrency(
      deliverySettings?.riderBasePayout ?? deliverySettings?.customerBaseDeliveryFee ?? 30
    );
    const baseCapacityKm = Number(deliverySettings?.baseDistanceCapacityKm ?? 0.5);
    const ratePerKm = Number(
      deliverySettings?.deliveryPartnerRatePerKm ?? deliverySettings?.incrementalKmSurcharge ?? 5
    );

    riderBase = basePayout;
    const extraKm = Math.max(0, normalizedDistance - baseCapacityKm);
    if (extraKm > 0) {
      roundedExtraKm = ceilKm(extraKm);
      riderDistance = roundCurrency(roundedExtraKm * ratePerKm);
    }
  } else {
    // Slabs configured
    const weightSurcharge = computeWeightSurcharge(
      weightKg,
      deliverySettings?.riderEarningBaseWeightKg ?? 2,
      deliverySettings?.riderEarningExtraFeePerKg ?? 10,
    );

    let extraDistanceEarning = 0;
    if (slab && slab.maxKm == null) {
      const extraKm = normalizedDistance - Number(slab.minKm || 0);
      if (extraKm > 0) {
        roundedExtraKm = ceilKm(extraKm);
        const perKmRate = Number(deliverySettings?.riderExtraEarningPerKmBeyondSlabs ?? 0);
        extraDistanceEarning = roundCurrency(roundedExtraKm * perKmRate);
      }
    }

    riderDistance = roundCurrency(weightSurcharge + extraDistanceEarning);
  }

  const riderTotal = roundCurrency(riderBase + riderDistance);

  return {
    riderPayoutBase: riderBase,
    riderPayoutDistance: riderDistance,
    riderPayoutBonus: 0,
    riderPayoutTotal: riderTotal,
    roundedExtraKm,
    mode,
  };
}

export async function hydrateOrderItems(
  orderItems = [],
  { session = null, enforceServerPricing = true } = {},
) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return [];
  }

  const productIds = orderItems
    .map((item) => item.product || item.productId || item._id || item.id)
    .filter(Boolean);

  const productQuery = Product.find({ _id: { $in: productIds } })
    .select("_id name salePrice price costPrice mainImage headerId sellerId status approvalStatus variants deliveryType weight packageLength packageBreadth packageHeight isReturnable returnWindowDays")
    .lean();
  if (session) productQuery.session(session);
  const products = await productQuery;

  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return orderItems.map((item) => {
    const productId = String(item.product || item.productId || item._id || item.id);
    const product = productMap.get(productId);
    if (!product) {
      throw new Error(`Product not found for line item: ${productId}`);
    }
    if (product.status !== "active") {
      throw new Error(`Product is not available for purchase: ${product.name}`);
    }
    if (resolveProductApprovalStatus(product) !== PRODUCT_APPROVAL_STATUS.APPROVED) {
      throw new Error(`Product is not approved for purchase: ${product.name}`);
    }

    const rawVariantSku = String(item.variantSku || item.variantSlot || "").trim();
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (productHasVariants(product) && !rawVariantSku) {
      const err = new Error(`Please select a variant for: ${product.name}`);
      err.statusCode = 400;
      throw err;
    }

    let resolvedVariant = null;
    if (rawVariantSku) {
      resolvedVariant = resolveVariantByKey(variants, rawVariantSku);
      if (!resolvedVariant) {
        const err = new Error(`Invalid variant for product: ${product.name}`);
        err.statusCode = 400;
        throw err;
      }
    }

    const quantity = normalizeLineQuantity(item.quantity);
    const serverUnitPrice = normalizeLinePrice(
      resolveVariantUnitPrice(resolvedVariant, product),
    );
    const inferredUnitPrice = enforceServerPricing
      ? serverUnitPrice
      : normalizeLinePrice(item.price) || serverUnitPrice;
    const resolvedCostPrice = normalizeLinePrice(
      resolvedVariant && resolvedVariant.costPrice != null
        ? resolvedVariant.costPrice
        : product.costPrice || 0,
    );

    return {
      productId,
      productName: item.name || product.name,
      quantity,
      price: inferredUnitPrice,
      costPrice: resolvedCostPrice,
      image: item.image || product.mainImage,
      headerCategoryId: String(product.headerId),
      sellerId: String(product.sellerId),
      variantSku: rawVariantSku || "",
      variantName: resolvedVariant ? String(resolvedVariant?.name || "").trim() : "",
      deliveryType: product.deliveryType || "instant",
      weight: product.weight || "",
      packageLength: product.packageLength ?? null,
      packageBreadth: product.packageBreadth ?? null,
      packageHeight: product.packageHeight ?? null,
      isReturnable: product.isReturnable ?? true,
      returnWindowDays: product.returnWindowDays ?? 1,
    };
  });
}

export async function generateOrderPaymentBreakdown({
  items = [],
  preHydratedItems = null,
  distanceKm = 0,
  discountTotal = 0,
  taxTotal = 0,
  tipTotal = 0,
  deliverySettings,
  handlingFeeStrategy,
  session = null,
  hasFreeDelivery = false,
  hasFreeHandling = false,
  membershipTier = "none",
  isFirstOrder = false,
  isExpressDelivery = false,
}) {
  const normalizedItems = Array.isArray(preHydratedItems) && preHydratedItems.length > 0
    ? preHydratedItems
    : await hydrateOrderItems(items, { session, enforceServerPricing: true });
  if (normalizedItems.length === 0) {
    throw new Error("Cart is empty");
  }

  const sellerIds = Array.from(new Set(normalizedItems.map((item) => item.sellerId)));
  if (sellerIds.length > 1) {
    throw new Error("Multi-seller checkout is not supported in current flow");
  }

  let sellerConfig = null;
  if (sellerIds.length === 1 && mongoose.Types.ObjectId.isValid(sellerIds[0])) {
    sellerConfig = await Seller.findById(sellerIds[0]).select("commissionModel oneTimeChargePaid subscription categoryCommissionOverrides").lean();
  }

  const headerIds = Array.from(
    new Set(normalizedItems.map((item) => item.headerCategoryId).filter(Boolean)),
  );

  const categoryQuery = Category.find({ _id: { $in: headerIds } })
    .select(
      "_id name adminCommission adminCommissionType adminCommissionValue adminCommissionFixedRule handlingFees handlingFeeType handlingFeeValue",
    )
    .lean();
  if (session) categoryQuery.session(session);
  const categories = await categoryQuery;
  const categoryById = new Map(categories.map((category) => [String(category._id), category]));

  const effectiveSettings =
    deliverySettings || (await getOrCreateFinanceSettings());
  const effectiveHandlingStrategy =
    handlingFeeStrategy || effectiveSettings.handlingFeeStrategy;

  // Product subtotal is needed up-front now — the slab-based customer fee's
  // "free above ₹X order value" rule depends on it.
  let productSubtotal = 0;
  for (const item of normalizedItems) {
    productSubtotal = addMoney(productSubtotal, roundCurrency(item.price * item.quantity));
  }

  const totalWeightKg = computeTotalWeightKg(normalizedItems);

  let delivery;
  let rider;
  const isScheduled = normalizedItems.some(item => item.deliveryType === "scheduled");

  if (isScheduled) {
    let baseDeliveryFee = 0;
    if (totalWeightKg <= 0.5) {
      baseDeliveryFee = 60;
    } else {
      baseDeliveryFee = 60 + Math.ceil((totalWeightKg - 0.5) / 0.5) * 40;
    }
    const deliveryFee = hasFreeDelivery ? 0 : baseDeliveryFee;

    delivery = {
      deliveryFeeCharged: deliveryFee,
      deliveryFeeBase: baseDeliveryFee,
      distanceKmActual: distanceKm,
      distanceKmRounded: distanceKm,
      roundedExtraKm: 0,
      mode: "WEIGHT_BASED",
      baseFee: deliveryFee,
      extraFee: 0,
    };

    rider = {
      riderPayoutBase: 0,
      riderPayoutDistance: 0,
      riderPayoutBonus: 0,
      riderPayoutTotal: 0,
      roundedExtraKm: 0,
    };
  } else {
    const effectiveFreeDelivery = hasFreeDelivery || (isFirstOrder && effectiveSettings.firstOrderFreeDelivery !== false);
    const deliveryOptions = {
      weightKg: totalWeightKg,
      isExpressDelivery,
      orderValue: productSubtotal,
    };
    delivery = calculateCustomerDeliveryFee(distanceKm, effectiveSettings, effectiveFreeDelivery, deliveryOptions);
    // Rider is always paid the full slab/express earning regardless of any
    // customer-side discount or "free above ₹X" promo — admin absorbs the
    // gap, mirroring how the seller's delivery-fee share already works.
    rider = calculateRiderPayout(distanceKm, effectiveSettings, {
      weightKg: totalWeightKg,
      isExpressDelivery,
    });
  }

  const shippingChargeToDeduct = 0;
  const commissionBase = Math.max(productSubtotal - shippingChargeToDeduct, 0);

  // Determine membership discount
  let membershipDiscountPercent = 0;
  const tierClean = String(membershipTier || "none").toLowerCase();
  if (tierClean === "gold") {
    membershipDiscountPercent = effectiveSettings.goldCardMemberDiscountPercent ?? 10;
  } else if (tierClean === "silver") {
    membershipDiscountPercent = effectiveSettings.silverCardMemberDiscountPercent ?? 5;
  } else if (tierClean === "bronze") {
    membershipDiscountPercent = effectiveSettings.bronzeCardMemberDiscountPercent ?? 2.5;
  }
  const membershipDiscountAmount = roundCurrency((productSubtotal * membershipDiscountPercent) / 100);

  // Compute splits
  const now = new Date();
  const isSubscriptionActive =
    sellerConfig?.commissionModel === "PLAN_BASED" &&
    sellerConfig?.subscription?.status === "active" &&
    sellerConfig?.subscription?.expiresAt &&
    new Date(sellerConfig.subscription.expiresAt) > now;

  const isExempt =
    isSubscriptionActive ||
    (sellerConfig?.commissionModel === "ONE_TIME" && sellerConfig?.oneTimeChargePaid);

  const lineItems = normalizedItems.map((item) => {
    const category = categoryById.get(String(item.headerCategoryId));
    const itemSubtotal = roundCurrency(item.price * item.quantity);

    const itemShippingProportion = productSubtotal > 0 ? (itemSubtotal / productSubtotal) * shippingChargeToDeduct : 0;
    const itemCommissionBase = Math.max(itemSubtotal - itemShippingProportion, 0);

    // Category commission can be configured as a percentage OR a fixed amount
    // (per item / per qty) — resolveCommissionConfig() is the single source
    // of truth for interpreting that config, shared with calculateCategoryCommission().
    const categoryCommission = resolveCommissionConfig(category);
    const overridePercent = getSellerCategoryOverridePercent(
      sellerConfig,
      item.headerCategoryId,
    );

    let appliedType = categoryCommission.type;
    let appliedValue = categoryCommission.value;
    let appliedFixedRule = categoryCommission.fixedRule;
    let commissionSource = "global_slab";

    if (overridePercent !== null) {
      appliedType = COMMISSION_TYPE.PERCENTAGE;
      appliedValue = overridePercent;
      appliedFixedRule = COMMISSION_FIXED_RULE.PER_QTY;
      commissionSource = "seller_category_override";
    } else if (categoryCommission.value > 0) {
      commissionSource = "category_config";
    } else {
      appliedType = COMMISSION_TYPE.PERCENTAGE;
      appliedValue = Number(effectiveSettings.adminCommissionPercent ?? 0);
    }

    let itemCommission = 0;
    if (!isExempt) {
      if (appliedType === COMMISSION_TYPE.FIXED) {
        const fixedBase =
          appliedFixedRule === COMMISSION_FIXED_RULE.PER_ITEM
            ? appliedValue
            : appliedValue * item.quantity;
        itemCommission = roundCurrency(fixedBase);
      } else {
        itemCommission = percentOf(itemCommissionBase, appliedValue);
      }
      itemCommission = clampMoney(itemCommission, 0, itemSubtotal);
    }

    const itemSellerPayout = Math.max(itemSubtotal - itemCommission, 0);
    const itemCostPrice = Number(item.costPrice || 0);
    const itemCostTotal = roundCurrency(itemCostPrice * item.quantity);
    const itemNetProfit = roundCurrency(itemSellerPayout - itemCostTotal);

    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.price,
      costPrice: itemCostPrice,
      itemCostTotal,
      itemSubtotal,
      sellerPayout: itemSellerPayout,
      sellerNetProfit: itemNetProfit,
      adminProductCommission: itemCommission,
      headerCategoryId: item.headerCategoryId,
      headerCategoryName: category?.name || "Unknown",
      appliedCommissionType: isExempt ? "one_time_exempt" : commissionSource,
      appliedCommissionValue: isExempt ? 0 : appliedValue,
      appliedCommissionFixedRule: isExempt ? "none" : appliedType,
    };
  });

  // IMPORTANT:
  // Seller payout should be reduced only by seller/category commission.
  // Platform allocation percentages (technical/sub-admin/site cashback/etc.)
  // are internal splits and must not be additionally deducted from seller.
  const totalCommissionAmount = roundCurrency(
    lineItems.reduce((sum, line) => sum + Number(line.adminProductCommission || 0), 0),
  );
  const adminCommPercent =
    commissionBase > 0
      ? roundCurrency((totalCommissionAmount * 100) / commissionBase)
      : 0;

  const commissionBreakdown = {
    adminCommissionPercent: adminCommPercent,
    adminCommissionAmount: totalCommissionAmount,
    
    technicalChargePercent: effectiveSettings.technicalChargePercent ?? 0,
    technicalChargeAmount: isExempt ? 0 : roundCurrency((commissionBase * (effectiveSettings.technicalChargePercent ?? 0)) / 100),
    
    subAdminCommissionPercent: effectiveSettings.subAdminCommissionPercent ?? 0,
    subAdminCommissionAmount: isExempt ? 0 : roundCurrency((commissionBase * (effectiveSettings.subAdminCommissionPercent ?? 0)) / 100),
    
    fieldWorkerCommissionPercent: effectiveSettings.fieldWorkerCommissionPercent ?? 0,
    fieldWorkerCommissionAmount: isExempt ? 0 : roundCurrency((commissionBase * (effectiveSettings.fieldWorkerCommissionPercent ?? 0)) / 100),
    
    directSlabCommissionPercent: effectiveSettings.directSlabCommissionPercent ?? 0,
    directSlabCommissionAmount: isExempt ? 0 : roundCurrency((commissionBase * (effectiveSettings.directSlabCommissionPercent ?? 0)) / 100),
    
    advertiseChargePercent: effectiveSettings.advertiseChargePercent ?? 0,
    advertiseChargeAmount: isExempt ? 0 : roundCurrency((commissionBase * (effectiveSettings.advertiseChargePercent ?? 0)) / 100),
    
    siteCashbackPercent: effectiveSettings.siteCashbackPercent ?? 0,
    siteCashbackAmount: isExempt ? 0 : roundCurrency((commissionBase * (effectiveSettings.siteCashbackPercent ?? 0)) / 100),
    
    otherMaintenancePercent: effectiveSettings.otherMaintenancePercent ?? 0,
    otherMaintenanceAmount: isExempt ? 0 : roundCurrency((commissionBase * (effectiveSettings.otherMaintenancePercent ?? 0)) / 100),
    
    affiliateMarketingPercent: effectiveSettings.affiliateMarketingPercent ?? 0,
    affiliateMarketingAmount: isExempt ? 0 : roundCurrency((commissionBase * (effectiveSettings.affiliateMarketingPercent ?? 0)) / 100),
    
    membershipTier: tierClean,
    membershipDiscountPercent,
    membershipDiscountAmount,
    
    commissionBaseAmount: commissionBase,
    shippingDeductedAmount: shippingChargeToDeduct,
  };

  let handling = calculateHandlingFee(normalizedItems, {
    handlingFeeStrategy: effectiveHandlingStrategy,
    categoryById,
  });
  if (hasFreeHandling) {
    handling.handlingFeeCharged = 0;
  }

  const firstOrderDiscountPercent = isFirstOrder ? Number(effectiveSettings.firstOrderDiscountPercent ?? 10) : 0;
  const firstOrderDiscountAmount = isFirstOrder ? roundCurrency((productSubtotal * firstOrderDiscountPercent) / 100) : 0;

  const finalDiscountTotal = roundCurrency(discountTotal + membershipDiscountAmount + firstOrderDiscountAmount);
  const normalizedTax = roundCurrency(taxTotal || 0);
  const normalizedTip = roundCurrency(tipTotal || 0);

  const grandTotal = roundCurrency(
    productSubtotal +
      delivery.deliveryFeeCharged +
      handling.handlingFeeCharged -
      finalDiscountTotal +
      normalizedTax +
      normalizedTip,
  );

  const riderTipAmount = normalizedTip;
  const logisticsEarnings = recalculateLogisticsEarnings({
    deliveryFeeCharged: delivery.deliveryFeeCharged,
    handlingFeeCharged: handling.handlingFeeCharged,
    adminProductCommissionTotal: totalCommissionAmount,
    tipTotal: riderTipAmount,
    riderPayoutBase: rider.riderPayoutBase,
    riderPayoutDistance: rider.riderPayoutDistance,
    riderPayoutBonus: rider.riderPayoutBonus,
    riderPayoutTotal: rider.riderPayoutTotal,
    sellerDeliveryFeeSharePercent: effectiveSettings.sellerDeliveryFeeSharePercent,
  });

  const adminProductCommissionTotal = totalCommissionAmount;
  const {
    sellerDeliveryFeeShare,
    adminDeliveryFeeShare,
    platformLogisticsMargin,
    platformTotalEarning,
    riderPayoutBase,
    riderPayoutDistance,
    riderPayoutBonus,
    riderPayoutTotal,
  } = logisticsEarnings;

  const sellerPayoutTotal = roundCurrency(
    Math.max(productSubtotal - totalCommissionAmount, 0) + sellerDeliveryFeeShare,
  );
  const totalCostPrice = roundCurrency(
    lineItems.reduce((sum, line) => sum + Number(line.itemCostTotal || 0), 0),
  );
  const sellerNetProfit = roundCurrency(sellerPayoutTotal - totalCostPrice);

  const snapshots = {
    deliverySettings: {
      ...effectiveSettings,
    },
    categoryCommissionSettings: categories.map((category) => ({
      headerCategoryId: String(category._id),
      headerCategoryName: category.name,
      adminCommissionType:
        category.adminCommissionType || COMMISSION_TYPE.PERCENTAGE,
      adminCommissionValue: resolveCommissionConfig(category).value,
      adminCommissionFixedRule:
        category.adminCommissionFixedRule || COMMISSION_FIXED_RULE.PER_QTY,
      handlingFeeType:
        category.handlingFeeType || HANDLING_FEE_TYPE.FIXED,
      handlingFeeValue: resolveHandlingConfig(category).value,
    })),
    handlingFeeStrategy: effectiveHandlingStrategy,
    handlingCategoryUsed: handling.handlingCategoryUsed,
  };

  return {
    sellerId: sellerIds[0],
    lineItems,
    currency: "INR",
    productSubtotal,
    deliveryFeeCharged: delivery.deliveryFeeCharged,
    deliveryFeeBase: delivery.deliveryFeeBase,
    handlingFeeCharged: handling.handlingFeeCharged,
    tipTotal: normalizedTip,
    discountTotal: finalDiscountTotal,
    membershipDiscountAmount,
    firstOrderDiscountAmount,
    firstOrderDiscountPercent,
    taxTotal: normalizedTax,
    grandTotal,
    sellerPayoutTotal,
    totalCostPrice,
    sellerNetProfit,
    adminProductCommissionTotal,
    sellerDeliveryFeeShare,
    adminDeliveryFeeShare,
    riderPayoutBase,
    riderPayoutDistance,
    riderPayoutBonus,
    riderTipAmount,
    riderPayoutTotal,
    platformLogisticsMargin,
    platformTotalEarning,
    codCollectedAmount: 0,
    codRemittedAmount: 0,
    codPendingAmount: 0,
    estimatedCashback: 0,
    distanceKmActual: delivery.distanceKmActual,
    distanceKmRounded: delivery.distanceKmRounded,
    snapshots,
    commissionBreakdown,
  };
}
