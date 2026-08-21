import express from "express";
import multer from "multer";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }
});
import {
    bootstrapAdmin,
    signupAdmin,
    loginAdmin,
} from "../controller/adminAuthController.js";
import {
    getAdminProfile,
    updateAdminProfile,
    updateAdminPassword,
    getAdminStats,
    getDeliveryPartners,
    approveDeliveryPartner,
    rejectDeliveryPartner,
    updateDeliveryPartner,
    getActiveFleet,
    getAdminWalletData,
    getDeliveryTransactions,
    settleTransaction,
    bulkSettleDelivery,
    getActiveSellers,
    getPendingSellers,
    approveSellerApplication,
    rejectSellerApplication,
    uploadSellerKycDocument,
    getSellerWithdrawals,
    getDeliveryWithdrawals,
    updateWithdrawalStatus,
    getSellerTransactions,
    getDeliveryCashBalances,
    getRiderCashDetails,
    settleRiderCash,
    getCashSettlementHistory,
    getUsers,
    getUserById,
    updateUserWallet,
    getUserReferralTree,
    getSellers,
    getSellerLocations,
    getPlatformSettings,
    updatePlatformSettings,
    updateSellerDetails,
    deleteSeller,
    getZones,
    createZone,
    updateZone,
    deleteZone,
    getSubadmins,
    createSubadmin,
    updateSubadmin,
    deleteSubadmin,
    getSubadminWalletController,
} from "../controller/adminController.js";
import {
    createSellerPlan,
    getAdminSellerPlans,
    updateSellerPlan,
    deleteSellerPlan,
    assignSellerPlanToSeller,
} from "../controller/sellerPlanController.js";
import { getAdminPhotoOrders, getAdminPhotoOrderChat, toggleAdminPhotoOrderChat } from "../controller/photoOrderController.js";
import { getAuthActivityLogs } from "../controller/authActivityController.js";
import {
    exportAdminFinanceStatementController,
    getAdminFinanceLedgerController,
    getAdminFinancePayoutsController,
    getAdminFinanceSummaryController,
    getAdminOrderEarningsController,
    getCodPartnerBreakdownController,
    getCommissionSplitsReportController,
    getDeliverySettingsController,
    processAdminFinancePayoutsController,
    updateDeliverySettingsController,
} from "../controller/adminFinanceController.js";

import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import { loadSubadminZones } from "../middleware/zoneRestrictionMiddleware.js";
import {
    adminBootstrapRateLimiter,
    authRouteRateLimiter,
    createContentLengthGuard,
} from "../middleware/securityMiddlewares.js";

const router = express.Router();

const smallAdminPayload = createContentLengthGuard(
    parseInt(process.env.ADMIN_AUTH_MAX_PAYLOAD_BYTES || "20480", 10),
    "Admin auth payload too large",
);
router.post("/bootstrap", adminBootstrapRateLimiter, smallAdminPayload, bootstrapAdmin);
router.post("/signup", adminBootstrapRateLimiter, smallAdminPayload, signupAdmin);
router.post("/login", authRouteRateLimiter, smallAdminPayload, loginAdmin);

router.use(verifyToken);
router.use(loadSubadminZones);

// Profile routes
router.get(
    "/profile",
    verifyToken,
    allowRoles("admin"),
    getAdminProfile
);

router.put(
    "/profile",
    verifyToken,
    allowRoles("admin"),
    updateAdminProfile
);

router.put(
    "/profile/password",
    verifyToken,
    allowRoles("admin"),
    updateAdminPassword
);

router.get(
    "/stats",
    verifyToken,
    allowRoles("admin"),
    getAdminStats
);
router.get(
    "/finance/summary",
    verifyToken,
    allowRoles("admin"),
    getAdminFinanceSummaryController,
);
router.get(
    "/finance/cod-partners",
    verifyToken,
    allowRoles("admin"),
    getCodPartnerBreakdownController,
);
router.get(
    "/finance/ledger",
    verifyToken,
    allowRoles("admin"),
    getAdminFinanceLedgerController,
);
router.get(
    "/finance/order-earnings",
    verifyToken,
    allowRoles("admin"),
    getAdminOrderEarningsController,
);
router.get(
    "/finance/commission-splits",
    verifyToken,
    allowRoles("admin"),
    getCommissionSplitsReportController,
);
router.get(
    "/finance/payouts",
    verifyToken,
    allowRoles("admin"),
    getAdminFinancePayoutsController,
);
router.post(
    "/finance/payouts/process",
    verifyToken,
    allowRoles("admin"),
    processAdminFinancePayoutsController,
);
router.get(
    "/finance/export-statement",
    verifyToken,
    allowRoles("admin"),
    exportAdminFinanceStatementController,
);
router.get(
    "/settings/platform",
    verifyToken,
    allowRoles("admin"),
    getPlatformSettings
);
router.get(
    "/settings/delivery",
    verifyToken,
    allowRoles("admin"),
    getDeliverySettingsController,
);
router.put(
    "/settings/delivery",
    verifyToken,
    allowRoles("admin"),
    updateDeliverySettingsController,
);
router.put(
    "/settings/platform",
    verifyToken,
    allowRoles("admin"),
    updatePlatformSettings
);
router.get("/users", verifyToken, allowRoles("admin"), getUsers);
router.get("/users/:id", verifyToken, allowRoles("admin"), getUserById);
router.get("/users/:id/referral-tree", verifyToken, allowRoles("admin"), getUserReferralTree);
router.put("/users/:id/wallet", verifyToken, allowRoles("admin"), updateUserWallet);
router.get("/sellers", verifyToken, allowRoles("admin"), getSellers);
router.get("/sellers/locations", verifyToken, allowRoles("admin"), getSellerLocations);
router.get("/sellers/active", verifyToken, allowRoles("admin"), getActiveSellers);
router.get("/sellers/pending", verifyToken, allowRoles("admin"), getPendingSellers);
router.patch("/sellers/approve/:id", verifyToken, allowRoles("admin"), approveSellerApplication);
router.delete("/sellers/reject/:id", verifyToken, allowRoles("admin"), rejectSellerApplication);
router.post("/sellers/:id/kyc-document", verifyToken, allowRoles("admin", "sub-admin"), upload.single("kycDocument"), uploadSellerKycDocument);
router.put("/sellers/:id", verifyToken, allowRoles("admin", "sub-admin"), updateSellerDetails);
router.delete("/sellers/:id", verifyToken, allowRoles("admin"), deleteSeller);

// Seller Subscription Plans (Admin)
router.post("/seller-plans", verifyToken, allowRoles("admin"), createSellerPlan);
router.get("/seller-plans", verifyToken, allowRoles("admin"), getAdminSellerPlans);
router.put("/seller-plans/:id", verifyToken, allowRoles("admin"), updateSellerPlan);
router.delete("/seller-plans/:id", verifyToken, allowRoles("admin"), deleteSellerPlan);
router.post("/sellers/:id/assign-plan", verifyToken, allowRoles("admin"), assignSellerPlanToSeller);

// Custom Photo Orders (Admin & Sub-Admin)
router.get("/photo-orders", verifyToken, allowRoles("admin", "sub-admin"), getAdminPhotoOrders);
router.get("/photo-orders/:id/chat", verifyToken, allowRoles("admin", "sub-admin"), getAdminPhotoOrderChat);
router.patch("/photo-orders/:id/toggle-chat", verifyToken, allowRoles("admin", "sub-admin"), toggleAdminPhotoOrderChat);

router.get(
    "/delivery-partners",
    verifyToken,
    allowRoles("admin"),
    getDeliveryPartners
);

router.put(
    "/delivery-partners/:id",
    verifyToken,
    allowRoles("admin"),
    updateDeliveryPartner
);

router.patch(
    "/delivery-partners/approve/:id",
    verifyToken,
    allowRoles("admin"),
    approveDeliveryPartner
);

router.delete(
    "/delivery-partners/reject/:id",
    verifyToken,
    allowRoles("admin"),
    rejectDeliveryPartner
);

// Active fleet stays seller-accessible: it's order tracking scoped by order.seller,
// not rider roster management (riders are platform-owned, managed by admin only).
router.get("/active-fleet", verifyToken, allowRoles("admin", "seller"), getActiveFleet);
router.get("/wallet-data", verifyToken, allowRoles("admin"), getAdminWalletData);

// Delivery Payouts / Funds
router.get("/delivery-transactions", verifyToken, allowRoles("admin"), getDeliveryTransactions);
router.put("/transactions/:id/settle", verifyToken, allowRoles("admin"), settleTransaction);
router.put("/transactions/bulk-settle-delivery", verifyToken, allowRoles("admin"), bulkSettleDelivery);

// Cash Collection Hub
router.get("/delivery-cash", verifyToken, allowRoles("admin"), getDeliveryCashBalances);
router.get("/rider-cash-details/:id", verifyToken, allowRoles("admin"), getRiderCashDetails);
router.post("/settle-cash", verifyToken, allowRoles("admin"), settleRiderCash);
router.get("/cash-history", verifyToken, allowRoles("admin"), getCashSettlementHistory);

// Seller Withdrawal Management
router.get("/seller-withdrawals", verifyToken, allowRoles("admin"), getSellerWithdrawals);
router.get("/delivery-withdrawals", verifyToken, allowRoles("admin"), getDeliveryWithdrawals);
router.get("/seller-transactions", verifyToken, allowRoles("admin"), getSellerTransactions);
router.put("/withdrawals/:id", verifyToken, allowRoles("admin"), updateWithdrawalStatus);

// Zone Management
router.get("/zones", verifyToken, allowRoles("admin", "sub-admin"), getZones);
router.post("/zones", verifyToken, allowRoles("admin"), createZone);
router.put("/zones/:id", verifyToken, allowRoles("admin"), updateZone);
router.delete("/zones/:id", verifyToken, allowRoles("admin"), deleteZone);

// Sub-Admin Management
router.get("/subadmins", verifyToken, allowRoles("admin"), getSubadmins);
router.post("/subadmins", verifyToken, allowRoles("admin"), createSubadmin);
router.put("/subadmins/:id", verifyToken, allowRoles("admin"), updateSubadmin);
router.delete("/subadmins/:id", verifyToken, allowRoles("admin"), deleteSubadmin);
router.get("/subadmins/:id/wallet", verifyToken, allowRoles("admin"), getSubadminWalletController);

router.get(
    "/auth-activity",
    verifyToken,
    allowRoles("admin", "sub-admin"),
    getAuthActivityLogs,
);

// Protected admin route example
router.get(
    "/dashboard",
    verifyToken,
    allowRoles("admin", "sub-admin"),
    (req, res) => {
        res.json({
            success: true,
            message: "Welcome to Admin Dashboard",
        });
    }
);

export default router;
