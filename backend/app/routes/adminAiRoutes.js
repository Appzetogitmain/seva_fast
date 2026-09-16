import express from "express";
import { handleAdminChat } from "../controller/adminAiController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import { requireChatbotAccess } from "../middleware/chatbotAccessMiddleware.js";
import { aiRouteRateLimiter } from "../middleware/securityMiddlewares.js";

const router = express.Router();

router.post("/chat", verifyToken, allowRoles("admin", "sub-admin"), requireChatbotAccess, aiRouteRateLimiter, handleAdminChat);

export default router;
