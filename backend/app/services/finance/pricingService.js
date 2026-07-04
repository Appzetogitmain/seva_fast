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

export function splitDeliveryFee(deliveryFeeCharged = 0) {
  const fee = roundCurrency(deliveryFeeCharged || 0);
  return {
    sellerDeliveryFeeShare: roundCurrency(fee * DELIVERY_FEE_SELLER_SHARE),
    adminDeliveryFeeShare: roundCurrency(fee * DELIVERY_FEE_ADMIN_SHARE),
  };
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
  const { sellerDeliveryFeeShare } = splitDeliveryFee(deliveryFee);

  return roundCurrency(
    Math.max(subtotal - commission, 0) + sellerDeliveryFeeShare,
  );
}

export function recalculateLogisticsEarnings({
  deliveryFeeCharged = 0,
  handlingFeeCharged = 0,
  adminProductCommissionTotal = 0,
  tipTotal = 0,
} = {}) {
  const { sellerDeliveryFeeShare, adminDeliveryFeeShare } = splitDeliveryFee(
    deliveryFeeCharged,
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
    riderPayoutBase: 0,
    riderPayoutDistance: 0,
    riderPayoutBonus: 0,
    riderTipAmount: tip,
    riderPayoutTotal: 0,
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
  
  if (sellerConfig?.commissionModel === "ONE_TIME" && sellerConfig?.oneTimeChargePaid) {
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

export function calculateCustomerDeliveryFee(distanceKm, deliverySettings, hasFreeDelivery = false) {
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
      distanceKmActual: normalizedDistance,
      distanceKmRounded: roundCurrency(normalizedDistance),
      roundedExtraKm: 0,
      mode,
      baseFee: fixedFee,
      extraFee: 0,
    };
  }

  const baseFee = roundCurrency(deliverySettings.customerBaseDeliveryFee ?? 0);
  const baseDistance = Math.max(Number(deliverySettings.baseDistanceCapacityKm || 0), 0);
  const surcharge = roundCurrency(deliverySettings.incrementalKmSurcharge ?? 0);

  if (normalizedDistance <= baseDistance) {
    let chargedBaseFee = baseFee;
    if (hasFreeDelivery) {
        chargedBaseFee = 0;
    }
    return {
      deliveryFeeCharged: chargedBaseFee,
      distanceKmActual: normalizedDistance,
      distanceKmRounded: roundCurrency(baseDistance),
      roundedExtraKm: 0,
      mode,
      baseFee,
      extraFee: 0,
    };
  }

  const extraKm = normalizedDistance - baseDistance;
  const roundedExtraKm = ceilKm(extraKm);
  const extraFee = roundCurrency(roundedExtraKm * surcharge);
  let total = addMoney(baseFee, extraFee);

  if (hasFreeDelivery) {
    total = 0;
  }

  return {
    deliveryFeeCharged: total,
    distanceKmActual: normalizedDistance,
    distanceKmRounded: roundCurrency(baseDistance + roundedExtraKm),
    roundedExtraKm,
    mode,
    baseFee,
    extraFee,
  };
}

export function calculateRiderPayout(distanceKm, deliverySettings) {
  const mode =
    deliverySettings.deliveryPricingMode || DELIVERY_PRICING_MODE.DISTANCE_BASED;
  const actualDistance = Number(distanceKm || 0);
  const normalizedDistance = Number.isFinite(actualDistance)
    ? Math.max(actualDistance, 0)
    : 0;

  const riderBase = roundCurrency(deliverySettings.riderBasePayout ?? deliverySettings.customerBaseDeliveryFee ?? 0);
  const baseDistance = Math.max(Number(deliverySettings.baseDistanceCapacityKm || 0), 0);
  const perExtraKm = roundCurrency(deliverySettings.deliveryPartnerRatePerKm ?? 0);

  if (mode === DELIVERY_PRICING_MODE.FIXED_PRICE || normalizedDistance <= baseDistance) {
    return {
      riderPayoutBase: riderBase,
      riderPayoutDistance: 0,
      riderPayoutBonus: 0,
      riderPayoutTotal: riderBase,
      roundedExtraKm: 0,
    };
  }

  const extraKm = normalizedDistance - baseDistance;
  const roundedExtraKm = ceilKm(extraKm);
  const riderDistance = roundCurrency(roundedExtraKm * perExtraKm);
  const riderTotal = addMoney(riderBase, riderDistance);

  return {
    riderPayoutBase: riderBase,
    riderPayoutDistance: riderDistance,
    riderPayoutBonus: 0,
    riderPayoutTotal: riderTotal,
    roundedExtraKm,
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
    .select("_id name salePrice price mainImage headerId sellerId status approvalStatus variants deliveryType weight")
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

    return {
      productId,
      productName: item.name || product.name,
      quantity,
      price: inferredUnitPrice,
      image: item.image || product.mainImage,
      headerCategoryId: String(product.headerId),
      sellerId: String(product.sellerId),
      variantSku: rawVariantSku || "",
      variantName: resolvedVariant ? String(resolvedVariant?.name || "").trim() : "",
      deliveryType: product.deliveryType || "instant",
      weight: product.weight || "",
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
    sellerConfig = await Seller.findById(sellerIds[0]).select("commissionModel oneTimeChargePaid categoryCommissionOverrides").lean();
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

  let delivery;
  let rider;
  const isScheduled = normalizedItems.some(item => item.deliveryType === "scheduled");

  if (isScheduled) {
    let totalWeightKg = 0;
    for (const item of normalizedItems) {
      const wStr = item.weight || "";
      let wVal = parseFloat(String(wStr).replace(/[^\d.]/g, ""));
      if (!Number.isFinite(wVal) || wVal <= 0) wVal = 0.5;
      if (String(wStr).toLowerCase().includes("gm") || String(wStr).toLowerCase().includes("gram")) {
        wVal = wVal / 1000;
      }
      totalWeightKg += wVal * item.quantity;
    }

    let deliveryFee = 0;
    if (!hasFreeDelivery) {
      if (totalWeightKg <= 0.5) {
        deliveryFee = 60;
      } else {
        deliveryFee = 60 + Math.ceil((totalWeightKg - 0.5) / 0.5) * 40;
      }
    }

    delivery = {
      deliveryFeeCharged: deliveryFee,
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
    delivery = calculateCustomerDeliveryFee(distanceKm, effectiveSettings, hasFreeDelivery);
    rider = {
      riderPayoutBase: 0,
      riderPayoutDistance: 0,
      riderPayoutBonus: 0,
      riderPayoutTotal: 0,
      roundedExtraKm: 0,
    };
  }

  // Calculate Product Subtotal
  let productSubtotal = 0;
  for (const item of normalizedItems) {
    productSubtotal = addMoney(productSubtotal, roundCurrency(item.price * item.quantity));
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
  const isExempt = sellerConfig?.commissionModel === "ONE_TIME" && sellerConfig?.oneTimeChargePaid;

  const categoryConfig = normalizedItems.length > 0 && normalizedItems[0].headerCategoryId
    ? categoryById.get(String(normalizedItems[0].headerCategoryId))
    : null;

  const categoryCommissionVal = categoryConfig
    ? (categoryConfig.adminCommissionValue ?? categoryConfig.adminCommission ?? 0)
    : 0;

  const adminCommPercent = categoryCommissionVal > 0
    ? categoryCommissionVal
    : (effectiveSettings.adminCommissionPercent ?? 0);

  const totalCommissionPercent = isExempt
    ? 0
    : (adminCommPercent +
       (effectiveSettings.technicalChargePercent ?? 0) +
       (effectiveSettings.subAdminCommissionPercent ?? 0) +
       (effectiveSettings.fieldWorkerCommissionPercent ?? 0) +
       (effectiveSettings.advertiseChargePercent ?? 0) +
       (effectiveSettings.otherMaintenancePercent ?? 0) +
       (effectiveSettings.affiliateMarketingPercent ?? 0) +
       (effectiveSettings.directSlabCommissionPercent ?? 0) +
       (effectiveSettings.siteCashbackPercent ?? 0));

  const totalCommissionAmount = roundCurrency((commissionBase * totalCommissionPercent) / 100);

  const commissionBreakdown = {
    adminCommissionPercent: adminCommPercent,
    adminCommissionAmount: isExempt ? 0 : roundCurrency((commissionBase * adminCommPercent) / 100),
    
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

  const lineItems = normalizedItems.map((item) => {
    const category = categoryById.get(String(item.headerCategoryId));
    const itemSubtotal = roundCurrency(item.price * item.quantity);
    
    const itemShippingProportion = productSubtotal > 0 ? (itemSubtotal / productSubtotal) * shippingChargeToDeduct : 0;
    const itemCommissionBase = Math.max(itemSubtotal - itemShippingProportion, 0);
    const itemCommission = isExempt ? 0 : roundCurrency((itemCommissionBase * totalCommissionPercent) / 100);
    const itemSellerPayout = Math.max(itemSubtotal - itemCommission, 0);

    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.price,
      itemSubtotal,
      sellerPayout: itemSellerPayout,
      adminProductCommission: itemCommission,
      headerCategoryId: item.headerCategoryId,
      headerCategoryName: category?.name || "Unknown",
      appliedCommissionType: isExempt ? "one_time_exempt" : "global_slab",
      appliedCommissionValue: isExempt ? 0 : totalCommissionPercent,
      appliedCommissionFixedRule: "percentage",
    };
  });

  let handling = calculateHandlingFee(normalizedItems, {
    handlingFeeStrategy: effectiveHandlingStrategy,
    categoryById,
  });
  if (hasFreeHandling) {
    handling.handlingFeeCharged = 0;
  }

  const finalDiscountTotal = roundCurrency(discountTotal + membershipDiscountAmount);
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
  });

  const adminProductCommissionTotal = totalCommissionAmount;
  const {
    sellerDeliveryFeeShare,
    adminDeliveryFeeShare,
    platformLogisticsMargin,
    platformTotalEarning,
    riderPayoutTotal,
  } = logisticsEarnings;

  const sellerPayoutTotal = roundCurrency(
    Math.max(productSubtotal - totalCommissionAmount, 0) + sellerDeliveryFeeShare,
  );

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
    handlingFeeCharged: handling.handlingFeeCharged,
    tipTotal: normalizedTip,
    discountTotal: finalDiscountTotal,
    taxTotal: normalizedTax,
    grandTotal,
    sellerPayoutTotal,
    adminProductCommissionTotal,
    sellerDeliveryFeeShare,
    adminDeliveryFeeShare,
    riderPayoutBase: 0,
    riderPayoutDistance: 0,
    riderPayoutBonus: 0,
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
