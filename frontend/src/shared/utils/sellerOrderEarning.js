const DELIVERY_FEE_SELLER_SHARE = 0.8;

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function getSellerOrderEarning(order) {
  if (!order) return 0;

  const direct = Number(order.sellerEarning);
  if (Number.isFinite(direct) && direct >= 0) {
    return roundMoney(direct);
  }

  const fromApiBreakdown = Number(order.sellerEarningBreakdown?.total);
  if (Number.isFinite(fromApiBreakdown) && fromApiBreakdown >= 0) {
    return roundMoney(fromApiBreakdown);
  }

  const fromPayout = Number(order.paymentBreakdown?.sellerPayoutTotal);
  if (Number.isFinite(fromPayout) && fromPayout >= 0) {
    return roundMoney(fromPayout);
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
  const sellerDeliveryShare = roundMoney(deliveryFee * DELIVERY_FEE_SELLER_SHARE);
  const productEarning = Math.max(subtotal - commission, 0);

  return roundMoney(productEarning + sellerDeliveryShare);
}

export function getSellerEarningBreakdown(order) {
  const api = order?.sellerEarningBreakdown;
  if (api && Number.isFinite(Number(api.total))) {
    return {
      total: roundMoney(api.total),
      deliveryShare: roundMoney(api.deliveryShare || 0),
      productEarning: roundMoney(api.productEarning || 0),
    };
  }

  const total = getSellerOrderEarning(order);
  const deliveryFee = Number(
    order?.pricing?.deliveryFee ?? order?.paymentBreakdown?.deliveryFeeCharged ?? 0,
  );
  const deliveryShare = roundMoney(deliveryFee * DELIVERY_FEE_SELLER_SHARE);
  const productEarning = roundMoney(Math.max(total - deliveryShare, 0));

  return { total, deliveryShare, productEarning };
}

export function getCustomerOrderBill(order) {
  if (!order) {
    return {
      subtotal: 0,
      deliveryFee: 0,
      platformFee: 0,
      gst: 0,
      discount: 0,
      tip: 0,
      grandTotal: 0,
    };
  }

  if (order.customerBill) {
    return {
      subtotal: roundMoney(order.customerBill.subtotal),
      deliveryFee: roundMoney(order.customerBill.deliveryFee),
      platformFee: roundMoney(order.customerBill.platformFee),
      gst: roundMoney(order.customerBill.gst),
      discount: roundMoney(order.customerBill.discount),
      tip: roundMoney(order.customerBill.tip),
      grandTotal: roundMoney(order.customerBill.grandTotal),
    };
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsSubtotal = items.reduce((sum, item) => {
    const price = Number(item?.price || 0);
    const qty = Number(item?.qty ?? item?.quantity ?? 0);
    return sum + (Number.isFinite(price) && Number.isFinite(qty) ? price * qty : 0);
  }, 0);

  const subtotal = Number(
    order.pricing?.subtotal ?? order.paymentBreakdown?.productSubtotal ?? itemsSubtotal,
  );
  const deliveryFee = Number(
    order.pricing?.deliveryFee ?? order.paymentBreakdown?.deliveryFeeCharged ?? 0,
  );
  const platformFee = Number(
    order.pricing?.platformFee ?? order.paymentBreakdown?.handlingFeeCharged ?? 0,
  );
  const gst = Number(order.pricing?.gst ?? order.paymentBreakdown?.taxTotal ?? 0);
  const discount = Number(
    order.pricing?.discount ?? order.paymentBreakdown?.discountTotal ?? 0,
  );
  const tip = Number(order.pricing?.tip ?? order.paymentBreakdown?.tipTotal ?? 0);

  let grandTotal = Number(
    order.pricing?.total ?? order.paymentBreakdown?.grandTotal ?? 0,
  );
  if (!grandTotal) {
    grandTotal = Math.max(subtotal + deliveryFee + platformFee + gst + tip - discount, 0);
  }

  return {
    subtotal: roundMoney(subtotal),
    deliveryFee: roundMoney(deliveryFee),
    platformFee: roundMoney(platformFee),
    gst: roundMoney(gst),
    discount: roundMoney(discount),
    tip: roundMoney(tip),
    grandTotal: roundMoney(grandTotal),
  };
}
