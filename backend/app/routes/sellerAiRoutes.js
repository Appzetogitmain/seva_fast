import express from "express";
import { handleSellerChat } from "../controller/sellerAiController.js";
import { generateCatalogImage } from "../controller/imageAiController.js";
import { verifyToken, allowRoles, requireApprovedSeller } from "../middleware/authMiddleware.js";
import { requireChatbotAccess } from "../middleware/chatbotAccessMiddleware.js";
import { aiRouteRateLimiter } from "../middleware/securityMiddlewares.js";

const router = express.Router();

router.post("/chat", verifyToken, allowRoles("seller"), requireApprovedSeller, requireChatbotAccess, aiRouteRateLimiter, handleSellerChat);
router.post("/generate-image", verifyToken, allowRoles("seller"), requireApprovedSeller, aiRouteRateLimiter, generateCatalogImage);

export default router;
