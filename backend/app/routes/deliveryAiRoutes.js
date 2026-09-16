import express from "express";
import { handleDeliveryChat } from "../controller/deliveryAiController.js";
import { verifyToken, allowRoles, requireApprovedDelivery } from "../middleware/authMiddleware.js";
import { requireChatbotAccess } from "../middleware/chatbotAccessMiddleware.js";
import { aiRouteRateLimiter } from "../middleware/securityMiddlewares.js";

const router = express.Router();

router.post("/chat", verifyToken, allowRoles("delivery"), requireApprovedDelivery, requireChatbotAccess, aiRouteRateLimiter, handleDeliveryChat);

export default router;
