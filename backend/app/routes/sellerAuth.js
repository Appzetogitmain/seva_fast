import express from "express";
import {
    signupSeller,
    loginSeller,
    sendSellerSignupOtp,
    verifySellerSignupOtp,
    acceptSellerCertificate,
} from "../controller/sellerAuthController.js";
import { getSellerProfile, updateSellerProfile, requestWithdrawal, getNearbySellers, getSellerCodCashSummary, submitSellerCodCashToAdmin } from "../controller/sellerController.js";
import { getSellerStats, getSellerEarnings, getSellerProfitSummary } from "../controller/sellerStatsController.js";
import { getSellerWalletSummaryController } from "../controller/adminFinanceController.js";
import {
    getPublicSellerPlans,
    initiateSellerPlanPurchase,
    verifySellerPlanPurchase,
    getSellerSubscriptionStatus,
    switchToCategoryCommission,
} from "../controller/sellerPlanController.js";
import { verifyToken, allowRoles, requireApprovedSeller } from "../middleware/authMiddleware.js";
import {
    authRouteRateLimiter,
    createContentLengthGuard,
    otpRouteRateLimiter,
} from "../middleware/securityMiddlewares.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const sellerOtpPayloadGuard = createContentLengthGuard(
    parseInt(process.env.AUTH_MAX_PAYLOAD_BYTES || "16384", 10),
    "Verification payload too large",
);

router.post(
    "/verification/send-otp",
    authRouteRateLimiter,
    otpRouteRateLimiter,
    sellerOtpPayloadGuard,
    sendSellerSignupOtp
);
router.post(
    "/verification/verify-otp",
    authRouteRateLimiter,
    otpRouteRateLimiter,
    sellerOtpPayloadGuard,
    verifySellerSignupOtp
);

router.post(
    "/signup",
    upload.any(),
    signupSeller
);
router.post("/login", loginSeller);
router.get("/nearby", getNearbySellers);

// Profile routes
router.get(
    "/profile",
    verifyToken,
    allowRoles("seller"),
    getSellerProfile
);

router.put(
    "/profile",
    verifyToken,
    allowRoles("seller"),
    updateSellerProfile
);

router.post(
    "/accept-certificate",
    verifyToken,
    allowRoles("seller"),
    acceptSellerCertificate
);

// Analytics & Financials
router.get("/stats", verifyToken, allowRoles("seller"), getSellerStats);
router.get("/earnings", verifyToken, allowRoles("seller"), getSellerEarnings);
router.get("/profit-summary", verifyToken, allowRoles("seller"), getSellerProfitSummary);
router.get("/wallet/summary", verifyToken, allowRoles("seller"), getSellerWalletSummaryController);
router.post("/request-withdrawal", verifyToken, allowRoles("seller"), requestWithdrawal);

router.get(
  "/cod/summary",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  getSellerCodCashSummary,
);
router.post(
  "/cod/pay",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  submitSellerCodCashToAdmin,
);

// Seller Subscription Plan routes
router.get("/plans", getPublicSellerPlans);
router.post("/plans/subscribe/initiate", verifyToken, allowRoles("seller"), initiateSellerPlanPurchase);
router.post("/plans/subscribe/verify", verifyToken, allowRoles("seller"), verifySellerPlanPurchase);
router.get("/subscription-status", verifyToken, allowRoles("seller"), getSellerSubscriptionStatus);
router.post("/switch-to-commission", verifyToken, allowRoles("seller"), switchToCategoryCommission);

export default router;
