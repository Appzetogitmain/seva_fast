import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
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
    initiatePayPlatformAd,
    verifyPayPlatformAd
} from "../controller/platformAdController.js";

const router = express.Router();

// Public routes
router.get("/categories", getCategories);
router.get("/search", searchAds);
router.get("/platform-ads/active", getActivePlatformAds);

// Protected professional profile routes
router.post("/profile", verifyToken, createAd);
router.get("/profile", verifyToken, getMyAd);
router.put("/profile", verifyToken, updateMyAd);
router.put("/profile/services", verifyToken, updateMyServices);
router.post("/profile/pay", verifyToken, payMyAd);
router.post("/profile/pay/initiate", verifyToken, initiatePayMyAd);
router.post("/profile/pay/verify", verifyToken, verifyPayMyAd);

// Separated Platform Ad Requests routes
router.post("/platform-ads", verifyToken, createPlatformAd);
router.put("/platform-ads/:id", verifyToken, updatePlatformAd);
router.get("/platform-ads", verifyToken, getMyPlatformAds);
router.post("/platform-ads/:id/pay", verifyToken, payPlatformAd);
router.post("/platform-ads/:id/pay/initiate", verifyToken, initiatePayPlatformAd);
router.post("/platform-ads/:id/pay/verify", verifyToken, verifyPayPlatformAd);

export default router;

