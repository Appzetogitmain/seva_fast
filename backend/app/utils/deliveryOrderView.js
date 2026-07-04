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
    },
    paymentBreakdown: order.paymentBreakdown
      ? {
          grandTotal: Number(order.paymentBreakdown.grandTotal) || total,
          walletAmount:
            Number(order.paymentBreakdown.walletAmount) || walletAmount,
        }
      : undefined,
  };
}

export function sanitizeOrdersForDeliveryView(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.map(sanitizeOrderForDeliveryView);
}
