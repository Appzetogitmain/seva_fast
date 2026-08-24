import express from "express";
import { handleAdminChat } from "../controller/adminAiController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import { aiRouteRateLimiter } from "../middleware/securityMiddlewares.js";

const router = express.Router();

router.post("/chat", verifyToken, allowRoles("admin", "sub-admin"), aiRouteRateLimiter, handleAdminChat);

export default router;
