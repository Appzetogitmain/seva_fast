function stripItemPrices(item) {
  if (!item || typeof item !== "object") return item;

  const {
    price,
    mrp,
    salePrice,
    unitPrice,
    lineTotal,
    ...rest
  } = item;

  const cleaned = { ...rest };
  if (cleaned.product && typeof cleaned.product === "object") {
    const {
      price: _productPrice,
      salePrice: _productSalePrice,
      mrp: _productMrp,
      ...productRest
    } = cleaned.product;
    cleaned.product = productRest;
  }

  return cleaned;
}

export function sanitizeOrderForDeliveryView(order) {
  if (!order || typeof order !== "object") return order;

  // Actual pickup->drop distance, computed once at checkout and frozen here —
  // distanceKm/routeDistanceKm were never real fields on the Order schema, so
  // this always resolved to null before.
  const resolvedDistanceKm =
    order.distanceSnapshot?.distanceKmRounded ??
    order.distanceSnapshot?.distanceKmActual ??
    order.paymentBreakdown?.distanceKmRounded ??
    order.paymentBreakdown?.distanceKmActual ??
    null;

  const total =
    Number(order.pricing?.total) ||
    Number(order.paymentBreakdown?.grandTotal) ||
    0;
  const walletAmount =
    Number(order.pricing?.walletAmount) ||
    Number(order.paymentBreakdown?.walletAmount) ||
    0;

  const finalAmountToPay =
    Number(order.pricing?.finalAmountToPay) ||
    Number(order.paymentBreakdown?.finalAmountToPay) ||
    Math.max(0, total - walletAmount);

  return {
    ...order,
    items: Array.isArray(order.items)
      ? order.items.map(stripItemPrices)
      : order.items,
    returnItems: Array.isArray(order.returnItems)
      ? order.returnItems.map(stripItemPrices)
      : order.returnItems,
    pricing: {
      total,
      walletAmount,
      finalAmountToPay,
    },
    paymentBreakdown: order.paymentBreakdown
      ? {
          grandTotal: Number(order.paymentBreakdown.grandTotal) || total,
          walletAmount:
            Number(order.paymentBreakdown.walletAmount) || walletAmount,
          finalAmountToPay,
        }
      : undefined,
    // What this delivery partner actually earns for a regular (non-return)
    // delivery, per the admin-configured slab structure. Exposed as its own
    // flat field since paymentBreakdown above is deliberately stripped down
    // to customer-facing totals only.
    riderEarnings: (Number.isFinite(Number(order.paymentBreakdown?.riderPayoutTotal)) && Number(order.paymentBreakdown?.riderPayoutTotal) > 0)
      ? Number(order.paymentBreakdown.riderPayoutTotal)
      : Math.round(30 + Math.max(0, Number(resolvedDistanceKm ?? 0) - 0.5) * 5),
    // COD cash breakdown, exposed as flat fields for the same reason as
    // riderEarnings (paymentBreakdown above is stripped down). Note
    // codCollectedAmount is net of the rider's own commission (what actually
    // enters the system float) — use paymentBreakdown.grandTotal for the
    // full gross amount the customer paid.
    codCollectedAmount: Number(order.paymentBreakdown?.codCollectedAmount) || 0,
    codRemittedAmount: Number(order.paymentBreakdown?.codRemittedAmount) || 0,
    codPendingAmount: Number(order.paymentBreakdown?.codPendingAmount) || 0,
    // Bug 222: Include distance/time for history cards
    distanceKm: resolvedDistanceKm,
    estimatedMinutes: order.estimatedMinutes ?? order.routeEstimatedMinutes ?? null,
    // Bug 231/230: Include return fields
    returnStatus: order.returnStatus,
    returnDeliveryCommission: order.returnDeliveryCommission ?? null,
  };
}

export function sanitizeOrdersForDeliveryView(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.map(sanitizeOrderForDeliveryView);
}
