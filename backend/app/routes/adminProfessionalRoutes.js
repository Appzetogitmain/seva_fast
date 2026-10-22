import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory,
} from "../controller/admin/professionalCategoryController.js";
import {
    adminGetAds,
    adminApproveAd,
    adminRejectAd,
} from "../controller/professionalAdController.js";
import {
    adminGetPlatformAds,
    adminApprovePlatformAd,
    adminRejectPlatformAd,
} from "../controller/platformAdController.js";
import {
    adminGetAllReviews,
    adminModerateReview,
    adminDeleteReview,
} from "../controller/professionalReviewController.js";

const router = express.Router();

// Apply auth middleware to all admin professional routes
router.use(verifyToken);
router.use(allowRoles("admin"));

// Category management routes
router.get("/categories", getCategories);
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

// Advertisement moderation routes
router.get("/ads", adminGetAds);
router.patch("/ads/:id/approve", adminApproveAd);
router.patch("/ads/:id/reject", adminRejectAd);

// Separated Platform Ad moderation routes
router.get("/platform-ads", adminGetPlatformAds);
router.patch("/platform-ads/:id/approve", adminApprovePlatformAd);
router.patch("/platform-ads/:id/reject", adminRejectPlatformAd);

// Review moderation routes
router.get("/reviews", adminGetAllReviews);
router.patch("/reviews/:reviewId/status", adminModerateReview);
router.delete("/reviews/:reviewId", adminDeleteReview);

export default router;
