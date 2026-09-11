import express from "express";
import {
    getCart,
    addToCart,
    batchAddToCart,
    updateQuantity,
    removeFromCart,
    clearCart
} from "../controller/cartController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken);


router.get("/", getCart);
router.post("/add", addToCart);
router.post("/batch-add", batchAddToCart);
router.put("/update", updateQuantity);
router.delete("/remove/:productId", removeFromCart);
router.delete("/clear", clearCart);

export default router;
