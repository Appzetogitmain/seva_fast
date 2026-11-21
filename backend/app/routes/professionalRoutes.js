import express from "express";
import { verifyToken, optionalVerifyToken } from "../middleware/authMiddleware.js";
import { trackAdInteraction, getAdInteractionStats } from "../controller/adAnalyticsController.js";
import {
    createAd,
    getMyAd,
    updateMyAd,
    updateMyServices,
    payMyAd,
    searchAds,
    initiatePayMyAd,
    verifyPayMyAd
} from "../controller/professionalAdController.js";
import { getCategories } from "../controller/admin/professionalCategoryController.js";
import {
    createPlatformAd,
    updatePlatformAd,
    getMyPlatformAds,
    payPlatformAd,
    getActivePlatformAds,
    getPlatformAdById,
    initiatePayPlatformAd,
    verifyPayPlatformAd
} from "../controller/platformAdController.js";
import {
    getProviderReviews,
    checkCanReview,
    submitProviderReview,
    deleteProviderReview,
} from "../controller/professionalReviewController.js";

const router = express.Router();

// Public routes
router.get("/categories", getCategories);
router.get("/search", searchAds);
router.get("/platform-ads/active", getActivePlatformAds);
router.get("/platform-ads/:id", getPlatformAdById);

// Analytics tracking routes (Supports guest & logged-in users with 24-hr deduplication)
router.post("/track-interaction", optionalVerifyToken, trackAdInteraction);
router.get("/stats/:targetType/:targetId", optionalVerifyToken, getAdInteractionStats);

// Protected professional profile routes
router.post("/profile", verifyToken, createAd);
router.get("/profile", verifyToken, getMyAd);
router.put("/profile", verifyToken, updateMyAd);
router.put("/profile/services", verifyToken, updateMyServices);
router.post("/profile/pay", verifyToken, payMyAd);
router.post("/profile/pay/initiate", verifyToken, initiatePayMyAd);
router.post("/profile/pay/verify", verifyToken, verifyPayMyAd);

// Reviews & Dynamic Ratings (Verified Contact Model)
router.get("/:providerId/reviews", optionalVerifyToken, getProviderReviews);
router.get("/:providerId/can-review", optionalVerifyToken, checkCanReview);
router.post("/:providerId/reviews", verifyToken, submitProviderReview);
router.delete("/:providerId/reviews/:reviewId", verifyToken, deleteProviderReview);

// Separated Platform Ad Requests routes
router.post("/platform-ads", verifyToken, createPlatformAd);
router.put("/platform-ads/:id", verifyToken, updatePlatformAd);
router.get("/platform-ads", verifyToken, getMyPlatformAds);
router.post("/platform-ads/:id/pay", verifyToken, payPlatformAd);
router.post("/platform-ads/:id/pay/initiate", verifyToken, initiatePayPlatformAd);
router.post("/platform-ads/:id/pay/verify", verifyToken, verifyPayPlatformAd);

export default router;
