import express from "express";
import {
    getProducts,
    getSellerProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    getModerationProducts,
    approveProduct,
    rejectProduct,
    downloadBulkProductTemplate,
    bulkUploadProducts,
} from "../controller/productController.js";
import { adjustStock, getStockHistory } from "../controller/stockController.js";
import { generateProductListing, generateListingFromImage } from "../controller/productAiController.js";
import { getSentimentIntelligence } from "../controller/reviewAiController.js";
import Product from "../models/product.js";
import Seller from "../models/seller.js";
import { loadSubadminZones, enforceZoneAccess } from "../middleware/zoneRestrictionMiddleware.js";
import {
    verifyToken,
    allowRoles,
    optionalVerifyToken,
    requireApprovedSeller,
} from "../middleware/authMiddleware.js";
import { aiRouteRateLimiter } from "../middleware/securityMiddlewares.js";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

const resolveProductZoneId = async (req) => {
  const productId = req.params.id;
  const product = await Product.findById(productId).lean();
  if (!product) return null;
  const seller = await Seller.findById(product.sellerId).select("zoneId").lean();
  return seller?.zoneId || null;
};

// Public routes with optional auth (to detect admin/seller vs customer)
router.get("/", optionalVerifyToken, getProducts);

// Seller protected routes
router.get("/seller/me", verifyToken, allowRoles("seller"), requireApprovedSeller, getSellerProducts);
router.get("/stock-history", verifyToken, allowRoles("seller"), requireApprovedSeller, getStockHistory);
router.post("/adjust-stock", verifyToken, allowRoles("seller"), requireApprovedSeller, adjustStock);
router.post(
  "/ai/generate-listing",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  aiRouteRateLimiter,
  generateProductListing
);
router.post(
  "/ai/generate-listing-from-image",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  aiRouteRateLimiter,
  generateListingFromImage
);
router.get(
  "/ai/sentiment-intelligence",
  verifyToken,
  allowRoles("seller", "admin"),
  requireApprovedSeller,
  aiRouteRateLimiter,
  getSentimentIntelligence
);
router.get(
  "/bulk/template",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  downloadBulkProductTemplate
);
router.post(
  "/bulk",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  upload.single("file"),
  bulkUploadProducts
);
router.get("/moderation", verifyToken, loadSubadminZones, allowRoles("admin"), getModerationProducts);
router.patch("/moderation/:id/approve", verifyToken, loadSubadminZones, enforceZoneAccess(resolveProductZoneId), allowRoles("admin"), approveProduct);
router.patch("/moderation/:id/reject", verifyToken, loadSubadminZones, enforceZoneAccess(resolveProductZoneId), allowRoles("admin"), rejectProduct);
router.get("/:id", optionalVerifyToken, getProductById);

router.post(
    "/",
    verifyToken,
    allowRoles("seller", "admin"),
    requireApprovedSeller,
    upload.any(),
    createProduct
);

router.put(
    "/:id",
    verifyToken,
    loadSubadminZones,
    enforceZoneAccess(resolveProductZoneId),
    allowRoles("seller", "admin"),
    requireApprovedSeller,
    upload.any(),
    updateProduct
);

router.delete(
    "/:id",
    verifyToken,
    loadSubadminZones,
    enforceZoneAccess(resolveProductZoneId),
    allowRoles("seller", "admin"),
    requireApprovedSeller,
    deleteProduct
);

export default router;
