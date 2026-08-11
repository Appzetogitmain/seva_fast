import axiosInstance from "@core/api/axios";
import { getWithDedupe, invalidateCache } from "@core/api/dedupe";

export const customerApi = {
  sendLoginOtp: (data) => axiosInstance.post("/customer/send-login-otp", data),
  sendSignupOtp: (data) =>
    axiosInstance.post("/customer/send-signup-otp", data),
  verifyOtp: (data) => axiosInstance.post("/customer/verify-otp", data),
  getFirstOrderEligibility: () => getWithDedupe("/customer/first-order-eligibility", {}, { ttl: 5000 }),
  getProfile: () => getWithDedupe("/customer/profile", {}, { ttl: 5000 }), // Short cache for profile
  updateProfile: (data) => {
    invalidateCache("/customer/profile");
    return axiosInstance.put("/customer/profile", data);
  },
  getWalletTransactions: (params) =>
    getWithDedupe("/customer/transactions", params),
  getReferralTree: () => getWithDedupe("/customer/referrals/tree"),
  getCategories: (params) =>
    getWithDedupe("/categories", params, { ttl: 60 * 1000 }), // 1 min for categories
  getProducts: (params) => getWithDedupe("/products", params),
  getProductById: (id, params) => getWithDedupe(`/products/${id}`, params),

  // Sellers & Location
  getNearbySellers: (params) => getWithDedupe("/seller/nearby", params),

  // Cart
  getCart: () => getWithDedupe("/cart", {}, { ttl: 2000 }), // Very short cache for cart
  addToCart: (data) => {
    invalidateCache("/cart"); // Invalidate cart cache
    return axiosInstance.post("/cart/add", data);
  },
  updateCartQuantity: (data) => {
    invalidateCache("/cart");
    return axiosInstance.put("/cart/update", data);
  },
  removeFromCart: (productId, variantSku = "") => {
    invalidateCache("/cart");
    const params = {};
    const normalizedVariantSku = String(variantSku || "").trim();
    if (normalizedVariantSku) params.variantSku = normalizedVariantSku;
    return axiosInstance.delete(`/cart/remove/${productId}`, { params });
  },
  clearCart: () => {
    invalidateCache("/cart");
    return axiosInstance.delete("/cart/clear");
  },

  // Wishlist
  getWishlist: (params) => getWithDedupe("/wishlist", params, { ttl: 5000 }),
  addToWishlist: (data) => {
    invalidateCache("/wishlist");
    return axiosInstance.post("/wishlist/add", data);
  },
  toggleWishlist: (data) => {
    invalidateCache("/wishlist");
    return axiosInstance.post("/wishlist/toggle", data);
  },
  removeFromWishlist: (productId) => {
    invalidateCache("/wishlist");
    return axiosInstance.delete(`/wishlist/remove/${productId}`);
  },

  // Orders
  // Explicit timeout so checkout never waits forever if the server blocks (e.g. Redis/Bull).
  checkoutPreview: (data) =>
    axiosInstance.post("/orders/checkout/preview", data, { timeout: 120000 }),
  createOrder: (data) => {
    invalidateCache("/orders/my-orders");
    return axiosInstance.post("/orders", data, { timeout: 120000 });
  },
  verifyOnlineOrderPayment: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/payment/verify-online`, data),
  markOrderDelivered: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/delivered`, data || {}),
  markOrderCodCollected: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/cod/mark-collected`, data || {}),
  reconcileOrderCod: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/cod/reconcile`, data),
  placeOrder: (data) => {
    invalidateCache("/orders/my-orders");
    return axiosInstance.post("/orders/place", data, { timeout: 120000 });
  },
  getMyOrders: () => getWithDedupe("/orders/my-orders", {}, { ttl: 0 }),
  /**
   * Order details must reflect live workflow, but we still dedupe in-flight requests to avoid
   * network spam when multiple effects/events trigger refresh simultaneously.
   * ttl=0 means "no caching" (only in-flight dedupe).
   */
  getOrderDetails: (orderId) =>
    getWithDedupe(
      `/orders/details/${encodeURIComponent(String(orderId ?? "").trim())}`,
      {},
      { ttl: 0 },
    ),
  getOrderRoute: (orderId, params) =>
    axiosInstance.get(`/orders/workflow/${orderId}/route`, { params }),
  cancelOrder: (orderId, data) =>
    axiosInstance.put(`/orders/cancel/${orderId}`, data),
  requestReturn: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/returns`, data),
  getReturnDetails: (orderId) =>
    axiosInstance.get(`/orders/${encodeURIComponent(String(orderId ?? "").trim())}/returns`),

  // Payments
  createPaymentOrder: (data) =>
    axiosInstance.post("/payments/create-order", data),
  getRazorpayConfig: () => axiosInstance.get("/payments/razorpay-config"),
  verifyPaymentClient: (data) =>
    axiosInstance.post("/payments/verify", data),
  verifyPaymentStatus: (id) => axiosInstance.get(`/payments/status/${id}`),

  // Support & Reviews
  getProductReviews: (productId) =>
    getWithDedupe(`/reviews/product/${productId}`),
  canReviewProduct: (productId) =>
    getWithDedupe(`/reviews/can-review/${productId}`, {}, { ttl: 0 }),
  getMyReviewsForOrder: (orderId) =>
    axiosInstance.get(`/reviews/my-order/${encodeURIComponent(String(orderId ?? "").trim())}`),
  submitReview: (data) => axiosInstance.post("/reviews/submit", data),
  createTicket: (data) => axiosInstance.post("/tickets/create", data),
  getMyTickets: () => getWithDedupe("/tickets/my-tickets"),
  replyTicket: (ticketId, text, options = {}) => {
    const {
      mediaUrl = "",
      mediaType = "",
      mimeType = "",
    } = options || {};

    return axiosInstance.post(`/tickets/reply/${encodeURIComponent(String(ticketId))}`, {
      text,
      isAdmin: false,
      mediaUrl,
      mediaType,
      mimeType,
    });
  },

  // Experience sections (home / header pages)
  getExperienceSections: (params) => getWithDedupe("/experience", params),

  // Hero config (separate hero banners + categories per page; fallback to home)
  getHeroConfig: (params) =>
    getWithDedupe("/experience/hero", params, { ttl: 60 * 1000 }),

  // Public offers
  getOffers: () => getWithDedupe("/offers"),
  // Offer sections (category → products, banner + side image)
  getOfferSections: (params) => getWithDedupe("/offer-sections", params),

  // Coupons
  validateCoupon: (data) => axiosInstance.post("/coupons/validate", data),
  getActiveCoupons: () => getWithDedupe("/coupons", { status: "active" }),

  // Maps (server-side geocoding)
  geocodeAddress: (address, params = {}) =>
    axiosInstance.get("/maps/geocode", { params: { address, ...params } }),
  geocodePlaceId: (placeId, params = {}) =>
    axiosInstance.get("/maps/geocode", { params: { placeId, ...params } }),
  reverseGeocode: (lat, lng, params = {}) =>
    axiosInstance.get("/maps/reverse-geocode", { params: { lat, lng, ...params } }),

  // Push (FCM) test
  testPushNotification: () => axiosInstance.post("/push/test"),
  getTestPushNotificationStatus: (orderId) =>
    axiosInstance.get(`/push/test-status/${encodeURIComponent(String(orderId || "").trim())}`),

  // Plans
  getPlans: (options = {}) => getWithDedupe("/plans", {}, options),
  initiatePlanSubscription: (data) => axiosInstance.post("/plans/subscribe/initiate", data),
  verifyPlanPayment: (data) => axiosInstance.post("/plans/subscribe/verify", data),

  // Professional Ads & Public Search
  getProfessionalCategories: () => getWithDedupe("/professionals/categories", {}, { ttl: 60 * 1000 }),
  searchProfessionals: (params) => getWithDedupe("/professionals/search", params),
  getProfessionalProfile: () => axiosInstance.get("/professionals/profile"),
  createProfessionalProfile: (data) => axiosInstance.post("/professionals/profile", data),
  updateProfessionalProfile: (data) => axiosInstance.put("/professionals/profile", data),
  updateProfessionalServices: (data) => axiosInstance.put("/professionals/profile/services", data),
  payProfessionalProfile: () => axiosInstance.post("/professionals/profile/pay"),
  initiatePayProfessionalProfile: () => axiosInstance.post("/professionals/profile/pay/initiate"),
  verifyPayProfessionalProfile: (data) => axiosInstance.post("/professionals/profile/pay/verify", data),
  uploadMedia: (formData) => axiosInstance.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
  }),

  createPlatformAd: (data) => axiosInstance.post("/professionals/platform-ads", data),
  updatePlatformAd: (id, data) => axiosInstance.put(`/professionals/platform-ads/${id}`, data),
  getMyPlatformAds: () => axiosInstance.get("/professionals/platform-ads"),
  payPlatformAd: (id) => axiosInstance.post(`/professionals/platform-ads/${id}/pay`),
  initiatePayPlatformAd: (id) => axiosInstance.post(`/professionals/platform-ads/${id}/pay/initiate`),
  verifyPayPlatformAd: (id, data) => axiosInstance.post(`/professionals/platform-ads/${id}/pay/verify`, data),
  getActivePlatformAds: (params) => axiosInstance.get("/professionals/platform-ads/active", { params }),

  // Product Demands
  registerProductDemand: (data) => axiosInstance.post("/product-demands/register", data),
};
