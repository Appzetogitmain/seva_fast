import express from "express";
import {
  signupDelivery,
  loginDelivery,
  verifyDeliveryOTP,
  getDeliveryProfile,
  updateDeliveryProfile,
} from "../controller/deliveryAuthController.js";
import {
  getDeliveryStats,
  getDeliveryEarnings,
  getDeliveryCodCashSummary,
  submitDeliveryCodCashToAdmin,
  getMyDeliveryOrders,
  requestWithdrawal,
  updateDeliveryLocation,
  generateDeliveryOtp,
  validateDeliveryOtp,
} from "../controller/deliveryController.js";
import { getRiderWalletSummaryController } from "../controller/adminFinanceController.js";

import { verifyToken, allowRoles, requireApprovedDelivery } from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/send-signup-otp",
  upload.any(),
  signupDelivery,
);
router.post("/send-login-otp", loginDelivery);
router.post("/verify-otp", verifyDeliveryOTP);

// Profile routes
router.get("/profile", verifyToken, getDeliveryProfile);
router.put("/profile", verifyToken, updateDeliveryProfile);
router.get("/stats", verifyToken, requireApprovedDelivery, getDeliveryStats);
router.get("/earnings", verifyToken, requireApprovedDelivery, getDeliveryEarnings);
router.get("/cod/summary", verifyToken, allowRoles("delivery"), requireApprovedDelivery, getDeliveryCodCashSummary);
router.post("/cod/pay", verifyToken, allowRoles("delivery"), requireApprovedDelivery, submitDeliveryCodCashToAdmin);
router.get("/wallet/summary", verifyToken, allowRoles("delivery"), requireApprovedDelivery, getRiderWalletSummaryController);
router.get(
  "/order-history",
  verifyToken,
  allowRoles("delivery"),
  requireApprovedDelivery,
  getMyDeliveryOrders,
);
router.post("/request-withdrawal", verifyToken, requireApprovedDelivery, requestWithdrawal);
router.post("/location", verifyToken, requireApprovedDelivery, updateDeliveryLocation);

// OTP generation for delivery completion
router.post(
  "/orders/:orderId/generate-otp",
  verifyToken,
  allowRoles("delivery", "admin"),
  requireApprovedDelivery,
  generateDeliveryOtp
);

// OTP validation for delivery completion
router.post(
  "/orders/:orderId/validate-otp",
  verifyToken,
  allowRoles("delivery", "admin"),
  requireApprovedDelivery,
  validateDeliveryOtp
);

export default router;
