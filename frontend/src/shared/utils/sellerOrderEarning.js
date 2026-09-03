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
  // Match backend's splitDeliveryFee (pricingService.js): the rider is paid
  // out of the delivery fee FIRST, and only what's left after that is split
  // 80/20 between seller and admin. Subtracting the rider's cut before
  // applying the seller's share avoids overstating what the seller is owed.
  const riderPayoutTotal = Number(order.paymentBreakdown?.riderPayoutTotal ?? 0);
  const remainingDeliveryFee = Math.max(
    roundMoney(deliveryFee) - roundMoney(riderPayoutTotal),
    0,
  );
  const sellerDeliveryShare = roundMoney(remainingDeliveryFee * DELIVERY_FEE_SELLER_SHARE);
  const productEarning = Math.max(subtotal - commission, 0);

  return roundMoney(productEarning + sellerDeliveryShare);
}

export function getSellerEarningBreakdown(order) {
  const total = getSellerOrderEarning(order);
  const deliveryFee = Number(
    order?.pricing?.deliveryFee ?? order?.paymentBreakdown?.deliveryFeeCharged ?? 0,
  );
  const deliveryShare = roundMoney(deliveryFee * DELIVERY_FEE_SELLER_SHARE);
  const productEarning = roundMoney(Math.max(total - deliveryShare, 0));

  const items = Array.isArray(order?.items) ? order.items : (order?.paymentBreakdown?.lineItems || []);
  const itemsSubtotal = items.reduce((sum, item) => {
    const price = Number(item?.price ?? item?.unitPrice ?? 0);
    const qty = Number(item?.qty ?? item?.quantity ?? 1);
    return sum + (Number.isFinite(price) && Number.isFinite(qty) ? price * qty : 0);
  }, 0);
  const productSubtotal = Number(
    order?.pricing?.subtotal ?? order?.paymentBreakdown?.productSubtotal ?? itemsSubtotal,
  );

  const adminCommission = Number(
    order?.paymentBreakdown?.adminProductCommissionTotal ?? Math.max(productSubtotal - productEarning, 0),
  );

  let totalCostPrice = Number(order?.paymentBreakdown?.totalCostPrice ?? 0);
  if (!totalCostPrice && items.length > 0) {
    totalCostPrice = items.reduce((sum, item) => {
      const cost = Number(item?.costPrice || 0);
      const qty = Number(item?.qty ?? item?.quantity ?? 1);
      return sum + (Number.isFinite(cost) && Number.isFinite(qty) ? cost * qty : 0);
    }, 0);
  }
  totalCostPrice = roundMoney(totalCostPrice);

  let sellerNetProfit = Number(order?.paymentBreakdown?.sellerNetProfit);
  if (!Number.isFinite(sellerNetProfit)) {
    sellerNetProfit = roundMoney(total - totalCostPrice);
  } else {
    sellerNetProfit = roundMoney(sellerNetProfit);
  }

  const profitMarginPercent = total > 0 ? roundMoney((sellerNetProfit / total) * 100) : 0;

  return {
    total,
    deliveryShare,
    productEarning,
    productSubtotal: roundMoney(productSubtotal),
    adminCommission: roundMoney(adminCommission),
    totalCostPrice,
    sellerNetProfit,
    profitMarginPercent,
  };
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
