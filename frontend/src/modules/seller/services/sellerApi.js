import axiosInstance from '@core/api/axios';

export const sellerApi = {
    login: (data) => axiosInstance.post('/seller/login', data),
    signup: (data) => axiosInstance.post('/seller/signup', data),
    sendVerificationOtp: (data) => axiosInstance.post('/seller/verification/send-otp', data),
    verifyVerificationOtp: (data) => axiosInstance.post('/seller/verification/verify-otp', data),
    // Products
    getProducts: (params) => axiosInstance.get('/products/seller/me', { params }),
    getProductById: (id) => axiosInstance.get(`/products/${id}`),
    createProduct: (data) => axiosInstance.post('/products', data),
    updateProduct: (id, data) => axiosInstance.put(`/products/${id}`, data),
    deleteProduct: (id) => axiosInstance.delete(`/products/${id}`),
    downloadBulkTemplate: () =>
        axiosInstance.get('/products/bulk/template', { responseType: 'blob' }),
    bulkUploadProducts: (formData) =>
        axiosInstance.post('/products/bulk', formData),

    // Categories (Public)
    getCategories: () => axiosInstance.get('/admin/categories'),
    getCategoryTree: () => axiosInstance.get('/admin/categories?tree=true'),

    // Others
    getStats: (range) => axiosInstance.get('/seller/stats', { params: { range } }),
    getOrders: (params) => axiosInstance.get('/orders/seller-orders', { params }),
    updateOrderStatus: (orderId, data) => axiosInstance.put(`/orders/status/${orderId}`, data),
    getEarnings: () => axiosInstance.get('/seller/earnings'),
    getWalletSummary: () => axiosInstance.get('/seller/wallet/summary'),
    getProfile: () => axiosInstance.get('/seller/profile'),
    updateProfile: (data) => axiosInstance.put('/seller/profile', data),
    acceptCertificate: () => axiosInstance.post('/seller/accept-certificate'),
    getCodCashSummary: () => axiosInstance.get('/seller/cod/summary'),
    payCodCashToAdmin: (data) => axiosInstance.post('/seller/cod/pay', data),

    // Stock
    adjustStock: (data) => axiosInstance.post('/products/adjust-stock', data),
    getStockHistory: () => axiosInstance.get('/products/stock-history'),

    // Notifications
    getNotifications: () => axiosInstance.get('/notifications'),
    markNotificationRead: (id) => axiosInstance.put(`/notifications/${id}/read`),
    markAllNotificationsRead: () => axiosInstance.put('/notifications/mark-all-read'),

    // Money Requests
    requestWithdrawal: (data) => axiosInstance.post('/seller/request-withdrawal', data),

    // Returns
    getReturns: (params) => axiosInstance.get('/orders/seller-returns', { params }),
    getReturnDetails: (orderId) => axiosInstance.get(`/orders/${orderId}/returns`),
    approveReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/approve`, data),
    rejectReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/reject`, data),
    assignReturnDelivery: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/assign-delivery`, data),
    submitReturnSelfCollection: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/self-collect`, data),

    // Delivery Boys — platform-wide pool, GPS/availability filtered near this seller
    getAvailableRiders: () => axiosInstance.get('/orders/available-riders'),

    // Subscription Plans
    getPlans: () => axiosInstance.get('/seller/plans'),
    initiatePlanPurchase: (data) => axiosInstance.post('/seller/plans/subscribe/initiate', data),
    verifyPlanPurchase: (data) => axiosInstance.post('/seller/plans/subscribe/verify', data),
    getSubscriptionStatus: () => axiosInstance.get('/seller/subscription-status'),
    switchToCategoryCommission: () => axiosInstance.post('/seller/switch-to-commission'),

    // Store Promotion / Ads
    getStorePromotionPlans: () => axiosInstance.get('/store-promotions/public'),
    initiateStorePromotionPurchase: (data) => axiosInstance.post('/store-promotions/subscribe/initiate', data),
    verifyStorePromotionPurchase: (data) => axiosInstance.post('/store-promotions/subscribe/verify', data),
    payStorePromotionWithWallet: (data) => axiosInstance.post('/store-promotions/subscribe/wallet', data),
    getMyStorePromotions: () => axiosInstance.get('/store-promotions/seller/my-promotions'),
    getStorePromotionStatus: () => axiosInstance.get('/store-promotions/seller/status'),

    // Product Demands
    getProductDemands: () => axiosInstance.get('/product-demands/seller'),
};

