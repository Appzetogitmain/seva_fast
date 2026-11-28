import {
  resolveSellerOrderEarning,
  splitDeliveryFee,
} from "../services/finance/pricingService.js";
import { roundCurrency } from "./money.js";

function buildCustomerBill(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemsSubtotal = items.reduce(
    (sum, item) =>
      sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );

  const subtotal = roundCurrency(
    Number(
      order?.pricing?.subtotal ??
        order?.paymentBreakdown?.productSubtotal ??
        itemsSubtotal,
    ),
  );
  const deliveryFee = roundCurrency(
    Number(
      order?.pricing?.deliveryFee ??
        order?.paymentBreakdown?.deliveryFeeCharged ??
        0,
    ),
  );
  const platformFee = roundCurrency(
    Number(
      order?.pricing?.platformFee ??
        order?.paymentBreakdown?.handlingFeeCharged ??
        0,
    ),
  );
  const gst = roundCurrency(
    Number(order?.pricing?.gst ?? order?.paymentBreakdown?.taxTotal ?? 0),
  );
  const discount = roundCurrency(
    Number(
      order?.pricing?.discount ?? order?.paymentBreakdown?.discountTotal ?? 0,
    ),
  );
  const tip = roundCurrency(
    Number(order?.pricing?.tip ?? order?.paymentBreakdown?.tipTotal ?? 0),
  );

  let grandTotal = roundCurrency(
    Number(order?.pricing?.total ?? order?.paymentBreakdown?.grandTotal ?? 0),
  );
  if (!grandTotal) {
    grandTotal = roundCurrency(
      Math.max(subtotal + deliveryFee + platformFee + gst + tip - discount, 0),
    );
  }

  return {
    subtotal,
    deliveryFee,
    platformFee,
    gst,
    discount,
    tip,
    grandTotal,
  };
}

/**
 * Seller-facing order payload: seller earning for internal view + customer bill for parcel invoice.
 * Strips raw pricing/paymentBreakdown fields.
 */
export function sanitizeOrderForSellerView(order) {
  if (!order || typeof order !== "object") return order;

  const earning = resolveSellerOrderEarning(order);
  const pb = order.paymentBreakdown || {};
  const deliveryFee = Number(
    order.pricing?.deliveryFee ?? pb.deliveryFeeCharged ?? 0,
  );
  const riderPayoutTotal = Number(pb.riderPayoutTotal ?? 0);
  const sellerDeliveryFeeShare =
    pb.sellerDeliveryFeeShare != null
      ? roundCurrency(pb.sellerDeliveryFeeShare)
      : splitDeliveryFee(deliveryFee, riderPayoutTotal, {
          deliveryType: order.deliveryType,
          deliveryFeeBase: pb.deliveryFeeBase,
        }).sellerDeliveryFeeShare;
  const shippingCharge = roundCurrency(
    pb.sellerShippingChargesTotal ?? pb.shiprocketShippingCharge ?? 0,
  );
  const productEarning = roundCurrency(
    Math.max(
      Number(pb.productSubtotal ?? order.pricing?.subtotal ?? 0) -
        Number(pb.adminProductCommissionTotal || 0),
      0,
    ),
  );
  const shippingChargeLines = (pb.shippingCharges || [])
    .filter((e) => e.bearer === "SELLER")
    .map((e) => ({
      kind: e.kind,
      amount: roundCurrency(e.amount),
      courierName: e.courierName || null,
      source: e.source || null,
      appliedAt: e.appliedAt || null,
    }));
  const customerBill = buildCustomerBill(order);

  const { pricing: _pricing, paymentBreakdown: _paymentBreakdown, ...rest } =
    order;

  return {
    ...rest,
    sellerEarning: earning,
    sellerEarningBreakdown: {
      productEarning,
      deliveryShare: sellerDeliveryFeeShare,
      shippingCharge,
      shippingChargeLines,
      shippingChargeSource: pb.shiprocketShippingChargeSource || null,
      shippingRecoveredFromWallet: roundCurrency(pb.sellerShippingRecoveredFromWallet || 0),
      shippingDueOutstanding: roundCurrency(pb.sellerShippingDueOutstanding || 0),
      adminCommission: roundCurrency(pb.adminProductCommissionTotal || 0),
      productSubtotal: roundCurrency(pb.productSubtotal ?? order.pricing?.subtotal ?? 0),
      totalCostPrice: roundCurrency(pb.totalCostPrice || 0),
      sellerNetProfit: pb.sellerNetProfit != null ? roundCurrency(pb.sellerNetProfit) : null,
      isPanIndia: order.deliveryType === "scheduled",
      total: earning,
    },
    customerBill,
  };
}

export function sanitizeOrdersForSellerView(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.map(sanitizeOrderForSellerView);
}
