import express from "express";
import { registerDemand, getSellerDemands } from "../controller/productDemandController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Customer route
router.post("/register", verifyToken, registerDemand);

// Seller route
router.get("/seller", verifyToken, allowRoles("seller"), getSellerDemands);

export default router;
