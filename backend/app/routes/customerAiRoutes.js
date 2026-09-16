import express from "express";
import {
  handleChat,
  handleVisualSearch,
  handleProcessShoppingList,
} from "../controller/customerAiController.js";
import { optionalVerifyToken } from "../middleware/authMiddleware.js";
import { requireChatbotAccess } from "../middleware/chatbotAccessMiddleware.js";
import { aiRouteRateLimiter } from "../middleware/securityMiddlewares.js";

const router = express.Router();

// Chat endpoint — stays reachable by logged-out shoppers (no verifyToken gate),
// but optionalVerifyToken attaches req.user when a customer token IS present so
// chatbot access-control/analytics can key off the real identity when known.
router.post("/chat", optionalVerifyToken, requireChatbotAccess, aiRouteRateLimiter, handleChat);

// Visual search endpoint
router.post("/visual-search", handleVisualSearch);

// Process shopping list (text or image)
router.post("/process-list", handleProcessShoppingList);

export default router;
