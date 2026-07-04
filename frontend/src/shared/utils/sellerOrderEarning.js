const DELIVERY_FEE_SELLER_SHARE = 0.8;



export function getSellerOrderEarning(order) {

  if (!order) return 0;



  const direct = Number(order.sellerEarning);

  if (Number.isFinite(direct) && direct >= 0) {

    return Math.round(direct * 100) / 100;

  }



  const fromApiBreakdown = Number(order.sellerEarningBreakdown?.total);

  if (Number.isFinite(fromApiBreakdown) && fromApiBreakdown >= 0) {

    return Math.round(fromApiBreakdown * 100) / 100;

  }



  const fromPayout = Number(order.paymentBreakdown?.sellerPayoutTotal);

  if (Number.isFinite(fromPayout) && fromPayout >= 0) {

    return Math.round(fromPayout * 100) / 100;

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

  const sellerDeliveryShare = Math.round(deliveryFee * DELIVERY_FEE_SELLER_SHARE * 100) / 100;

  const productEarning = Math.max(subtotal - commission, 0);



  return Math.round((productEarning + sellerDeliveryShare) * 100) / 100;

}



export function getSellerEarningBreakdown(order) {

  const api = order?.sellerEarningBreakdown;

  if (api && Number.isFinite(Number(api.total))) {

    return {

      total: Math.round(Number(api.total) * 100) / 100,

      deliveryShare: Math.round(Number(api.deliveryShare || 0) * 100) / 100,

      productEarning: Math.round(Number(api.productEarning || 0) * 100) / 100,

    };

  }



  const total = getSellerOrderEarning(order);

  const deliveryFee = Number(

    order?.pricing?.deliveryFee ?? order?.paymentBreakdown?.deliveryFeeCharged ?? 0,

  );

  const deliveryShare = Math.round(deliveryFee * DELIVERY_FEE_SELLER_SHARE * 100) / 100;

  const productEarning = Math.round(Math.max(total - deliveryShare, 0) * 100) / 100;



  return { total, deliveryShare, productEarning };

}

