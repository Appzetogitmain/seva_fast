import express from "express";
import { handleSellerChat } from "../controller/sellerAiController.js";
import { verifyToken, allowRoles, requireApprovedSeller } from "../middleware/authMiddleware.js";
import { aiRouteRateLimiter } from "../middleware/securityMiddlewares.js";

const router = express.Router();

router.post("/chat", verifyToken, allowRoles("seller"), requireApprovedSeller, aiRouteRateLimiter, handleSellerChat);

export default router;
