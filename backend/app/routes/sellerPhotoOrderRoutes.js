import express from "express";
import { 
    getReceivedPhotoOrders,
    updatePhotoOrderStatus,
    getChatMessages,
    sendChatMessage
} from "../controller/photoOrderController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken, allowRoles("seller"));
router.get("/", getReceivedPhotoOrders);
router.put("/:id/status", updatePhotoOrderStatus);
router.get("/:id/chat", getChatMessages);
router.post("/:id/chat", sendChatMessage);

export default router;
