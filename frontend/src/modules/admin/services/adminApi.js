import axiosInstance from '@core/api/axios';

export const adminApi = {
    login: (data) => axiosInstance.post('/admin/login', data),
    signup: (data) => axiosInstance.post('/admin/signup', data),
    getStats: () => axiosInstance.get('/admin/stats'),
    getUsers: (params) => axiosInstance.get('/admin/users', { params }),
    getUserById: (id) => axiosInstance.get(`/admin/users/${id}`),
    getUserReferralTree: (id) => axiosInstance.get(`/admin/users/${id}/referral-tree`),
    updateUserWallet: (id, data) => axiosInstance.put(`/admin/users/${id}/wallet`, data),
    getActiveSellers: (params) => axiosInstance.get('/admin/sellers/active', { params }),
    getSellerLocations: (params) => axiosInstance.get('/admin/sellers/locations', { params }),
    getPendingSellers: (params) => axiosInstance.get('/admin/sellers/pending', { params }),
    updateSellerDetails: (id, data) => axiosInstance.put(`/admin/sellers/${id}`, data),
    approveSeller: (id, data) => axiosInstance.patch(`/admin/sellers/approve/${id}`, data),
    rejectSeller: (id, data) => axiosInstance.delete(`/admin/sellers/reject/${id}`, { data }),
    uploadSellerKycDocument: (id, formData) =>
        axiosInstance.post(`/admin/sellers/${id}/kyc-document`, formData),
    deleteSeller: (id) => axiosInstance.delete(`/admin/sellers/${id}`),
    getAdminWalletData: (params) => axiosInstance.get('/admin/wallet-data', { params }),
    getReports: () => axiosInstance.get('/admin/reports'),
    getProfile: () => axiosInstance.get('/admin/profile'),
    updateProfile: (data) => axiosInstance.put('/admin/profile', data),
    updatePassword: (data) => axiosInstance.put('/admin/profile/password', data),
    getPlatformSettings: () => axiosInstance.get('/admin/settings/platform'),
    updatePlatformSettings: (data) => axiosInstance.put('/admin/settings/platform', data),
    getDeliveryFinanceSettings: () => axiosInstance.get('/admin/settings/delivery'),
    updateDeliveryFinanceSettings: (data) => axiosInstance.put('/admin/settings/delivery', data),
    getFinanceSummary: () => axiosInstance.get('/admin/finance/summary'),
    getFinanceLedger: (params) => axiosInstance.get('/admin/finance/ledger', { params }),
    getFinanceOrderEarnings: (params) => axiosInstance.get('/admin/finance/order-earnings', { params }),
    getCommissionSplitsReport: (params) => axiosInstance.get('/admin/finance/commission-splits', { params }),
    getFinancePayouts: (params) => axiosInstance.get('/admin/finance/payouts', { params }),
    processFinancePayouts: (data) => axiosInstance.post('/admin/finance/payouts/process', data),
    exportFinanceStatement: (params) =>
        axiosInstance.get('/admin/finance/export-statement', { params, responseType: 'blob' }),
    // Centralized settings (public GET, admin PUT)
    getSettings: () => axiosInstance.get('/settings'),
    updateSettings: (data) => axiosInstance.put('/settings', data),
    uploadSettingsImage: (formData, type = 'logo') =>
        axiosInstance.post(`/settings/upload?type=${type}`, formData),

    // Category Management
    getCategories: (params) => axiosInstance.get('/admin/categories', { params }),
    getCategoryTree: () => axiosInstance.get('/admin/categories?tree=true'),
    getSellers: (params) => axiosInstance.get('/admin/sellers', { params }),
    createCategory: (formData) => axiosInstance.post('/admin/categories', formData),
    updateCategory: (id, formData) => axiosInstance.put(`/admin/categories/${id}`, formData),
    deleteCategory: (id) => axiosInstance.delete(`/admin/categories/${id}`),
    seedMasterCategories: () => axiosInstance.post('/admin/categories/seed-master'),
    getParentUnits: () => axiosInstance.get('/admin/categories?flat=true'),

    // Product Management
    getProducts: (params) => axiosInstance.get('/products', { params }),
    getProductModerationList: (params) => axiosInstance.get('/products/moderation', { params }),
    approveProductModeration: (id, data = {}) => axiosInstance.patch(`/products/moderation/${id}/approve`, data),
    rejectProductModeration: (id, data = {}) => axiosInstance.patch(`/products/moderation/${id}/reject`, data),
    createProduct: (formData) => axiosInstance.post('/products', formData),
    updateProduct: (id, formData) => axiosInstance.put(`/products/${id}`, formData),
    deleteProduct: (id) => axiosInstance.delete(`/products/${id}`),
    getOrders: (params) => axiosInstance.get('/orders/seller-orders', { params }),
    getOrderDetails: (orderId) => axiosInstance.get(`/orders/details/${orderId}`),
    updateOrderStatus: (orderId, data) => axiosInstance.put(`/orders/status/${orderId}`, data),
    // Returns
    getReturns: (params) => axiosInstance.get('/orders/seller-returns', { params }),
    getReturnDetails: (orderId) => axiosInstance.get(`/orders/${orderId}/returns`),
    approveReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/approve`, data),
    rejectReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/reject`, data),
    assignReturnDelivery: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/assign-delivery`, data),
    updateReturnQc: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/qc`, data),

    // Support Tickets
    getTickets: (params) => axiosInstance.get('/tickets/admin/all', { params }),
    updateTicketStatus: (id, status) => axiosInstance.patch(`/tickets/admin/status/${id}`, { status }),
    replyTicket: (id, text, options = {}) => {
        const { mediaUrl = "", mediaType = "", mimeType = "" } = options || {};
        return axiosInstance.post(`/tickets/reply/${id}`, { text, isAdmin: true, mediaUrl, mediaType, mimeType });
    },
    getNotifications: () => axiosInstance.get('/notifications'),
    markNotificationRead: (id) => axiosInstance.put(`/notifications/${id}/read`),
    markAllNotificationsRead: () => axiosInstance.put('/notifications/mark-all-read'),
    broadcastNotification: (data) => axiosInstance.post('/notifications/broadcast', data),
    getBroadcastAudienceStats: () => axiosInstance.get('/notifications/broadcast/audience-stats'),
    getAuthActivityLogs: (params) => axiosInstance.get('/admin/auth-activity', { params }),

    // WhatsApp campaigns
    getWhatsAppConfigStatus: () => axiosInstance.get('/admin/whatsapp/config-status'),
    createWhatsAppCampaign: (data) => axiosInstance.post('/admin/whatsapp/campaigns', data),
    getWhatsAppCampaigns: (params) => axiosInstance.get('/admin/whatsapp/campaigns', { params }),
    getWhatsAppCampaign: (id) => axiosInstance.get(`/admin/whatsapp/campaigns/${id}`),
    cancelWhatsAppCampaign: (id) => axiosInstance.post(`/admin/whatsapp/campaigns/${id}/cancel`),
    getWhatsAppCampaignMessages: (id, params) => axiosInstance.get(`/admin/whatsapp/campaigns/${id}/messages`, { params }),
    getWhatsAppMessages: (params) => axiosInstance.get('/admin/whatsapp/messages', { params }),
    getWhatsAppTemplates: () => axiosInstance.get('/admin/whatsapp/templates'),
    updateWhatsAppTemplate: (messageType, data) => axiosInstance.put(`/admin/whatsapp/templates/${messageType}`, data),
    resetWhatsAppTemplate: (messageType) => axiosInstance.delete(`/admin/whatsapp/templates/${messageType}`),

    // Reviews
    // Delivery Partners
    getDeliveryPartners: (params) => axiosInstance.get('/admin/delivery-partners', { params }),
    updateDeliveryPartner: (id, data) => axiosInstance.put(`/admin/delivery-partners/${id}`, data),
    approveDeliveryPartner: (id) => axiosInstance.patch(`/admin/delivery-partners/approve/${id}`),
    rejectDeliveryPartner: (id) => axiosInstance.delete(`/admin/delivery-partners/reject/${id}`),
    getActiveFleet: (params) => axiosInstance.get('/admin/active-fleet', { params }),

    // Delivery Payouts / Funds
    getDeliveryTransactions: (params) => axiosInstance.get('/admin/delivery-transactions', { params }),
    settleTransaction: (id) => axiosInstance.put(`/admin/transactions/${id}/settle`),
    bulkSettleDelivery: () => axiosInstance.put('/admin/transactions/bulk-settle-delivery'),

    // Seller Withdrawals
    getSellerWithdrawals: (params) => axiosInstance.get('/admin/seller-withdrawals', { params }),
    getDeliveryWithdrawals: (params) => axiosInstance.get('/admin/delivery-withdrawals', { params }),
    getSellerTransactions: (params) => axiosInstance.get('/admin/seller-transactions', { params }),
    updateWithdrawalStatus: (id, data) => axiosInstance.put(`/admin/withdrawals/${id}`, data),
    // Cash Collection Hub
    getDeliveryCashBalances: (params) => axiosInstance.get('/admin/delivery-cash', { params }),
    getRiderCashDetails: (id) => axiosInstance.get(`/admin/rider-cash-details/${id}`),
    settleRiderCash: (data) => axiosInstance.post('/admin/settle-cash', data),
    getCashSettlementHistory: (params) => axiosInstance.get('/admin/cash-history', { params }),

    // FAQ Management
    getFAQs: (params) => axiosInstance.get('/admin/faqs', { params }),
    createFAQ: (data) => axiosInstance.post('/admin/faqs', data),
    updateFAQ: (id, data) => axiosInstance.put(`/admin/faqs/${id}`, data),
    deleteFAQ: (id) => axiosInstance.delete(`/admin/faqs/${id}`),
    // Public FAQs (for profile pages, etc.)
    getPublicFAQs: (params) => axiosInstance.get('/public/faqs', { params }),

    // Experience Studio / Content Manager
    getExperienceSections: (params) => axiosInstance.get('/admin/experience', { params }),
    createExperienceSection: (data) => axiosInstance.post('/admin/experience', data),
    updateExperienceSection: (id, data) => axiosInstance.put(`/admin/experience/${id}`, data),
    deleteExperienceSection: (id) => axiosInstance.delete(`/admin/experience/${id}`),
    reorderExperienceSections: (items) => axiosInstance.put('/admin/experience/reorder', { items }),
    uploadExperienceBanner: (formData) => axiosInstance.post('/admin/experience/upload-banner', formData),

    // Hero config (separate hero banners + categories per page)
    getHeroConfig: (params) => axiosInstance.get('/admin/experience/hero', { params }),
    setHeroConfig: (data) => axiosInstance.put('/admin/experience/hero', data),

    // Offers Management
    getOffers: (params) => axiosInstance.get('/admin-offers', { params }),
    createOffer: (data) => axiosInstance.post('/admin-offers', data),
    updateOffer: (id, data) => axiosInstance.put(`/admin-offers/${id}`, data),
    deleteOffer: (id) => axiosInstance.delete(`/admin-offers/${id}`),
    reorderOffers: (items) => axiosInstance.put('/admin-offers/reorder', { items }),

    // Offer Sections (category → products, banner + side image)
    getOfferSections: (params) => axiosInstance.get('/admin-offer-sections', { params }),
    createOfferSection: (data) => axiosInstance.post('/admin-offer-sections', data),
    updateOfferSection: (id, data) => axiosInstance.put(`/admin-offer-sections/${id}`, data),
    deleteOfferSection: (id) => axiosInstance.delete(`/admin-offer-sections/${id}`),
    reorderOfferSections: (items) => axiosInstance.put('/admin-offer-sections/reorder', { items }),

    // Coupons & Promos
    getCoupons: (params) => axiosInstance.get('/admin/coupons', { params }),
    createCoupon: (data) => axiosInstance.post('/admin/coupons', data),
    updateCoupon: (id, data) => axiosInstance.put(`/admin/coupons/${id}`, data),
    deleteCoupon: (id) => axiosInstance.delete(`/admin/coupons/${id}`),

    // Professional Ads & Categories Management
    getProfessionalCategories: () => axiosInstance.get('/admin/professionals/categories'),
    createProfessionalCategory: (data) => axiosInstance.post('/admin/professionals/categories', data),
    updateProfessionalCategory: (id, data) => axiosInstance.put(`/admin/professionals/categories/${id}`, data),
    deleteProfessionalCategory: (id) => axiosInstance.delete(`/admin/professionals/categories/${id}`),
    getProfessionalAds: (params) => axiosInstance.get('/admin/professionals/ads', { params }),
    approveProfessionalAd: (id) => axiosInstance.patch(`/admin/professionals/ads/${id}/approve`),
    rejectProfessionalAd: (id, data) => axiosInstance.patch(`/admin/professionals/ads/${id}/reject`, data),

    // Platform Ads Management
    getPlatformAds: (params) => axiosInstance.get('/admin/professionals/platform-ads', { params }),
    approvePlatformAd: (id) => axiosInstance.patch(`/admin/professionals/platform-ads/${id}/approve`),
    rejectPlatformAd: (id, data) => axiosInstance.patch(`/admin/professionals/platform-ads/${id}/reject`, data),

    // Sub-Admin Management
    // Payloads support: assignedZones, assignedCategories, categoryCommissionRate, allowedPermissions
    getSubadmins: () => axiosInstance.get('/admin/subadmins'),
    createSubadmin: (data) => axiosInstance.post('/admin/subadmins', data),
    updateSubadmin: (id, data) => axiosInstance.put(`/admin/subadmins/${id}`, data),
    deleteSubadmin: (id) => axiosInstance.delete(`/admin/subadmins/${id}`),
    getSubadminWallet: (id) => axiosInstance.get(`/admin/subadmins/${id}/wallet`),

    // Zone Management
    getZones: (params) => axiosInstance.get('/admin/zones', { params }),
    createZone: (data) => axiosInstance.post('/admin/zones', data),
    updateZone: (id, data) => axiosInstance.put(`/admin/zones/${id}`, data),
    deleteZone: (id) => axiosInstance.delete(`/admin/zones/${id}`),

    // Header Categories (for sub-admin category picker)
    getHeaderCategories: () => axiosInstance.get('/categories', { params: { type: 'header' } }),

    // Product Reviews
    getPendingReviews: (params) => axiosInstance.get('/reviews/admin/pending', { params }),
    updateReviewStatus: (id, data) => axiosInstance.patch(`/reviews/admin/status/${id}`, data),

    uploadMedia: (formData) => axiosInstance.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),

    // Seller Subscription Plans
    getSellerPlans: () => axiosInstance.get('/admin/seller-plans'),
    createSellerPlan: (data) => axiosInstance.post('/admin/seller-plans', data),
    updateSellerPlan: (id, data) => axiosInstance.put(`/admin/seller-plans/${id}`, data),
    deleteSellerPlan: (id) => axiosInstance.delete(`/admin/seller-plans/${id}`),
    assignSellerPlan: (sellerId, data) => axiosInstance.post(`/admin/sellers/${sellerId}/assign-plan`, data),

    // Store Promotion / Ads Management
    getAdminStorePromotionPlans: () => axiosInstance.get('/store-promotions/admin/plans'),
    createStorePromotionPlan: (data) => axiosInstance.post('/store-promotions/admin/plans', data),
    updateStorePromotionPlan: (id, data) => axiosInstance.put(`/store-promotions/admin/plans/${id}`, data),
    deleteStorePromotionPlan: (id) => axiosInstance.delete(`/store-promotions/admin/plans/${id}`),
    getAdminStorePromotionPurchases: () => axiosInstance.get('/store-promotions/admin/purchases'),
    updateStorePromotionCampaignStatus: (id, data) => axiosInstance.patch(`/store-promotions/admin/purchases/${id}/status`, data),
};
