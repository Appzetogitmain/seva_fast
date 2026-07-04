import {
  resolveSellerOrderEarning,
  splitDeliveryFee,
} from "../services/finance/pricingService.js";
import { roundCurrency } from "./money.js";

/**
 * Seller-facing order payload: only product earning + 80% delivery share.
 * Strips customer bill totals (GST, platform fee, grand total, etc.).
 */
export function sanitizeOrderForSellerView(order) {
  if (!order || typeof order !== "object") return order;

  const earning = resolveSellerOrderEarning(order);
  const deliveryFee = Number(
    order.pricing?.deliveryFee ?? order.paymentBreakdown?.deliveryFeeCharged ?? 0,
  );
  const { sellerDeliveryFeeShare } = splitDeliveryFee(deliveryFee);
  const productEarning = roundCurrency(
    Math.max(earning - sellerDeliveryFeeShare, 0),
  );

  const { pricing: _pricing, paymentBreakdown: _paymentBreakdown, ...rest } =
    order;

  return {
    ...rest,
    sellerEarning: earning,
    sellerEarningBreakdown: {
      productEarning,
      deliveryShare: sellerDeliveryFeeShare,
      total: earning,
    },
  };
}

export function sanitizeOrdersForSellerView(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.map(sanitizeOrderForSellerView);
}
