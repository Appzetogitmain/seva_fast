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
    // Bug 222: Include distance/time for history cards
    distanceKm: order.distanceKm ?? order.routeDistanceKm ?? null,
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
