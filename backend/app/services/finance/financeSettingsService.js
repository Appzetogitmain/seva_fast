import Setting from "../../models/setting.js";
import {
  DELIVERY_PRICING_MODE,
  HANDLING_FEE_STRATEGY,
} from "../../constants/finance.js";
import { roundCurrency } from "../../utils/money.js";

const DEFAULT_FINANCE_SETTINGS = {
  deliveryPricingMode: DELIVERY_PRICING_MODE.DISTANCE_BASED,
  customerBaseDeliveryFee: 30,
  riderBasePayout: 30,
  baseDistanceCapacityKm: 0.5,
  incrementalKmSurcharge: 10,
  deliveryPartnerRatePerKm: 5,
  fixedDeliveryFee: 30,
  minimumOrderValue: 0,
  freeDeliveryThreshold: 0,
  handlingFeeStrategy: HANDLING_FEE_STRATEGY.HIGHEST_CATEGORY_FEE,
  codEnabled: true,
  onlineEnabled: true,
  adminCommissionPercent: 5,
  technicalChargePercent: 5,
  subAdminCommissionPercent: 10,
  fieldWorkerCommissionPercent: 5,
  goldCardMemberDiscountPercent: 10,
  silverCardMemberDiscountPercent: 5,
  bronzeCardMemberDiscountPercent: 2.5,
  directSlabCommissionPercent: 25,
  deductShippingBeforeCommission: true,
  advertiseChargePercent: 5,
  siteCashbackPercent: 15,
  otherMaintenancePercent: 7.5,
  affiliateMarketingPercent: 5,
};

export function normalizeFinanceSettings(raw = {}) {
  const deliveryPricingMode =
    raw.deliveryPricingMode ||
    raw.pricingMode ||
    DEFAULT_FINANCE_SETTINGS.deliveryPricingMode;

  const customerBaseDeliveryFee = roundCurrency(
    raw.customerBaseDeliveryFee ?? raw.baseDeliveryCharge ?? DEFAULT_FINANCE_SETTINGS.customerBaseDeliveryFee,
  );

  const riderBasePayout = roundCurrency(
    raw.riderBasePayout ?? raw.baseDeliveryCharge ?? DEFAULT_FINANCE_SETTINGS.riderBasePayout,
  );

  const deliveryPartnerRatePerKm = roundCurrency(
    raw.deliveryPartnerRatePerKm ??
      raw.fleetCommissionRatePerKm ??
      DEFAULT_FINANCE_SETTINGS.deliveryPartnerRatePerKm,
  );

  const baseDistanceCapacityKm = Number(
    raw.baseDistanceCapacityKm ?? DEFAULT_FINANCE_SETTINGS.baseDistanceCapacityKm,
  );

  const incrementalKmSurcharge = roundCurrency(
    raw.incrementalKmSurcharge ?? DEFAULT_FINANCE_SETTINGS.incrementalKmSurcharge,
  );

  const fixedDeliveryFee = roundCurrency(
    raw.fixedDeliveryFee ?? raw.baseDeliveryCharge ?? customerBaseDeliveryFee,
  );

  const minimumOrderValue = roundCurrency(
    raw.minimumOrderValue ?? DEFAULT_FINANCE_SETTINGS.minimumOrderValue,
  );

  const freeDeliveryThreshold = roundCurrency(
    raw.freeDeliveryThreshold ?? DEFAULT_FINANCE_SETTINGS.freeDeliveryThreshold,
  );

  const handlingFeeStrategy =
    raw.handlingFeeStrategy || DEFAULT_FINANCE_SETTINGS.handlingFeeStrategy;

  return {
    deliveryPricingMode,
    pricingMode: deliveryPricingMode,
    customerBaseDeliveryFee,
    riderBasePayout,
    baseDeliveryCharge: customerBaseDeliveryFee,
    baseDistanceCapacityKm: Number.isFinite(baseDistanceCapacityKm)
      ? Math.max(baseDistanceCapacityKm, 0)
      : DEFAULT_FINANCE_SETTINGS.baseDistanceCapacityKm,
    incrementalKmSurcharge,
    deliveryPartnerRatePerKm,
    fleetCommissionRatePerKm: deliveryPartnerRatePerKm,
    fixedDeliveryFee,
    minimumOrderValue,
    freeDeliveryThreshold,
    handlingFeeStrategy,
    codEnabled: raw.codEnabled ?? DEFAULT_FINANCE_SETTINGS.codEnabled,
    onlineEnabled: raw.onlineEnabled ?? DEFAULT_FINANCE_SETTINGS.onlineEnabled,
    adminCommissionPercent: Number(raw.adminCommissionPercent ?? DEFAULT_FINANCE_SETTINGS.adminCommissionPercent),
    technicalChargePercent: Number(raw.technicalChargePercent ?? DEFAULT_FINANCE_SETTINGS.technicalChargePercent),
    subAdminCommissionPercent: Number(raw.subAdminCommissionPercent ?? DEFAULT_FINANCE_SETTINGS.subAdminCommissionPercent),
    fieldWorkerCommissionPercent: Number(raw.fieldWorkerCommissionPercent ?? DEFAULT_FINANCE_SETTINGS.fieldWorkerCommissionPercent),
    goldCardMemberDiscountPercent: Number(raw.goldCardMemberDiscountPercent ?? DEFAULT_FINANCE_SETTINGS.goldCardMemberDiscountPercent),
    silverCardMemberDiscountPercent: Number(raw.silverCardMemberDiscountPercent ?? DEFAULT_FINANCE_SETTINGS.silverCardMemberDiscountPercent),
    bronzeCardMemberDiscountPercent: Number(raw.bronzeCardMemberDiscountPercent ?? DEFAULT_FINANCE_SETTINGS.bronzeCardMemberDiscountPercent),
    directSlabCommissionPercent: Number(raw.directSlabCommissionPercent ?? DEFAULT_FINANCE_SETTINGS.directSlabCommissionPercent),
    deductShippingBeforeCommission: Boolean(raw.deductShippingBeforeCommission ?? DEFAULT_FINANCE_SETTINGS.deductShippingBeforeCommission),
    advertiseChargePercent: Number(raw.advertiseChargePercent ?? DEFAULT_FINANCE_SETTINGS.advertiseChargePercent),
    siteCashbackPercent: Number(raw.siteCashbackPercent ?? DEFAULT_FINANCE_SETTINGS.siteCashbackPercent),
    otherMaintenancePercent: Number(raw.otherMaintenancePercent ?? DEFAULT_FINANCE_SETTINGS.otherMaintenancePercent),
    affiliateMarketingPercent: Number(raw.affiliateMarketingPercent ?? DEFAULT_FINANCE_SETTINGS.affiliateMarketingPercent),
  };
}

export async function getOrCreateFinanceSettings({ session } = {}) {
  const query = {};
  const options = session ? { session } : {};
  let settings = await Setting.findOne(query, null, options);

  if (!settings) {
    settings = await Setting.create(
      {
        ...DEFAULT_FINANCE_SETTINGS,
        pricingMode: DEFAULT_FINANCE_SETTINGS.deliveryPricingMode,
        baseDeliveryCharge: DEFAULT_FINANCE_SETTINGS.customerBaseDeliveryFee,
        fleetCommissionRatePerKm: DEFAULT_FINANCE_SETTINGS.deliveryPartnerRatePerKm,
      },
      options,
    );
  }

  return normalizeFinanceSettings(settings.toObject?.() || settings);
}

export async function updateDeliveryFinanceSettings(payload, { session } = {}) {
  const normalized = normalizeFinanceSettings(payload || {});
  const query = {};
  const options = { upsert: true, new: true };
  if (session) options.session = session;

  const updated = await Setting.findOneAndUpdate(query, { $set: normalized }, options);
  return normalizeFinanceSettings(updated.toObject?.() || updated);
}

export { DEFAULT_FINANCE_SETTINGS };
