import express from "express";
import {
    createPromotionPlan,
    getAdminPromotionPlans,
    updatePromotionPlan,
    deletePromotionPlan,
    getAdminPromotionPurchases,
    updateCampaignStatus,
    getPublicPromotionPlans,
    initiatePromotionPurchase,
    verifyPromotionPurchase,
    payPromotionWithWallet,
    getSellerPromotions,
    getSellerPromotionStatus,
} from "../controller/storePromotionController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================================
   PUBLIC / SELLER PROMOTION ROUTES
 ========================================================= */
router.get("/public", getPublicPromotionPlans);
router.get("/seller/my-promotions", verifyToken, allowRoles("seller"), getSellerPromotions);
router.get("/seller/status", verifyToken, allowRoles("seller"), getSellerPromotionStatus);
router.post("/subscribe/initiate", verifyToken, allowRoles("seller"), initiatePromotionPurchase);
router.post("/subscribe/verify", verifyToken, allowRoles("seller"), verifyPromotionPurchase);
router.post("/subscribe/wallet", verifyToken, allowRoles("seller"), payPromotionWithWallet);

/* =========================================================
   ADMIN PROMOTION MANAGEMENT ROUTES
 ========================================================= */
router.get("/admin/plans", verifyToken, allowRoles("admin", "sub-admin"), getAdminPromotionPlans);
router.post("/admin/plans", verifyToken, allowRoles("admin", "sub-admin"), createPromotionPlan);
router.put("/admin/plans/:id", verifyToken, allowRoles("admin", "sub-admin"), updatePromotionPlan);
router.delete("/admin/plans/:id", verifyToken, allowRoles("admin", "sub-admin"), deletePromotionPlan);

router.get("/admin/purchases", verifyToken, allowRoles("admin", "sub-admin"), getAdminPromotionPurchases);
router.patch("/admin/purchases/:id/status", verifyToken, allowRoles("admin", "sub-admin"), updateCampaignStatus);

export default router;
