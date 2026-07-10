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
  const deliveryFee = Number(
    order.pricing?.deliveryFee ?? order.paymentBreakdown?.deliveryFeeCharged ?? 0,
  );
  const { sellerDeliveryFeeShare } = splitDeliveryFee(deliveryFee);
  const productEarning = roundCurrency(
    Math.max(earning - sellerDeliveryFeeShare, 0),
  );
  const customerBill = buildCustomerBill(order);

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
    customerBill,
  };
}

export function sanitizeOrdersForSellerView(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.map(sanitizeOrderForSellerView);
}
