import express from "express";
import { 
    createPhotoOrder, 
    getMyPhotoOrders,
    getChatMessages,
    sendChatMessage,
    getSellersByCity
} from "../controller/photoOrderController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/sellers", getSellersByCity);

router.use(verifyToken, allowRoles("customer", "user"));
router.post("/", createPhotoOrder);
router.get("/", getMyPhotoOrders);
router.get("/:id/chat", getChatMessages);
router.post("/:id/chat", sendChatMessage);

export default router;
